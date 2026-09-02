alter table public.bookings
add column confirmed_at timestamptz;

update public.bookings
set confirmed_at = status_updated_at
where status in ('confirmed', 'completed');

drop index if exists public.bookings_reserved_overlap_idx;

create index bookings_confirmed_overlap_idx
on public.bookings (room_type_id, arrival_date, departure_date)
where status = 'confirmed';

create index bookings_confirmed_earnings_idx
on public.bookings (confirmed_at desc)
where status in ('confirmed', 'completed');

create or replace function public.set_booking_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_updated_at := now();
    if new.status = 'confirmed' then
      new.confirmed_at := now();
    elsif new.status = 'completed' and new.confirmed_at is null then
      new.confirmed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_confirmed_booking_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total_units integer;
  v_reserved_units integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  perform pg_advisory_xact_lock(new.room_type_id);

  select total_units
  into v_total_units
  from public.room_types
  where id = new.room_type_id
    and is_active;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ROOM_NOT_AVAILABLE';
  end if;

  select count(*)::integer
  into v_reserved_units
  from public.bookings as b
  where b.room_type_id = new.room_type_id
    and b.id <> new.id
    and b.status = 'confirmed'
    and b.arrival_date < new.departure_date
    and b.departure_date > new.arrival_date;

  if v_reserved_units >= v_total_units then
    raise exception using
      errcode = 'P0001',
      message = 'ROOM_SOLD_OUT';
  end if;

  if new.confirmed_at is null then
    new.confirmed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_confirmed_capacity on public.bookings;
create trigger bookings_enforce_confirmed_capacity
before insert or update of room_type_id, arrival_date, departure_date, status
on public.bookings
for each row execute function public.enforce_confirmed_booking_capacity();

create or replace function public.create_booking_request(
  p_room_type_id bigint,
  p_guest_first_name text,
  p_guest_last_name text,
  p_guest_email text,
  p_guest_phone text,
  p_arrival_date date,
  p_departure_date date
)
returns table (
  booking_confirmation_code text,
  booking_status text,
  booked_nightly_rate numeric,
  booking_total_amount numeric,
  booking_currency text,
  remaining_units integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.room_types%rowtype;
  v_reserved integer;
  v_confirmation text;
  v_total numeric(12, 2);
  v_attempt integer := 0;
begin
  if p_arrival_date is null
    or p_departure_date is null
    or p_departure_date <= p_arrival_date
    or p_arrival_date < current_date then
    raise exception using
      errcode = '22023',
      message = 'INVALID_STAY_DATES';
  end if;

  if btrim(coalesce(p_guest_first_name, '')) = ''
    or btrim(coalesce(p_guest_last_name, '')) = ''
    or btrim(coalesce(p_guest_email, '')) = ''
    or btrim(coalesce(p_guest_phone, '')) = '' then
    raise exception using
      errcode = '22023',
      message = 'INVALID_GUEST_DETAILS';
  end if;

  perform pg_advisory_xact_lock(p_room_type_id);

  select *
  into v_room
  from public.room_types
  where id = p_room_type_id
    and is_active;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ROOM_NOT_AVAILABLE';
  end if;

  select count(*)::integer
  into v_reserved
  from public.bookings as b
  where b.room_type_id = p_room_type_id
    and b.status = 'confirmed'
    and b.arrival_date < p_departure_date
    and b.departure_date > p_arrival_date;

  if v_reserved >= v_room.total_units then
    raise exception using
      errcode = 'P0001',
      message = 'ROOM_SOLD_OUT';
  end if;

  v_total := v_room.nightly_rate * (p_departure_date - p_arrival_date);

  loop
    v_attempt := v_attempt + 1;
    v_confirmation := 'NYK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    begin
      insert into public.bookings (
        confirmation_code,
        room_type_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        arrival_date,
        departure_date,
        status,
        nightly_rate,
        total_amount,
        currency
      )
      values (
        v_confirmation,
        v_room.id,
        btrim(p_guest_first_name),
        btrim(p_guest_last_name),
        lower(btrim(p_guest_email)),
        btrim(p_guest_phone),
        p_arrival_date,
        p_departure_date,
        'pending',
        v_room.nightly_rate,
        v_total,
        v_room.currency
      );
      exit;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  return query
  select
    v_confirmation,
    'pending'::text,
    v_room.nightly_rate,
    v_total,
    v_room.currency,
    v_room.total_units - v_reserved;
end;
$$;

create or replace function public.get_room_availability(
  p_arrival_date date,
  p_departure_date date
)
returns table (
  room_type_id bigint,
  reserved_units integer,
  available_units integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    count(b.id)::integer,
    greatest(r.total_units - count(b.id)::integer, 0)
  from public.room_types as r
  left join public.bookings as b
    on b.room_type_id = r.id
   and b.status = 'confirmed'
   and b.arrival_date < p_departure_date
   and b.departure_date > p_arrival_date
  where r.is_active
    and p_arrival_date is not null
    and p_departure_date is not null
    and p_departure_date > p_arrival_date
  group by r.id, r.total_units;
$$;

revoke all on function public.enforce_confirmed_booking_capacity()
from public, anon, authenticated;

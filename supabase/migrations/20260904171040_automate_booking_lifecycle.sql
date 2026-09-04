create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;

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
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.force_new_booking_pending()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.status := 'pending';
  new.confirmed_at := null;
  return new;
end;
$$;

drop trigger if exists bookings_00_force_pending_on_insert on public.bookings;
create trigger bookings_00_force_pending_on_insert
before insert on public.bookings
for each row execute function private.force_new_booking_pending();

create index if not exists bookings_open_departure_idx
on public.bookings (departure_date)
where status in ('pending', 'confirmed');

create or replace function private.advance_booking_lifecycle(
  p_today date default timezone('Africa/Kampala', statement_timestamp())::date
)
returns table (
  completed_count bigint,
  cancelled_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_completed_count bigint;
  v_cancelled_count bigint;
begin
  with completed as (
    update public.bookings
    set status = 'completed'
    where status = 'confirmed'
      and departure_date <= p_today
    returning id
  )
  select count(*) into v_completed_count from completed;

  with cancelled as (
    update public.bookings
    set status = 'cancelled'
    where status = 'pending'
      and departure_date <= p_today
    returning id
  )
  select count(*) into v_cancelled_count from cancelled;

  return query select v_completed_count, v_cancelled_count;
end;
$$;

revoke all on function private.force_new_booking_pending()
from public, anon, authenticated;
revoke all on function private.advance_booking_lifecycle(date)
from public, anon, authenticated;

do $$
declare
  v_existing_job record;
begin
  for v_existing_job in
    select jobid from cron.job where jobname = 'advance-booking-lifecycle'
  loop
    perform cron.unschedule(v_existing_job.jobid);
  end loop;

  perform cron.schedule(
    'advance-booking-lifecycle',
    '5 * * * *',
    'select private.advance_booking_lifecycle();'
  );
end;
$$;

select * from private.advance_booking_lifecycle();

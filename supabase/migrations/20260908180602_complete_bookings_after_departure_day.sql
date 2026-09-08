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
      and departure_date < p_today
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

revoke all on function private.advance_booking_lifecycle(date)
from public, anon, authenticated;

update public.bookings
set status = 'confirmed'
where status = 'completed'
  and departure_date >= timezone('Africa/Kampala', statement_timestamp())::date;

drop policy "active room types are publicly readable" on public.room_types;
drop policy "admins manage room types" on public.room_types;

create policy "active room types are anonymously readable"
on public.room_types
for select
to anon
using (is_active);

create policy "authenticated users read permitted room types"
on public.room_types
for select
to authenticated
using (is_active or (select public.is_admin()));

create policy "admins create room types"
on public.room_types
for insert
to authenticated
with check ((select public.is_admin()));

create policy "admins update room types"
on public.room_types
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke delete on table public.room_types from authenticated;

drop policy "active room images are publicly readable" on public.room_images;
drop policy "admins manage room images" on public.room_images;

create policy "active room images are anonymously readable"
on public.room_images
for select
to anon
using (
  exists (
    select 1
    from public.room_types
    where room_types.id = room_images.room_type_id
      and room_types.is_active
  )
);

create policy "authenticated users read permitted room images"
on public.room_images
for select
to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.room_types
    where room_types.id = room_images.room_type_id
      and room_types.is_active
  )
);

create policy "admins create room images"
on public.room_images
for insert
to authenticated
with check ((select public.is_admin()));

create policy "admins update room images"
on public.room_images
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "admins delete room images"
on public.room_images
for delete
to authenticated
using ((select public.is_admin()));

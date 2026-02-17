-- 1. Create the bucket
insert into storage.buckets (id, name, public)
values ('activity-photos', 'activity-photos', true)
on conflict (id) do nothing;

-- 2. Allow public access to read photos (or restricted to authenticated if preferred)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'activity-photos' );

-- 3. Allow authenticated users to upload photos
create policy "Authenticated Upload"
on storage.objects for insert
with check (
  bucket_id = 'activity-photos' 
  AND auth.role() = 'authenticated'
);

-- 4. Allow users to delete their own photos
create policy "Individual Delete"
on storage.objects for delete
using (
  bucket_id = 'activity-photos'
  AND auth.uid() = owner
);

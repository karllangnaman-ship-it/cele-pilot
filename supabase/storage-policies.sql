-- This bucket remains private. All browser traffic is routed through the Vercel
-- API using a service-role key after Firebase ID-token verification.
insert into storage.buckets (id, name, public)
values ('cele-pilot', 'cele-pilot', false)
on conflict (id) do update set public = false;

-- Do not grant anon/authenticated roles direct access. The Vercel API is the
-- only storage client and enforces users/{firebaseUid}/ path ownership.
revoke all on storage.objects from anon, authenticated;

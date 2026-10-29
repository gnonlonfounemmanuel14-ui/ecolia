-- ECOLIA · Backend 5/6 : stockage des photos du personnel et des fichiers d'annonces
-- À exécuter UNE fois.
-- Chemins attendus :  staff-photos/<id_ecole>/<id_personnel>.jpg
--                     announcement-files/<id_ecole>/<id_annonce>/<nom_du_fichier>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('staff-photos', 'staff-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('announcement-files', 'announcement-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Photos du personnel : lues par les membres de l'école, écrites par la direction
create policy "photos personnel : lecture" on storage.objects
  for select to authenticated using (
    bucket_id = 'staff-photos'
    and (public.is_school_member(public.safe_uuid((storage.foldername(name))[1])) or public.is_platform_admin())
  );
create policy "photos personnel : ajout" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'staff-photos'
    and (public.is_school_staff(public.safe_uuid((storage.foldername(name))[1])) or public.is_platform_admin())
  );
create policy "photos personnel : modification" on storage.objects
  for update to authenticated using (
    bucket_id = 'staff-photos'
    and (public.is_school_staff(public.safe_uuid((storage.foldername(name))[1])) or public.is_platform_admin())
  );
create policy "photos personnel : suppression" on storage.objects
  for delete to authenticated using (
    bucket_id = 'staff-photos'
    and (public.is_school_staff(public.safe_uuid((storage.foldername(name))[1])) or public.is_platform_admin())
  );

-- Fichiers d'annonces : lisibles par ceux qui peuvent voir l'annonce, ajoutés par son auteur ou la direction
create policy "fichiers annonces : lecture" on storage.objects
  for select to authenticated using (
    bucket_id = 'announcement-files'
    and (
      public.is_platform_admin()
      or exists (select 1 from public.announcements a
                 where a.id = public.safe_uuid((storage.foldername(name))[2]))
    )
  );
create policy "fichiers annonces : ajout" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'announcement-files'
    and exists (select 1 from public.announcements a
                where a.id = public.safe_uuid((storage.foldername(name))[2])
                  and (a.author_id = auth.uid() or public.is_school_staff(a.school_id)))
  );
create policy "fichiers annonces : suppression" on storage.objects
  for delete to authenticated using (
    bucket_id = 'announcement-files'
    and exists (select 1 from public.announcements a
                where a.id = public.safe_uuid((storage.foldername(name))[2])
                  and (a.author_id = auth.uid() or public.is_school_staff(a.school_id)))
  );

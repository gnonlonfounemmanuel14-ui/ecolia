-- ECOLIA · Phase 1b : formulaire de contact + rattrapage des profils
-- À exécuter UNE fois, après le script de la phase 1.

-- 1. Messages du formulaire de contact (tout le monde peut écrire, seul l'admin plateforme lit)
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  school text check (char_length(school) <= 120),
  topic text check (char_length(topic) <= 80),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

create policy "contact : tout le monde peut écrire" on public.contact_messages
  for insert to anon, authenticated with check (true);
create policy "contact : admin plateforme lit" on public.contact_messages
  for select to authenticated using (public.is_platform_admin());

-- 2. Profils des comptes créés avant l'installation du déclencheur (s'il y en a)
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
from auth.users u
on conflict (id) do nothing;

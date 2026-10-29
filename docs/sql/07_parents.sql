-- ECOLIA · Backend 7 : liste des parents d'un élève (nom, e-mail) pour la direction
-- À exécuter UNE fois.
create or replace function public.student_guardians_info(p_student uuid)
returns table (parent_user_id uuid, full_name text, email text, relation text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.students s
    where s.id = p_student and (public.is_school_staff(s.school_id) or public.is_platform_admin())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select g.parent_user_id, pr.full_name, pr.email, g.relation
  from public.student_guardians g
  left join public.profiles pr on pr.id = g.parent_user_id
  where g.student_id = p_student;
end;
$$;
revoke all on function public.student_guardians_info(uuid) from public, anon;
grant execute on function public.student_guardians_info(uuid) to authenticated;

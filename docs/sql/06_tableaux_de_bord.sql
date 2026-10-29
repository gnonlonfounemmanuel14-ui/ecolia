-- ECOLIA · Backend 6/6 : suspension d'école, données des tableaux de bord, administration
-- À exécuter UNE fois.

-- 1. Une école suspendue perd l'accès de ses membres
create or replace function public.is_school_member(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_members m join public.schools s on s.id = m.school_id
    where m.school_id = p_school and m.user_id = auth.uid() and s.status = 'active'
  );
$$;
create or replace function public.is_school_staff(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_members m join public.schools s on s.id = m.school_id
    where m.school_id = p_school and m.user_id = auth.uid()
      and m.role in ('director', 'admin') and s.status = 'active'
  );
$$;

-- 2. État du compte (enrichi : identifiant, nom et statut de l'école)
create or replace function public.get_my_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.full_name,
    'email', p.email,
    'hasSchool', exists (select 1 from public.school_members m where m.user_id = p.id),
    'role', (select m.role from public.school_members m where m.user_id = p.id order by m.created_at limit 1),
    'schoolId', (select m.school_id from public.school_members m where m.user_id = p.id order by m.created_at limit 1),
    'schoolName', (select s.name from public.school_members m join public.schools s on s.id = m.school_id
                   where m.user_id = p.id order by m.created_at limit 1),
    'schoolStatus', (select s.status from public.school_members m join public.schools s on s.id = m.school_id
                     where m.user_id = p.id order by m.created_at limit 1),
    'plan', (
      select sub.plan_id from public.subscriptions sub
      join public.school_members m on m.school_id = sub.school_id
      where m.user_id = p.id and sub.status = 'active' limit 1
    ),
    'platformAdmin', public.is_platform_admin()
  )
  from public.profiles p where p.id = auth.uid();
$$;

-- 3. Tableau de bord de la direction (chiffres et séries pour les graphiques)
create or replace function public.director_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid;
begin
  select m.school_id into v_school
  from public.school_members m join public.schools s on s.id = m.school_id
  where m.user_id = auth.uid() and m.role in ('director', 'admin') and s.status = 'active'
  order by m.created_at limit 1;
  if v_school is null then raise exception 'forbidden' using errcode = '42501'; end if;

  return jsonb_build_object(
    'school', (select jsonb_build_object('id', s.id, 'name', s.name, 'whatsapp', s.parent_whatsapp_url)
               from public.schools s where s.id = v_school),
    'plan', (select jsonb_build_object('id', p.id, 'name', p.name, 'limit', p.student_limit,
                                       'periodEnd', sub.current_period_end)
             from public.subscriptions sub join public.plans p on p.id = sub.plan_id
             where sub.school_id = v_school and sub.status = 'active'),
    'counts', jsonb_build_object(
      'students', (select count(*) from public.students where school_id = v_school and status = 'active'),
      'staff', (select count(*) from public.staff where school_id = v_school and status = 'active'),
      'classes', (select count(*) from public.classes where school_id = v_school)
    ),
    'finance', (select jsonb_build_object(
                  'due', coalesce(sum(b.due_fcfa), 0),
                  'paid', coalesce(sum(b.paid_fcfa), 0),
                  'remaining', coalesce(sum(b.remaining_fcfa), 0))
                from public.student_balances b where b.school_id = v_school),
    'studentsByClass', coalesce((
      select jsonb_agg(jsonb_build_object('class', c.name, 'count', x.n) order by c.name)
      from public.classes c
      left join lateral (select count(*) as n from public.students st
                         where st.class_id = c.id and st.status = 'active') x on true
      where c.school_id = v_school), '[]'::jsonb),
    'paymentsByMonth', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(mth, 'YYYY-MM'), 'total', coalesce(t.total, 0)) order by mth)
      from generate_series(date_trunc('month', now()) - interval '5 months',
                           date_trunc('month', now()), interval '1 month') as mth
      left join lateral (select sum(sp.amount_fcfa) as total from public.student_payments sp
                         where sp.school_id = v_school and sp.status = 'approved'
                           and date_trunc('month', sp.paid_at) = mth) t on true), '[]'::jsonb)
  );
end;
$$;

-- 4. Administration de la plateforme (réservée à vous)
create or replace function public.platform_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'schools', (select count(*) from public.schools),
    'activeSchools', (select count(*) from public.schools where status = 'active'),
    'students', (select count(*) from public.students where status = 'active'),
    'mrr', (select coalesce(sum(p.monthly_price_fcfa), 0)
            from public.subscriptions s join public.plans p on p.id = s.plan_id where s.status = 'active'),
    'byPlan', coalesce((
      select jsonb_agg(jsonb_build_object('plan', p.name, 'count', x.n) order by p.monthly_price_fcfa)
      from public.plans p
      left join lateral (select count(*) as n from public.subscriptions s
                         where s.plan_id = p.id and s.status = 'active') x on true), '[]'::jsonb),
    'schoolsByMonth', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(mth, 'YYYY-MM'), 'count', coalesce(t.n, 0)) order by mth)
      from generate_series(date_trunc('month', now()) - interval '5 months',
                           date_trunc('month', now()), interval '1 month') as mth
      left join lateral (select count(*) as n from public.schools sc
                         where date_trunc('month', sc.created_at) = mth) t on true), '[]'::jsonb),
    'revenueByMonth', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(mth, 'YYYY-MM'), 'total', coalesce(t.total, 0)) order by mth)
      from generate_series(date_trunc('month', now()) - interval '5 months',
                           date_trunc('month', now()), interval '1 month') as mth
      left join lateral (select sum(pm.amount_fcfa) as total from public.payments pm
                         where pm.status = 'approved' and date_trunc('month', pm.created_at) = mth) t on true), '[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_list_schools()
returns table (
  school_id uuid, school_name text, school_status text, plan_id text,
  students_count bigint, created_at timestamptz, owner_email text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select s.id, s.name, s.status, sub.plan_id,
         (select count(*) from public.students st where st.school_id = s.id and st.status = 'active'),
         s.created_at, pr.email
  from public.schools s
  left join public.subscriptions sub on sub.school_id = s.id and sub.status = 'active'
  left join public.profiles pr on pr.id = s.owner_id
  order by s.created_at desc;
end;
$$;

create or replace function public.platform_set_school_status(p_school uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update public.schools set status = p_status where id = p_school;
  insert into public.audit_log (actor_id, school_id, action, details)
  values (auth.uid(), p_school, 'school.status', jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.platform_delete_school(p_school uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select name into v_name from public.schools where id = p_school;
  if v_name is null then return; end if;
  insert into public.audit_log (actor_id, school_id, action, details)
  values (auth.uid(), p_school, 'school.deleted', jsonb_build_object('name', v_name));
  delete from public.schools where id = p_school;
end;
$$;

-- 5. Droits d'exécution
revoke all on function
  public.director_dashboard(), public.platform_dashboard(), public.platform_list_schools(),
  public.platform_set_school_status(uuid, text), public.platform_delete_school(uuid)
from public, anon;
grant execute on function
  public.director_dashboard(), public.platform_dashboard(), public.platform_list_schools(),
  public.platform_set_school_status(uuid, text), public.platform_delete_school(uuid)
to authenticated;

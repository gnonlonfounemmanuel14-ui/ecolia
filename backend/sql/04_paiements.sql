-- ECOLIA · Backend 4/6 : paiements (abonnements et scolarité), reçus, utilitaires
-- À exécuter UNE fois, après les scripts de la phase 1 et de la phase 3 (B1 et B2).

-- Un paiement groupé de parents peut concerner plusieurs élèves : même référence FedaPay
alter table public.student_payments drop constraint if exists student_payments_provider_ref_key;
create index if not exists student_payments_provider_ref_idx on public.student_payments (provider_ref);

-- Numéro de reçu automatique quand un règlement est approuvé
create sequence if not exists public.receipt_seq;
create or replace function public.set_receipt_no() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and new.receipt_no is null then
    new.receipt_no := 'R' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists student_payments_receipt on public.student_payments;
create trigger student_payments_receipt
  before insert or update of status on public.student_payments
  for each row execute function public.set_receipt_no();

-- Conversion sûre d'un texte en identifiant (renvoie null si invalide)
create or replace function public.safe_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Retrouve un compte par e-mail (réservé au serveur)
create or replace function public.find_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- ABONNEMENT : prépare un paiement. Le prix vient de la table plans, jamais du navigateur.
create or replace function public.prepare_checkout(p_plan text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_school_name text;
  v_plan public.plans;
  v_current_price integer;
  v_current_plan text;
  v_students integer;
  v_payment uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select m.school_id, s.name into v_school, v_school_name
  from public.school_members m join public.schools s on s.id = m.school_id
  where m.user_id = v_uid and m.role = 'director' and s.status = 'active'
  order by m.created_at limit 1;
  if v_school is null then raise exception 'no_school' using errcode = 'P0002'; end if;

  select * into v_plan from public.plans where id = p_plan;
  if not found or v_plan.monthly_price_fcfa <= 0 then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;

  select sub.plan_id, p.monthly_price_fcfa into v_current_plan, v_current_price
  from public.subscriptions sub join public.plans p on p.id = sub.plan_id
  where sub.school_id = v_school and sub.status = 'active';
  if v_current_plan = p_plan then raise exception 'already_active' using errcode = 'P0001'; end if;
  if v_plan.monthly_price_fcfa < coalesce(v_current_price, 0) then
    raise exception 'downgrade_not_allowed' using errcode = 'P0001';
  end if;

  select count(*) into v_students from public.students where school_id = v_school and status = 'active';
  if v_plan.student_limit is not null and v_students > v_plan.student_limit then
    raise exception 'capacity_exceeded' using errcode = 'P0001';
  end if;

  update public.payments set status = 'canceled' where school_id = v_school and status = 'pending';
  insert into public.payments (school_id, plan_id, amount_fcfa)
  values (v_school, p_plan, v_plan.monthly_price_fcfa) returning id into v_payment;

  return jsonb_build_object(
    'payment_id', v_payment, 'amount', v_plan.monthly_price_fcfa,
    'plan_name', v_plan.name, 'school_name', v_school_name
  );
end;
$$;

-- ABONNEMENT : applique le résultat confirmé par FedaPay (réservé au serveur)
create or replace function public.apply_subscription_payment(p_payment uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  if not found then return; end if;
  if v_pay.status = 'approved' then return; end if;  -- déjà traité : rien à refaire

  if p_status = 'approved' then
    update public.payments set status = 'approved' where id = v_pay.id;
    insert into public.subscriptions as s (school_id, plan_id, status, current_period_end, updated_at)
    values (v_pay.school_id, v_pay.plan_id, 'active', now() + interval '1 month', now())
    on conflict (school_id) do update set
      current_period_end = case
        when s.plan_id = excluded.plan_id and s.status = 'active'
          then greatest(now(), coalesce(s.current_period_end, now())) + interval '1 month'
        else now() + interval '1 month' end,
      plan_id = excluded.plan_id,
      status = 'active',
      updated_at = now();
    insert into public.audit_log (actor_id, school_id, action, details)
    values (null, v_pay.school_id, 'subscription.paid',
            jsonb_build_object('plan', v_pay.plan_id, 'amount', v_pay.amount_fcfa, 'payment', v_pay.id));
  elsif p_status in ('declined', 'canceled') then
    update public.payments set status = p_status where id = v_pay.id and status = 'pending';
  end if;
end;
$$;

-- SCOLARITÉ : prépare le paiement d'un parent pour un ou plusieurs de ses enfants (même école)
create or replace function public.prepare_fee_checkout(p_student_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_total bigint := 0;
  v_count integer := 0;
  v_school uuid;
  v_ref text := gen_random_uuid()::text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_student_ids is null or coalesce(array_length(p_student_ids, 1), 0) = 0 or array_length(p_student_ids, 1) > 20 then
    raise exception 'invalid_students' using errcode = '22023';
  end if;

  for v_row in
    select s.id as student_id, s.school_id,
      coalesce((select sum(f.amount_due_fcfa) from public.student_fees f where f.student_id = s.id), 0)
      - coalesce((select sum(p.amount_fcfa) from public.student_payments p
                  where p.student_id = s.id and p.status = 'approved'), 0) as remaining
    from public.students s
    join public.student_guardians g on g.student_id = s.id and g.parent_user_id = v_uid
    join public.schools sc on sc.id = s.school_id and sc.status = 'active'
    where s.id = any (p_student_ids) and s.status = 'active'
  loop
    if v_row.remaining > 0 then
      if v_school is not null and v_school <> v_row.school_id then
        raise exception 'multiple_schools' using errcode = 'P0001';
      end if;
      v_school := v_row.school_id;
      update public.student_payments set status = 'canceled'
        where student_id = v_row.student_id and status = 'pending' and provider = 'fedapay';
      insert into public.student_payments
        (school_id, student_id, amount_fcfa, method, provider, provider_ref, status, recorded_by)
      values (v_row.school_id, v_row.student_id, v_row.remaining, 'other', 'fedapay', v_ref, 'pending', v_uid);
      v_total := v_total + v_row.remaining;
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then raise exception 'nothing_to_pay' using errcode = 'P0001'; end if;
  return jsonb_build_object('temp_ref', v_ref, 'amount', v_total, 'students', v_count);
end;
$$;

-- SCOLARITÉ : applique le résultat confirmé par FedaPay (réservé au serveur)
create or replace function public.apply_fee_payment(p_ref text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status = 'approved' then
    update public.student_payments set status = 'approved', paid_at = now()
    where provider_ref = p_ref and status <> 'approved';
  elsif p_status in ('declined', 'canceled') then
    update public.student_payments set status = p_status
    where provider_ref = p_ref and status = 'pending';
  end if;
end;
$$;

-- Droits d'exécution
revoke all on function
  public.prepare_checkout(text), public.prepare_fee_checkout(uuid[]),
  public.apply_subscription_payment(uuid, text), public.apply_fee_payment(text, text),
  public.find_user_id_by_email(text)
from public, anon, authenticated;
grant execute on function public.prepare_checkout(text), public.prepare_fee_checkout(uuid[]) to authenticated, service_role;
grant execute on function
  public.apply_subscription_payment(uuid, text), public.apply_fee_payment(text, text),
  public.find_user_id_by_email(text)
to service_role;

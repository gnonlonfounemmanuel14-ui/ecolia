// Edge Function « invite-user » : la direction crée le compte d'un enseignant, d'un membre du
// personnel, d'un parent ou d'un élève. Elle reçoit un LIEN à transmettre (par exemple sur WhatsApp) :
// la personne y choisit elle-même son mot de passe. Aucun mot de passe n'est jamais communiqué.
// Appelée par le site : supabase.functions.invoke('invite-user', { body: {...} })
import { createClient } from 'npm:@supabase/supabase-js@2.108.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ROLE_FOR_KIND: Record<string, string> = {
  teacher: 'teacher',
  administrative: 'admin',
  parent: 'parent',
  student: 'student',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (value: unknown, max: number) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  // L'école est déduite du compte de l'appelant : il ne peut inviter que dans SON école, et seulement s'il est directeur.
  const { data: membership } = await userClient
    .from('school_members')
    .select('school_id')
    .eq('user_id', userData.user.id)
    .eq('role', 'director')
    .limit(1)
    .maybeSingle();
  if (!membership) return json({ error: 'forbidden' }, 403);
  const schoolId: string = membership.school_id;

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const kind = String(body?.kind ?? '');
  const email = clean(body?.email, 254).toLowerCase();
  const fullName = clean(body?.fullName, 120);
  if (!ROLE_FOR_KIND[kind]) return json({ error: 'invalid_kind' }, 400);
  if (!EMAIL.test(email)) return json({ error: 'invalid_email' }, 400);
  if (fullName.length < 2) return json({ error: 'invalid_name' }, 400);

  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Vérifie à l'avance que les élèves visés appartiennent bien à cette école.
  const studentIds: string[] =
    kind === 'parent' && Array.isArray(body?.studentIds)
      ? (body!.studentIds as unknown[]).map(String)
      : kind === 'student' && body?.studentId
        ? [String(body.studentId)]
        : [];
  if (studentIds.some((id) => !UUID.test(id))) return json({ error: 'invalid_students' }, 400);
  if ((kind === 'parent' || kind === 'student') && studentIds.length === 0) return json({ error: 'invalid_students' }, 400);
  if (studentIds.length > 0) {
    const { data: found } = await service.from('students').select('id').eq('school_id', schoolId).in('id', studentIds);
    if ((found ?? []).length !== studentIds.length) return json({ error: 'invalid_students' }, 400);
  }

  // Compte : on le crée s'il n'existe pas, avec un mot de passe aléatoire que personne ne connaît.
  let userId: string | null = (await service.rpc('find_user_id_by_email', { p_email: email })).data ?? null;
  let setupLink: string | null = null;
  const created = !userId;

  // Une personne a un seul rôle par école : on refuse de changer le rôle d'un membre existant
  // (sinon un directeur pourrait, par exemple, se rétrograder lui-même en s'invitant).
  if (userId) {
    const { data: existing } = await service
      .from('school_members')
      .select('role')
      .eq('school_id', schoolId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing?.role && existing.role !== ROLE_FOR_KIND[kind]) {
      return json({ error: 'role_conflict', existingRole: existing.role }, 409);
    }
  }
  if (!userId) {
    const result = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      user_metadata: { full_name: fullName },
    });
    if (result.error || !result.data.user) {
      console.error('createUser', result.error);
      return json({ error: 'create_failed' }, 500);
    }
    userId = result.data.user.id;
    const link = await service.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${SITE_URL}/pages/reset-password.html` },
    });
    setupLink = link.data?.properties?.action_link ?? null;
  }

  const { error: memberError } = await service
    .from('school_members')
    .upsert({ school_id: schoolId, user_id: userId, role: ROLE_FOR_KIND[kind] }, { onConflict: 'school_id,user_id' });
  if (memberError) {
    console.error('member', memberError);
    return json({ error: 'member_failed' }, 500);
  }

  let detailError = null;
  if (kind === 'teacher' || kind === 'administrative') {
    ({ error: detailError } = await service.from('staff').upsert(
      {
        school_id: schoolId,
        user_id: userId,
        kind: kind === 'teacher' ? 'teacher' : 'administrative',
        full_name: fullName,
        bio: clean(body?.bio, 500) || null,
        email,
        phone: clean(body?.phone, 30) || null,
        whatsapp: clean(body?.whatsapp, 30) || null,
      },
      { onConflict: 'school_id,user_id' }
    ));
  } else if (kind === 'parent') {
    ({ error: detailError } = await service.from('student_guardians').upsert(
      studentIds.map((student_id) => ({
        school_id: schoolId,
        student_id,
        parent_user_id: userId,
        relation: clean(body?.relation, 40) || null,
      })),
      { onConflict: 'student_id,parent_user_id' }
    ));
  } else if (kind === 'student') {
    ({ error: detailError } = await service
      .from('students')
      .update({ user_id: userId })
      .eq('id', studentIds[0])
      .eq('school_id', schoolId));
  }
  if (detailError) {
    console.error('detail', detailError);
    return json({ error: 'detail_failed' }, 500);
  }

  return json({ userId, created, setupLink });
});

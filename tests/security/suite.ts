/**
 * PCH Ball 2026 — backend security test suite (permanent, in-repo).
 *
 * Run:  bun run tests/security/suite.ts
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY
 *
 * The suite creates its own temporary actors/data (*@sectest.local) and
 * removes everything it created in the cleanup phase, so runs leave no residue.
 * It never modifies real event data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env['SUPABASE_URL']!;
const SERVICE = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const PUB = process.env['SUPABASE_PUBLISHABLE_KEY']!;
if (!URL || !SERVICE || !PUB) throw new Error('Missing Supabase env vars');

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = () => createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------- harness
type Result = { name: string; status: 'pass' | 'fail' | 'skip' | 'error'; detail?: string };
const results: Result[] = [];
let group = '';
const G = (g: string) => { group = g; };
const record = (name: string, status: Result['status'], detail?: string) =>
  results.push({ name: `[${group}] ${name}`, status, detail });

async function check(name: string, fn: () => Promise<boolean | string>) {
  try {
    const r = await fn();
    if (r === true) record(name, 'pass');
    else record(name, 'fail', typeof r === 'string' ? r : 'assertion false');
  } catch (e: any) {
    record(name, 'error', e?.message ?? String(e));
  }
}
const skip = (name: string, why: string) => record(name, 'skip', why);

/** PostgREST read must yield no rows (error or empty both acceptable as "denied"). */
const denied = async (q: any) => {
  const { data, error } = await q;
  if (error) return true;
  return Array.isArray(data) ? data.length === 0 : data == null;
};
/** Write must be rejected. */
const writeBlocked = async (q: any) => {
  const { data, error } = await q;
  if (error) return true;
  return Array.isArray(data) ? data.length === 0 : data == null;
};
const ok = async (q: any) => {
  const { error } = await q;
  return error ? `unexpected error: ${error.message}` : true;
};
const rowsAtLeast = async (q: any, n: number) => {
  const { data, error } = await q;
  if (error) return `error: ${error.message}`;
  return (data?.length ?? 0) >= n ? true : `expected >=${n} rows, got ${data?.length ?? 0}`;
};

// ---------------------------------------------------------------- actors
const TAG = 'sectest.local';
const PASSWORD = 'Sec!Test#2026#pch';
type Actor = { email: string; id: string; client: SupabaseClient };
const actors: Record<string, Actor> = {};
const createdUserIds: string[] = [];
const createdStoragePaths: Array<{ bucket: string; path: string }> = [];

async function makeActor(key: string): Promise<Actor> {
  const email = `${key}-${Date.now().toString(36)}@${TAG}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser ${key}: ${error.message}`);
  const id = data.user!.id;
  createdUserIds.push(id);
  const client = createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (sErr) throw new Error(`signIn ${key}: ${sErr.message}`);
  const a = { email, id, client };
  actors[key] = a;
  return a;
}

// ids of temporary rows for cleanup
const created = {
  registrations: [] as string[],
  payments: [] as string[],
  badges: [] as string[],
  people: [] as string[],
  programme: [] as string[],
  assetPubs: [] as string[],
  becoming: [] as string[],
  letters: [] as string[],
};

let ticketTypeId = '';

async function seed() {
  const { data: tt, error: ttErr } = await admin.from('ticket_types').select('id').eq('is_active', true).limit(1);
  if (ttErr || !tt?.length) throw new Error('no active ticket type to test against');
  ticketTypeId = tt[0].id;

  await Promise.all(['attendeeA', 'attendeeB', 'attendeeC', 'staff', 'adminU', 'superU', 'outsider'].map(makeActor));

  await admin.from('user_roles').insert([
    { user_id: actors['staff'].id, role: 'staff' },
    { user_id: actors['adminU'].id, role: 'admin' },
    { user_id: actors['superU'].id, role: 'super_admin' },
    { user_id: actors['attendeeA'].id, role: 'attendee' },
    { user_id: actors['attendeeB'].id, role: 'attendee' },
  ]);

  // paid registrations for A and B, pending for C
  for (const [key, status] of [['attendeeA', 'paid'], ['attendeeB', 'paid'], ['attendeeC', 'pending']] as const) {
    const { data, error } = await admin.from('registrations').insert({
      user_id: actors[key].id,
      ticket_type_id: ticketTypeId,
      attendee_code: `SECTEST-${key}-${Date.now().toString(36)}`,
      status,
      amount_kobo: 350000,
      currency: 'NGN',
    }).select('id').single();
    if (error) throw new Error(`seed registration ${key}: ${error.message}`);
    created.registrations.push(data.id);
    (actors[key] as any).registrationId = data.id;

    const { data: tok } = await admin.rpc('generate_qr_token');
    const { data: badge, error: bErr } = await admin.from('attendee_badges').insert({
      registration_id: data.id,
      user_id: actors[key].id,
      qr_token: tok as unknown as string,
      status: key === 'attendeeB' ? 'revoked' : 'active',
    }).select('id, qr_token').single();
    if (bErr) throw new Error(`seed badge ${key}: ${bErr.message}`);
    created.badges.push(badge.id);
    (actors[key] as any).badgeId = badge.id;
    (actors[key] as any).qrToken = badge.qr_token;

    if (status === 'paid') {
      const { data: pay, error: pErr } = await admin.from('payments').insert({
        registration_id: data.id,
        user_id: actors[key].id,
        provider: 'sectest',
        tx_ref: `SECTEST-${key}-${Date.now().toString(36)}`,
        amount_kobo: 350000,
        currency: 'NGN',
        status: 'successful',
        provider_payload: { secret_internal: 'must-never-leak' },
      }).select('id').single();
      if (pErr) throw new Error(`seed payment ${key}: ${pErr.message}`);
      created.payments.push(pay.id);
    }
  }

  // A and B are connected; privacy of B allows linkedin only
  await admin.from('connections').insert({
    user_a: [actors['attendeeA'].id, actors['attendeeB'].id].sort()[0],
    user_b: [actors['attendeeA'].id, actors['attendeeB'].id].sort()[1],
  });
  await admin.from('profiles').update({
    full_name: 'Sectest B', phone: '+2348000000001', whatsapp: '+2348000000001',
    instagram: 'ig_b', linkedin: 'li_b',
  }).eq('id', actors['attendeeB'].id);
  await admin.from('profile_privacy').update({
    networking_enabled: true, show_linkedin_to_connections: true,
    show_instagram_to_connections: false, show_phone_to_connections: false,
    show_whatsapp_to_connections: false, show_email_to_connections: false,
  }).eq('profile_id', actors['attendeeB'].id);
  await admin.from('profile_privacy').update({ networking_enabled: false })
    .eq('profile_id', actors['outsider'].id);
  // C is the legitimate recipient in the networking flow, so C opts in
  await admin.from('profile_privacy').update({ networking_enabled: true })
    .eq('profile_id', actors['attendeeC'].id);

  // private data owned by A
  const { data: letter } = await admin.from('dear_future_me')
    .insert({ user_id: actors['attendeeA'].id, content: 'sectest letter' }).select('id').single();
  if (letter) created.letters.push(letter.id);
  const { data: entry } = await admin.from('becoming_entries')
    .insert({ user_id: actors['attendeeA'].id, entry_type: 'reflection', title: 'sectest entry' })
    .select('id').single();
  if (entry) created.becoming.push(entry.id);

  // unpublished content
  const { data: person } = await admin.from('people')
    .insert({ full_name: 'Sectest Hidden Speaker', person_type: 'speaker', is_published: false })
    .select('id').single();
  if (person) created.people.push(person.id);
  const { data: prog } = await admin.from('programme_items')
    .insert({ title: 'Sectest Hidden Session', session_type: 'other', is_published: false })
    .select('id').single();
  if (prog) created.programme.push(prog.id);

  // storage fixtures
  const fixtures: Array<[string, string]> = [
    ['attendee-photos', `${actors['attendeeB'].id}/sectest.txt`],
    ['becoming-media', `${actors['attendeeB'].id}/sectest.txt`],
    ['event-assets', `sectest/published-${Date.now().toString(36)}.txt`],
    ['event-assets', `sectest/unpublished-${Date.now().toString(36)}.txt`],
  ];
  for (const [bucket, path] of fixtures) {
    const { error } = await admin.storage.from(bucket).upload(path, new Blob(['sectest']), { upsert: true });
    if (!error) createdStoragePaths.push({ bucket, path });
  }
  const publishedPath = fixtures[2][1];
  (globalThis as any).__publishedAsset = publishedPath;
  (globalThis as any).__unpublishedAsset = fixtures[3][1];
  const { data: pub } = await admin.from('event_asset_publications')
    .insert({ object_path: publishedPath, title: 'Sectest published asset', is_published: true })
    .select('id').single();
  if (pub) created.assetPubs.push(pub.id);
  const { data: unpub } = await admin.from('event_asset_publications')
    .insert({ object_path: fixtures[3][1], title: 'Sectest unpublished asset', is_published: false })
    .select('id').single();
  if (unpub) created.assetPubs.push(unpub.id);
}

// ---------------------------------------------------------------- tests
const PRIVATE_TABLES = [
  'profiles', 'profile_privacy', 'registrations', 'payments', 'attendee_badges',
  'check_ins', 'badge_scans', 'connection_requests', 'connections',
  'dear_future_me', 'becoming_entries', 'user_roles',
];
const PUBLIC_TABLES = ['ticket_types', 'people', 'programme_items', 'award_categories', 'hackathon_teams', 'event_asset_publications'];

async function testAnonymous() {
  G('anonymous');
  const c = anonClient();
  for (const t of PRIVATE_TABLES) {
    await check(`anon cannot read ${t}`, () => denied(c.from(t).select('*').limit(5)));
  }
  for (const t of PUBLIC_TABLES) {
    await check(`anon may read public ${t}`, async () => {
      const { error } = await c.from(t).select('*').limit(5);
      return error ? `error: ${error.message}` : true;
    });
  }
  await check('anon cannot read announcements', () => denied(c.from('announcements').select('*').limit(5)));
  await check('anon cannot see unpublished person', () =>
    denied(c.from('people').select('id').eq('id', created.people[0])));
  await check('anon cannot see unpublished programme item', () =>
    denied(c.from('programme_items').select('id').eq('id', created.programme[0])));
  await check('anon cannot see unpublished asset publication', () =>
    denied(c.from('event_asset_publications').select('id').eq('is_published', false)));

  for (const t of ['registrations', 'profiles', 'user_roles', 'payments', 'check_ins', 'attendee_badges']) {
    await check(`anon cannot insert into ${t}`, () => writeBlocked(c.from(t).insert({} as any).select()));
  }
  await check('anon cannot update ticket prices', () =>
    writeBlocked(c.from('ticket_types').update({ price_kobo: 1 }).eq('id', ticketTypeId).select()));

  await check('anon get_my_payment_summary returns nothing', async () => {
    const { data, error } = await c.rpc('get_my_payment_summary');
    return error ? true : (data?.length ?? 0) === 0;
  });
  await check('anon get_shareable_profile returns nothing', async () => {
    const { data, error } = await c.rpc('get_shareable_profile', { _target: actors['attendeeB'].id });
    return error ? true : (data?.length ?? 0) === 0;
  });
  await check('anon staff_lookup_badge is rejected', async () => {
    const { error } = await c.rpc('staff_lookup_badge', { _qr_token: (actors['attendeeA'] as any).qrToken });
    return !!error;
  });
  await check('anon cannot mint QR tokens', async () => {
    const { error } = await c.rpc('generate_qr_token');
    return !!error;
  });
  for (const fn of ['has_role', 'is_admin', 'is_staff', 'are_connected']) {
    await check(`anon cannot RPC ${fn}`, async () => {
      const { error } = await c.rpc(fn as any, {} as any);
      return !!error;
    });
  }
  for (const bucket of ['attendee-photos', 'becoming-media']) {
    await check(`anon cannot download from ${bucket}`, async () => {
      const { error } = await c.storage.from(bucket).download(`${actors['attendeeB'].id}/sectest.txt`);
      return !!error;
    });
    await check(`anon cannot list ${bucket}`, async () => {
      const { data, error } = await c.storage.from(bucket).list(actors['attendeeB'].id);
      return !!error || (data?.length ?? 0) === 0;
    });
  }
  await check('anon cannot download unpublished event asset', async () => {
    const { error } = await c.storage.from('event-assets').download((globalThis as any).__unpublishedAsset);
    return !!error;
  });
  await check('anon may download published event asset', async () => {
    const { error } = await c.storage.from('event-assets').download((globalThis as any).__publishedAsset);
    return error ? `error: ${error.message}` : true;
  });
  await check('anon cannot upload to event-assets', async () => {
    const { error } = await c.storage.from('event-assets').upload(`sectest/anon-${Date.now()}.txt`, new Blob(['x']));
    return !!error;
  });
}

async function testAttendee() {
  G('attendee');
  const A = actors['attendeeA'], B = actors['attendeeB'], C = actors['attendeeC'];
  const a = A.client;

  await check('reads own profile', () => rowsAtLeast(a.from('profiles').select('*').eq('id', A.id), 1));
  await check('cannot read another profile directly', () => denied(a.from('profiles').select('*').eq('id', B.id)));
  await check('cannot list all profiles', async () => {
    const { data } = await a.from('profiles').select('id');
    return (data?.length ?? 0) <= 1;
  });
  await check('updates own profile', () => ok(a.from('profiles').update({ bio: 'sectest bio' }).eq('id', A.id)));
  await check('cannot update another profile', () =>
    writeBlocked(a.from('profiles').update({ bio: 'hacked' }).eq('id', B.id).select()));
  await check('reads own privacy settings', () => rowsAtLeast(a.from('profile_privacy').select('*').eq('profile_id', A.id), 1));
  await check('cannot read another privacy row', () => denied(a.from('profile_privacy').select('*').eq('profile_id', B.id)));
  await check('updates own privacy settings', () =>
    ok(a.from('profile_privacy').update({ networking_enabled: true }).eq('profile_id', A.id)));
  await check('cannot update another privacy row', () =>
    writeBlocked(a.from('profile_privacy').update({ networking_enabled: true }).eq('profile_id', B.id).select()));

  // registrations
  await check('reads own registration', () => rowsAtLeast(a.from('registrations').select('*').eq('user_id', A.id), 1));
  await check('cannot read another registration', () => denied(a.from('registrations').select('*').eq('user_id', B.id)));
  await check('updates own dietary notes', () =>
    ok(a.from('registrations').update({ dietary_notes: 'sectest' }).eq('id', (A as any).registrationId)));
  await check('cannot self-mark registration paid', () =>
    writeBlocked(a.from('registrations').update({ status: 'paid' }).eq('id', (C as any).registrationId).select()));
  await check('cannot change own registration amount', () =>
    writeBlocked(a.from('registrations').update({ amount_kobo: 1 }).eq('id', (A as any).registrationId).select()));
  await check('cannot change own registration status', () =>
    writeBlocked(a.from('registrations').update({ status: 'refunded' }).eq('id', (A as any).registrationId).select()));
  await check('cannot change attendee code', () =>
    writeBlocked(a.from('registrations').update({ attendee_code: 'FAKE' }).eq('id', (A as any).registrationId).select()));
  await check('cannot insert a pre-paid registration', () =>
    writeBlocked(a.from('registrations').insert({
      user_id: A.id, ticket_type_id: ticketTypeId, attendee_code: `SECTEST-EVIL-${Date.now()}`,
      status: 'paid', amount_kobo: 0, currency: 'NGN',
    }).select()));
  await check('cannot insert a registration for someone else', () =>
    writeBlocked(a.from('registrations').insert({
      user_id: B.id, ticket_type_id: ticketTypeId, attendee_code: `SECTEST-EVIL2-${Date.now()}`,
      status: 'pending', amount_kobo: 0, currency: 'NGN',
    }).select()));
  await check('cannot delete own registration', () =>
    writeBlocked(a.from('registrations').delete().eq('id', (A as any).registrationId).select()));

  // payments
  await check('cannot read payments table', () => denied(a.from('payments').select('*')));
  await check('cannot insert a payment', () => writeBlocked(a.from('payments').insert({
    registration_id: (A as any).registrationId, user_id: A.id, provider: 'x', tx_ref: `evil-${Date.now()}`,
    amount_kobo: 1, currency: 'NGN', status: 'successful',
  }).select()));
  await check('cannot update a payment', () =>
    writeBlocked(a.from('payments').update({ status: 'successful' }).eq('user_id', A.id).select()));
  await check('payment summary returns only own rows', async () => {
    const { data, error } = await a.rpc('get_my_payment_summary');
    if (error) return `error: ${error.message}`;
    return (data ?? []).every((r: any) => r.registration_id === (A as any).registrationId);
  });
  await check('payment summary omits provider payload', async () => {
    const { data } = await a.rpc('get_my_payment_summary');
    const keys = Object.keys(data?.[0] ?? {});
    return !keys.some(k => /payload|provider_transaction/.test(k));
  });

  // badges / QR
  await check('reads own badge', () => rowsAtLeast(a.from('attendee_badges').select('*').eq('user_id', A.id), 1));
  await check('cannot read another badge', () => denied(a.from('attendee_badges').select('*').eq('user_id', B.id)));
  await check('cannot enumerate badges by token', () =>
    denied(a.from('attendee_badges').select('*').eq('qr_token', (B as any).qrToken)));
  await check('cannot list all badges', async () => {
    const { data } = await a.from('attendee_badges').select('id');
    return (data?.length ?? 0) <= 1;
  });
  await check('cannot insert a badge', () => writeBlocked(a.from('attendee_badges').insert({
    registration_id: (A as any).registrationId, user_id: A.id, qr_token: `PCHB26-evil-${Date.now()}`,
  }).select()));
  await check('cannot reactivate a revoked badge', () =>
    writeBlocked(a.from('attendee_badges').update({ status: 'active' }).eq('id', (B as any).badgeId).select()));
  await check('cannot mint QR tokens', async () => {
    const { error } = await a.rpc('generate_qr_token');
    return !!error;
  });
  await check('cannot call staff badge lookup', async () => {
    const { error } = await a.rpc('staff_lookup_badge', { _qr_token: (A as any).qrToken });
    return !!error;
  });

  // check-ins
  await check('cannot record a check-in', () => writeBlocked(a.from('check_ins').insert({
    badge_id: (A as any).badgeId, user_id: A.id, checked_in_by: A.id,
  }).select()));
  await check('cannot read others check-ins', () => denied(a.from('check_ins').select('*').eq('user_id', B.id)));

  // roles
  await check('reads own roles', () => ok(a.from('user_roles').select('*').eq('user_id', A.id)));
  await check('cannot read all roles', () => denied(a.from('user_roles').select('*').eq('user_id', actors['adminU'].id)));
  await check('cannot grant itself admin', () =>
    writeBlocked(a.from('user_roles').insert({ user_id: A.id, role: 'admin' }).select()));
  await check('cannot grant itself super_admin', () =>
    writeBlocked(a.from('user_roles').insert({ user_id: A.id, role: 'super_admin' }).select()));
  await check('cannot grant a role to someone else', () =>
    writeBlocked(a.from('user_roles').insert({ user_id: B.id, role: 'staff' }).select()));
  await check('cannot escalate an existing role row', () =>
    writeBlocked(a.from('user_roles').update({ role: 'super_admin' }).eq('user_id', A.id).select()));
  await check('cannot delete a role row', () =>
    writeBlocked(a.from('user_roles').delete().eq('user_id', actors['adminU'].id).select()));

  // private data
  await check('reads own letter', () => rowsAtLeast(a.from('dear_future_me').select('*').eq('user_id', A.id), 1));
  await check('cannot read another letter', () => denied(B.client.from('dear_future_me').select('*').eq('user_id', A.id)));
  await check('cannot list all letters', async () => {
    const { data } = await B.client.from('dear_future_me').select('id');
    return (data?.length ?? 0) === 0;
  });
  await check('cannot write a letter as someone else', () =>
    writeBlocked(a.from('dear_future_me').insert({ user_id: B.id, content: 'impersonated' }).select()));
  await check('reads own becoming entry', () => rowsAtLeast(a.from('becoming_entries').select('*').eq('user_id', A.id), 1));
  await check('cannot read another becoming entry', () =>
    denied(B.client.from('becoming_entries').select('*').eq('user_id', A.id)));
  await check('cannot write a becoming entry as someone else', () =>
    writeBlocked(a.from('becoming_entries').insert({ user_id: B.id, entry_type: 'note', title: 'impersonated' }).select()));
  await check('cannot spoof scanner identity', () =>
    writeBlocked(a.from('badge_scans').insert({ scanner_user_id: B.id, scanned_user_id: A.id }).select()));
  await check('may log own scan', () =>
    ok(a.from('badge_scans').insert({ scanner_user_id: A.id, scanned_user_id: B.id })));

  // unpublished content
  await check('cannot see unpublished person', () => denied(a.from('people').select('id').eq('id', created.people[0])));
  await check('cannot see unpublished programme item', () =>
    denied(a.from('programme_items').select('id').eq('id', created.programme[0])));
  await check('cannot see unpublished asset publication', () =>
    denied(a.from('event_asset_publications').select('id').eq('is_published', false)));
  await check('cannot publish content', () =>
    writeBlocked(a.from('people').update({ is_published: true }).eq('id', created.people[0]).select()));
  await check('cannot create people rows', () =>
    writeBlocked(a.from('people').insert({ full_name: 'evil', person_type: 'speaker' }).select()));
  await check('cannot create ticket types', () =>
    writeBlocked(a.from('ticket_types').insert({ code: `EVIL${Date.now()}`, name: 'evil', price_kobo: 0 }).select()));
}

async function testNetworking() {
  G('networking');
  const A = actors['attendeeA'], B = actors['attendeeB'], C = actors['attendeeC'], O = actors['outsider'];

  await check('connected viewer sees shareable profile', async () => {
    const { data, error } = await A.client.rpc('get_shareable_profile', { _target: B.id });
    if (error) return `error: ${error.message}`;
    return (data?.length ?? 0) === 1 && data![0].is_connected === true;
  });
  await check('connected viewer sees allowed linkedin', async () => {
    const { data } = await A.client.rpc('get_shareable_profile', { _target: B.id });
    return data?.[0]?.linkedin === 'li_b';
  });
  for (const [field] of [['instagram'], ['phone'], ['whatsapp'], ['email']] as const) {
    await check(`connected viewer cannot see hidden ${field}`, async () => {
      const { data } = await A.client.rpc('get_shareable_profile', { _target: B.id });
      return data?.[0]?.[field] == null;
    });
  }
  await check('unconnected viewer gets no contact details', async () => {
    const { data } = await C.client.rpc('get_shareable_profile', { _target: B.id });
    const r = data?.[0];
    return !r || (r.is_connected === false && !r.linkedin && !r.phone && !r.email && !r.whatsapp && !r.instagram);
  });
  await check('networking-disabled profile is not shareable', async () => {
    const { data } = await A.client.rpc('get_shareable_profile', { _target: O.id });
    return (data?.length ?? 0) === 0;
  });
  await check('shareable profile never returns qr or payment fields', async () => {
    const { data } = await A.client.rpc('get_shareable_profile', { _target: B.id });
    const keys = Object.keys(data?.[0] ?? {});
    return !keys.some(k => /qr|token|amount|payment|status/.test(k));
  });
  await check('connection request to networking-disabled user is blocked', () =>
    writeBlocked(A.client.from('connection_requests').insert({ requester_id: A.id, recipient_id: O.id }).select()));
  await check('cannot send a request as someone else', () =>
    writeBlocked(A.client.from('connection_requests').insert({ requester_id: B.id, recipient_id: C.id }).select()));
  await check('cannot create a pre-accepted request', () =>
    writeBlocked(A.client.from('connection_requests')
      .insert({ requester_id: A.id, recipient_id: C.id, status: 'accepted' }).select()));
  await check('may send a legitimate request', () =>
    ok(A.client.from('connection_requests').insert({ requester_id: A.id, recipient_id: C.id, status: 'pending' })));
  await check('cannot read a request it is not party to', () =>
    denied(actors['staff'].client.from('connection_requests').select('*').eq('requester_id', A.id)));
  await check('recipient may accept its own request', async () => {
    const { data } = await admin.from('connection_requests').select('id')
      .eq('requester_id', A.id).eq('recipient_id', C.id).limit(1);
    if (!data?.length) return 'no pending request found';
    const { error } = await C.client.from('connection_requests').update({ status: 'accepted' }).eq('id', data[0].id);
    return error ? `error: ${error.message}` : true;
  });
  await check('accepting a request creates the connection', async () => {
    const [x, y] = [A.id, C.id].sort();
    const { data } = await admin.from('connections').select('id').eq('user_a', x).eq('user_b', y);
    return (data?.length ?? 0) === 1;
  });
  await check('third party cannot accept a request', async () => {
    const { data } = await admin.from('connection_requests').select('id').eq('requester_id', A.id).limit(1);
    return writeBlocked(actors['outsider'].client.from('connection_requests')
      .update({ status: 'accepted' }).eq('id', data![0].id).select());
  });
  await check('cannot insert a connection directly', () =>
    writeBlocked(A.client.from('connections')
      .insert({ user_a: [A.id, O.id].sort()[0], user_b: [A.id, O.id].sort()[1] }).select()));
  await check('cannot read connections of others', () =>
    denied(actors['outsider'].client.from('connections').select('*').eq('user_a', A.id)));
}

async function testStaff() {
  G('staff');
  const s = actors['staff'].client;
  const A = actors['attendeeA'], B = actors['attendeeB'], C = actors['attendeeC'];

  await check('badge lookup resolves a paid active badge', async () => {
    const { data, error } = await s.rpc('staff_lookup_badge', { _qr_token: (A as any).qrToken });
    if (error) return `error: ${error.message}`;
    return (data?.length ?? 0) === 1 && data![0].registration_status === 'paid';
  });
  await check('badge lookup exposes no qr token, payment or contact data', async () => {
    const { data } = await s.rpc('staff_lookup_badge', { _qr_token: (A as any).qrToken });
    const keys = Object.keys(data?.[0] ?? {});
    return !keys.some(k => /qr_token|amount|email|phone|whatsapp|payment|tx_ref/.test(k));
  });
  await check('badge lookup on unknown token returns nothing', async () => {
    const { data, error } = await s.rpc('staff_lookup_badge', { _qr_token: 'PCHB26-does-not-exist' });
    return error ? `error: ${error.message}` : (data?.length ?? 0) === 0;
  });
  await check('badge lookup flags an unpaid registration', async () => {
    const { data } = await s.rpc('staff_lookup_badge', { _qr_token: (C as any).qrToken });
    return data?.[0]?.registration_status === 'pending';
  });
  await check('staff cannot read the badge table directly', () => denied(s.from('attendee_badges').select('*')));
  await check('staff can check in a paid attendee', () =>
    ok(s.from('check_ins').insert({ badge_id: (A as any).badgeId, user_id: A.id, checked_in_by: actors['staff'].id })));
  await check('duplicate check-in is rejected', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: (A as any).badgeId, user_id: A.id, checked_in_by: actors['staff'].id }).select()));
  await check('check-in on an unpaid registration is rejected', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: (C as any).badgeId, user_id: C.id, checked_in_by: actors['staff'].id }).select()));
  await check('check-in on a revoked badge is rejected', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: (B as any).badgeId, user_id: B.id, checked_in_by: actors['staff'].id }).select()));
  await check('check-in with an unknown badge is rejected', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: '00000000-0000-0000-0000-000000000000', user_id: A.id, checked_in_by: actors['staff'].id }).select()));
  await check('staff cannot spoof checked_in_by', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: (C as any).badgeId, user_id: C.id, checked_in_by: actors['adminU'].id }).select()));
  await check('staff cannot use the admin override flag', () =>
    writeBlocked(s.from('check_ins')
      .insert({ badge_id: (C as any).badgeId, user_id: C.id, checked_in_by: actors['staff'].id, is_override: true }).select()));
  await check('staff cannot read payments', () => denied(s.from('payments').select('*')));
  await check('staff cannot read attendee profiles', () => denied(s.from('profiles').select('*').eq('id', A.id)));
  await check('staff cannot read registrations', () => denied(s.from('registrations').select('*').eq('user_id', A.id)));
  await check('staff cannot read letters', () => denied(s.from('dear_future_me').select('*')));
  await check('staff cannot read becoming entries', () => denied(s.from('becoming_entries').select('*')));
  await check('staff cannot grant roles', () =>
    writeBlocked(s.from('user_roles').insert({ user_id: actors['staff'].id, role: 'admin' }).select()));
  await check('staff cannot edit event content', () =>
    writeBlocked(s.from('people').update({ full_name: 'x' }).eq('id', created.people[0]).select()));
  await check('staff cannot see unpublished content', () =>
    denied(s.from('people').select('id').eq('id', created.people[0])));
  await check('staff cannot read attendee photos', async () => {
    const { error } = await s.storage.from('attendee-photos').download(`${B.id}/sectest.txt`);
    return !!error;
  });
}

async function testAdmin() {
  G('admin');
  const ad = actors['adminU'].client;
  const A = actors['attendeeA'];

  await check('admin reads payments', () => rowsAtLeast(ad.from('payments').select('*').eq('user_id', A.id), 1));
  await check('admin reads registrations', () => rowsAtLeast(ad.from('registrations').select('*').eq('user_id', A.id), 1));
  await check('admin reads profiles', () => rowsAtLeast(ad.from('profiles').select('*').eq('id', A.id), 1));
  await check('admin reads badges', () => rowsAtLeast(ad.from('attendee_badges').select('*').eq('user_id', A.id), 1));
  await check('admin sees unpublished content', () =>
    rowsAtLeast(ad.from('people').select('id').eq('id', created.people[0]), 1));
  await check('admin updates registration status', () =>
    ok(ad.from('registrations').update({ status: 'paid' }).eq('id', (actors['attendeeC'] as any).registrationId)));
  await check('admin manages event content', () =>
    ok(ad.from('people').update({ bio: 'sectest admin edit' }).eq('id', created.people[0])));
  await check('admin cannot read letters', () => denied(ad.from('dear_future_me').select('*')));
  await check('admin cannot read becoming entries', () => denied(ad.from('becoming_entries').select('*')));
  await check('admin cannot grant roles', () =>
    writeBlocked(ad.from('user_roles').insert({ user_id: actors['outsider'].id, role: 'staff' }).select()));
  await check('admin cannot edit an attendee profile', () =>
    writeBlocked(ad.from('profiles').update({ full_name: 'overwritten' }).eq('id', A.id).select()));
  await check('admin cannot insert payments', () =>
    writeBlocked(ad.from('payments').insert({
      registration_id: (A as any).registrationId, user_id: A.id, provider: 'x',
      tx_ref: `admin-evil-${Date.now()}`, amount_kobo: 1, currency: 'NGN', status: 'successful',
    }).select()));
  await check('admin cannot read attendee photos of others', async () => {
    const { error } = await ad.storage.from('attendee-photos').download(`${actors['attendeeB'].id}/sectest.txt`);
    return !!error;
  });
  await check('admin cannot read becoming media of others', async () => {
    const { error } = await ad.storage.from('becoming-media').download(`${actors['attendeeB'].id}/sectest.txt`);
    return !!error;
  });
  await check('admin manages event assets storage', async () => {
    const path = `sectest/admin-${Date.now().toString(36)}.txt`;
    const { error } = await ad.storage.from('event-assets').upload(path, new Blob(['x']));
    if (!error) createdStoragePaths.push({ bucket: 'event-assets', path });
    return error ? `error: ${error.message}` : true;
  });
}

async function testSuperAdmin() {
  G('super admin');
  const su = actors['superU'].client;
  await check('super admin grants a role', () =>
    ok(su.from('user_roles').insert({ user_id: actors['outsider'].id, role: 'staff' })));
  await check('super admin cannot change own roles', () =>
    writeBlocked(su.from('user_roles').insert({ user_id: actors['superU'].id, role: 'admin' }).select()));
  await check('super admin revokes a role', () =>
    ok(su.from('user_roles').delete().eq('user_id', actors['outsider'].id).eq('role', 'staff')));
  await check('granted role is recorded with granter', async () => {
    const { data } = await admin.from('user_roles').select('granted_by').eq('user_id', actors['adminU'].id);
    return (data?.length ?? 0) >= 1;
  });
  await check('super admin still cannot read letters', () => denied(su.from('dear_future_me').select('*')));
}

async function testStorage() {
  G('storage');
  const A = actors['attendeeA'], B = actors['attendeeB'];
  const own = `${A.id}/sectest-own.txt`;

  await check('attendee uploads to own photo folder', async () => {
    const { error } = await A.client.storage.from('attendee-photos').upload(own, new Blob(['x']), { upsert: true });
    if (!error) createdStoragePaths.push({ bucket: 'attendee-photos', path: own });
    return error ? `error: ${error.message}` : true;
  });
  await check('attendee cannot upload into another folder', async () => {
    const { error } = await A.client.storage.from('attendee-photos').upload(`${B.id}/evil.txt`, new Blob(['x']));
    return !!error;
  });
  await check('attendee downloads own photo', async () => {
    const { error } = await A.client.storage.from('attendee-photos').download(own);
    return error ? `error: ${error.message}` : true;
  });
  await check('connected attendee may read connected photo', async () => {
    const { error } = await A.client.storage.from('attendee-photos').download(`${B.id}/sectest.txt`);
    return error ? `error: ${error.message}` : true;
  });
  await check('unconnected attendee cannot read photo', async () => {
    const { error } = await actors['outsider'].client.storage.from('attendee-photos').download(`${B.id}/sectest.txt`);
    return !!error;
  });
  const ownMedia = `${A.id}/sectest-media.txt`;
  await check('attendee uploads own becoming media', async () => {
    const { error } = await A.client.storage.from('becoming-media').upload(ownMedia, new Blob(['x']), { upsert: true });
    if (!error) createdStoragePaths.push({ bucket: 'becoming-media', path: ownMedia });
    return error ? `error: ${error.message}` : true;
  });
  await check('becoming media is owner-only even for connections', async () => {
    const { error } = await A.client.storage.from('becoming-media').download(`${B.id}/sectest.txt`);
    return !!error;
  });
  await check('attendee cannot upload to event-assets', async () => {
    const { error } = await A.client.storage.from('event-assets').upload(`sectest/att-${Date.now()}.txt`, new Blob(['x']));
    return !!error;
  });
  await check('attendee may read a published event asset', async () => {
    const { error } = await A.client.storage.from('event-assets').download((globalThis as any).__publishedAsset);
    return error ? `error: ${error.message}` : true;
  });
  await check('attendee cannot read an unpublished event asset', async () => {
    const { error } = await A.client.storage.from('event-assets').download((globalThis as any).__unpublishedAsset);
    return !!error;
  });
  await check('buckets are not publicly listable', async () => {
    const { data } = await anonClient().storage.from('attendee-photos').list();
    return (data?.length ?? 0) === 0;
  });
  await check('signed url cannot be minted by a non-owner', async () => {
    const { error } = await actors['outsider'].client.storage.from('becoming-media')
      .createSignedUrl(`${B.id}/sectest.txt`, 60);
    return !!error;
  });
}

async function testImpersonation() {
  G('impersonation');
  const A = actors['attendeeA'], B = actors['attendeeB'];
  const a = A.client;
  const cases: Array<[string, any]> = [
    ['cannot filter payments by another user id', a.from('payments').select('*').eq('user_id', B.id)],
    ['cannot filter badges by another user id', a.from('attendee_badges').select('*').eq('user_id', B.id)],
    ['cannot filter registrations by another user id', a.from('registrations').select('*').eq('user_id', B.id)],
    ['cannot filter letters by another user id', a.from('dear_future_me').select('*').eq('user_id', B.id)],
    ['cannot filter becoming entries by another user id', a.from('becoming_entries').select('*').eq('user_id', B.id)],
    ['cannot filter privacy rows by another user id', a.from('profile_privacy').select('*').eq('profile_id', B.id)],
    ['cannot filter check-ins by another user id', a.from('check_ins').select('*').eq('user_id', B.id)],
    ['cannot filter roles by another user id', a.from('user_roles').select('*').eq('user_id', actors['superU'].id)],
  ];
  for (const [name, q] of cases) await check(name, () => denied(q));

  await check('payment summary ignores injected filters', async () => {
    const { data } = await a.rpc('get_my_payment_summary');
    return (data ?? []).every((r: any) => r.registration_id === (A as any).registrationId);
  });
  await check('shareable profile of self returns own contact fields', async () => {
    const { data } = await a.rpc('get_shareable_profile', { _target: A.id });
    return (data?.length ?? 0) === 1 && data![0].id === A.id;
  });
  await check('shareable profile of unknown id returns nothing', async () => {
    const { data } = await a.rpc('get_shareable_profile', { _target: '00000000-0000-0000-0000-000000000000' });
    return (data?.length ?? 0) === 0;
  });
  await check('service-role-only tables reject anon rpc', async () => {
    const { error } = await anonClient().rpc('handle_new_user' as any);
    return !!error;
  });
}

// ---------------------------------------------------------------- cleanup
async function cleanup() {
  for (const { bucket, path } of createdStoragePaths) {
    await admin.storage.from(bucket).remove([path]);
  }
  await admin.from('event_asset_publications').delete().in('id', created.assetPubs.length ? created.assetPubs : ['00000000-0000-0000-0000-000000000000']);
  await admin.from('check_ins').delete().in('user_id', createdUserIds);
  await admin.from('badge_scans').delete().in('scanner_user_id', createdUserIds);
  await admin.from('badge_scans').delete().in('scanned_user_id', createdUserIds);
  await admin.from('attendee_badges').delete().in('user_id', createdUserIds);
  await admin.from('payments').delete().in('user_id', createdUserIds);
  await admin.from('connections').delete().in('user_a', createdUserIds);
  await admin.from('connections').delete().in('user_b', createdUserIds);
  await admin.from('connection_requests').delete().in('requester_id', createdUserIds);
  await admin.from('connection_requests').delete().in('recipient_id', createdUserIds);
  await admin.from('registrations').delete().in('user_id', createdUserIds);
  await admin.from('dear_future_me').delete().in('user_id', createdUserIds);
  await admin.from('becoming_entries').delete().in('user_id', createdUserIds);
  await admin.from('user_roles').delete().in('user_id', createdUserIds);
  await admin.from('profile_privacy').delete().in('profile_id', createdUserIds);
  await admin.from('profiles').delete().in('id', createdUserIds);
  if (created.people.length) await admin.from('people').delete().in('id', created.people);
  if (created.programme.length) await admin.from('programme_items').delete().in('id', created.programme);
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
}

// ---------------------------------------------------------------- runner
async function main() {
  const started = Date.now();
  try {
    await seed();
    await testAnonymous();
    await testAttendee();
    await testNetworking();
    await testStaff();
    await testAdmin();
    await testSuperAdmin();
    await testStorage();
    await testImpersonation();
  } catch (e: any) {
    record(`fatal: ${e?.message ?? e}`, 'error');
  } finally {
    try { await cleanup(); record('temporary test data removed', 'pass'); }
    catch (e: any) { record('cleanup', 'error', e?.message); }
  }

  const total = results.length;
  const by = (s: Result['status']) => results.filter(r => r.status === s).length;
  for (const r of results.filter(r => r.status !== 'pass')) {
    console.log(`${r.status.toUpperCase().padEnd(5)} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log('\n================ SECURITY SUITE ================');
  console.log(`total ${total} | passed ${by('pass')} | failed ${by('fail')} | skipped ${by('skip')} | errors ${by('error')}`);
  console.log(`duration ${(Date.now() - started) / 1000}s`);
  process.exit(by('fail') + by('error') > 0 ? 1 : 0);
}

void main();
export { skip };

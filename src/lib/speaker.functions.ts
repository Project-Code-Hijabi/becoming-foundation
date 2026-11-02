import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function rolesOf({ supabase, userId }: Ctx): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function assertAdmin(ctx: Ctx) {
  const r = await rolesOf(ctx);
  if (!r.includes("admin") && !r.includes("super_admin")) throw new Error("Not authorised");
}

export const PLATFORMS = ["instagram", "linkedin", "x", "tiktok", "youtube", "website"] as const;
export type SpeakerLink = { platform: (typeof PLATFORMS)[number]; url: string; shared: boolean };

const PERSON_TYPES = ["speaker", "panelist", "fireside_guest", "special_guest", "grand_honoree", "host", "sponsor"] as const;

function attendeeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "PCHB26-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Gives a user a free confirmed seat (₦0) plus an active Ball Pass. Never touches an existing paid seat. */
async function ensureComplimentarySeat(admin: any, userId: string): Promise<string | null> {
  const { data: ticket } = await admin.from("ticket_types").select("id, currency").eq("code", "COMPLIMENTARY").maybeSingle();
  if (!ticket) return "The complimentary ticket is missing.";
  const { data: regs } = await admin.from("registrations").select("id, status").eq("user_id", userId).in("status", ["pending", "paid"]);
  let regId: string | null = regs?.find((r: any) => r.status === "paid")?.id ?? null;
  if (!regId) {
    const pending = regs?.find((r: any) => r.status === "pending");
    const fields = { ticket_type_id: ticket.id, amount_kobo: 0, currency: ticket.currency, status: "paid", paid_at: new Date().toISOString() };
    if (pending) {
      const { error } = await admin.from("registrations").update(fields).eq("id", pending.id).eq("status", "pending");
      if (error) return "The free seat couldn't be created.";
      regId = pending.id;
    } else {
      for (let i = 0; i < 3 && !regId; i++) {
        const { data, error } = await admin.from("registrations").insert({ ...fields, user_id: userId, attendee_code: attendeeCode() }).select("id").maybeSingle();
        if (!error && data) regId = data.id;
      }
      if (!regId) return "The free seat couldn't be created.";
    }
  }
  await admin.from("attendee_badges").upsert({ registration_id: regId, user_id: userId }, { onConflict: "registration_id", ignoreDuplicates: true });
  return null;
}

export const inviteSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      origin: z.string().url().max(200),
      personId: z.string().uuid().nullable(),
      fullName: z.string().trim().max(150).default(""),
      personType: z.enum(PERSON_TYPES).default("speaker"),
    }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const self = (context.claims as { email?: string }).email?.toLowerCase();
    if (self === data.email) return { ok: false, message: "You can't change your own role. Use the speaker's own email address." };
    if (!data.personId && !data.fullName) return { ok: false, message: "Choose a guest from the list or type the speaker's full name." };
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null, invited = false;
    const { data: existing } = await admin.from("profiles").select("id, full_name").ilike("email", data.email).maybeSingle();
    if (existing) userId = existing.id;
    else {
      // The speaker picks her own password from the invite email; admins never set it.
      const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${data.origin}/ball/app/login` });
      if (error || !inv.user) { console.error("speaker invite failed", error?.message); return { ok: false, message: "We couldn't send that invite. Check the email and try again." }; }
      userId = inv.user.id; invited = true;
    }
    if (userId === context.userId) return { ok: false, message: "You can't change your own role." };

    // Link to the guest list entry (or create an unpublished one).
    let personId = data.personId;
    let name = data.fullName;
    if (personId) {
      const { data: p } = await admin.from("people").select("id, user_id, full_name").eq("id", personId).maybeSingle();
      if (!p) return { ok: false, message: "That guest no longer exists. Refresh and try again." };
      if (p.user_id && p.user_id !== userId) return { ok: false, message: `${p.full_name} is already linked to another account.` };
      name = p.full_name;
    }
    const { data: already } = await admin.from("people").select("id").eq("user_id", userId).maybeSingle();
    if (already && already.id !== personId) return { ok: false, message: "This email is already linked to another speaker entry." };
    if (personId) await admin.from("people").update({ user_id: userId }).eq("id", personId);
    else {
      const { data: np, error } = await admin.from("people").insert({ full_name: name, person_type: data.personType, is_published: false, user_id: userId }).select("id").maybeSingle();
      if (error || !np) return { ok: false, message: "The speaker entry couldn't be created." };
      personId = np.id;
    }

    const { error: rErr } = await admin.from("user_roles").upsert({ user_id: userId, role: "speaker", granted_by: context.userId }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) return { ok: false, message: "The speaker role couldn't be added. Try again." };
    await admin.from("profiles").update({ full_name: name }).eq("id", userId).is("full_name", null);
    const seatErr = await ensureComplimentarySeat(admin, userId!);
    if (seatErr) return { ok: false, message: `${seatErr} Speaker access was added; try again to create her pass.` };
    return {
      ok: true,
      message: invited
        ? `Invite sent to ${data.email}. She sets her own password, then gets a free Ball Pass and her speaker page.`
        : `${data.email} already has an account — speaker page and free Ball Pass added. She signs in with her existing password.`,
    };
  });

export type SpeakerRow = { personId: string; name: string; type: string; email: string; published: boolean; resources: number };

export const listSpeakers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SpeakerRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: ppl } = await admin.from("people").select("id, full_name, person_type, is_published, user_id").not("user_id", "is", null).order("display_order");
    const ids = (ppl ?? []).map((p) => p.user_id!);
    if (!ids.length) return [];
    const [{ data: profs }, { data: res }] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", ids),
      admin.from("speaker_resources").select("person_id"),
    ]);
    return (ppl ?? []).map((p) => ({ personId: p.id, name: p.full_name, type: p.person_type, published: p.is_published, email: profs?.find((x) => x.id === p.user_id)?.email ?? "", resources: (res ?? []).filter((r) => r.person_id === p.id).length }));
  });

export const removeSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ personId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await admin.from("people").select("user_id").eq("id", data.personId).maybeSingle();
    if (!p?.user_id) return { ok: true };
    if (p.user_id === context.userId) return { ok: false };
    // Removes the speaker page only; her Ball Pass and guest-list entry stay.
    await admin.from("people").update({ user_id: null }).eq("id", data.personId);
    await admin.from("user_roles").delete().eq("user_id", p.user_id).eq("role", "speaker");
    return { ok: true };
  });

export type MySpeaker = { personId: string; name: string; type: string; title: string; organisation: string; bio: string; published: boolean; links: SpeakerLink[] };

export const getMySpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySpeaker | null> => {
    if (!(await rolesOf(context)).includes("speaker")) return null;
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await admin.from("people").select("id, full_name, person_type, title, organisation, bio, is_published").eq("user_id", context.userId).maybeSingle();
    if (!p) return null;
    const { data: links } = await admin.from("speaker_links").select("platform, url, is_shared").eq("person_id", p.id);
    return {
      personId: p.id, name: p.full_name, type: p.person_type, title: p.title ?? "", organisation: p.organisation ?? "", bio: p.bio ?? "", published: p.is_published,
      links: (links ?? []).map((l) => ({ platform: l.platform as SpeakerLink["platform"], url: l.url, shared: l.is_shared })),
    };
  });

const url = z.string().trim().max(300).refine((v) => /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), "Links must start with https://");

export const saveMySpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().max(150),
      organisation: z.string().trim().max(150),
      bio: z.string().trim().max(2000),
      links: z.array(z.object({ platform: z.enum(PLATFORMS), url, shared: z.boolean() })).max(PLATFORMS.length),
    }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    if (!(await rolesOf(context)).includes("speaker")) return { ok: false, message: "Speaker access is needed." };
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await admin.from("people").select("id").eq("user_id", context.userId).maybeSingle();
    if (!p) return { ok: false, message: "Your speaker page isn't set up yet. Ask the team." };
    const uniq = new Map(data.links.map((l) => [l.platform, l]));
    const { error } = await admin.from("people").update({ title: data.title || null, organisation: data.organisation || null, bio: data.bio || null }).eq("id", p.id);
    if (error) return { ok: false, message: "Couldn't save. Try again." };
    await admin.from("speaker_links").delete().eq("person_id", p.id);
    if (uniq.size) {
      const { error: lErr } = await admin.from("speaker_links").insert([...uniq.values()].map((l) => ({ person_id: p.id, platform: l.platform, url: l.url, is_shared: l.shared })));
      if (lErr) return { ok: false, message: "Your details saved, but links didn't. Try again." };
    }
    return { ok: true, message: "Saved." };
  });

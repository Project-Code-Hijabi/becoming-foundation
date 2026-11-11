import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

/** Verifies the caller is admin/super_admin using their own RLS-scoped role rows. */
async function assertAdmin({ supabase, userId }: Ctx) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) throw new Error("Not authorised");
}

export type StaffRow = { userId: string; email: string; name: string | null; since: string };

export const listStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, created_at").eq("role", "staff").order("created_at", { ascending: false });
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids);
    return (roles ?? []).map((r) => {
      const p = profs?.find((x) => x.id === r.user_id);
      return { userId: r.user_id, email: p?.email ?? "", name: p?.full_name ?? null, since: r.created_at };
    });
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(255), origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result: "invited" | "granted" | "error"; message: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const self = (context.claims as { email?: string }).email?.toLowerCase();
    if (self && self === data.email) return { result: "error", message: "You can't change your own role. Invite a different email address." };
    let userId: string | null = null;
    let invited = false;
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing) userId = existing.id;
    else {
      // Invite email lets the staff member choose their own password; admins never set it.
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${data.origin}/ball/app/login` });
      if (error || !inv.user) {
        console.error("invite failed", error?.message);
        return { result: "error", message: "We couldn't send that invite. Check the email and try again." };
      }
      userId = inv.user.id;
      invited = true;
    }
    if (userId === context.userId) return { result: "error", message: "You can't change your own role." };
    const { error: rErr } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "staff", granted_by: context.userId }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) { console.error("role grant failed", rErr.message); return { result: "error", message: "The staff role couldn't be added. Try again." }; }
    return invited
      ? { result: "invited", message: `Invite sent to ${data.email}. She'll set her own password from the email.` }
      : { result: "granted", message: `${data.email} already has an account — staff access added. She signs in with her existing password.` };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "staff");
    return { ok: true };
  });

/** Admin-only: EmailOctopus configuration status (never returns the key). */
export const emailSettingsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { checkEmailOctopus } = await import("@/lib/emailoctopus.server");
    return checkEmailOctopus();
  });

export type SpeakerRow = { userId: string; email: string; name: string | null; code: string | null };

export const listSpeakers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SpeakerRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "speaker");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const [{ data: profs }, { data: regs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids),
      supabaseAdmin.from("registrations").select("user_id, attendee_code").eq("status", "paid").in("user_id", ids),
    ]);
    return ids.map((id) => {
      const p = profs?.find((x) => x.id === id);
      return { userId: id, email: p?.email ?? "", name: p?.full_name ?? null, code: regs?.find((r) => r.user_id === id)?.attendee_code ?? null };
    });
  });

/** Adds the speaker role and a complimentary (₦0) confirmed pass with a server-issued QR. Speakers never pay. */
export const inviteSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(255), origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result: "invited" | "granted" | "error"; message: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    let invited = false;
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing) userId = existing.id;
    else {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${data.origin}/ball/app/login?setup=speaker` });
      if (error || !inv.user) { console.error("speaker invite failed", error?.message); return { result: "error", message: "We couldn't send that invite. Check the email and try again." }; }
      userId = inv.user.id; invited = true;
    }
    const { error: rErr } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "speaker", granted_by: context.userId }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) { console.error("speaker role failed", rErr.message); return { result: "error", message: "The speaker role couldn't be added. Try again." }; }
    // Complimentary pass, only if she has no confirmed registration already.
    const { data: paid } = await supabaseAdmin.from("registrations").select("id").eq("user_id", userId).eq("status", "paid").maybeSingle();
    let regId = paid?.id ?? null;
    if (!regId) {
      const { data: t } = await supabaseAdmin.from("ticket_types").select("id, currency").eq("is_active", true).order("price_kobo").limit(1).maybeSingle();
      if (!t) return { result: "error", message: "No ticket type is set up to attach the pass to." };
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = "PCHB26-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
      const { data: pending } = await supabaseAdmin.from("registrations").select("id").eq("user_id", userId).eq("status", "pending").maybeSingle();
      const row = { status: "paid" as const, amount_kobo: 0, paid_at: new Date().toISOString(), payment_reference: "SPEAKER-COMP" };
      const res = pending
        ? await supabaseAdmin.from("registrations").update(row).eq("id", pending.id).select("id").single()
        : await supabaseAdmin.from("registrations").insert({ ...row, user_id: userId, ticket_type_id: t.id, attendee_code: code, currency: t.currency }).select("id").single();
      if (res.error) { console.error("speaker pass failed", res.error.message); return { result: "error", message: "The speaker role was added, but her pass couldn't be created. Try again." }; }
      regId = res.data.id;
    }
    const { error: badgeError } = await supabaseAdmin.from("attendee_badges").upsert({ registration_id: regId, user_id: userId }, { onConflict: "registration_id", ignoreDuplicates: true });
    if (badgeError) return { result: "error", message: "Speaker access was added, but her pass couldn't be issued. Try again." };
    if (!invited) {
      const { error: mailError } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo: `${data.origin}/ball/app/login?setup=speaker` });
      if (mailError) return { result: "error", message: "Her speaker page and free pass are ready, but the access email couldn't be sent. She can sign in with her existing password; try again to resend the email." };
    }
    return invited
      ? { result: "invited", message: `Invite sent to ${data.email}. She'll set her own password, then find her free Ball Pass and Speaker page in the app.` }
      : { result: "granted", message: `${data.email} has speaker access and a free Ball Pass. A secure password-setup email was sent; she can also sign in with her existing password. No registration or payment is required.` };
  });

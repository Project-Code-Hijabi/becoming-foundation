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

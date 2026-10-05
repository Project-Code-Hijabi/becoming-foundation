import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN = /^PCHB26-[0-9a-f]{64}$/;

export type LookupResult =
  | { state: "invalid" }
  | { state: "unpaid" | "revoked" | "ok" | "already"; badgeId: string; name: string; ticket: string; photoUrl: string | null; dietary: string | null; accessibility: string | null; checkedInAt: string | null };

/** Staff-only. Uses the existing staff_lookup_badge function (raises for non-staff). */
export const staffLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<LookupResult> => {
    const token = data.token.trim();
    if (!TOKEN.test(token)) return { state: "invalid" };
    const { data: rows, error } = await context.supabase.rpc("staff_lookup_badge", { _qr_token: token });
    if (error) throw new Error("not_authorised");
    const b = rows?.[0];
    if (!b) return { state: "invalid" };
    let checkedInAt: string | null = null;
    if (b.already_checked_in) {
      const { data: ci } = await context.supabase.from("check_ins").select("checked_in_at")
        .eq("badge_id", b.badge_id).is("programme_item_id", null).order("checked_in_at").limit(1).maybeSingle();
      checkedInAt = ci?.checked_in_at ?? null;
    }
    let photoUrl: string | null = null;
    if (b.photo_path) {
      // Caller is verified staff (the RPC above raised otherwise); sign one short-lived photo URL.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: s } = await supabaseAdmin.storage.from("attendee-photos").createSignedUrl(b.photo_path, 120);
      photoUrl = s?.signedUrl ?? null;
    }
    const state = b.badge_status !== "active" ? "revoked" : b.registration_status !== "paid" ? "unpaid" : b.already_checked_in ? "already" : "ok";
    return { state, badgeId: b.badge_id, name: b.full_name ?? "Attendee", ticket: b.ticket_name, photoUrl, dietary: b.dietary_notes, accessibility: b.accessibility_notes, checkedInAt };
  });

export const staffCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ badgeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ result: "checked_in" | "already" | "refused" }> => {
    // guard_check_in trigger enforces staff, active badge, paid registration and sets user_id/checked_in_by.
    const { error } = await context.supabase.from("check_ins").insert({
      badge_id: data.badgeId, user_id: context.userId, checked_in_by: context.userId, is_override: false,
    });
    if (!error) return { result: "checked_in" };
    if (error.code === "23505") return { result: "already" };
    return { result: "refused" };
  });

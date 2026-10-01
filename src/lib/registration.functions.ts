import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PublicTicket = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceKobo: number;
  currency: string;
  onSale: boolean;
  note: string | null;
};

/** Public: active ticket types straight from the database (price source of truth). */
export const getTicketTypes = createServerFn({ method: "GET" }).handler(async (): Promise<PublicTicket[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb
    .from("ticket_types")
    .select("id, code, name, description, price_kobo, currency, sales_start, sales_end")
    .eq("is_active", true)
    .order("price_kobo", { ascending: true });
  if (error) throw new Error("tickets_unavailable");
  const now = Date.now();
  return (data ?? []).map((t) => {
    const notYet = t.sales_start && new Date(t.sales_start).getTime() > now;
    const ended = t.sales_end && new Date(t.sales_end).getTime() < now;
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      priceKobo: t.price_kobo,
      currency: t.currency,
      onSale: !notYet && !ended,
      note: notYet ? "Not on sale yet" : ended ? "Sales have closed" : null,
    };
  });
});

export type RegistrationResult =
  | { ok: true; attendeeCode: string; ticketName: string; amountKobo: number; currency: string; status: "pending" | "paid" }
  | { ok: false; reason: "already_paid" | "unavailable" | "sold_out" | "price_changed" | "profile_incomplete" | "error"; newPriceKobo?: number };

const regInput = z.object({
  ticketTypeId: z.string().uuid(),
  expectedPriceKobo: z.number().int().nonnegative(),
  dietaryNotes: z.string().trim().max(500).optional().default(""),
  accessibilityNotes: z.string().trim().max(500).optional().default(""),
});

function attendeeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "PCHB26-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Signed in: create or refresh the caller's pending registration. Price always comes from the database. */
export const createRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => regInput.parse(d))
  .handler(async ({ data, context }): Promise<RegistrationResult> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("full_name, phone, profession").eq("id", userId).maybeSingle();
    if (!profile?.full_name || !profile.phone || !profile.profession) return { ok: false, reason: "profile_incomplete" };

    const { data: ticket } = await supabase
      .from("ticket_types")
      .select("id, name, price_kobo, currency, sales_start, sales_end, quantity_cap, is_active")
      .eq("id", data.ticketTypeId)
      .maybeSingle();
    const now = Date.now();
    if (
      !ticket || !ticket.is_active ||
      (ticket.sales_start && new Date(ticket.sales_start).getTime() > now) ||
      (ticket.sales_end && new Date(ticket.sales_end).getTime() < now)
    ) return { ok: false, reason: "unavailable" };
    if (ticket.price_kobo !== data.expectedPriceKobo) return { ok: false, reason: "price_changed", newPriceKobo: ticket.price_kobo };

    const { data: existing } = await supabase
      .from("registrations")
      .select("id, status, attendee_code, ticket_type_id")
      .eq("user_id", userId)
      .in("status", ["pending", "paid"])
      .maybeSingle();
    if (existing?.status === "paid") return { ok: false, reason: "already_paid" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (ticket.quantity_cap != null) {
      const { count } = await supabaseAdmin
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("ticket_type_id", ticket.id)
        .eq("status", "paid");
      if ((count ?? 0) >= ticket.quantity_cap) return { ok: false, reason: "sold_out" };
    }

    const fields = {
      ticket_type_id: ticket.id,
      amount_kobo: ticket.price_kobo,
      currency: ticket.currency,
      dietary_notes: data.dietaryNotes || null,
      accessibility_notes: data.accessibilityNotes || null,
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("registrations").update(fields).eq("id", existing.id).eq("status", "pending");
      if (error) return { ok: false, reason: "error" };
      return { ok: true, attendeeCode: existing.attendee_code, ticketName: ticket.name, amountKobo: ticket.price_kobo, currency: ticket.currency, status: "pending" };
    }

    for (let i = 0; i < 3; i++) {
      const code = attendeeCode();
      const { error } = await supabaseAdmin.from("registrations").insert({ ...fields, user_id: userId, attendee_code: code, status: "pending" });
      if (!error) return { ok: true, attendeeCode: code, ticketName: ticket.name, amountKobo: ticket.price_kobo, currency: ticket.currency, status: "pending" };
      if (error.code !== "23505") return { ok: false, reason: "error" };
      // unique clash on attendee_code → retry; clash on one-active-per-user → someone double-clicked
      const { data: again } = await supabase.from("registrations").select("attendee_code, status").eq("user_id", userId).in("status", ["pending", "paid"]).maybeSingle();
      if (again) {
        if (again.status === "paid") return { ok: false, reason: "already_paid" };
        return { ok: true, attendeeCode: again.attendee_code, ticketName: ticket.name, amountKobo: ticket.price_kobo, currency: ticket.currency, status: "pending" };
      }
    }
    return { ok: false, reason: "error" };
  });

export type StartPaymentResult =
  | { status: "redirect"; link: string }
  | { status: "not_configured" | "already_paid" | "no_registration" | "price_changed" | "unavailable" | "error" };

/** Signed in: creates a pending payment attempt server-side and returns the Flutterwave checkout link. */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StartPaymentResult> => {
    const { data: reg } = await context.supabase
      .from("registrations")
      .select("id, status, amount_kobo, currency, ticket_type_id")
      .eq("user_id", context.userId)
      .in("status", ["pending", "paid"])
      .maybeSingle();
    if (!reg) return { status: "no_registration" };
    if (reg.status === "paid") return { status: "already_paid" };

    const fw = await import("@/lib/flutterwave.server");
    if (!fw.isFlutterwaveConfigured()) return { status: "not_configured" };

    // Re-check the ticket right before charging: price and availability come from the database.
    const { data: ticket } = await context.supabase
      .from("ticket_types")
      .select("name, price_kobo, currency, is_active, sales_start, sales_end")
      .eq("id", reg.ticket_type_id)
      .maybeSingle();
    const now = Date.now();
    if (!ticket || !ticket.is_active ||
      (ticket.sales_start && new Date(ticket.sales_start).getTime() > now) ||
      (ticket.sales_end && new Date(ticket.sales_end).getTime() < now)) return { status: "unavailable" };
    if (ticket.price_kobo !== reg.amount_kobo || ticket.currency !== reg.currency) return { status: "price_changed" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, phone, email").eq("id", context.userId).maybeSingle();
    const email = (context.claims as { email?: string }).email ?? profile?.email;
    if (!email) return { status: "error" };

    // Retire earlier unfinished attempts so only the newest can be paid against.
    const { data: open } = await supabaseAdmin.from("payments").select("tx_ref").eq("registration_id", reg.id).eq("status", "pending");
    for (const p of open ?? []) {
      const r = await fw.verifyAndFinalize(p.tx_ref);
      if (r === "paid") return { status: "already_paid" };
      if (r === "pending" || r === "not_found") {
        await supabaseAdmin.from("payments").update({ status: "cancelled", failure_reason: "superseded" }).eq("tx_ref", p.tx_ref).eq("status", "pending");
      }
    }

    const txRef = fw.newTxRef();
    const { error } = await supabaseAdmin.from("payments").insert({
      registration_id: reg.id, user_id: context.userId, provider: "flutterwave",
      tx_ref: txRef, amount_kobo: reg.amount_kobo, currency: reg.currency, status: "pending",
    });
    if (error) return { status: "error" };

    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    try {
      const link = await fw.createCheckout({
        txRef, amountKobo: reg.amount_kobo, currency: reg.currency, email,
        name: profile?.full_name ?? null, phone: profile?.phone ?? null,
        redirectUrl: `${origin}/ball/register`, ticketName: ticket.name,
      });
      return { status: "redirect", link };
    } catch {
      await supabaseAdmin.from("payments").update({ status: "failed", failure_reason: "checkout_creation_failed" }).eq("tx_ref", txRef);
      return { status: "error" };
    }
  });

export type VerifyResult = { outcome: "paid" | "pending" | "cancelled" | "failed" | "mismatch" | "not_found" | "unavailable" };

/** Signed in: verifies the caller's own payment directly with Flutterwave. Idempotent. */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ txRef: z.string().regex(/^PCHB26-PAY-[0-9a-f]{32}$/), cancelled: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { data: own } = await context.supabase.from("registrations").select("id").eq("user_id", context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin.from("payments").select("user_id").eq("tx_ref", data.txRef).maybeSingle();
    if (!pay || pay.user_id !== context.userId || !own?.length) return { outcome: "not_found" };
    const { verifyAndFinalize, isFlutterwaveConfigured } = await import("@/lib/flutterwave.server");
    if (!isFlutterwaveConfigured()) return { outcome: "unavailable" };
    return { outcome: await verifyAndFinalize(data.txRef, { clientSaysCancelled: data.cancelled }) };
  });

/** Signed in: the caller's own registration summary (no internal IDs, no tokens). */
export const getMyRegistration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("registrations")
      .select("status, attendee_code, amount_kobo, currency, ticket_types(name), attendee_badges(status)")
      .eq("user_id", context.userId)
      .in("status", ["pending", "paid"])
      .maybeSingle();
    if (!data) return null;
    const badges = (data as unknown as { attendee_badges: { status: string }[] | { status: string } | null }).attendee_badges;
    const badge = Array.isArray(badges) ? badges[0] : badges;
    return {
      status: data.status as "pending" | "paid",
      attendeeCode: data.attendee_code,
      amountKobo: data.amount_kobo,
      currency: data.currency,
      ticketName: (data.ticket_types as unknown as { name: string } | null)?.name ?? "",
      badgeActive: badge?.status === "active",
    };
  });

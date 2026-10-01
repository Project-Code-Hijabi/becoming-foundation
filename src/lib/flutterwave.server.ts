// Server-only Flutterwave helpers. Never import from components.
// The browser is never trusted: every decision here is based on a direct call to Flutterwave.

const FW_BASE = "https://api.flutterwave.com/v3";

export type VerifyOutcome =
  | "paid"
  | "pending"
  | "cancelled"
  | "failed"
  | "mismatch"
  | "not_found"
  | "unavailable";

function secret() {
  const k = process.env["FLUTTERWAVE_SECRET_KEY"];
  if (!k) throw new Error("flutterwave_not_configured");
  return k;
}

export function isFlutterwaveConfigured() {
  return Boolean(process.env["FLUTTERWAVE_SECRET_KEY"]);
}

export function newTxRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return "PCHB26-PAY-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createCheckout(args: {
  txRef: string;
  amountKobo: number;
  currency: string;
  email: string;
  name: string | null;
  phone: string | null;
  redirectUrl: string;
  ticketName: string;
}): Promise<string> {
  const res = await fetch(`${FW_BASE}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: args.txRef,
      amount: (args.amountKobo / 100).toFixed(2),
      currency: args.currency,
      redirect_url: args.redirectUrl,
      customer: { email: args.email, name: args.name ?? undefined, phonenumber: args.phone ?? undefined },
      customizations: { title: "PCH Annual Ball 2026", description: args.ticketName },
      configurations: { session_duration: 30, max_retry_attempt: 3 },
    }),
  });
  const json = (await res.json().catch(() => null)) as { status?: string; data?: { link?: string } } | null;
  if (!res.ok || json?.status !== "success" || !json.data?.link) {
    console.error("[flutterwave] checkout creation failed", res.status);
    throw new Error("checkout_failed");
  }
  return json.data.link;
}

type FwTx = {
  id: number;
  tx_ref: string;
  status: string;
  amount: number;
  currency: string;
  customer?: { email?: string };
};

async function fetchByReference(txRef: string): Promise<FwTx | null | "error"> {
  try {
    const res = await fetch(`${FW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${secret()}` },
    });
    const json = (await res.json().catch(() => null)) as { status?: string; data?: FwTx } | null;
    if (res.ok && json?.status === "success" && json.data) return json.data;
    if (res.status === 400 || res.status === 404) return null; // no transaction for this ref (yet)
    return "error";
  } catch {
    return "error";
  }
}

/**
 * Idempotent: verifies a payment with Flutterwave and, only if everything matches,
 * marks payment successful, registration paid, and issues the badge (server-generated token).
 */
export async function verifyAndFinalize(txRef: string, opts: { clientSaysCancelled?: boolean | undefined } = {}): Promise<VerifyOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, registration_id, user_id, amount_kobo, currency, status, tx_ref")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!pay) return "not_found";
  if (pay.status === "successful") {
    await ensureBadge(pay.registration_id, pay.user_id);
    return "paid";
  }

  const tx = await fetchByReference(txRef);
  if (tx === "error") return "unavailable";
  if (tx === null) {
    if (opts.clientSaysCancelled && pay.status === "pending") {
      await supabaseAdmin.from("payments").update({ status: "cancelled", failure_reason: "checkout_cancelled" }).eq("id", pay.id).eq("status", "pending");
      return "cancelled";
    }
    return pay.status === "cancelled" ? "cancelled" : "pending";
  }

  const { data: reg } = await supabaseAdmin
    .from("registrations")
    .select("id, status, amount_kobo, currency, user_id")
    .eq("id", pay.registration_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const status = tx.status.toLowerCase();

  if (status !== "successful") {
    if (status === "failed" || status === "cancelled") {
      await supabaseAdmin
        .from("payments")
        .update({ status: status === "failed" ? "failed" : "cancelled", provider_transaction_id: String(tx.id), provider_payload: tx as never, verified_at: now, failure_reason: `provider_${status}` })
        .eq("id", pay.id)
        .eq("status", "pending");
      return status === "failed" ? "failed" : "cancelled";
    }
    return "pending";
  }

  const amountKobo = Math.round(Number(tx.amount) * 100);
  const mismatch =
    !reg ||
    tx.tx_ref !== pay.tx_ref ||
    tx.currency !== pay.currency ||
    amountKobo !== pay.amount_kobo ||
    reg.user_id !== pay.user_id ||
    reg.amount_kobo !== pay.amount_kobo ||
    reg.currency !== pay.currency;

  if (mismatch) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", provider_transaction_id: String(tx.id), provider_payload: tx as never, verified_at: now, failure_reason: "amount_or_currency_mismatch" })
      .eq("id", pay.id)
      .eq("status", "pending");
    return "mismatch";
  }

  // Conditional update makes concurrent verifications (return page + webhook) safe.
  const { data: won } = await supabaseAdmin
    .from("payments")
    .update({ status: "successful", provider_transaction_id: String(tx.id), provider_payload: tx as never, verified_at: now, paid_at: now, failure_reason: null })
    .eq("id", pay.id)
    .in("status", ["pending", "cancelled", "failed"])
    .select("id")
    .maybeSingle();

  if (won && reg && reg.status !== "paid") {
    await supabaseAdmin
      .from("registrations")
      .update({ status: "paid", paid_at: now, payment_reference: pay.tx_ref })
      .eq("id", reg.id)
      .eq("status", "pending");
  }
  await ensureBadge(pay.registration_id, pay.user_id);
  return "paid";
}

async function ensureBadge(registrationId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: reg } = await supabaseAdmin.from("registrations").select("status").eq("id", registrationId).maybeSingle();
  if (reg?.status !== "paid") return;
  // qr_token defaults to generate_qr_token() in the database; unique(registration_id) prevents duplicates.
  await supabaseAdmin
    .from("attendee_badges")
    .upsert({ registration_id: registrationId, user_id: userId }, { onConflict: "registration_id", ignoreDuplicates: true });
}

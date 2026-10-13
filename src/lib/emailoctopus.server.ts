// Server-only EmailOctopus integration (API v2). Never import from client code.
const API = "https://api.emailoctopus.com";
const DEFAULT_AUTOMATION_ID = "3dae64c2-c737-11f1-ab9f-3dcc5f696374";

function cfg() {
  const key = process.env["EMAILOCTOPUS_API_KEY"];
  const listId = process.env["EMAILOCTOPUS_LIST_ID"];
  const automationId = process.env["EMAILOCTOPUS_AUTOMATION_ID"] || DEFAULT_AUTOMATION_ID;
  return { key, listId, automationId };
}

async function eo(path: string, init: RequestInit = {}) {
  const { key } = cfg();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body: body as any };
}

export type EmailStatus = { keySet: boolean; listSet: boolean; valid: boolean; listName: string | null; problem: string | null };

/** Checks configuration against EmailOctopus without revealing any secret value. */
export async function checkEmailOctopus(): Promise<EmailStatus> {
  const { key, listId } = cfg();
  const base = { keySet: !!key, listSet: !!listId, valid: false, listName: null };
  if (!key) return { ...base, problem: "The EmailOctopus API key hasn't been added yet." };
  if (!listId) return { ...base, problem: "The EmailOctopus list ID hasn't been added yet." };
  const r = await eo(`/lists/${encodeURIComponent(listId)}`);
  if (r.status === 401 || r.status === 403) return { ...base, problem: "EmailOctopus rejected the API key." };
  if (r.status === 404) return { ...base, problem: "EmailOctopus couldn't find that list ID." };
  if (!r.ok) return { ...base, problem: "EmailOctopus couldn't be reached. Try again shortly." };
  return { ...base, valid: true, listName: r.body?.name ?? null, problem: null };
}

/**
 * Adds a confirmed (paid or authorised free) attendee to the list and queues the
 * confirmation automation exactly once, guarded by registrations.confirmation_email_sent_at.
 */
export async function sendConfirmation(registrationId: string, origin?: string): Promise<"sent" | "skipped" | "not_configured" | "failed"> {
  const { key, listId, automationId } = cfg();
  if (!key || !listId) return "not_configured";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Atomic claim: only one caller can move this from null to a timestamp, and only when paid.
  const { data: claimed } = await supabaseAdmin
    .from("registrations")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("status", "paid")
    .is("confirmation_email_sent_at", null)
    .select("user_id, attendee_code, ticket_types(name)")
    .maybeSingle();
  if (!claimed) return "skipped";

  const release = () => supabaseAdmin.from("registrations").update({ confirmation_email_sent_at: null }).eq("id", registrationId);
  try {
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", claimed.user_id).maybeSingle();
    const email = profile?.email;
    if (!email) { await release(); return "failed"; }
    const [first, ...rest] = (profile?.full_name ?? "").trim().split(/\s+/);
    const site = origin || process.env["PUBLIC_SITE_URL"] || "";
    const fields = {
      FirstName: first || "",
      LastName: rest.join(" "),
      AttendeeID: claimed.attendee_code,
      TicketName: (claimed.ticket_types as unknown as { name: string } | null)?.name ?? "",
      PassLink: site ? `${site}/ball/app` : "",
    };
    // PUT = create or update (safe for duplicate contacts).
    let c = await eo(`/lists/${encodeURIComponent(listId)}/contacts`, { method: "PUT", body: JSON.stringify({ email_address: email, fields, status: "subscribed" }) });
    if (!c.ok && c.status === 422) {
      // Custom fields not created on the list yet — fall back to name fields only.
      c = await eo(`/lists/${encodeURIComponent(listId)}/contacts`, { method: "PUT", body: JSON.stringify({ email_address: email, fields: { FirstName: fields.FirstName, LastName: fields.LastName }, status: "subscribed" }) });
    }
    const contactId = c.body?.id;
    if (!c.ok || !contactId) { console.error("emailoctopus contact failed", c.status); await release(); return "failed"; }
    const q = await eo(`/automations/${encodeURIComponent(automationId)}/queue`, { method: "POST", body: JSON.stringify({ contact_id: contactId }) });
    // 409 means this contact is already queued/has run — treat as done, never resend.
    if (!q.ok && q.status !== 409) { console.error("emailoctopus queue failed", q.status); await release(); return "failed"; }
    return "sent";
  } catch {
    console.error("emailoctopus error");
    await release();
    return "failed";
  }
}

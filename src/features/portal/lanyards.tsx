import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoad, must, State } from "./shared";
import { buildBadgePdf } from "./badge-pdf";
import { Button } from "@/components/ui/button";

/** One printable pass. Only paid registrations with an active badge are included. */
export type LanyardPass = { name: string; code: string; ticket: string; role: string | null; token: string };

const card = "rounded-sm border border-border bg-card p-4";
const btn = "rounded-sm bg-secondary px-3 py-2 text-sm text-ivory hover:bg-velvet disabled:opacity-50";
const field = "w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

async function loadPasses(): Promise<LanyardPass[]> {
  const regs = must(await supabase.from("registrations").select("id, user_id, attendee_code, ticket_types(name)").eq("status", "paid")) as unknown as { id: string; user_id: string; attendee_code: string; ticket_types: { name: string } | null }[];
  if (!regs.length) return [];
  const ids = regs.map((r) => r.user_id);
  const [b, p, ro] = await Promise.all([
    supabase.from("attendee_badges").select("registration_id, qr_token").eq("status", "active").in("registration_id", regs.map((r) => r.id)),
    supabase.from("profiles").select("id, full_name").in("id", ids),
    supabase.from("user_roles").select("user_id, role").in("user_id", ids).in("role", ["speaker"]),
  ]);
  const badges = must(b) ?? [];
  const profs = must(p) ?? [];
  const speakers = new Set((ro.data ?? []).map((x) => x.user_id));
  return regs
    .map((r) => {
      const badge = badges.find((x) => x.registration_id === r.id);
      if (!badge) return null;
      return { name: profs.find((x) => x.id === r.user_id)?.full_name?.trim() || "Guest", code: r.attendee_code, ticket: r.ticket_types?.name ?? "", role: speakers.has(r.user_id) ? "SPEAKER" : null, token: badge.qr_token };
    })
    .filter((x): x is LanyardPass => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Built-in PDF fonts only cover Latin-1; strip accents outside it so no name prints as boxes. */
export function pdfSafe(s: string) {
  return [...s].map((ch) => (ch.charCodeAt(0) <= 255 ? ch : ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\xff]/g, ""))).join("");
}

export async function buildLanyardPdf(passes: LanyardPass[], layout: "single" | "sheet") {
  return buildBadgePdf(passes, layout);
}

export function Lanyards() {
  const d = useLoad(loadPasses);
  const [layout, setLayout] = useState<"single" | "sheet">("single");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function download(list: LanyardPass[], file: string) {
    setBusy(true); setMsg(null);
    try { const doc = await buildLanyardPdf(list, layout); doc.save(file); setMsg(`Downloaded ${list.length} pass${list.length === 1 ? "" : "es"}.`); }
    catch (e) { console.error(e); setMsg("The PDF couldn't be made. Try again."); }
    setBusy(false);
  }
  const shown = (d.data ?? []).filter((p) => !q || [p.name, p.code].some((v) => v.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">Lanyard passes (PDF)</h2>
        <p className="text-sm text-muted-foreground">Every confirmed guest with an active Ball Pass: full name and the same QR code the door scanner checks. Treat printed passes like tickets — anyone holding one can be checked in.</p>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">Layout</legend>
          <label className="flex items-center gap-2"><input type="radio" name="layout" checked={layout === "single"} onChange={() => setLayout("single")} />One pass per page (54 × 86 mm, 3 mm bleed)</label>
          <label className="flex items-center gap-2"><input type="radio" name="layout" checked={layout === "sheet"} onChange={() => setLayout("sheet")} />4 passes per A4 sheet (cut along dotted lines)</label>
        </fieldset>
        <Button className={btn} disabled={busy || !d.data?.length} onClick={() => { if (d.data?.length) void download(d.data, `pch-ball-2026-passes-${layout}.pdf`); }}>{busy ? "Making PDF…" : `Download all ${d.data?.length ?? 0} passes`}</Button>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>
      <State {...d} tone="light" empty={d.data?.length === 0 && "No confirmed passes yet."}>
        <section className={card}>
          <input aria-label="Search passes" placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} max-w-xs`} />
          <ul className="mt-3 divide-y divide-border text-sm">
            {shown.map((p) => (
              <li key={p.code} className="flex items-center justify-between gap-2 py-2">
                <span>{p.name}<span className="block text-xs text-muted-foreground">{p.role ?? p.ticket} · <span className="font-mono">{p.code}</span></span></span>
                <button className="text-xs underline" disabled={busy} onClick={() => download([p], `pass-${p.code}.pdf`)}>Download</button>
              </li>
            ))}
          </ul>
        </section>
      </State>
    </div>
  );
}

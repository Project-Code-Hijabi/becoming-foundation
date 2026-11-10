import { useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useLoad, must, State } from "./shared";

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

const PURPLE: [number, number, number] = [53, 18, 79];
const PINK: [number, number, number] = [201, 54, 130];
const IVORY: [number, number, number] = [255, 248, 252];

/** Draws one 105×148mm (A6) badge with its top-left at x,y. */
async function drawBadge(doc: import("jspdf").jsPDF, p: LanyardPass, x: number, y: number) {
  const w = 105, h = 148;
  doc.setFillColor(...IVORY); doc.rect(x, y, w, h, "F");
  doc.setFillColor(...PURPLE); doc.rect(x, y, w, 30, "F");
  doc.setFillColor(...PINK); doc.rect(x, y + 30, w, 1.5, "F");
  // lanyard hole guide
  doc.setDrawColor(...IVORY); doc.setLineWidth(0.3); doc.roundedRect(x + w / 2 - 8, y + 4, 16, 3, 1.5, 1.5, "S");
  doc.setTextColor(...IVORY); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text("PROJECT CODE-HIJABI  ·  PINK & PURPLE EDITION", x + w / 2, y + 14, { align: "center" });
  doc.setFont("times", "bold"); doc.setFontSize(16);
  doc.text("ANNUAL BALL 2026", x + w / 2, y + 23, { align: "center" });

  // Name: shrink until it fits on at most two lines.
  const name = pdfSafe(p.name);
  doc.setTextColor(...PURPLE); doc.setFont("times", "bold");
  let size = 26, lines: string[] = [];
  for (; size >= 12; size -= 1) { doc.setFontSize(size); lines = doc.splitTextToSize(name, w - 14); if (lines.length <= 2) break; }
  const lh = size * 0.42;
  lines.slice(0, 2).forEach((l, i) => doc.text(l, x + w / 2, y + 44 + i * lh, { align: "center" }));
  let cy = y + 44 + Math.min(lines.length, 2) * lh;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...PINK);
  doc.text(pdfSafe((p.role ?? p.ticket ?? "").toUpperCase()), x + w / 2, cy + 1, { align: "center" });

  const qr = await QRCode.toDataURL(p.token, { margin: 1, width: 600, errorCorrectionLevel: "M", color: { dark: "#35124F", light: "#FFF8FC" } });
  const q = 58;
  doc.addImage(qr, "PNG", x + (w - q) / 2, y + 66, q, q);
  doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(...PURPLE);
  doc.text(p.code, x + w / 2, y + 129, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("Saturday 28 November 2026  ·  Raybam, Lagos", x + w / 2, y + 138, { align: "center" });
  doc.setTextColor(...PINK); doc.text("BECOMING", x + w / 2, y + 143, { align: "center" });
}

export async function buildLanyardPdf(passes: LanyardPass[], layout: "single" | "sheet") {
  const { jsPDF } = await import("jspdf");
  if (layout === "single") {
    const doc = new jsPDF({ unit: "mm", format: "a6" });
    for (let i = 0; i < passes.length; i++) { if (i) doc.addPage("a6"); await drawBadge(doc, passes[i]!, 0, 0); }
    return doc;
  }
  // A4 portrait holds a 2×2 grid of A6 badges exactly; light cut lines between them.
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let i = 0; i < passes.length; i++) {
    const slot = i % 4;
    if (i && slot === 0) doc.addPage("a4");
    await drawBadge(doc, passes[i]!, (slot % 2) * 105, Math.floor(slot / 2) * 148.5);
    if (slot === 3 || i === passes.length - 1) {
      doc.setDrawColor(201, 167, 232); doc.setLineWidth(0.2); doc.setLineDashPattern([2, 2], 0);
      doc.line(105, 0, 105, 297); doc.line(0, 148.5, 210, 148.5); doc.setLineDashPattern([], 0);
    }
  }
  return doc;
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
          <label className="flex items-center gap-2"><input type="radio" name="layout" checked={layout === "single"} onChange={() => setLayout("single")} />One pass per page (A6 lanyard size)</label>
          <label className="flex items-center gap-2"><input type="radio" name="layout" checked={layout === "sheet"} onChange={() => setLayout("sheet")} />4 passes per A4 sheet (cut along dotted lines)</label>
        </fieldset>
        <button className={btn} disabled={busy || !d.data?.length} onClick={() => download(d.data!, `pch-ball-2026-passes-${layout}.pdf`)}>{busy ? "Making PDF…" : `Download all ${d.data?.length ?? 0} passes`}</button>
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

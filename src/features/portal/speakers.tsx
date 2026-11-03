import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteSpeaker, listSpeakers } from "@/lib/admin.functions";
import { State, useLoad, must } from "./shared";

const BUCKET = "speaker-materials";
type Material = { id: string; speaker_id: string; title: string; note: string | null; url: string | null; file_path: string | null; file_name: string | null; created_at: string };
const SOCIALS = [
  ["show_instagram", "Instagram"], ["show_linkedin", "LinkedIn"], ["show_website", "Website"], ["show_email", "Email"], ["show_whatsapp", "WhatsApp"],
] as const;
type ShareKey = (typeof SOCIALS)[number][0];

async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300, { download: true });
  if (error || !data) { alert("That file couldn't be opened. Try again."); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

/* ---------- Admin: Speakers tab ---------- */
const aCard = "rounded-sm border border-border bg-card p-4";
const aBtn = "rounded-sm bg-secondary px-3 py-2 text-sm text-ivory hover:bg-velvet disabled:opacity-50";
const aField = "w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

export function AdminSpeakers() {
  const list = useServerFn(listSpeakers);
  const invite = useServerFn(inviteSpeaker);
  const d = useLoad(() => list());
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { const r = await invite({ data: { email, origin: window.location.origin } }); setMsg(r.message); if (r.result !== "error") { setEmail(""); void d.reload(); } }
    catch { setMsg("Something went wrong. Try again."); }
    setBusy(false);
  }
  return (
    <div className="space-y-5">
      <form onSubmit={send} className={`${aCard} space-y-3`}>
        <h2 className="font-semibold">Add a speaker</h2>
        <p className="text-sm text-muted-foreground">She gets a free Ball Pass with her own QR code (no payment) and a Speaker page in the app where she shares slides and chooses which contacts guests can see. New emails receive an invite to set their own password.</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="spe" className="sr-only">Speaker email</label>
          <input id="spe" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="speaker@email.com" className={`${aField} max-w-sm`} />
          <button className={aBtn} disabled={busy}>{busy ? "Adding…" : "Add speaker"}</button>
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </form>
      <section className={aCard}>
        <h2 className="font-semibold">Speakers with app access</h2>
        <State {...d} tone="light" empty={d.data?.length === 0 && "No speakers added yet."}>
          <ul className="mt-2 divide-y divide-border text-sm">
            {d.data?.map((s) => (
              <li key={s.userId} className="py-2">{s.name ?? s.email}<span className="block text-xs text-muted-foreground">{s.email} · {s.code ? <span className="font-mono">{s.code}</span> : "no pass yet"}</span></li>
            ))}
          </ul>
        </State>
      </section>
    </div>
  );
}

/* ---------- Attendee app styles ---------- */
const card = "rounded-sm border border-lavender/20 bg-plum/60 p-5";
const field = "w-full rounded-sm border border-lavender/30 bg-ink/40 px-3 py-2 text-ivory placeholder:text-lavender/50 focus:border-blush focus:outline-none focus-visible:ring-2 focus-visible:ring-blush";
const btn = "inline-flex items-center justify-center rounded-sm bg-rose px-4 py-2 text-sm font-medium tracking-wide text-ink transition hover:bg-blush focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory disabled:opacity-50";

/* ---------- Speaker's own page ---------- */
export function SpeakerStudio({ userId }: { userId: string }) {
  const d = useLoad(async () => {
    const [m, s] = await Promise.all([
      supabase.from("speaker_materials").select("*").eq("speaker_id", userId).order("created_at", { ascending: false }),
      supabase.from("speaker_sharing").select("*").eq("speaker_id", userId).maybeSingle(),
    ]);
    return { materials: must(m) as Material[], share: must(s) };
  }, [userId]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!file && !url.trim()) { setMsg("Add a file or a link."); return; }
    if (url.trim() && !/^https:\/\//.test(url.trim())) { setMsg("Links must start with https://"); return; }
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, file.type ? { contentType: file.type } : {});
      if (up.error) { setBusy(false); setMsg("The file couldn't be uploaded (max 50 MB). Try again."); return; }
    }
    const { error } = await supabase.from("speaker_materials").insert({ speaker_id: userId, title: title.trim(), note: note.trim() || null, url: url.trim() || null, file_path: path, file_name: file?.name ?? null });
    setBusy(false);
    if (error) { if (path) await supabase.storage.from(BUCKET).remove([path]); setMsg("That couldn't be saved. Try again."); return; }
    setTitle(""); setNote(""); setUrl(""); setFile(null); (e.target as HTMLFormElement).reset();
    setMsg("Shared. Confirmed guests can now download it from their app."); void d.reload();
  }
  async function remove(m: Material) {
    if (!confirm(`Remove "${m.title}"? Guests will no longer see it.`)) return;
    if (m.file_path) await supabase.storage.from(BUCKET).remove([m.file_path]);
    await supabase.from("speaker_materials").delete().eq("id", m.id);
    void d.reload();
  }
  async function toggle(k: ShareKey, v: boolean) {
    const { error } = await supabase.from("speaker_sharing").upsert({ speaker_id: userId, ...(d.data?.share ?? {}), [k]: v, updated_at: new Date().toISOString() });
    if (error) setMsg("That setting couldn't be saved."); else void d.reload();
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-blush">Speaker</p>
        <h1 className="mt-2 font-serif text-4xl">Your speaker page</h1>
        <p className="mt-2 text-sm text-lavender">Your Ball Pass is free and already on the Pass tab. Share your slides or resources here — only confirmed guests can see and download them.</p>
      </div>
      <State {...d}>
        {d.data && (
          <>
            <form onSubmit={add} className={`${card} space-y-3`}>
              <h2 className="font-serif text-2xl">Share something</h2>
              <label className="block text-sm">Title<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} placeholder="e.g. Keynote slides" /></label>
              <label className="block text-sm">Short note (optional)<textarea maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1`} rows={2} /></label>
              <label className="block text-sm">File (slides, PDF, image — up to 50 MB)<input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-lavender" /></label>
              <label className="block text-sm">…or a link<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={`${field} mt-1`} placeholder="https://" /></label>
              <button className={btn} disabled={busy}>{busy ? "Sharing…" : "Share with guests"}</button>
              {msg && <p role="status" className="text-sm text-blush">{msg}</p>}
            </form>
            <div className={card}>
              <h2 className="font-serif text-2xl">What you've shared</h2>
              {d.data.materials.length === 0 ? <p className="mt-2 text-sm text-lavender/80">Nothing yet.</p> : (
                <ul className="mt-3 divide-y divide-lavender/15">
                  {d.data.materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>{m.title}<span className="block text-xs text-lavender/70">{m.file_name ?? m.url}</span></span>
                      <button onClick={() => remove(m)} className="text-xs underline">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <fieldset className={card}>
              <legend className="font-serif text-2xl">What guests can see</legend>
              <p className="mt-1 text-sm text-lavender">Everything is hidden until you switch it on. Contacts come from your Profile tab.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SOCIALS.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!d.data!.share?.[k]} onChange={(e) => toggle(k, e.target.checked)} /> Show my {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </State>
    </section>
  );
}

/* ---------- Attendee view: speakers' shared materials ---------- */
export function SpeakerResources() {
  const d = useLoad(async () => {
    const [dir, mats] = await Promise.all([
      supabase.rpc("speaker_directory"),
      supabase.from("speaker_materials").select("*").order("created_at", { ascending: false }),
    ]);
    return { speakers: must(dir) ?? [], materials: (must(mats) ?? []) as Material[] };
  });
  if (d.data && d.data.speakers.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-3xl">From the speakers</h2>
      <p className="mt-1 text-sm text-lavender">Slides and resources speakers have shared with confirmed guests.</p>
      <State {...d}>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {d.data?.speakers.map((s) => {
            const mine = d.data!.materials.filter((m) => m.speaker_id === s.id);
            const links = [
              s.instagram && ["Instagram", s.instagram.startsWith("http") ? s.instagram : `https://instagram.com/${s.instagram.replace(/^@/, "")}`],
              s.linkedin && ["LinkedIn", s.linkedin.startsWith("http") ? s.linkedin : `https://${s.linkedin}`],
              s.website && ["Website", s.website.startsWith("http") ? s.website : `https://${s.website}`],
              s.email && ["Email", `mailto:${s.email}`],
              s.whatsapp && ["WhatsApp", `https://wa.me/${s.whatsapp.replace(/\D/g, "")}`],
            ].filter(Boolean) as [string, string][];
            return (
              <li key={s.id} className={card}>
                <p className="font-serif text-xl">{s.full_name ?? "Speaker"}</p>
                {(s.profession || s.organisation) && <p className="text-sm text-lavender">{[s.profession, s.organisation].filter(Boolean).join(", ")}</p>}
                {links.length > 0 && <p className="mt-2 flex flex-wrap gap-3 text-xs">{links.map(([l, h]) => <a key={l} href={h} target="_blank" rel="noopener noreferrer" className="text-blush underline">{l}</a>)}</p>}
                {mine.length === 0 ? <p className="mt-3 text-xs text-lavender/70">No materials shared yet.</p> : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {mine.map((m) => (
                      <li key={m.id}>
                        {m.file_path
                          ? <button onClick={() => openFile(m.file_path!)} className="text-left text-ivory underline underline-offset-4">⇩ {m.title}</button>
                          : <a href={m.url!} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">↗ {m.title}</a>}
                        {m.note && <span className="block text-xs text-lavender/80">{m.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </State>
    </section>
  );
}

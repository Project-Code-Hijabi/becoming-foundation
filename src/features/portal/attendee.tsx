import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { State, useLoad, must, initials, fmtTime, signOut } from "./shared";

const EVENT = {
  name: "Project Code-Hijabi Annual Ball 2026",
  theme: "Becoming: Muslim Women Navigating Tech, Identity & Impact",
  date: "Saturday, 14 November 2026",
  venue: "Raybam",
  address: "20 Peace Estate Road, Alimosho, Lagos",
};

type Tab = "home" | "programme" | "guests" | "becoming" | "network" | "profile";
const TABS: [Tab, string][] = [
  ["home", "Pass"], ["programme", "Evening"], ["guests", "Guests"],
  ["becoming", "Becoming"], ["network", "Connect"], ["profile", "Profile"],
];

const card = "rounded-sm border border-lavender/20 bg-plum/60 p-5";
const field = "w-full rounded-sm border border-lavender/30 bg-ink/40 px-3 py-2 text-ivory placeholder:text-lavender/50 focus:border-blush focus:outline-none focus-visible:ring-2 focus-visible:ring-blush";
const btn = "inline-flex items-center justify-center rounded-sm bg-rose px-4 py-2 text-sm font-medium tracking-wide text-ink transition hover:bg-blush focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory disabled:opacity-50";
const ghost = "inline-flex items-center justify-center rounded-sm border border-lavender/40 px-4 py-2 text-sm text-lavender transition hover:border-blush hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush disabled:opacity-50";

export function AttendeeApp({ userId, email }: { userId: string; email: string }) {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <div className="velvet-bg grain min-h-screen pb-24 text-ivory md:pb-10">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-6">
        <a href="/ball" className="font-sans text-[11px] uppercase tracking-[0.3em] text-lavender">PCH · Annual Ball 2026</a>
        <button onClick={signOut} className="text-xs text-lavender underline underline-offset-4 hover:text-ivory">Sign out</button>
      </header>
      <nav aria-label="Ball sections" className="fixed inset-x-0 bottom-0 z-20 border-t border-lavender/20 bg-ink/95 md:static md:mx-auto md:mt-6 md:max-w-4xl md:border-0 md:bg-transparent md:px-5">
        <ul className="grid grid-cols-6 md:flex md:gap-6">
          {TABS.map(([k, l]) => (
            <li key={k}>
              <button onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
                className={`w-full py-3 text-[11px] uppercase tracking-[0.15em] md:text-xs ${tab === k ? "text-blush md:border-b md:border-blush" : "text-lavender/80 hover:text-ivory"}`}>{l}</button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto max-w-4xl px-5 pt-6">
        {tab === "home" && <Home userId={userId} />}
        {tab === "programme" && <Programme />}
        {tab === "guests" && <Guests />}
        {tab === "becoming" && <Becoming userId={userId} />}
        {tab === "network" && <Network userId={userId} />}
        {tab === "profile" && <Profile userId={userId} email={email} />}
      </main>
    </div>
  );
}

function Home({ userId }: { userId: string }) {
  const q = useLoad(async () => {
    const [profile, regs, badges, tickets, ann] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("registrations").select("id, attendee_code, status, ticket_type_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("attendee_badges").select("registration_id, qr_token, status").eq("user_id", userId),
      supabase.from("ticket_types").select("id, name"),
      supabase.from("announcements").select("id, title, body, publish_at, created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(5),
    ]);
    const r = must(regs);
    const reg = r.find((x) => x.status === "paid") ?? r[0] ?? null;
    const badge = reg ? must(badges).find((b) => b.registration_id === reg.id) ?? null : null;
    const ticket = reg ? must(tickets).find((t) => t.id === reg.ticket_type_id)?.name ?? "Ticket" : null;
    return { name: must(profile)?.full_name ?? "", reg, badge, ticket, ann: must(ann) };
  }, [userId]);
  const first = q.data?.name.split(" ")[0];
  return (
    <State {...q} reload={q.reload}>
      {q.data && (
        <div className="space-y-10">
          <section>
            <p className="text-sm text-lavender">Hi{first ? `, ${first}` : ""}.</p>
            <h1 className="mt-2 font-serif text-5xl md:text-6xl">{q.data.reg?.status === "paid" ? "You're in. 💜" : "Almost there."}</h1>
            <p className="mt-4 font-serif text-xl text-blush">{EVENT.name}</p>
            <p className="mt-1 text-lavender">{EVENT.theme}</p>
            <p className="mt-4 text-sm text-ivory/90">{EVENT.date}<br />{EVENT.venue}<br />{EVENT.address}</p>
          </section>
          <Pass data={q.data} />
          <section aria-labelledby="ann">
            <h2 id="ann" className="font-serif text-3xl">Notes from the hosts</h2>
            {q.data.ann.length === 0 ? <p className="mt-3 text-sm text-lavender/80">No announcements yet. We'll share updates here.</p> : (
              <ul className="mt-4 space-y-3">
                {q.data.ann.map((a) => (
                  <li key={a.id} className={card}>
                    <p className="font-serif text-xl">{a.title}</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-lavender">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </State>
  );
}

function Pass({ data }: { data: { name: string; reg: { attendee_code: string; status: string } | null; badge: { qr_token: string; status: string } | null; ticket: string | null } }) {
  const [qr, setQr] = useState<string | null>(null);
  const active = data.reg?.status === "paid" && data.badge?.status === "active";
  useEffect(() => {
    if (active && data.badge) QRCode.toDataURL(data.badge.qr_token, { margin: 1, width: 360, color: { dark: "#35124F", light: "#FFF8FC" } }).then(setQr);
  }, [active, data.badge]);
  if (!data.reg)
    return (
      <section className={card}>
        <p className="font-serif text-2xl">You don't have a seat yet.</p>
        <a href="/ball/register" className={`${btn} mt-4`}>Get your ticket</a>
      </section>
    );
  return (
    <section aria-labelledby="pass" className="overflow-hidden rounded-sm bg-ivory text-plum shadow-[0_20px_60px_-20px] shadow-rose/40">
      <div className="bg-gradient-to-r from-plum to-velvet px-6 py-4 text-ivory">
        <p className="text-[11px] uppercase tracking-[0.3em] text-blush">Ball Pass · Pink & Purple Edition</p>
        <h2 id="pass" className="font-serif text-3xl">Becoming</h2>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Item k="Name" v={data.name || "—"} />
          <Item k="Ticket" v={data.ticket ?? "—"} />
          <Item k="Attendee ID" v={data.reg.attendee_code} mono />
          <Item k="Status" v={active ? "Confirmed" : data.reg.status === "paid" ? "Pass being prepared" : "Payment not confirmed"} />
          <Item k="Date" v="14 Nov 2026" />
          <Item k="Venue" v="Raybam, Alimosho, Lagos" />
        </dl>
        <div className="flex flex-col items-center justify-center">
          {active ? (qr ? <img src={qr} alt="Your Ball Pass QR code. Show this at the door." className="h-48 w-48" /> : <p className="text-sm">Preparing QR…</p>)
            : <p className="max-w-[12rem] text-center text-sm text-plum/70">{data.reg.status === "paid" ? "Your QR will appear here shortly." : <>Your QR appears once payment is confirmed. <a className="underline" href="/ball/register">Finish payment</a></>}</p>}
        </div>
      </div>
    </section>
  );
}
function Item({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div><dt className="text-[10px] uppercase tracking-[0.2em] text-velvet/70">{k}</dt><dd className={`mt-1 ${mono ? "font-mono text-xs" : "font-medium"}`}>{v}</dd></div>;
}

function Programme() {
  const q = useLoad(async () => {
    const [items, links, people] = await Promise.all([
      supabase.from("programme_items").select("*").eq("is_published", true).order("display_order"),
      supabase.from("session_speakers").select("programme_item_id, person_id, speaking_role, display_order").order("display_order"),
      supabase.from("people").select("id, full_name, title").eq("is_published", true),
    ]);
    const ppl = must(people);
    return must(items).map((i) => ({ ...i, speakers: must(links).filter((l) => l.programme_item_id === i.id).map((l) => ({ ...l, p: ppl.find((p) => p.id === l.person_id) })).filter((s) => s.p) }));
  });
  return (
    <section>
      <h1 className="font-serif text-4xl">The Evening</h1>
      <State {...q} empty={q.data?.length === 0 && "The programme will appear here once it's published."}>
        <ol className="mt-6 space-y-4">
          {q.data?.map((i, n) => (
            <li key={i.id} className={card}>
              <p className="text-[11px] uppercase tracking-[0.25em] text-blush">{String(n + 1).padStart(2, "0")} · {i.session_type} · {fmtTime(i.starts_at)}</p>
              <h2 className="mt-2 font-serif text-2xl">{i.title}</h2>
              {i.description && <p className="mt-2 text-sm text-lavender">{i.description}</p>}
              {i.location && <p className="mt-2 text-xs text-lavender/70">{i.location}</p>}
              {i.speakers.length > 0 && <p className="mt-3 text-sm">{i.speakers.map((s) => s.p!.full_name + (s.speaking_role ? ` (${s.speaking_role})` : "")).join(" · ")}</p>}
            </li>
          ))}
        </ol>
      </State>
    </section>
  );
}

function Guests() {
  const q = useLoad(async () => {
    const [people, teams, members] = await Promise.all([
      supabase.from("people").select("id, full_name, title, organisation, bio, person_type").eq("is_published", true).order("display_order"),
      supabase.from("hackathon_teams").select("id, name, description, pitch_summary, is_finalist").eq("is_published", true).order("display_order"),
      supabase.from("hackathon_team_members").select("team_id, full_name, role, display_order").order("display_order"),
    ]);
    return { people: must(people), teams: must(teams), members: must(members) };
  });
  return (
    <State {...q}>
      {q.data && (
        <div className="space-y-12">
          <section>
            <h1 className="font-serif text-4xl">Voices of the evening</h1>
            {q.data.people.length === 0 ? <p className="mt-3 text-sm text-lavender/80">Guests will be shared here soon.</p> : (
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {q.data.people.map((p) => (
                  <li key={p.id} className={card}>
                    <div className="flex items-center gap-4">
                      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full border border-blush/50 font-serif text-lg text-blush">{initials(p.full_name)}</span>
                      <div>
                        <p className="font-serif text-xl">{p.full_name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-lavender/80">{p.person_type.replace("_", " ")}</p>
                      </div>
                    </div>
                    {(p.title || p.organisation) && <p className="mt-3 text-sm">{[p.title, p.organisation].filter(Boolean).join(", ")}</p>}
                    {p.bio && <details className="mt-2 text-sm text-lavender"><summary className="cursor-pointer text-blush">Read more</summary><p className="mt-2 whitespace-pre-line">{p.bio}</p></details>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <p className="text-[11px] uppercase tracking-[0.3em] text-blush">PCH Hackathon</p>
            <h2 className="mt-1 font-serif text-4xl">Built by her.</h2>
            <p className="mt-2 text-lavender">Muslim Women Building the Future of Careers in Africa.</p>
            {q.data.teams.length === 0 ? <p className="mt-3 text-sm text-lavender/80">Teams will be revealed soon.</p> : (
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {q.data.teams.map((t) => (
                  <li key={t.id} className={`${card} border-rose/30`}>
                    <p className="font-serif text-2xl">{t.name} {t.is_finalist && <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.2em] text-blush">Finalist</span>}</p>
                    {t.description && <p className="mt-2 text-sm text-lavender">{t.description}</p>}
                    {t.pitch_summary && <p className="mt-2 text-sm">{t.pitch_summary}</p>}
                    <p className="mt-3 text-xs text-lavender/80">{q.data!.members.filter((m) => m.team_id === t.id).map((m) => m.full_name + (m.role ? ` — ${m.role}` : "")).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </State>
  );
}

function Becoming({ userId }: { userId: string }) {
  const q = useLoad(async () => {
    const [letters, entries] = await Promise.all([
      supabase.from("dear_future_me").select("id, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("becoming_entries").select("id, title, body, entry_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    return { letters: must(letters), entries: must(entries) };
  }, [userId]);
  const [letter, setLetter] = useState("");
  const [note, setNote] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function act(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? "That didn't save. Please try again." : ok);
    if (!error) void q.reload();
    return !error;
  }
  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-serif text-4xl">Dear Future Me</h1>
        <p className="mt-2 text-sm text-lavender">Only you can read these. Not even the hosts.</p>
        <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (letter.trim() && await act(() => supabase.from("dear_future_me").insert({ user_id: userId, content: letter.trim() }), "Sealed. 💜")) setLetter(""); }}>
          <label htmlFor="letter" className="sr-only">Your letter</label>
          <textarea id="letter" rows={5} maxLength={5000} value={letter} onChange={(e) => setLetter(e.target.value)} className={field} placeholder="Dear future me…" />
          <button disabled={busy || !letter.trim()} className={btn}>Seal this letter</button>
        </form>
      </section>
      <section>
        <h2 className="font-serif text-3xl">Reflections</h2>
        <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (note.body.trim() && await act(() => supabase.from("becoming_entries").insert({ user_id: userId, entry_type: "reflection", title: note.title.trim() || null, body: note.body.trim(), is_public: false }), "Saved.")) setNote({ title: "", body: "" }); }}>
          <input aria-label="Title (optional)" value={note.title} maxLength={200} onChange={(e) => setNote({ ...note, title: e.target.value })} className={field} placeholder="A title (optional)" />
          <textarea aria-label="Reflection" rows={3} value={note.body} maxLength={5000} onChange={(e) => setNote({ ...note, body: e.target.value })} className={field} placeholder="What are you becoming?" />
          <button disabled={busy || !note.body.trim()} className={btn}>Save reflection</button>
        </form>
      </section>
      {msg && <p role="status" className="text-sm text-blush">{msg}</p>}
      <State {...q}>
        {q.data && (
          <ul className="space-y-3">
            {[...q.data.letters.map((l) => ({ id: l.id, kind: "letter" as const, title: "Letter to future me", body: l.content, at: l.created_at })),
              ...q.data.entries.map((x) => ({ id: x.id, kind: "entry" as const, title: x.title ?? "Reflection", body: x.body ?? "", at: x.created_at }))]
              .sort((a, b) => b.at.localeCompare(a.at)).map((x) => (
                <li key={x.id} className={card}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-serif text-xl">{x.title}</p>
                    <button className="text-xs text-lavender underline" disabled={busy} onClick={() => confirm("Delete this for good?") && act(() => supabase.from(x.kind === "letter" ? "dear_future_me" : "becoming_entries").delete().eq("id", x.id), "Deleted.")}>Delete</button>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-lavender">{x.body}</p>
                  <p className="mt-2 text-[11px] text-lavender/60">{new Date(x.at).toLocaleDateString("en-NG")}</p>
                </li>
              ))}
          </ul>
        )}
      </State>
    </div>
  );
}

function Network({ userId }: { userId: string }) {
  const q = useLoad(async () => {
    const [dir, reqs, conns, priv] = await Promise.all([
      supabase.rpc("network_directory"),
      supabase.from("connection_requests").select("id, requester_id, recipient_id, status, message").or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
      supabase.from("connections").select("id, user_a, user_b"),
      supabase.from("profile_privacy").select("networking_enabled, profile_discoverable").eq("profile_id", userId).maybeSingle(),
    ]);
    const c = must(conns);
    const details = await Promise.all(c.map((x) => supabase.rpc("get_shareable_profile", { _target: x.user_a === userId ? x.user_b : x.user_a }).then((r) => r.data?.[0])));
    return { dir: must(dir), reqs: must(reqs), conns: details.filter(Boolean), priv: must(priv) };
  }, [userId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run(fn: () => PromiseLike<{ error: { message?: string } | null }>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? (error.message?.includes("not accepting") ? "She isn't accepting connections right now." : "That didn't go through. Please try again.") : ok);
    void q.reload();
  }
  const d = q.data;
  const name = (id: string) => d?.dir.find((p) => p.id === id)?.full_name ?? "A guest";
  return (
    <State {...q}>
      {d && (
        <div className="space-y-10">
          <section>
            <h1 className="font-serif text-4xl">Don't just attend. Meet someone.</h1>
            <div className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-sm">{d.priv?.networking_enabled ? (d.priv.profile_discoverable ? "You're visible to other guests." : "Networking is on, but you're hidden from the directory.") : "Networking is off. Others can't find or request you."}</p>
              <button className={ghost} disabled={busy} onClick={() => run(() => supabase.from("profile_privacy").update(d.priv?.networking_enabled ? { networking_enabled: false, profile_discoverable: false } : { networking_enabled: true, profile_discoverable: true }).eq("profile_id", userId), "Updated.")}>
                {d.priv?.networking_enabled ? "Turn off networking" : "Turn on networking"}
              </button>
            </div>
            {msg && <p role="status" className="mt-3 text-sm text-blush">{msg}</p>}
          </section>
          {d.reqs.some((r) => r.recipient_id === userId && r.status === "pending") && (
            <section>
              <h2 className="font-serif text-2xl">Waiting for you</h2>
              <ul className="mt-3 space-y-3">
                {d.reqs.filter((r) => r.recipient_id === userId && r.status === "pending").map((r) => (
                  <li key={r.id} className={card}>
                    <p className="font-serif text-xl">{name(r.requester_id)}</p>
                    {r.message && <p className="mt-1 text-sm text-lavender">"{r.message}"</p>}
                    <div className="mt-3 flex gap-2">
                      <button className={btn} disabled={busy} onClick={() => run(() => supabase.from("connection_requests").update({ status: "accepted" }).eq("id", r.id), "Connected. 💜")}>Accept</button>
                      <button className={ghost} disabled={busy} onClick={() => run(() => supabase.from("connection_requests").update({ status: "declined" }).eq("id", r.id), "Declined.")}>Decline</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="font-serif text-2xl">Your connections</h2>
            {d.conns.length === 0 ? <p className="mt-2 text-sm text-lavender/80">No connections yet.</p> : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {d.conns.map((p) => p && (
                  <li key={p.id} className={card}>
                    <p className="font-serif text-xl">{p.full_name}</p>
                    <p className="text-sm text-lavender">{[p.profession, p.organisation].filter(Boolean).join(" · ")}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.instagram && <li>Instagram: {p.instagram}</li>}
                      {p.linkedin && <li>LinkedIn: {p.linkedin}</li>}
                      {p.whatsapp && <li>WhatsApp: {p.whatsapp}</li>}
                      {p.email && <li>Email: {p.email}</li>}
                      {!p.instagram && !p.linkedin && !p.whatsapp && !p.email && <li className="text-lavender/70">She hasn't shared contact details.</li>}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="font-serif text-2xl">Guests open to connect</h2>
            {d.dir.filter((p) => p.discoverable).length === 0 ? <p className="mt-2 text-sm text-lavender/80">No one is discoverable yet. Check back closer to the evening.</p> : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {d.dir.filter((p) => p.discoverable).map((p) => {
                  const r = d.reqs.find((x) => (x.requester_id === p.id || x.recipient_id === p.id));
                  return (
                    <li key={p.id} className={card}>
                      <p className="font-serif text-xl">{p.full_name ?? "Guest"}</p>
                      <p className="text-sm text-lavender">{[p.profession, p.organisation, p.location].filter(Boolean).join(" · ")}</p>
                      {p.interests?.length > 0 && <p className="mt-2 text-xs text-blush">{p.interests.slice(0, 5).join(" · ")}</p>}
                      <div className="mt-3">
                        {!r ? <button className={btn} disabled={busy || !d.priv?.networking_enabled} onClick={() => run(() => supabase.from("connection_requests").insert({ requester_id: userId, recipient_id: p.id }), "Request sent.")}>Connect</button>
                          : <span className="text-xs uppercase tracking-[0.2em] text-lavender">{r.status === "pending" ? (r.requester_id === userId ? "Request sent" : "Wants to connect") : r.status}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </State>
  );
}

const PRIV = [
  ["profile_discoverable", "Show me in the guest directory"],
  ["networking_enabled", "Allow connection requests"],
  ["show_instagram_to_connections", "Share Instagram with connections"],
  ["show_linkedin_to_connections", "Share LinkedIn with connections"],
  ["show_whatsapp_to_connections", "Share WhatsApp with connections"],
  ["show_email_to_connections", "Share email with connections"],
] as const;
const PF = [["full_name", "Full name"], ["profession", "What you do"], ["organisation", "Organisation"], ["location", "City / country"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"], ["whatsapp", "WhatsApp"]] as const;

function Profile({ userId, email }: { userId: string; email: string }) {
  const q = useLoad(async () => {
    const [p, v] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profile_privacy").select("*").eq("profile_id", userId).maybeSingle(),
    ]);
    return { p: must(p), v: must(v) };
  }, [userId]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [priv, setPriv] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    const f: Record<string, string> = {};
    for (const [k] of PF) f[k] = (q.data.p?.[k] as string | null) ?? "";
    f["bio"] = q.data.p?.bio ?? "";
    setForm(f);
    const pv: Record<string, boolean> = {};
    for (const [k] of PRIV) pv[k] = Boolean(q.data.v?.[k]);
    setPriv(pv);
  }, [q.data]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form["full_name"]?.trim()) { setMsg("Please add your name."); return; }
    setBusy(true); setMsg(null);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim().slice(0, k === "bio" ? 1000 : 200) || null]));
    const a = await supabase.from("profiles").update(clean).eq("id", userId);
    const b = await supabase.from("profile_privacy").update(priv).eq("profile_id", userId);
    setBusy(false);
    setMsg(a.error || b.error ? "Your changes didn't save. Please try again." : "Saved. 💜");
  }
  return (
    <State {...q}>
      <form onSubmit={save} className="space-y-8">
        <div>
          <h1 className="font-serif text-4xl">Your Ball profile</h1>
          <p className="mt-1 text-sm text-lavender">{email}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PF.map(([k, l]) => (
            <label key={k} className="block text-sm"><span className="text-lavender">{l}</span>
              <input className={`${field} mt-1`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <label className="block text-sm md:col-span-2"><span className="text-lavender">A little about you</span>
            <textarea rows={3} className={`${field} mt-1`} value={form["bio"] ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </label>
        </div>
        <fieldset className={card}>
          <legend className="px-1 font-serif text-xl">Your visibility</legend>
          <p className="text-xs text-lavender/80">Contact details are only ever shared with people you've connected with.</p>
          <div className="mt-3 space-y-3">
            {PRIV.map(([k, l]) => (
              <label key={k} className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--rose)]" checked={priv[k] ?? false} onChange={(e) => setPriv({ ...priv, [k]: e.target.checked })} />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-4">
          <button className={btn} disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          {msg && <p role="status" className="text-sm text-blush">{msg}</p>}
        </div>
      </form>
    </State>
  );
}

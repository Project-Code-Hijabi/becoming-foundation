import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gate, signOut, useLoad, must, State, naira, fmtTime } from "@/features/portal/shared";
import { listStaff, inviteStaff, removeStaff } from "@/lib/admin.functions";

export const Route = createFileRoute("/ball/admin")({
  ssr: false,
  beforeLoad: () => gate("/ball/admin", "admin"),
  head: () => ({
    meta: [
      { title: "Admin — PCH Annual Ball 2026" },
      { name: "description", content: "Event control for the PCH Annual Ball 2026 team." },
      { property: "og:title", content: "Admin — PCH Annual Ball 2026" },
      { property: "og:description", content: "Event control for the PCH Annual Ball 2026 team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const TABS = ["Overview", "Attendees", "Staff", "Announcements", "Programme", "Content"] as const;
type Tab = (typeof TABS)[number];
const card = "rounded-sm border border-plum/15 bg-card p-4";
const btn = "rounded-sm bg-plum px-3 py-2 text-sm text-ivory hover:bg-velvet disabled:opacity-50";
const field = "w-full rounded-sm border border-plum/25 bg-background px-3 py-2 text-sm";

function Admin() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="min-h-screen bg-background text-plum">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-plum/15 bg-ink px-5 py-3 text-ivory">
        <p className="text-xs uppercase tracking-[0.25em] text-blush">PCH Ball · Admin</p>
        <div className="flex gap-4 text-xs text-lavender">
          <a href="/ball/staff" className="underline">Door</a><a href="/ball/app" className="underline">My Ball</a>
          <button onClick={signOut} className="underline">Sign out</button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-plum/15 px-3" aria-label="Admin sections">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-3 text-sm ${tab === t ? "border-b-2 border-rose font-semibold" : "text-plum/70"}`}>{t}</button>
        ))}
      </nav>
      <main className="mx-auto max-w-6xl p-4">
        {tab === "Overview" && <Overview />}
        {tab === "Attendees" && <Attendees />}
        {tab === "Staff" && <Staff />}
        {tab === "Announcements" && <Announcements />}
        {tab === "Programme" && <Programme />}
        {tab === "Content" && <Content />}
      </main>
    </div>
  );
}

type Reg = { id: string; user_id: string; attendee_code: string; status: string; amount_kobo: number; created_at: string; paid_at: string | null; dietary_notes: string | null; accessibility_notes: string | null; ticket_types: { name: string } | null };
type Prof = { id: string; full_name: string | null; email: string | null; phone: string | null; whatsapp: string | null; profession: string | null; organisation: string | null };

async function loadRegs() {
  const regs = must(await supabase.from("registrations").select("id, user_id, attendee_code, status, amount_kobo, created_at, paid_at, dietary_notes, accessibility_notes, ticket_types(name)").order("created_at", { ascending: false })) as unknown as Reg[];
  const ids = [...new Set(regs.map((r) => r.user_id))];
  const [profs, cis] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id, full_name, email, phone, whatsapp, profession, organisation").in("id", ids) : Promise.resolve({ data: [], error: null }),
    supabase.from("check_ins").select("user_id, checked_in_at").is("programme_item_id", null),
  ]);
  return { regs, profs: (must(profs) ?? []) as Prof[], checked: new Map((must(cis) ?? []).map((c) => [c.user_id, c.checked_in_at])) };
}

function Overview() {
  const d = useLoad(async () => {
    const [r, t, p, c] = await Promise.all([
      loadRegs(),
      supabase.from("ticket_types").select("id, name, price_kobo, quantity_cap, is_active"),
      supabase.from("payments").select("tx_ref, amount_kobo, status, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("connections").select("id", { count: "exact", head: true }),
    ]);
    return { ...r, tickets: must(t), pays: must(p), conns: c.count ?? 0 };
  });
  return (
    <State {...d} tone="light">
      {d.data && (() => {
        const { regs, profs, checked, tickets, pays, conns } = d.data;
        const by = (s: string) => regs.filter((r) => r.status === s).length;
        const paid = regs.filter((r) => r.status === "paid");
        const revenue = paid.reduce((a, r) => a + r.amount_kobo, 0);
        const name = (id: string) => profs.find((p) => p.id === id)?.full_name ?? "—";
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Registrations", regs.length], ["Paid attendees", paid.length], ["Pending", by("pending")], ["Cancelled / refunded", by("cancelled") + by("refunded")], ["Checked in", checked.size], ["Revenue", naira(revenue)], ["Connections made", conns], ["Still expected", Math.max(0, paid.length - checked.size)]].map(([k, v]) => (
                <div key={k as string} className={card}><p className="text-2xl font-semibold">{v}</p><p className="text-xs uppercase tracking-wider text-plum/60">{k}</p></div>
              ))}
            </div>
            <section className={card}>
              <h2 className="font-semibold">Ticket sales</h2>
              <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-plum/60"><th>Ticket</th><th>Price</th><th>Paid</th><th>Remaining</th></tr></thead><tbody>
                {tickets.map((t) => { const sold = paid.filter((r) => r.ticket_types?.name === t.name).length; return (
                  <tr key={t.id} className="border-t border-plum/10"><td className="py-2">{t.name}{!t.is_active && " (inactive)"}</td><td>{naira(t.price_kobo)}</td><td>{sold}</td><td>{t.quantity_cap == null ? "No cap" : Math.max(0, t.quantity_cap - sold)}</td></tr>); })}
              </tbody></table>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <section className={card}><h2 className="font-semibold">Recent registrations</h2>
                <ul className="mt-2 divide-y divide-plum/10 text-sm">{regs.slice(0, 8).map((r) => <li key={r.id} className="flex justify-between py-2"><span>{name(r.user_id)} · {r.ticket_types?.name}</span><span className="text-plum/60">{r.status}</span></li>)}</ul>
              </section>
              <section className={card}><h2 className="font-semibold">Recent payments</h2>
                <ul className="mt-2 divide-y divide-plum/10 text-sm">{pays.map((p) => <li key={p.tx_ref} className="flex justify-between py-2"><span className="font-mono text-xs">{p.tx_ref}</span><span>{naira(p.amount_kobo)} · {p.status}</span></li>)}</ul>
              </section>
            </div>
          </div>
        );
      })()}
    </State>
  );
}

function Attendees() {
  const d = useLoad(loadRegs);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  return (
    <State {...d} tone="light" empty={d.data?.regs.length === 0 && "No registrations yet."}>
      {d.data && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input aria-label="Search attendees" placeholder="Search name, email, code" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} max-w-xs`} />
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} w-auto`}>
              {["all", "paid", "pending", "cancelled", "refunded"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead><tr className="text-left text-plum/60"><th className="py-2">Name</th><th>Email</th><th>Phone / WhatsApp</th><th>Ticket</th><th>Code</th><th>Status</th><th>Checked in</th><th>Notes</th></tr></thead>
            <tbody>{d.data.regs.filter((r) => status === "all" || r.status === status).map((r) => ({ r, p: d.data!.profs.find((x) => x.id === r.user_id) }))
              .filter(({ r, p }) => !q || [p?.full_name, p?.email, r.attendee_code].some((v) => v?.toLowerCase().includes(q.toLowerCase())))
              .map(({ r, p }) => (
                <tr key={r.id} className="border-t border-plum/10 align-top">
                  <td className="py-2 font-medium">{p?.full_name ?? "—"}<div className="text-xs text-plum/60">{[p?.profession, p?.organisation].filter(Boolean).join(" · ")}</div></td>
                  <td>{p?.email}</td><td>{p?.phone ?? p?.whatsapp ?? "—"}</td><td>{r.ticket_types?.name}</td>
                  <td className="font-mono text-xs">{r.attendee_code}</td><td>{r.status}</td>
                  <td>{d.data!.checked.get(r.user_id) ? new Date(d.data!.checked.get(r.user_id)!).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                  <td className="text-xs">{[r.dietary_notes, r.accessibility_notes].filter(Boolean).join(" · ") || "—"}</td>
                </tr>))}</tbody>
          </table></div>
        </div>
      )}
    </State>
  );
}

function Staff() {
  const list = useServerFn(listStaff);
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeStaff);
  const d = useLoad(() => list());
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { const r = await invite({ data: { email, origin: window.location.origin } }); setMsg(r.message); if (r.result !== "error") { setEmail(""); void d.reload(); } }
    catch { setMsg("Something went wrong. Try again."); }
    setBusy(false);
  }
  return (
    <div className="space-y-5">
      <form onSubmit={send} className={`${card} space-y-3`}>
        <h2 className="font-semibold">Invite a staff member</h2>
        <p className="text-sm text-plum/70">She'll receive an email to set her own password, then can use the Door scanner. You never set her password.</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="se" className="sr-only">Staff email</label>
          <input id="se" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@email.com" className={`${field} max-w-sm`} />
          <button className={btn} disabled={busy}>{busy ? "Sending…" : "Send invite"}</button>
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </form>
      <section className={card}>
        <h2 className="font-semibold">Current staff</h2>
        <State {...d} tone="light" empty={d.data?.length === 0 && "No staff yet."}>
          <ul className="mt-2 divide-y divide-plum/10 text-sm">
            {d.data?.map((s) => (
              <li key={s.userId} className="flex items-center justify-between gap-2 py-2">
                <span>{s.name ?? s.email}<span className="block text-xs text-plum/60">{s.email}</span></span>
                <button onClick={async () => { if (confirm(`Remove staff access for ${s.email}?`)) { await remove({ data: { userId: s.userId } }); void d.reload(); } }} className="text-xs underline">Remove</button>
              </li>))}
          </ul>
        </State>
      </section>
    </div>
  );
}

function Announcements() {
  const d = useLoad(async () => must(await supabase.from("announcements").select("id, title, body, is_published, created_at").order("created_at", { ascending: false })));
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [err, setErr] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.from("announcements").insert({ title, body, is_published: false });
    if (error) return setErr("Couldn't save. Try again.");
    setTitle(""); setBody(""); void d.reload();
  }
  return (
    <div className="space-y-5">
      <form onSubmit={add} className={`${card} space-y-2`}>
        <h2 className="font-semibold">New announcement</h2>
        <input aria-label="Title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={field} />
        <textarea aria-label="Message" required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={3} className={field} />
        {err && <p role="alert" className="text-sm">{err}</p>}
        <button className={btn}>Save as draft</button>
      </form>
      <State {...d} tone="light" empty={d.data?.length === 0 && "No announcements yet."}>
        <ul className="space-y-2">{d.data?.map((a) => <EditableAnnouncement key={a.id} a={a} onChange={d.reload} />)}</ul>
      </State>
    </div>
  );
}

function EditableAnnouncement({ a, onChange }: { a: { id: string; title: string; body: string; is_published: boolean }; onChange: () => void }) {
  const [edit, setEdit] = useState(false); const [t, setT] = useState(a.title); const [b, setB] = useState(a.body);
  const upd = async (v: { title?: string; body?: string; is_published?: boolean }) => { await supabase.from("announcements").update(v).eq("id", a.id); onChange(); };
  return (
    <li className={card}>
      {edit ? (
        <div className="space-y-2"><input aria-label="Title" value={t} onChange={(e) => setT(e.target.value)} className={field} /><textarea aria-label="Message" value={b} onChange={(e) => setB(e.target.value)} rows={3} className={field} />
          <button className={btn} onClick={async () => { await upd({ title: t, body: b }); setEdit(false); }}>Save</button></div>
      ) : (<><p className="font-medium">{a.title} {!a.is_published && <span className="text-xs text-plum/60">(draft)</span>}</p><p className="mt-1 text-sm text-plum/80">{a.body}</p></>)}
      <div className="mt-2 flex gap-3 text-xs">
        <button className="underline" onClick={() => upd({ is_published: !a.is_published })}>{a.is_published ? "Unpublish" : "Publish"}</button>
        <button className="underline" onClick={() => setEdit(!edit)}>{edit ? "Cancel" : "Edit"}</button>
        <button className="underline" onClick={async () => { if (confirm("Delete this announcement?")) { await supabase.from("announcements").delete().eq("id", a.id); onChange(); } }}>Delete</button>
      </div>
    </li>
  );
}

const SESSION_TYPES = ["keynote", "panel", "fireside", "hackathon", "award", "networking", "break", "opening", "closing", "other"] as const;

function Programme() {
  const d = useLoad(async () => must(await supabase.from("programme_items").select("id, title, description, session_type, starts_at, location, is_published, display_order").order("display_order")));
  const [f, setF] = useState({ title: "", description: "", session_type: "other" as (typeof SESSION_TYPES)[number], starts_at: "", location: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("programme_items").insert({ title: f.title, description: f.description || null, session_type: f.session_type, starts_at: f.starts_at ? new Date(f.starts_at + ":00+01:00").toISOString() : null, location: f.location || null, display_order: (d.data?.length ?? 0) + 1, is_published: false });
    setF({ title: "", description: "", session_type: "other", starts_at: "", location: "" }); void d.reload();
  }
  return (
    <div className="space-y-5">
      <form onSubmit={add} className={`${card} grid gap-2 md:grid-cols-2`}>
        <h2 className="font-semibold md:col-span-2">New session</h2>
        <input aria-label="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" className={field} />
        <select aria-label="Type" value={f.session_type} onChange={(e) => setF({ ...f, session_type: e.target.value as typeof f.session_type })} className={field}>{SESSION_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        <input aria-label="Start time (Lagos)" type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} className={field} />
        <input aria-label="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Location (optional)" className={field} />
        <textarea aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description (optional)" className={`${field} md:col-span-2`} />
        <button className={`${btn} md:col-span-2`}>Save as draft</button>
      </form>
      <State {...d} tone="light" empty={d.data?.length === 0 && "No sessions yet."}>
        <ul className="space-y-2">{d.data?.map((p) => (
          <li key={p.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
            <span><span className="font-medium">{p.title}</span> <span className="text-xs text-plum/60">{p.session_type} · {fmtTime(p.starts_at)}{!p.is_published && " · draft"}</span></span>
            <span className="flex gap-3 text-xs">
              <button className="underline" onClick={async () => { await supabase.from("programme_items").update({ is_published: !p.is_published }).eq("id", p.id); void d.reload(); }}>{p.is_published ? "Unpublish" : "Publish"}</button>
              <button className="underline" onClick={async () => { if (confirm("Delete this session?")) { await supabase.from("programme_items").delete().eq("id", p.id); void d.reload(); } }}>Delete</button>
            </span>
          </li>))}</ul>
      </State>
    </div>
  );
}

const PERSON_TYPES = ["speaker", "panelist", "fireside_guest", "special_guest", "grand_honoree", "host", "sponsor"] as const;

function Content() {
  const d = useLoad(async () => {
    const [p, h, a] = await Promise.all([
      supabase.from("people").select("id, full_name, title, person_type, is_published").order("display_order"),
      supabase.from("hackathon_teams").select("id, name, is_finalist, is_published").order("display_order"),
      supabase.from("award_categories").select("id, name, year, is_published").order("display_order"),
    ]);
    return { people: must(p), teams: must(h), awards: must(a) };
  });
  const toggle = async (table: "people" | "hackathon_teams" | "award_categories", id: string, v: boolean) => { await supabase.from(table).update({ is_published: v }).eq("id", id); void d.reload(); };
  const [pn, setPn] = useState(""); const [pt, setPt] = useState<(typeof PERSON_TYPES)[number]>("speaker"); const [ptitle, setPtitle] = useState("");
  const [tn, setTn] = useState(""); const [an, setAn] = useState("");
  return (
    <State {...d} tone="light">
      {d.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={card}>
            <h2 className="font-semibold">People & speakers</h2>
            <form className="mt-2 space-y-2" onSubmit={async (e) => { e.preventDefault(); await supabase.from("people").insert({ full_name: pn, title: ptitle || null, person_type: pt, is_published: false }); setPn(""); setPtitle(""); void d.reload(); }}>
              <input aria-label="Full name" required value={pn} onChange={(e) => setPn(e.target.value)} placeholder="Full name" className={field} />
              <input aria-label="Title / role" value={ptitle} onChange={(e) => setPtitle(e.target.value)} placeholder="Title / role (optional)" className={field} />
              <select aria-label="Type" value={pt} onChange={(e) => setPt(e.target.value as typeof pt)} className={field}>{PERSON_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <button className={btn}>Add (draft)</button>
            </form>
            <Rows rows={d.data.people.map((x) => ({ id: x.id, label: x.full_name, sub: `${x.person_type}${x.title ? " · " + x.title : ""}`, pub: x.is_published }))} onToggle={(id, v) => toggle("people", id, v)} />
          </section>
          <section className={card}>
            <h2 className="font-semibold">Hackathon teams</h2>
            <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await supabase.from("hackathon_teams").insert({ name: tn, is_published: false }); setTn(""); void d.reload(); }}>
              <input aria-label="Team name" required value={tn} onChange={(e) => setTn(e.target.value)} placeholder="Team name" className={field} /><button className={btn}>Add</button>
            </form>
            <Rows rows={d.data.teams.map((x) => ({ id: x.id, label: x.name, sub: x.is_finalist ? "finalist" : "", pub: x.is_published }))} onToggle={(id, v) => toggle("hackathon_teams", id, v)} />
          </section>
          <section className={card}>
            <h2 className="font-semibold">Award categories</h2>
            <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await supabase.from("award_categories").insert({ name: an, year: 2026, is_published: false }); setAn(""); void d.reload(); }}>
              <input aria-label="Category name" required value={an} onChange={(e) => setAn(e.target.value)} placeholder="Category" className={field} /><button className={btn}>Add</button>
            </form>
            <Rows rows={d.data.awards.map((x) => ({ id: x.id, label: x.name, sub: String(x.year), pub: x.is_published }))} onToggle={(id, v) => toggle("award_categories", id, v)} />
          </section>
        </div>
      )}
    </State>
  );
}

function Rows({ rows, onToggle }: { rows: { id: string; label: string; sub: string; pub: boolean }[]; onToggle: (id: string, v: boolean) => void }) {
  if (!rows.length) return <p className="mt-3 text-sm text-plum/60">Nothing here yet.</p>;
  return (
    <ul className="mt-3 divide-y divide-plum/10 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-2">
          <span>{r.label}<span className="block text-xs text-plum/60">{r.sub}</span></span>
          <button className="text-xs underline" onClick={() => onToggle(r.id, !r.pub)}>{r.pub ? "Unpublish" : "Publish"}</button>
        </li>))}
    </ul>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { gate, signOut, useLoad, must, State } from "@/features/portal/shared";
import { staffLookup, staffCheckIn, type LookupResult } from "@/lib/staff.functions";

export const Route = createFileRoute("/ball/staff")({
  ssr: false,
  beforeLoad: () => gate("/ball/staff", "staff"),
  head: () => ({
    meta: [
      { title: "Door — PCH Annual Ball 2026" },
      { name: "description", content: "Event-day check-in for PCH Annual Ball 2026 staff." },
      { property: "og:title", content: "Door — PCH Annual Ball 2026" },
      { property: "og:description", content: "Event-day check-in for PCH Annual Ball 2026 staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Staff,
});

type Stats = { confirmed: number; checked_in: number; recent: { full_name: string | null; checked_in_at: string }[] };

function Staff() {
  const stats = useLoad(async () => {
    const [s, a] = await Promise.all([
      supabase.rpc("staff_event_stats"),
      supabase.from("announcements").select("id, title, body").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
    ]);
    return { s: must(s) as unknown as Stats, a: must(a) };
  });
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const lookup = useServerFn(staffLookup);
  const checkIn = useServerFn(staffCheckIn);

  async function verify(token: string) {
    setScanning(false); setBusy(true); setDone(null);
    try { setResult(await lookup({ data: { token } })); }
    catch { setResult({ state: "invalid" }); }
    setBusy(false);
  }
  async function doCheckIn() {
    if (!result || result.state !== "ok") return;
    setBusy(true);
    try {
      const r = await checkIn({ data: { badgeId: result.badgeId } });
      setDone(r.result === "checked_in" ? "Checked in. Welcome her in. 💜" : r.result === "already" ? "Already checked in." : "Check-in was refused. Ask an admin.");
      if (r.result !== "refused") void stats.reload();
    } catch { setDone("Check-in didn't go through. Try again."); }
    setBusy(false);
  }
  const s = stats.data?.s;

  return (
    <div className="min-h-screen bg-ink text-ivory">
      <header className="flex items-center justify-between border-b border-lavender/20 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.25em] text-blush">PCH Ball · Door</p>
        <button onClick={signOut} className="text-xs text-lavender underline">Sign out</button>
      </header>
      <main className="mx-auto max-w-lg space-y-5 p-4">
        <p className="text-sm text-lavender">Saturday, 14 November 2026 · Raybam, 20 Peace Estate Road, Alimosho, Lagos</p>
        <State {...stats}>
          {s && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Confirmed", s.confirmed], ["In", s.checked_in], ["Expected", Math.max(0, s.confirmed - s.checked_in)]].map(([k, v]) => (
                <div key={k} className="rounded-sm bg-plum p-3"><p className="text-3xl font-semibold">{v}</p><p className="text-[11px] uppercase tracking-[0.2em] text-lavender">{k}</p></div>
              ))}
            </div>
          )}
        </State>

        {!result && !scanning && (
          <button onClick={() => setScanning(true)} className="w-full rounded-sm bg-rose py-6 text-lg font-semibold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ivory">Scan Ball Pass</button>
        )}
        {scanning && <Scanner onCode={verify} onCancel={() => setScanning(false)} />}
        {!result && (
          <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void verify(manual.trim()); }} className="flex gap-2">
            <label htmlFor="tok" className="sr-only">Pass code</label>
            <input id="tok" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste pass code" className="min-w-0 flex-1 rounded-sm border border-lavender/30 bg-plum/40 px-3 py-2 font-mono text-xs" />
            <button className="rounded-sm border border-lavender/40 px-3 text-sm" disabled={busy}>Check</button>
          </form>
        )}
        {busy && <p role="status" className="text-center text-sm text-lavender">Checking…</p>}

        {result && <Result r={result} done={done} busy={busy} onCheckIn={doCheckIn} onNext={() => { setResult(null); setDone(null); setManual(""); setScanning(true); }} />}

        {s && s.recent.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-lavender">Recent check-ins</h2>
            <ul className="mt-2 divide-y divide-lavender/10 text-sm">
              {s.recent.map((r, i) => <li key={i} className="flex justify-between py-2"><span>{r.full_name ?? "Guest"}</span><span className="text-lavender">{new Date(r.checked_in_at).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" })}</span></li>)}
            </ul>
          </section>
        )}
        {stats.data?.a.map((a) => <div key={a.id} className="rounded-sm border border-lavender/20 p-3 text-sm"><p className="font-medium">{a.title}</p><p className="mt-1 text-lavender">{a.body}</p></div>)}
      </main>
    </div>
  );
}

function Result({ r, done, busy, onCheckIn, onNext }: { r: LookupResult; done: string | null; busy: boolean; onCheckIn: () => void; onNext: () => void }) {
  const head = { invalid: ["This Ball pass could not be verified.", "bg-destructive"], unpaid: ["This registration is not confirmed.", "bg-destructive"], revoked: ["This Ball pass is no longer valid.", "bg-destructive"], already: ["Already checked in.", "bg-velvet"], ok: ["CONFIRMED", "bg-rose text-ink"] }[r.state];
  return (
    <section aria-live="assertive" className="overflow-hidden rounded-sm border border-lavender/30">
      <p className={`p-4 text-center text-xl font-semibold ${head[1]}`}>{done ?? head[0]}</p>
      {r.state !== "invalid" && (
        <div className="flex gap-4 p-4">
          {r.photoUrl ? <img src={r.photoUrl} alt="" className="h-24 w-24 rounded-sm object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-sm bg-plum text-2xl">{r.name[0]}</div>}
          <div className="text-sm">
            <p className="text-xl font-semibold">{r.name}</p>
            <p className="text-lavender">{r.ticket}</p>
            {r.checkedInAt && <p className="mt-1 text-blush">In at {new Date(r.checkedInAt).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" })}</p>}
            {r.dietary && <p className="mt-1">Dietary: {r.dietary}</p>}
            {r.accessibility && <p className="mt-1">Access: {r.accessibility}</p>}
          </div>
        </div>
      )}
      <div className="flex gap-2 p-4 pt-0">
        {r.state === "ok" && !done && <button onClick={onCheckIn} disabled={busy} className="flex-1 rounded-sm bg-rose py-4 text-lg font-semibold text-ink">CHECK IN</button>}
        <button onClick={onNext} className="flex-1 rounded-sm border border-lavender/40 py-4">Scan next</button>
      </div>
    </section>
  );
}

function Scanner({ onCode, onCancel }: { onCode: (t: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || stopped) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          const v = video.current;
          if (stopped || !v || !ctx) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) { stopped = true; navigator.vibrate?.(80); onCode(code.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr("Camera unavailable. Allow camera access or paste the pass code below."); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="space-y-2">
      {err ? <p role="alert" className="rounded-sm bg-plum p-4 text-sm">{err}</p> : <video ref={video} muted playsInline className="aspect-square w-full rounded-sm bg-plum object-cover" aria-label="Camera view for scanning" />}
      <button onClick={onCancel} className="w-full rounded-sm border border-lavender/40 py-3 text-sm">Stop scanning</button>
    </div>
  );
}

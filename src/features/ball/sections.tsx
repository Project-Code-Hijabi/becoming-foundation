import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AWARDS, EVENT, FIRESIDE, HACKATHON, HONOREE, KEYNOTES, NAV, PANEL, PROGRAMME, TICKETS, naira,
  type Chapter, type Person, type Team, type Award,
} from "./data";
import { EditorialSection, EnterCta, Eyebrow, LightRays, Particles, Reveal, WaxSeal, useInView, Veil } from "./primitives";

/* ---------------- Navigation ---------------- */
export function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Ball"
        className={cn(
          "flex w-full max-w-6xl items-center justify-between px-4 py-3 transition-all duration-700 md:px-6",
          scrolled && "border border-champagne/10 bg-ink/70 backdrop-blur-md",
        )}
      >
        <a href="#pch" className="font-serif text-xl tracking-[0.2em] text-ivory">PCH</a>
        <ul className="hidden items-center gap-7 lg:flex">
          {NAV.slice(1).map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} className="font-sans text-[0.68rem] uppercase tracking-[0.28em] text-ivory/70 transition-colors hover:text-champagne">{n.label}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <EnterCta variant="ghost" className="hidden min-h-10 px-5 sm:inline-flex">Enter the Ball</EnterCta>
          <button
            type="button"
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={cn("h-px w-6 bg-ivory transition-transform", open && "translate-y-[3.5px] rotate-45")} />
            <span className={cn("h-px w-6 bg-ivory transition-transform", open && "-translate-y-[3.5px] -rotate-45")} />
          </button>
        </div>
      </nav>
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-0 -z-10 flex flex-col items-center justify-center gap-6 bg-ink/95 geometry backdrop-blur-lg lg:hidden"
      >
        {NAV.map((n, i) => (
          <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)} className="rise font-serif text-4xl italic text-ivory" style={{ animationDelay: `${i * 60}ms` }}>
            {n.label === "PCH" ? "Welcome" : n.label}
          </a>
        ))}
        <EnterCta className="mt-6" />
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
export function Hero() {
  const lines: [string, string, number][] = [
    ["font-sans text-[0.7rem] uppercase tracking-[0.5em] text-champagne/80", EVENT.name, 0],
    ["font-sans text-xs uppercase tracking-[0.4em] text-ivory/70", EVENT.edition, 250],
    ["mt-3 font-serif text-sm italic tracking-[0.2em] text-blush", EVENT.colourEdition, 450],
  ];
  return (
    <section id="pch" aria-label="Welcome" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center velvet-bg grain">
      <div className="absolute inset-0 geometry opacity-60" aria-hidden />
      <LightRays />
      <Particles count={14} />
      <div className="relative z-10 flex flex-col items-center" style={{ animationDelay: "0s" }}>
        {lines.map(([c, t, d]) => (
          <p key={t} className={cn("rise", c)} style={{ animationDelay: `${4.4 + d / 1000}s` }}>{t}</p>
        ))}
        <h1 className="rise mt-8 font-serif text-[clamp(4rem,16vw,12rem)] font-light leading-[0.85] tracking-[0.04em] text-ivory" style={{ animationDelay: "4.9s" }}>
          Becoming
        </h1>
        <p className="rise mt-6 max-w-md font-serif text-lg italic text-blush md:text-2xl" style={{ animationDelay: "5.3s" }}>{EVENT.subtitle}</p>
        <div className="rise mt-10 flex max-w-full flex-col items-center gap-3 font-sans text-[0.7rem] uppercase tracking-[0.3em] text-champagne md:flex-row md:gap-4" style={{ animationDelay: "5.7s" }}>
          <span>{EVENT.dayLabel}</span>
          <span className="hidden h-1 w-1 rotate-45 bg-rose md:block" aria-hidden />
          <a href={EVENT.mapsUrl} target="_blank" rel="noreferrer" className="leading-relaxed underline-offset-4 hover:text-blush hover:underline">{EVENT.venue}, {EVENT.address}</a>
        </div>
        <div className="rise mt-12 flex flex-col gap-4 sm:flex-row" style={{ animationDelay: "6.1s" }}>
          <EnterCta />
          <a href="#arrived" className="inline-flex min-h-12 items-center justify-center px-8 font-sans text-xs uppercase tracking-[0.3em] text-ivory/80 underline-offset-8 hover:text-champagne hover:underline">
            Explore the evening
          </a>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 h-12 w-px -translate-x-1/2 bg-gradient-to-b from-champagne/60 to-transparent" aria-hidden />
    </section>
  );
}

/* ---------------- You've arrived ---------------- */
export function Arrived() {
  const women = ["The woman learning.", "The woman building.", "The woman questioning.", "The woman leading.", "The woman figuring it out."];
  return (
    <EditorialSection id="arrived" label="You've arrived" className="bg-ink text-center">
      <div className="mx-auto max-w-4xl">
        <Reveal ink as="h2" className="font-serif text-[clamp(3rem,10vw,8rem)] font-light leading-none text-ivory">You've arrived.</Reveal>
        <Reveal as="p" className="mt-10 font-serif text-2xl italic text-blush md:text-3xl" delay={300}>There is a version of you that is still becoming.</Reveal>
        <ul className="mt-20 space-y-6">
          {women.map((w, i) => (
            <Reveal as="li" key={w} delay={i * 120} className="font-serif text-3xl text-ivory/85 md:text-5xl">{w}</Reveal>
          ))}
        </ul>
        <Reveal as="p" className="mt-24 font-sans text-sm uppercase tracking-[0.6em] text-champagne">This is becoming.</Reveal>
      </div>
    </EditorialSection>
  );
}

/* ---------------- BECOMING constellation ---------------- */
export function BecomingConstellation() {
  const words = ["Identity", "Faith", "Career", "Technology", "Purpose", "Community", "Leadership", "Impact"];
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const f = () => {
      const r = el.getBoundingClientRect();
      setShift(Math.max(-1, Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight)));
    };
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [ref]);
  const pts = words.map((_, i) => {
    const a = (i / words.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 32, y: 50 + Math.sin(a) * 38 };
  });
  return (
    <EditorialSection id="becoming" label="Becoming" className="overflow-hidden velvet-bg">
      <div ref={ref} className="relative mx-auto aspect-square w-full max-w-3xl md:aspect-[4/3]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden style={{ transform: `rotate(${shift * 6}deg)`, transition: "transform .2s linear" }}>
          {pts.map((p, i) => {
            const q = pts[(i + 3) % pts.length]!;
            return (
              <g key={i} stroke="var(--champagne)" strokeWidth="0.15" fill="none" opacity={seen ? 0.5 : 0} style={{ transition: `opacity 1.5s ${i * 150}ms` }}>
                <path d={`M50 50 L${p.x} ${p.y}`} strokeDasharray="0.8 0.8" />
                <path d={`M${p.x} ${p.y} Q50 ${50 + (i % 2 ? 10 : -10)} ${q.x} ${q.y}`} stroke="var(--rose)" />
                <circle cx={p.x} cy={p.y} r="0.6" fill="var(--champagne)" />
              </g>
            );
          })}
        </svg>
        {words.map((w, i) => (
          <span
            key={w}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[0.6rem] uppercase tracking-[0.18em] text-lavender transition-all duration-1000 md:text-xs md:tracking-[0.3em]"
            style={{ left: `clamp(3rem, ${pts[i]!.x}%, calc(100% - 3rem))`, top: `${pts[i]!.y}%`, opacity: seen ? 1 : 0, transform: `translate(-50%, calc(-50% + ${shift * (i % 2 ? 14 : -14)}px))`, transitionDelay: `${i * 120}ms` }}
          >
            {w}
          </span>
        ))}
        <h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-[clamp(2.5rem,9vw,6.5rem)] font-light tracking-[0.08em] text-ivory">
          Becoming
        </h2>
      </div>
      <Reveal as="p" className="mx-auto mt-12 max-w-xl text-center font-serif text-xl italic text-ivory/70">
        Every thread you carry — stitched into who you are becoming.
      </Reveal>
    </EditorialSection>
  );
}

/* ---------------- Tech × Ball terminal ---------------- */
export function TerminalMoment() {
  const items = ["conversations", "ideas", "stories", "connection", "recognition", "becoming"];
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setN(items.length + 1); return; }
    const t = setInterval(() => setN((v) => (v > items.length ? v : v + 1)), 450);
    return () => clearInterval(t);
  }, [seen, items.length]);
  return (
    <section aria-label="Loading the evening" className="flex justify-center bg-ink px-6 py-24">
      <div ref={ref} className="w-full max-w-sm border-y border-champagne/15 py-8 font-mono text-sm text-ivory/80" aria-live="polite">
        <p className={cn("text-lavender", n <= items.length && "caret")}>loading the evening…</p>
        <ul className="mt-4 space-y-1.5">
          {items.slice(0, n).map((it) => (
            <li key={it} className="rise" style={{ animationDuration: ".5s" }}><span className="text-champagne">✓</span> {it}</li>
          ))}
        </ul>
        {n > items.length && <p className="rise mt-6 tracking-[0.5em] text-champagne">READY</p>}
      </div>
    </section>
  );
}

/* ---------------- Programme ---------------- */
function ProgrammeChapter({ c }: { c: Chapter }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-champagne/15">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="group flex w-full items-baseline gap-6 py-6 text-left">
        <span className="font-mono text-xs text-rose">{c.no}</span>
        <span className="flex-1 font-serif text-3xl text-ink transition-all duration-500 group-hover:italic group-hover:tracking-wide md:text-4xl">{c.title}</span>
        <span aria-hidden className={cn("text-velvet transition-transform duration-500", open && "rotate-45")}>+</span>
      </button>
      <div className={cn("grid transition-all duration-500", open ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden pl-12">
          <p className="font-serif text-lg italic text-velvet">{c.line}</p>
          <p className="mt-2 font-sans text-[0.65rem] uppercase tracking-[0.3em] text-velvet/60">{c.time ?? "To be announced"}</p>
        </div>
      </div>
    </li>
  );
}

export function Programme() {
  return (
    <EditorialSection id="programme" label="The Evening" className="bg-ink">
      <div className="relative mx-auto max-w-3xl bg-ivory px-6 py-16 text-ink shadow-2xl md:px-16">
        <div className="absolute inset-3 border border-rosegold/40 pointer-events-none" aria-hidden />
        <Eyebrow className="text-center text-velvet/70">The Programme</Eyebrow>
        <Reveal ink as="h2" className="mt-4 text-center font-serif text-6xl font-light md:text-7xl">The Evening</Reveal>
        <p className="mx-auto mt-4 max-w-md text-center font-serif text-lg italic text-velvet">A day of conversations, stories, ideas, connection and celebration.</p>
        <ol className="mt-12">{PROGRAMME.map((c) => <ProgrammeChapter key={c.no} c={c} />)}</ol>
        <WaxSeal className="mx-auto mt-10 w-16" />
      </div>
    </EditorialSection>
  );
}

/* ---------------- Speaker card ---------------- */
function SpeakerCard({ p, large }: { p: Person; large?: boolean }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const initials = p.name.replace(/^Dr\.\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <article
      data-open={open}
      onClick={() => setOpen((o) => !o)}
      className={cn("group relative overflow-hidden border border-champagne/15 bg-card transition-colors duration-700 hover:border-champagne/60", large ? "min-h-[30rem]" : "min-h-[20rem]")}
    >
      <div className="absolute inset-0 geometry spin-slow opacity-40 transition-opacity duration-700 group-hover:opacity-100 motion-reduce:animate-none" style={{ transformOrigin: "50% 50%" }} aria-hidden />
      <span aria-hidden className="absolute right-6 top-4 font-serif text-[8rem] font-light leading-none text-velvet/60">{initials}</span>
      <Veil />
      <div className="relative flex h-full flex-col justify-end p-6 md:p-8">
        {p.role && <Eyebrow>{p.role}</Eyebrow>}
        <h3 className="mt-3 font-serif text-3xl text-ivory transition-all duration-500 group-hover:tracking-wide md:text-4xl">{p.name}</h3>
        {p.aka && <p className="font-serif italic text-blush">widely known as {p.aka}</p>}
        {p.title && <p className="mt-2 max-w-md font-sans text-xs uppercase leading-relaxed tracking-[0.18em] text-lavender">{p.title}</p>}
        {p.topic && <p className="mt-4 max-w-md font-serif text-lg italic text-champagne/90 transition-all duration-500 group-hover:text-xl">“{p.topic}”</p>}
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/75">{p.bio ?? (p.topic ? "Biography coming soon." : "Details coming soon.")}</p>
        {p.bioMore && (
          <>
            {more && <p className="mt-2 max-w-md text-sm leading-relaxed text-ivory/75">{p.bioMore}</p>}
            <button type="button" onClick={(e) => { e.stopPropagation(); setMore((m) => !m); }} aria-expanded={more} className="mt-3 self-start font-sans text-[0.65rem] uppercase tracking-[0.3em] text-champagne underline-offset-4 hover:underline">
              {more ? "Read less" : "Read more"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function PendingCard({ text }: { text: string }) {
  return (
    <div className="flex min-h-[20rem] items-center justify-center border border-dashed border-champagne/20 p-8 text-center">
      <p className="font-serif text-xl italic text-ivory/60">{text}</p>
    </div>
  );
}

export function Speakers() {
  const q = KEYNOTES[0]?.quote;
  return (
    <EditorialSection id="speakers" label="Speakers" className="velvet-bg">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Keynotes</Eyebrow>
        <Reveal ink as="h2" className="mt-4 font-serif text-5xl font-light text-ivory md:text-7xl">The voices of the evening</Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">{KEYNOTES.map((p) => <SpeakerCard key={p.name} p={p} large />)}</div>
        {q && (
          <Reveal as="blockquote" className="mx-auto my-28 max-w-3xl text-center font-serif text-3xl italic leading-snug text-blush md:text-5xl">
            “{q}”
            <footer className="mt-6 font-sans text-[0.65rem] not-italic uppercase tracking-[0.4em] text-champagne">— {KEYNOTES[0]?.aka}</footer>
          </Reveal>
        )}
      </div>
    </EditorialSection>
  );
}

/* ---------------- Grand Honoree ---------------- */
export function Honoree() {
  return (
    <EditorialSection label="The woman we honour" className="overflow-hidden bg-ink text-center">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 0%, oklch(0.83 0.07 80 / 16%), transparent 70%)" }} />
      <LightRays className="opacity-70" />
      <div className="relative mx-auto max-w-3xl">
        <WaxSeal className="mx-auto w-24" label="✦" />
        <Reveal as="p" className="mt-10 font-sans text-[0.7rem] uppercase tracking-[0.5em] text-champagne">The woman we honour</Reveal>
        <Reveal ink as="h2" className="mt-6 font-serif text-5xl font-light text-ivory md:text-7xl">Grand Honoree</Reveal>
        <div className="mx-auto my-10 h-px w-24 bg-champagne/50" aria-hidden />
        <Reveal as="p" className="font-serif text-2xl leading-snug text-ivory md:text-4xl" delay={200}>{HONOREE.name}</Reveal>
        <Reveal as="p" className="mt-6 font-serif text-lg italic text-champagne/90 md:text-xl" delay={400}>{HONOREE.title}</Reveal>
        <Reveal as="p" className="mt-14 font-sans text-[0.65rem] uppercase tracking-[0.5em] text-blush/70" delay={600}>Honour · Legacy · Faith · Presence · Impact</Reveal>
      </div>
    </EditorialSection>
  );
}

/* ---------------- Panel & Fireside ---------------- */
function Conversation({ eyebrow, title, line, people, pending, pendingCount }: { eyebrow: string; title: string; line: string; people: Person[]; pending: string; pendingCount: number }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Reveal ink as="h3" className="mt-4 max-w-3xl font-serif text-4xl font-light text-ivory md:text-6xl">{title}</Reveal>
      <p className="mt-6 max-w-2xl font-serif text-xl italic text-ivory/70">{line}</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {people.map((p) => <SpeakerCard key={p.name} p={p} />)}
        {Array.from({ length: pendingCount }).map((_, i) => <PendingCard key={i} text={pending} />)}
      </div>
    </div>
  );
}

export function Conversations() {
  return (
    <EditorialSection label="Conversations" className="space-y-40 bg-ink">
      <Conversation eyebrow="The Panel" title={PANEL.title} line={PANEL.line} people={PANEL.people} pending={PANEL.pending} pendingCount={2} />
      <Conversation eyebrow="The Fireside Chat" title={FIRESIDE.title} line={FIRESIDE.line} people={FIRESIDE.people} pending={FIRESIDE.pending} pendingCount={1} />
    </EditorialSection>
  );
}

/* ---------------- Hackathon ---------------- */
function HackathonCard({ t, i }: { t: Team; i: number }) {
  const rows: [string, string | null][] = [["Problem", t.problem], ["Solution", t.solution], ["Team", t.members.length ? t.members.join(", ") : null]];
  return (
    <Reveal as="article" delay={i * 100} className="group relative border border-lavender/15 bg-plum/40 p-6 transition-colors duration-500 hover:border-lavender/50">
      <div className="flex items-center justify-between font-mono text-[0.65rem] text-lavender/70">
        <span>team_0{i + 1}</span><span>● pitching</span>
      </div>
      <h3 className="mt-8 font-serif text-3xl text-ivory">{t.name ?? "To be revealed"}</h3>
      <dl className="mt-6 space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 border-t border-lavender/10 pt-3">
            <dt className="w-20 font-mono text-[0.65rem] uppercase text-lavender/60">{k}</dt>
            <dd className="text-ivory/60">{v ?? "Coming soon"}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

export function Hackathon() {
  return (
    <EditorialSection id="hackathon" label="Built By Her" className="overflow-hidden bg-ink circuit-grid">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 20%, oklch(0.4 0.14 310 / 25%), transparent 55%)" }} />
      <div className="relative mx-auto max-w-6xl">
        <p className="font-mono text-xs text-lavender/70">// project code-hijabi hackathon 2026 — top five</p>
        <Reveal ink as="h2" className="mt-6 font-serif text-6xl font-light text-ivory md:text-8xl">Built by her.</Reveal>
        <p className="mt-6 max-w-xl font-serif text-xl italic text-ivory/70">Five teams. Real problems. Ideas built into something you can see.</p>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{HACKATHON.map((t, i) => <HackathonCard key={i} t={t} i={i} />)}</div>
      </div>
    </EditorialSection>
  );
}

/* ---------------- Connection ---------------- */
export function Connection() {
  const steps = [
    ["Scan", "Scan a lanyard."],
    ["Discover", "Discover someone's profile."],
    ["Connect", "Send a request. Connect when they accept."],
  ];
  return (
    <EditorialSection id="experience" label="Connection" className="bg-plum">
      <div className="mx-auto max-w-6xl text-center">
        <Reveal ink as="h2" className="mx-auto max-w-4xl font-serif text-5xl font-light text-ivory md:text-7xl">Don't just attend. Meet someone.</Reveal>
        <p className="mx-auto mt-6 max-w-xl font-serif text-xl italic text-blush">The Ball is designed to help you leave knowing someone you didn't know when you arrived.</p>
        <ol className="mt-20 grid gap-12 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 200} className="relative flex flex-col items-center">
              <div className="flex h-24 w-24 items-center justify-center border border-champagne/40" style={{ transform: "rotate(45deg)" }}>
                <span className="font-mono text-xs text-champagne" style={{ transform: "rotate(-45deg)" }}>0{i + 1}</span>
              </div>
              <h3 className="mt-10 font-sans text-sm uppercase tracking-[0.5em] text-ivory">{t}</h3>
              <p className="mt-3 font-serif text-lg italic text-ivory/70">{d}</p>
            </Reveal>
          ))}
        </ol>
        <p className="mt-16 font-mono text-[0.65rem] text-lavender/60">available to registered attendees on the day</p>
      </div>
    </EditorialSection>
  );
}

/* ---------------- The Room ---------------- */
export function TheRoom() {
  return (
    <EditorialSection label="The Room" className="bg-ink">
      <div className="mx-auto max-w-6xl">
        <Reveal ink as="h2" className="font-serif text-5xl font-light text-ivory md:text-8xl">The room is waiting.</Reveal>
        <a href={EVENT.mapsUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block font-sans text-xs uppercase tracking-[0.3em] text-champagne underline-offset-4 hover:underline">
          {EVENT.venue} · {EVENT.address} ↗
        </a>
        <div className="mt-16 grid gap-6 md:grid-cols-5">
          <figure className="relative min-h-[26rem] overflow-hidden md:col-span-3 grain" style={{ background: "repeating-linear-gradient(90deg, oklch(0.24 0.09 340) 0 2%, oklch(0.32 0.11 345) 3.5%, oklch(0.22 0.08 340) 5%)" }}>
            <div aria-hidden className="absolute inset-x-[15%] bottom-0 top-[18%] bg-ink/85" style={{ clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)" }} />
            <LightRays className="h-full" />
            <div aria-hidden className="absolute inset-x-[10%] bottom-[12%] h-2 bg-champagne/30 blur-md" />
            <figcaption className="absolute bottom-6 left-6 right-6">
              <Eyebrow>The Stage</Eyebrow>
              <p className="mt-3 max-w-md font-serif text-lg italic text-ivory/85">Keynotes, the panel, the fireside chat, hackathon pitches, recognition and celebration.</p>
            </figcaption>
          </figure>
          <figure className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden border border-champagne/15 p-6 md:col-span-2 geometry">
            <Eyebrow>Upstairs</Eyebrow>
            <p className="mt-3 font-serif text-2xl text-ivory">A little quieter. Still part of the story.</p>
            <p className="mt-3 text-sm text-ivory/65">Overlooking the stage — for the PCH team, speakers, special invited guests and VIPs.</p>
          </figure>
        </div>
        <p className="mt-6 font-mono text-[0.65rem] text-ivory/40">venue photography coming soon</p>
      </div>
    </EditorialSection>
  );
}

/* ---------------- Awards ---------------- */
function AwardCard({ a, i }: { a: Award; i: number }) {
  return (
    <Reveal as="li" delay={(i % 4) * 100} className="group flex flex-col items-center border border-champagne/15 px-6 py-10 text-center transition-colors duration-500 hover:border-champagne/50">
      <svg viewBox="0 0 40 40" className="h-10 w-10 text-champagne transition-transform duration-700 group-hover:rotate-45" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="0.8"><rect x="10" y="10" width="20" height="20" /><rect x="10" y="10" width="20" height="20" transform="rotate(45 20 20)" /></g>
      </svg>
      <h3 className="mt-6 font-serif text-2xl text-ivory">{a.title}</h3>
      <p className="mt-3 font-sans text-[0.65rem] uppercase tracking-[0.3em] text-ivory/50">{a.recipient ?? "To be announced"}</p>
    </Reveal>
  );
}

export function Awards() {
  return (
    <EditorialSection label="Awards" className="velvet-bg">
      <div className="mx-auto max-w-6xl text-center">
        <Eyebrow>Awards & Recognition</Eyebrow>
        <Reveal ink as="h2" className="mx-auto mt-6 max-w-4xl font-serif text-4xl font-light leading-tight text-ivory md:text-7xl">
          She built. She led. She mentored. <em className="text-blush">She became.</em>
        </Reveal>
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{AWARDS.map((a, i) => <AwardCard key={a.title} a={a} i={i} />)}</ul>
      </div>
    </EditorialSection>
  );
}

/* ---------------- Countdown ---------------- */
export function Countdown() {
  const target = new Date(EVENT.dateISO).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = now === null ? null : target - now;
  const eventDay = diff !== null && diff <= 0;
  const units = diff !== null && diff > 0
    ? [["Days", Math.floor(diff / 864e5)], ["Hours", Math.floor(diff / 36e5) % 24], ["Minutes", Math.floor(diff / 6e4) % 60], ["Seconds", Math.floor(diff / 1e3) % 60]] as const
    : null;
  return (
    <EditorialSection label="Countdown" className="bg-ink text-center">
      <Eyebrow>{EVENT.dateLabel}</Eyebrow>
      {eventDay ? (
        <h2 className="mt-8 font-serif text-5xl font-light text-ivory md:text-8xl">Today, we meet.</h2>
      ) : (
        <>
          <Reveal ink as="h2" className="mt-6 font-serif text-4xl font-light text-ivory md:text-6xl">Until we meet</Reveal>
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-y-10 md:grid-cols-4" aria-live="off">
            {(units ?? [["Days", "—"], ["Hours", "—"], ["Minutes", "—"], ["Seconds", "—"]]).map(([l, v]) => (
              <div key={l}>
                <p className="font-serif text-6xl font-light tabular-nums text-champagne md:text-8xl">{typeof v === "number" ? String(v).padStart(2, "0") : v}</p>
                <p className="mt-2 font-sans text-[0.65rem] uppercase tracking-[0.4em] text-ivory/50">{l}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </EditorialSection>
  );
}

/* ---------------- Tickets ---------------- */
export function Tickets() {
  return (
    <EditorialSection id="tickets" label="Tickets" className="overflow-hidden bg-plum">
      <div className="absolute inset-0 geometry" aria-hidden />
      <div className="relative mx-auto max-w-5xl text-center">
        <Reveal ink as="h2" className="font-serif text-5xl font-light text-ivory md:text-8xl">Your seat is waiting.</Reveal>
        <p className="mx-auto mt-6 max-w-xl font-serif text-xl italic text-blush">Come for the conversations. Stay for the connections. Leave with something to remember.</p>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {TICKETS.map((t) => (
            <div key={t.code} className="group relative bg-ivory px-8 py-12 text-ink">
              <div className="pointer-events-none absolute inset-3 border border-rosegold/40" aria-hidden />
              <p className="font-sans text-[0.7rem] uppercase tracking-[0.4em] text-velvet">{t.name}</p>
              <p className="mt-4 font-serif text-6xl font-light">{naira(t.priceKobo)}</p>
              <WaxSeal className="absolute -right-4 -top-4 w-16 transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110" />
            </div>
          ))}
        </div>
        <EnterCta className="mt-14" />
      </div>
    </EditorialSection>
  );
}

/* ---------------- Final + Footer ---------------- */
export function Finale() {
  return (
    <section aria-label="You are becoming" className="relative flex min-h-[90svh] flex-col items-center justify-center overflow-hidden px-6 text-center velvet-bg grain">
      <Particles count={10} />
      <Reveal ink as="h2" className="font-serif text-[clamp(3rem,11vw,9rem)] font-light leading-none text-ivory">You are becoming.</Reveal>
      <p className="mt-8 font-serif text-xl italic text-blush md:text-2xl">Come as you are. Leave with something to remember.</p>
      <div className="mt-12 space-y-2 font-sans text-[0.7rem] uppercase tracking-[0.4em] text-champagne/85">
        <p>{EVENT.name}</p><p>{EVENT.edition}</p><p>{EVENT.dateLabel}</p><p>{EVENT.venue}, {EVENT.city}</p>
      </div>
      <EnterCta className="mt-12" />
    </section>
  );
}

export function Footer() {
  // Social/contact links to be supplied; rendered as labels until then.
  return (
    <footer className="border-t border-champagne/10 bg-ink px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 font-sans text-[0.65rem] uppercase tracking-[0.3em] text-ivory/50 md:flex-row">
        <p>{EVENT.name} · {EVENT.edition}</p>
        <ul className="flex gap-6">
          <li>Instagram</li><li>LinkedIn</li><li>Contact</li>
        </ul>
      </div>
    </footer>
  );
}

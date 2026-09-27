import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";
import { EVENT } from "./data";

export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

export function Reveal({ as: Tag = "div", className, children, ink, delay = 0 }: { as?: ElementType; className?: string; children: ReactNode; ink?: boolean; delay?: number }) {
  const [ref, seen] = useInView<HTMLElement>(0.15);
  return (
    <Tag ref={ref} data-visible={seen} className={cn(ink ? "ink" : "reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-sans text-[0.7rem] uppercase tracking-[0.35em] text-champagne/80", className)}>{children}</p>;
}

export function EditorialSection({ id, className, children, label }: { id?: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <section id={id} aria-label={label} className={cn("relative scroll-mt-20 px-6 py-28 md:px-12 md:py-40", className)}>
      {children}
    </section>
  );
}

export function EnterCta({ children = "Enter the Ball", variant = "solid", className }: { children?: ReactNode; variant?: "solid" | "ghost"; className?: string }) {
  // /ball/register is a confirmed future route (not built in this phase).
  return (
    <a
      href={EVENT.registerPath}
      className={cn(
        "group relative inline-flex min-h-12 items-center justify-center gap-3 px-8 font-sans text-xs uppercase tracking-[0.3em] transition-all duration-500",
        variant === "solid"
          ? "bg-champagne text-ink hover:bg-ivory glow"
          : "border border-champagne/40 text-ivory hover:border-champagne hover:text-champagne",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
    </a>
  );
}

export function WaxSeal({ className, label = "PCH" }: { className?: string; label?: string }) {
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden>
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <radialGradient id="wax" cx="40%" cy="35%">
            <stop offset="0%" stopColor="var(--rose)" />
            <stop offset="70%" stopColor="var(--velvet)" />
            <stop offset="100%" stopColor="var(--plum)" />
          </radialGradient>
        </defs>
        <path d="M50 3 C62 6 70 2 78 11 C88 16 92 26 95 38 C99 50 96 60 92 70 C87 82 78 90 66 95 C54 99 44 97 33 93 C20 88 11 80 6 67 C1 55 3 43 8 32 C13 20 22 11 34 6 C40 4 45 3 50 3Z" fill="url(#wax)" />
        <g fill="none" stroke="var(--champagne)" strokeOpacity="0.7" strokeWidth="0.8">
          <circle cx="50" cy="50" r="33" />
          <rect x="30" y="30" width="40" height="40" />
          <rect x="30" y="30" width="40" height="40" transform="rotate(45 50 50)" />
        </g>
        <text x="50" y="55" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="13" fill="var(--ivory)" letterSpacing="2">{label}</text>
      </svg>
    </div>
  );
}

/** Deterministic drifting particles: crescents, nodes, light motes. */
export function Particles({ count = 18, className }: { count?: number; className?: string }) {
  const items = Array.from({ length: count }, (_, i) => {
    const left = (i * 53) % 100;
    const dur = 18 + ((i * 7) % 14);
    const delay = -((i * 3.3) % dur);
    const size = 2 + (i % 4);
    const kind = i % 5;
    return { left, dur, delay, size, kind, i };
  });
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden", className)}>
      {items.map((p) => (
        <span key={p.i} className="particle" style={{ left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>
          {p.kind === 0 ? (
            <svg width={p.size * 4} height={p.size * 4} viewBox="0 0 10 10"><path d="M6 1a4 4 0 1 0 3 6.5A3.2 3.2 0 1 1 6 1z" fill="var(--champagne)" opacity=".6" /></svg>
          ) : p.kind === 1 ? (
            <span className="block border border-lavender/50" style={{ width: p.size * 2, height: p.size * 2, transform: "rotate(45deg)" }} />
          ) : (
            <span className="block rounded-full bg-champagne/70" style={{ width: p.size, height: p.size, boxShadow: "0 0 8px var(--champagne)" }} />
          )}
        </span>
      ))}
    </div>
  );
}

export function LightRays({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[80vh] overflow-hidden", className)}>
      <div
        className="rays absolute left-1/2 top-0 h-full w-[140%] -translate-x-1/2"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 150deg, oklch(0.83 0.07 80 / 10%) 165deg, transparent 172deg, oklch(0.82 0.05 355 / 8%) 182deg, transparent 190deg, oklch(0.83 0.07 80 / 9%) 198deg, transparent 212deg)",
        }}
      />
    </div>
  );
}

/** Desktop-only tiny golden cursor trail. */
export function CursorTrail() {
  const dot = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(window.matchMedia("(pointer: fine)").matches && !reduced);
  }, [reduced]);
  useEffect(() => {
    if (!on) return;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const move = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; };
    const tick = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      if (dot.current) dot.current.style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0) rotate(45deg)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, [on]);
  if (!on) return null;
  return <div ref={dot} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[60] h-2.5 w-2.5 border border-champagne/80 mix-blend-screen" />;
}

export function Veil({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-t from-plum/90 via-plum/40 to-transparent transition-all duration-700 group-hover:translate-y-[-8%] group-hover:opacity-40 group-data-[open=true]:opacity-40", className)}>
      {children}
    </div>
  );
}

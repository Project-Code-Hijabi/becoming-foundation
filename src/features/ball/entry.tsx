import { useEffect, useRef, useState } from "react";

const KEY = "pch-ball-entered";
type Phase = "black" | "static" | "curtain" | "done";

/** Signal → static → curtains part. First visit only; returning visitors get a brief fade. */
export function CurtainEntry() {
  const [phase, setPhase] = useState<Phase>("black");
  const [skip, setSkip] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let returning = false;
    try { returning = localStorage.getItem(KEY) === "1"; localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    const timers: number[] = [];
    if (returning || reduced) {
      setSkip(true);
      document.documentElement.dataset["quick"] = "1";
      timers.push(window.setTimeout(() => setPhase("done"), reduced ? 400 : 700));
    } else {
      timers.push(window.setTimeout(() => setPhase("static"), 500));
      timers.push(window.setTimeout(() => setPhase("curtain"), 2300));
      timers.push(window.setTimeout(() => setPhase("done"), 4600));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== "static") return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = 160; c.height = 100;
    let raf = 0, f = 0;
    const draw = () => {
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v * 0.95; img.data[i + 1] = v * 0.85; img.data[i + 2] = v;
        img.data[i + 3] = 55;
      }
      ctx.putImageData(img, 0, 0);
      // fleeting circuit fragments as the signal locks
      if (f > 40) {
        ctx.strokeStyle = "rgba(230,207,159,0.55)";
        ctx.beginPath();
        ctx.moveTo(40, 50); ctx.lineTo(70, 50); ctx.lineTo(80, 38); ctx.lineTo(120, 38);
        ctx.moveTo(80, 50); ctx.lineTo(80, 70); ctx.lineTo(110, 70);
        ctx.stroke();
      }
      f++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase === "done") return null;
  const open = phase === "curtain";

  return (
    <div
      role="presentation"
      aria-hidden
      className="fixed inset-0 z-[100] overflow-hidden bg-ink grain transition-opacity duration-700"
      style={skip ? { animation: "fadeout .6s ease forwards" } : undefined}
    >
      {skip ? null : (
        <>
          <canvas
            ref={canvas}
            className="absolute inset-0 h-full w-full transition-opacity duration-500"
            style={{ imageRendering: "pixelated", opacity: phase === "static" ? 1 : 0 }}
          />
          {/* Curtains */}
          {(["left", "right"] as const).map((side) => (
            <div
              key={side}
              className="absolute top-0 h-full w-1/2 transition-transform ease-[cubic-bezier(.7,0,.2,1)]"
              style={{
                [side]: 0,
                transitionDuration: "2200ms",
                transform: open ? `translateX(${side === "left" ? "-102%" : "102%"})` : "none",
                opacity: phase === "black" ? 0 : 1,
                background:
                  "repeating-linear-gradient(90deg, oklch(0.22 0.08 340) 0 3%, oklch(0.34 0.12 345) 5%, oklch(0.2 0.07 340) 8%), linear-gradient(180deg, transparent 70%, oklch(0.1 0.03 330 / 70%))",
                backgroundBlendMode: "multiply",
                boxShadow: side === "left" ? "inset -30px 0 60px oklch(0.1 0.03 330)" : "inset 30px 0 60px oklch(0.1 0.03 330)",
              }}
            >
              <div className="absolute inset-y-0 w-px bg-champagne/40" style={{ [side === "left" ? "right" : "left"]: 0 }} />
            </div>
          ))}
          <div
            className="absolute inset-0 transition-opacity duration-[2000ms]"
            style={{ opacity: open ? 1 : 0, background: "radial-gradient(ellipse at 50% 15%, oklch(0.83 0.07 80 / 22%), transparent 45%), radial-gradient(ellipse at 30% 70%, oklch(0.66 0.1 355 / 22%), transparent 55%), radial-gradient(ellipse at 75% 60%, oklch(0.5 0.12 310 / 25%), transparent 55%)" }}
          />
        </>
      )}
    </div>
  );
}

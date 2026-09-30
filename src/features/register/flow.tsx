import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { EVENT, naira } from "@/features/ball/data";
import { cn } from "@/lib/utils";
import { COUNTRIES, INTERESTS } from "./countries";
import {
  createRegistration, getMyRegistration, getTicketTypes, startPayment,
  type PublicTicket, type RegistrationResult,
} from "@/lib/registration.functions";

/* ---------------------------------------------------------------- state */

type Draft = {
  fullName: string; email: string; dialCountry: string; phoneLocal: string;
  profession: string; organisation: string;
  country: string; city: string;
  instagram: string; linkedin: string;
  interests: string[];
  networking: boolean; discoverable: boolean;
  showInstagram: boolean; showLinkedin: boolean; showWhatsapp: boolean; showEmail: boolean;
  ticketId: string; dietary: string; accessibility: string;
};

const EMPTY: Draft = {
  fullName: "", email: "", dialCountry: "NG", phoneLocal: "",
  profession: "", organisation: "", country: "", city: "",
  instagram: "", linkedin: "", interests: [],
  networking: false, discoverable: false,
  showInstagram: false, showLinkedin: false, showWhatsapp: false, showEmail: false,
  ticketId: "", dietary: "", accessibility: "",
};

// Only non-secret profile answers are kept, in this tab only. Never passwords, tokens or payment data.
const DRAFT_KEY = "pch-register-draft";

const STEPS = [
  "Welcome", "Your details", "What you do", "Where you are", "Let's connect", "What you're into",
  "Your visibility", "Your photo", "Your ticket", "One last look", "Payment", "You're in",
] as const;

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 5 * 1024 * 1024;

const dialOf = (code: string) => COUNTRIES.find((c) => c.code === code)?.dial ?? "";
const phoneE164 = (d: Draft) => `${dialOf(d.dialCountry)}${d.phoneLocal.replace(/\D/g, "").replace(/^0+/, "")}`;
const handle = (v: string) => v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "");

/* ---------------------------------------------------------------- ui bits */

const fieldCls =
  "w-full min-h-12 rounded-none border-0 border-b border-lavender/35 bg-transparent px-0 py-3 font-serif text-xl text-ivory placeholder:text-lavender/40 transition-colors focus:border-blush focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-rose";

function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: ReactNode | undefined; error?: string | undefined; optional?: boolean | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 font-sans text-[0.7rem] uppercase tracking-[0.28em] text-lavender">
        <span>{label}</span>
        {optional && <span className="normal-case tracking-normal text-lavender/60">optional</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="font-sans text-sm text-lavender/70">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="font-sans text-sm text-blush">{error}</p>}
    </div>
  );
}

function Btn({ children, onClick, variant = "solid", type = "button", disabled, className }: { children: ReactNode; onClick?: () => void; variant?: "solid" | "ghost" | "text"; type?: "button" | "submit"; disabled?: boolean | undefined; className?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 px-7 font-sans text-xs uppercase tracking-[0.28em] transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "bg-rose text-ivory shadow-[var(--shadow-glow)] hover:bg-velvet",
        variant === "ghost" && "border border-lavender/40 text-ivory hover:border-blush hover:bg-plum/60",
        variant === "text" && "px-2 text-lavender hover:text-blush",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ id, checked, onChange, label, desc, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string | undefined; disabled?: boolean | undefined }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-4", disabled && "opacity-45")}>
      <div>
        <label htmlFor={id} className="font-serif text-lg text-ivory">{label}</label>
        {desc && <p className="font-sans text-sm text-lavender/75">{desc}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-colors duration-300", checked ? "border-blush bg-rose" : "border-lavender/40 bg-ink/60")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-ivory transition-transform duration-300", checked ? "translate-x-[1.35rem]" : "translate-x-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

function StepHead({ n, title, sub }: { n: number; title: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-10 space-y-3">
      <p className="font-mono text-[0.7rem] tracking-[0.2em] text-blush/80">{String(n).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</p>
      <h1 tabIndex={-1} data-step-heading className="font-serif text-4xl leading-[1.05] text-ivory outline-none md:text-5xl">{title}</h1>
      {sub && <p className="max-w-md font-serif text-lg italic text-lavender">{sub}</p>}
    </header>
  );
}

function Progress({ step, maxReached, onJump }: { step: number; maxReached: number; onJump: (i: number) => void }) {
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Registration progress" className="w-full">
      <div className="flex items-center justify-between gap-4">
        <p className="font-sans text-[0.62rem] uppercase tracking-[0.35em] text-blush/85">Becoming your Ball profile</p>
        <p className="font-sans text-[0.7rem] text-lavender/80 md:hidden">{STEPS[step]}</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        className="relative mt-3 h-px w-full bg-lavender/20"
      >
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose to-blush transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
        <div className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-blush shadow-[0_0_12px_var(--rose)] transition-[left] duration-700 ease-out" style={{ left: `calc(${pct}% - 3px)` }} />
      </div>
      <ol className="mt-4 hidden grid-cols-12 gap-1 md:grid">
        {STEPS.map((s, i) => {
          const can = i <= maxReached && i !== step && step < 10 && i < 10;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!can}
                onClick={() => onJump(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "w-full truncate text-left font-sans text-[0.6rem] uppercase tracking-[0.12em] transition-colors",
                  i === step ? "text-ivory" : i < step ? "text-blush hover:text-ivory" : "text-lavender/40",
                  !can && "cursor-default",
                )}
              >
                {s}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const REG_ERRORS: Record<string, string> = {
  already_paid: "You already have a paid seat — no need to pay again.",
  unavailable: "That ticket isn't available right now. Please choose another.",
  sold_out: "That ticket has just sold out. Please choose another.",
  price_changed: "The price for that ticket has changed. Please take a look at the new price before you continue.",
  profile_incomplete: "A few details are missing. Please check your name, phone number and what you do.",
  error: "Something went wrong on our side. Please try again in a moment.",
};

/* ---------------------------------------------------------------- main */

export function RegisterFlow() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<number | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const mainRef = useRef<HTMLDivElement>(null);

  const fetchMine = useServerFn(getMyRegistration);
  const [paid, setPaid] = useState<Awaited<ReturnType<typeof getMyRegistration>>>(null);

  // restore draft + session after hydration
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { d: Draft; step: number; max: number };
        setD({ ...EMPTY, ...saved.d });
        setStep(Math.min(saved.step, 9));
        setMaxReached(Math.min(saved.max, 9));
      }
    } catch { /* ignore */ }
    const apply = async (uid: string | null, email: string | null) => {
      setUserId(uid);
      setSessionEmail(email);
      if (uid) {
        if (email) setD((p) => ({ ...p, email }));
        try {
          const mine = await fetchMine();
          if (mine?.status === "paid") { setPaid(mine); setStep(11); }
        } catch { /* ignore */ }
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") apply(session?.user.id ?? null, session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step >= 10) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ d, step, max: maxReached })); } catch { /* ignore */ }
  }, [d, step, maxReached]);

  const go = (i: number) => {
    setErrors({});
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      mainRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    });
  };
  const next = () => {
    if (returnTo != null) { const r = returnTo; setReturnTo(null); go(r); } else go(step + 1);
  };
  const back = () => go(Math.max(0, step - 1));
  const edit = (i: number) => { setReturnTo(9); go(i); };
  const fail = (e: Record<string, string>) => {
    setErrors(e);
    requestAnimationFrame(() => mainRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
    return false;
  };

  const props = { d, set, errors, next, back, fail, go };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-ink text-ivory">
      <Atmosphere />
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <aside className="hidden flex-col justify-between py-12 pl-12 lg:flex">
          <a href="/ball" className="font-sans text-xs uppercase tracking-[0.35em] text-lavender hover:text-blush">← Back to the Ball</a>
          <div className="space-y-6">
            <p className="font-sans text-[0.65rem] uppercase tracking-[0.4em] text-blush/85">{EVENT.name}</p>
            <p className="font-serif text-6xl leading-none text-ivory">Now, tell us<br /><em className="text-blush">about yourself.</em></p>
            <div className="h-px w-16 bg-rose/70" />
            <dl className="space-y-1 font-sans text-sm text-lavender">
              <dd>{EVENT.dayLabel}</dd>
              <dd>{EVENT.venue} · {EVENT.address}</dd>
              <dd className="text-blush">{EVENT.colourEdition}</dd>
            </dl>
          </div>
          <p className="font-mono text-[0.65rem] text-lavender/50">annual_ball_2026 · becoming</p>
        </aside>

        <div ref={mainRef} className="flex min-w-0 flex-col px-5 pb-16 pt-6 sm:px-8 lg:py-12 lg:pr-12">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <a href="/ball" className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-lavender hover:text-blush">← The Ball</a>
            <span className="font-serif text-lg text-blush">PCH</span>
          </div>
          {step > 0 && <Progress step={step} maxReached={maxReached} onJump={go} />}
          <main key={step} className="reg-step mt-10 flex-1 md:mt-14">
            {step === 0 && <Welcome onStart={() => go(1)} />}
            {step === 1 && <Details {...props} userId={userId} sessionEmail={sessionEmail} />}
            {step === 2 && <Work {...props} />}
            {step === 3 && <Location {...props} />}
            {step === 4 && <Socials {...props} />}
            {step === 5 && <Interests {...props} />}
            {step === 6 && <Visibility {...props} />}
            {step === 7 && <Photo {...props} userId={userId} />}
            {step === 8 && <Ticket {...props} />}
            {step === 9 && <Review {...props} edit={edit} userId={userId} onPaid={(m) => { setPaid(m); go(11); }} />}
            {step === 10 && <PaymentStep {...props} onPaid={(m) => { setPaid(m); try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* */ } go(11); }} />}
            {step === 11 && <YoureIn name={d.fullName} reg={paid} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-velvet/40 blur-[120px]" />
      <div className="absolute bottom-0 right-[-10rem] h-[26rem] w-[26rem] rounded-full bg-rose/20 blur-[120px]" />
      <div className="absolute inset-0 geometry opacity-[0.05]" />
      <div className="absolute inset-0 grain opacity-40" />
    </div>
  );
}

type StepProps = {
  d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; errors: Record<string, string>;
  next: () => void; back: () => void; fail: (e: Record<string, string>) => boolean; go: (i: number) => void;
};

function Nav({ onNext, nextLabel = "Continue →", back, busy, disabled }: { onNext: () => void; nextLabel?: string; back?: () => void; busy?: boolean | undefined; disabled?: boolean | undefined }) {
  return (
    <div className="mt-12 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      {back ? <Btn variant="text" onClick={back}>← Back</Btn> : <span />}
      <Btn onClick={onNext} disabled={busy || disabled}>{busy ? "One moment…" : nextLabel}</Btn>
    </div>
  );
}

/* ---------------------------------------------------------------- steps */

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex min-h-[70dvh] flex-col justify-center">
      <p className="font-sans text-[0.65rem] uppercase tracking-[0.4em] text-blush/85">{EVENT.name} · {EVENT.edition}</p>
      <h1 tabIndex={-1} data-step-heading className="mt-6 font-serif text-6xl leading-[0.95] text-ivory outline-none sm:text-7xl">You're coming. <span aria-hidden>💜</span></h1>
      <p className="mt-6 font-serif text-2xl italic text-blush">Let's make your seat official.</p>
      <p className="mt-2 font-sans text-sm text-lavender">A few little details, then you're on your way.</p>
      <div className="mt-10 border-l border-rose/50 pl-5 font-sans text-sm leading-7 text-lavender">
        <p className="text-ivory">{EVENT.dayLabel}</p>
        <p>{EVENT.venue}</p>
        <p>{EVENT.address}</p>
        <p className="mt-2 inline-block rounded-full border border-blush/40 px-3 py-0.5 text-[0.7rem] uppercase tracking-[0.25em] text-blush">{EVENT.colourEdition}</p>
      </div>
      <div className="mt-12"><Btn onClick={onStart}>Let's go →</Btn></div>
    </section>
  );
}

function Details({ d, set, errors, next, back, fail, userId, sessionEmail }: StepProps & { userId: string | null; sessionEmail: string | null }) {
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"new" | "signin" | "check">("new");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (d.fullName.trim().length < 2) e["fullName"] = "Please tell us your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e["email"] = "That email doesn't look quite right. Please check it.";
    const digits = d.phoneLocal.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 6 || digits.length > 14 || /[^\d\s()-]/.test(d.phoneLocal)) e["phone"] = "Please enter a valid number, without the country code.";
    if (!userId && (mode === "new" || mode === "signin") && password.length < 8) e["password"] = "Your password needs at least 8 characters.";
    return e;
  };

  const submit = async () => {
    setMsg(null);
    const e = validate();
    if (Object.keys(e).length) return fail(e);
    if (userId) return next();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: d.email.trim(), password });
        if (error) { setMsg(/confirm/i.test(error.message) ? "Please confirm your email first — the link is in your inbox." : "That email and password didn't match. Please try again."); return; }
        setPassword(""); next();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: d.email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/ball/register`, data: { full_name: d.fullName.trim() } },
        });
        if (error) { setMsg(/password/i.test(error.message) ? "Please choose a stronger password — try mixing words, numbers and symbols." : "We couldn't set that up just now. Please try again in a moment."); return; }
        setPassword("");
        if (data.session) next(); else setMode("check");
      }
    } catch {
      setMsg("Your connection seems to have dropped. Please try again.");
    } finally { setBusy(false); }
  };

  if (mode === "check" && !userId) {
    return (
      <section>
        <StepHead n={2} title="Check your inbox." sub="We've sent a little link to confirm your email." />
        <p className="max-w-md font-sans text-base leading-7 text-lavender">
          Open the email we sent to <span className="text-ivory">{d.email}</span> and tap the link. It brings you straight back here and everything you've typed will still be waiting.
          If you already have an account with us, sign in instead.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Btn variant="ghost" onClick={() => setMode("signin")}>I've confirmed — sign in</Btn>
          <Btn variant="text" onClick={() => setMode("new")}>Use a different email</Btn>
        </div>
      </section>
    );
  }

  return (
    <section>
      <StepHead n={2} title="First things first." sub="The name you'd like on your Ball profile, and how we can reach you." />
      <div className="space-y-8">
        <Field id="fullName" label="Full name" error={errors["fullName"]}>
          <input id="fullName" autoComplete="name" className={fieldCls} value={d.fullName} onChange={(e) => set("fullName", e.target.value)} aria-invalid={!!errors["fullName"]} aria-describedby={errors["fullName"] ? "fullName-err" : undefined} placeholder="Your name" />
        </Field>
        <Field id="email" label="Email" error={errors["email"]} hint={userId ? "You're signed in with this email." : "For your confirmation, payment receipt and signing in to your attendee app later."}>
          <input id="email" type="email" inputMode="email" autoComplete="email" className={fieldCls} value={d.email} disabled={!!sessionEmail} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors["email"]} aria-describedby={errors["email"] ? "email-err" : "email-hint"} placeholder="you@example.com" />
        </Field>
        <Field id="phone" label="WhatsApp / phone" error={errors["phone"]} hint="Any country is fine.">
          <div className="flex gap-3">
            <label htmlFor="dial" className="sr-only">Country code</label>
            <select id="dial" className={cn(fieldCls, "w-28 shrink-0 font-sans text-base [&>option]:bg-plum")} value={d.dialCountry} onChange={(e) => set("dialCountry", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code} {c.dial}</option>)}
            </select>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" className={fieldCls} value={d.phoneLocal} onChange={(e) => set("phoneLocal", e.target.value)} aria-invalid={!!errors["phone"]} aria-describedby={errors["phone"] ? "phone-err" : "phone-hint"} placeholder="801 234 5678" />
          </div>
        </Field>
        {!userId && (
          <Field id="password" label={mode === "signin" ? "Your password" : "Create a password"} error={errors["password"]} hint={mode === "signin" ? undefined : "At least 8 characters. You'll use it to sign in to your attendee app."}>
            <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} className={fieldCls} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors["password"]} aria-describedby={errors["password"] ? "password-err" : "password-hint"} />
          </Field>
        )}
        {!userId && (
          <p className="font-sans text-sm text-lavender">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button type="button" className="text-blush underline underline-offset-4 hover:text-ivory" onClick={() => { setMode(mode === "signin" ? "new" : "signin"); setMsg(null); }}>
              {mode === "signin" ? "Create one instead" : "Sign in instead"}
            </button>
          </p>
        )}
        {msg && <p role="alert" className="border-l-2 border-rose pl-4 font-sans text-sm text-blush">{msg}</p>}
      </div>
      <Nav back={back} onNext={submit} busy={busy} />
    </section>
  );
}

function Work({ d, set, errors, next, back, fail }: StepProps) {
  const examples = ["Student", "Software Engineer", "Cybersecurity Analyst", "Product Manager", "Designer", "Founder", "Researcher"];
  return (
    <section>
      <StepHead n={3} title="What do you do?" sub="Tell us what keeps you busy these days." />
      <div className="space-y-8">
        <Field id="profession" label="Profession / role" error={errors["profession"]}>
          <input id="profession" className={fieldCls} value={d.profession} maxLength={120} onChange={(e) => set("profession", e.target.value)} aria-invalid={!!errors["profession"]} aria-describedby={errors["profession"] ? "profession-err" : undefined} placeholder="e.g. Cybersecurity Analyst" />
        </Field>
        <div className="flex flex-wrap gap-2" aria-label="Quick picks">
          {examples.map((x) => (
            <button key={x} type="button" onClick={() => set("profession", x)} className={cn("rounded-full border px-3 py-1.5 font-sans text-xs transition-colors", d.profession === x ? "border-blush bg-rose/25 text-ivory" : "border-lavender/30 text-lavender hover:border-blush")}>{x}</button>
          ))}
        </div>
        <Field id="organisation" label="Company, organisation or school" optional>
          <input id="organisation" autoComplete="organization" className={fieldCls} value={d.organisation} maxLength={120} onChange={(e) => set("organisation", e.target.value)} placeholder="Where you work or study" />
        </Field>
      </div>
      <Nav back={back} onNext={() => (d.profession.trim().length < 2 ? fail({ profession: "Tell us a little about what you do — any title is fine." }) : next())} />
    </section>
  );
}

function Location({ d, set, errors, next, back, fail }: StepProps) {
  return (
    <section>
      <StepHead n={4} title="Where are you based?" sub="Just your country and city — nothing more." />
      <div className="space-y-8">
        <Field id="country" label="Country" error={errors["country"]}>
          <select id="country" className={cn(fieldCls, "[&>option]:bg-plum [&>option]:font-sans")} value={d.country} onChange={(e) => set("country", e.target.value)} aria-invalid={!!errors["country"]} aria-describedby={errors["country"] ? "country-err" : undefined}>
            <option value="">Choose your country</option>
            {[...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
            <option value="Other">Somewhere else</option>
          </select>
        </Field>
        <Field id="city" label="City" optional>
          <input id="city" autoComplete="address-level2" className={fieldCls} value={d.city} maxLength={80} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Abuja, Accra, London" />
        </Field>
      </div>
      <Nav back={back} onNext={() => (!d.country ? fail({ country: "Please choose your country." }) : next())} />
    </section>
  );
}

function Socials({ d, set, errors, next, back, fail }: StepProps) {
  const submit = () => {
    const e: Record<string, string> = {};
    if (d.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(handle(d.instagram))) e["instagram"] = "That handle doesn't look right — just letters, numbers, dots and underscores.";
    if (d.linkedin && !/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/.+/i.test(d.linkedin.trim()) && !/^[A-Za-z0-9-]{3,100}$/.test(d.linkedin.trim())) e["linkedin"] = "Please paste your LinkedIn profile link.";
    return Object.keys(e).length ? fail(e) : next();
  };
  return (
    <section>
      <StepHead n={5} title="Let's connect." sub="You might meet someone you'll want to keep in touch with." />
      <div className="space-y-8">
        <Field id="instagram" label="Instagram" optional error={errors["instagram"]}>
          <input id="instagram" className={fieldCls} value={d.instagram} maxLength={80} onChange={(e) => set("instagram", e.target.value)} aria-invalid={!!errors["instagram"]} placeholder="@yourhandle" />
        </Field>
        <Field id="linkedin" label="LinkedIn" optional error={errors["linkedin"]}>
          <input id="linkedin" inputMode="url" className={fieldCls} value={d.linkedin} maxLength={200} onChange={(e) => set("linkedin", e.target.value)} aria-invalid={!!errors["linkedin"]} placeholder="linkedin.com/in/you" />
        </Field>
        <p className="border-l border-lavender/40 pl-4 font-sans text-sm leading-6 text-lavender">
          We'll use the WhatsApp number you already gave us. Adding these doesn't show them to anyone — you choose that next.
        </p>
      </div>
      <Nav back={back} onNext={submit} />
    </section>
  );
}

function Interests({ d, set, next, back }: StepProps) {
  const [other, setOther] = useState("");
  const custom = d.interests.filter((i) => !INTERESTS.includes(i));
  const toggle = (x: string) => set("interests", d.interests.includes(x) ? d.interests.filter((i) => i !== x) : [...d.interests, x].slice(0, 20));
  const addOther = () => {
    const v = other.trim().slice(0, 40);
    if (v && !d.interests.includes(v)) set("interests", [...d.interests, v]);
    setOther("");
  };
  return (
    <section>
      <StepHead n={6} title="What are you into?" sub="Pick as many as feel like you." />
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Interests">
        {[...INTERESTS, ...custom].map((x) => {
          const on = d.interests.includes(x);
          return (
            <button key={x} type="button" aria-pressed={on} onClick={() => toggle(x)}
              className={cn("min-h-11 rounded-full border px-4 font-sans text-sm transition-all duration-300", on ? "scale-[1.03] border-blush bg-gradient-to-r from-velvet to-rose text-ivory shadow-[0_0_18px_-6px_var(--rose)]" : "border-lavender/30 bg-plum/30 text-lavender hover:border-blush hover:text-ivory")}>
              {on && <span aria-hidden className="mr-1.5">✓</span>}{x}
            </button>
          );
        })}
      </div>
      <div className="mt-8 flex items-end gap-3">
        <div className="flex-1">
          <Field id="other" label="Something else?" optional>
            <input id="other" className={fieldCls} value={other} maxLength={40} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} placeholder="Type and add" />
          </Field>
        </div>
        <Btn variant="ghost" onClick={addOther} disabled={!other.trim()}>Add</Btn>
      </div>
      <Nav back={back} onNext={next} nextLabel={d.interests.length ? "Continue →" : "Skip for now →"} />
    </section>
  );
}

function Visibility({ d, set, next, back }: StepProps) {
  return (
    <section>
      <StepHead n={7} title="You decide what people get to see." sub="Everything starts private. Change it any time." />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-lavender/20 bg-plum/40 p-5">
          <p className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-blush">Being found</p>
          <p className="mt-1 font-sans text-sm text-lavender/80">Lets other attendees see your name, role and interests. It never shares your contact details.</p>
          <div className="mt-2 divide-y divide-lavender/15">
            <Toggle id="networking" label="Networking on" desc="Other attendees can send you connection requests." checked={d.networking} onChange={(v) => { set("networking", v); if (!v) set("discoverable", false); }} />
            <Toggle id="discoverable" label="Show me in the attendee list" desc="Needs networking to be on." checked={d.discoverable} disabled={!d.networking} onChange={(v) => set("discoverable", v)} />
          </div>
        </div>
        <div className="border border-rose/25 bg-ink/50 p-5">
          <p className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-blush">Sharing contact details</p>
          <p className="mt-1 font-sans text-sm text-lavender/80">Only people you've accepted as connections can see what you switch on here. Nobody else, ever.</p>
          <div className="mt-2 divide-y divide-lavender/15">
            <Toggle id="sIg" label="Instagram" checked={d.showInstagram} onChange={(v) => set("showInstagram", v)} disabled={!d.instagram} desc={!d.instagram ? "You didn't add one." : undefined} />
            <Toggle id="sLi" label="LinkedIn" checked={d.showLinkedin} onChange={(v) => set("showLinkedin", v)} disabled={!d.linkedin} desc={!d.linkedin ? "You didn't add one." : undefined} />
            <Toggle id="sWa" label="WhatsApp" checked={d.showWhatsapp} onChange={(v) => set("showWhatsapp", v)} />
            <Toggle id="sEm" label="Email" checked={d.showEmail} onChange={(v) => set("showEmail", v)} />
          </div>
        </div>
      </div>
      <Nav back={back} onNext={next} />
    </section>
  );
}

function Photo({ next, back, userId }: StepProps & { userId: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("photo_path").eq("id", userId).maybeSingle().then(async ({ data }) => {
      if (!data?.photo_path) return;
      setPath(data.photo_path);
      const { data: s } = await supabase.storage.from("attendee-photos").createSignedUrl(data.photo_path, 600);
      if (s?.signedUrl) setPreview(s.signedUrl);
    });
  }, [userId]);

  const pick = async (file: File | undefined) => {
    setErr(null);
    if (!file || !userId) return;
    if (!PHOTO_TYPES.includes(file.type)) return setErr("Please choose a JPG, PNG or WebP image.");
    if (file.size > PHOTO_MAX) return setErr("That photo is a little too big. Please choose one under 5 MB.");
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const newPath = `${userId}/profile-${Date.now()}.${ext}`;
    try {
      const { error } = await supabase.storage.from("attendee-photos").upload(newPath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { error: pe } = await supabase.from("profiles").update({ photo_path: newPath }).eq("id", userId);
      if (pe) throw pe;
      if (path) await supabase.storage.from("attendee-photos").remove([path]);
      setPath(newPath);
      setPreview(URL.createObjectURL(file));
    } catch {
      setErr("We couldn't upload that photo. Please check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!path || !userId) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.from("profiles").update({ photo_path: null }).eq("id", userId);
      if (error) throw error;
      await supabase.storage.from("attendee-photos").remove([path]);
      setPath(null); setPreview(null);
    } catch { setErr("We couldn't remove it just now. Please try again."); } finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead n={8} title="Your photo." sub="Totally optional. It stays private — only you and people you connect with can see it." />
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-full border border-blush/40 bg-plum/60 shadow-[0_0_40px_-12px_var(--rose)]">
          {preview ? (
            <img src={preview} alt="Your profile photo preview" className="reg-step h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="flex h-full w-full items-center justify-center geometry"><span className="font-serif text-5xl text-lavender/60">PCH</span></div>
          )}
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-ink/70 font-sans text-xs uppercase tracking-[0.25em] text-blush" role="status">Uploading…</div>}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <input ref={input} id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <Btn variant="ghost" onClick={() => input.current?.click()} disabled={busy || !userId}>{preview ? "Replace photo" : "Choose a photo"}</Btn>
          {preview && <Btn variant="text" onClick={remove} disabled={busy}>Remove</Btn>}
          <p className="font-sans text-xs text-lavender/70">JPG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>
      {err && <p role="alert" className="mt-6 border-l-2 border-rose pl-4 font-sans text-sm text-blush">{err}</p>}
      <Nav back={back} onNext={next} nextLabel={preview ? "Continue →" : "Skip for now →"} disabled={busy} />
    </section>
  );
}

function useTickets() {
  const fetchTickets = useServerFn(getTicketTypes);
  const [tickets, setTickets] = useState<PublicTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => { setFailed(false); fetchTickets().then(setTickets).catch(() => setFailed(true)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  return { tickets, failed, reload: () => { setTickets(null); load(); } };
}

function Ticket({ d, set, errors, next, back, fail }: StepProps) {
  const { tickets, failed, reload } = useTickets();
  return (
    <section>
      <StepHead n={9} title="Your seat is waiting." sub="Choose your ticket." />
      {failed && <div role="alert" className="font-sans text-sm text-blush">We couldn't load the tickets. <button className="underline" onClick={reload}>Try again</button></div>}
      {!tickets && !failed && <p role="status" className="font-sans text-sm text-lavender">Fetching tickets…</p>}
      {tickets && tickets.length === 0 && <p className="font-serif text-xl text-lavender">Tickets aren't on sale right now. Please check back soon.</p>}
      {tickets && tickets.length > 0 && (
        <div role="radiogroup" aria-label="Ticket type" aria-invalid={!!errors["ticket"]} className="grid gap-4 sm:grid-cols-2">
          {tickets.map((t) => {
            const on = d.ticketId === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} disabled={!t.onSale} onClick={() => set("ticketId", t.id)}
                className={cn("group relative overflow-hidden border p-6 text-left transition-all duration-500 disabled:opacity-50",
                  on ? "border-blush bg-gradient-to-br from-velvet via-plum to-rose/60 shadow-[0_0_40px_-12px_var(--rose)]" : "border-lavender/25 bg-plum/40 hover:border-blush/70")}>
                <span aria-hidden className={cn("absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all", on ? "border-ivory bg-ivory text-plum" : "border-lavender/40")}>{on ? "✓" : ""}</span>
                <p className="font-sans text-[0.65rem] uppercase tracking-[0.35em] text-blush">{t.name}</p>
                <p className="mt-4 font-serif text-5xl text-ivory">{naira(t.priceKobo)}</p>
                {t.description && <p className="mt-3 font-sans text-sm text-lavender">{t.description}</p>}
                {t.note && <p className="mt-3 font-sans text-xs uppercase tracking-[0.2em] text-lavender/80">{t.note}</p>}
              </button>
            );
          })}
        </div>
      )}
      {errors["ticket"] && <p role="alert" className="mt-4 font-sans text-sm text-blush">{errors["ticket"]}</p>}
      <div className="mt-10 space-y-8">
        <Field id="dietary" label="Any dietary needs?" optional>
          <input id="dietary" className={fieldCls} value={d.dietary} maxLength={300} onChange={(e) => set("dietary", e.target.value)} placeholder="Allergies, preferences…" />
        </Field>
        <Field id="access" label="Anything that would make the day easier for you?" optional hint="Accessibility needs, seating, anything at all. Only the organising team sees this.">
          <input id="access" className={fieldCls} value={d.accessibility} maxLength={300} onChange={(e) => set("accessibility", e.target.value)} />
        </Field>
      </div>
      <Nav back={back} onNext={() => (tickets?.some((t) => t.id === d.ticketId && t.onSale) ? next() : fail({ ticket: "Please choose a ticket to continue." }))} />
    </section>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-lavender/20 py-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-blush">{title}</h2>
        <button type="button" onClick={onEdit} className="font-sans text-xs uppercase tracking-[0.2em] text-lavender underline-offset-4 hover:text-ivory hover:underline" aria-label={`Edit ${title}`}>Edit</button>
      </div>
      <div className="mt-2 font-serif text-lg leading-7 text-ivory">{children}</div>
    </div>
  );
}

function Review({ d, go, edit, back, userId, onPaid }: StepProps & { edit: (i: number) => void; userId: string | null; onPaid: (m: Awaited<ReturnType<typeof getMyRegistration>>) => void }) {
  const { tickets } = useTickets();
  const ticket = tickets?.find((t) => t.id === d.ticketId);
  const [agreeData, setAgreeData] = useState(false);
  const [agreePay, setAgreePay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const register = useServerFn(createRegistration);
  const fetchMine = useServerFn(getMyRegistration);
  const yes = (b: boolean) => (b ? "Visible to connections" : "Private");

  const submit = async () => {
    setMsg(null);
    if (!userId) { setMsg("Please sign in on the details step first."); return; }
    if (!ticket) { setMsg(REG_ERRORS["unavailable"]!); return; }
    if (!agreeData || !agreePay) { setMsg("Please tick both boxes so we know you're happy to continue."); return; }
    setBusy(true);
    try {
      const location = [d.city.trim(), d.country].filter(Boolean).join(", ");
      const phone = phoneE164(d);
      const { error: pe } = await supabase.from("profiles").update({
        full_name: d.fullName.trim(), phone, whatsapp: phone, profession: d.profession.trim(),
        organisation: d.organisation.trim() || null, location: location || null,
        instagram: d.instagram ? handle(d.instagram) : null, linkedin: d.linkedin.trim() || null,
        interests: d.interests,
      }).eq("id", userId);
      if (pe) throw pe;
      const { error: ve } = await supabase.from("profile_privacy").update({
        networking_enabled: d.networking, profile_discoverable: d.networking && d.discoverable,
        show_instagram_to_connections: !!d.instagram && d.showInstagram, show_linkedin_to_connections: !!d.linkedin && d.showLinkedin,
        show_whatsapp_to_connections: d.showWhatsapp, show_email_to_connections: d.showEmail, show_phone_to_connections: false,
      }).eq("profile_id", userId);
      if (ve) throw ve;
      const res: RegistrationResult = await register({ data: { ticketTypeId: ticket.id, expectedPriceKobo: ticket.priceKobo, dietaryNotes: d.dietary, accessibilityNotes: d.accessibility } });
      if (!res.ok) {
        if (res.reason === "already_paid") { onPaid(await fetchMine()); return; }
        setMsg(REG_ERRORS[res.reason] ?? REG_ERRORS["error"]!);
        if (res.reason === "price_changed" || res.reason === "sold_out" || res.reason === "unavailable") setTimeout(() => go(8), 2200);
        return;
      }
      go(10);
    } catch {
      setMsg("Something went wrong saving your details. Please check your connection and try again.");
    } finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead n={10} title="One last look." sub="Make sure everything feels right." />
      <ReviewBlock title="You" onEdit={() => edit(1)}>{d.fullName}<br /><span className="text-lavender">{d.email} · {phoneE164(d)}</span></ReviewBlock>
      <ReviewBlock title="What you do" onEdit={() => edit(2)}>{d.profession}{d.organisation && <span className="text-lavender"> · {d.organisation}</span>}</ReviewBlock>
      <ReviewBlock title="Where you're based" onEdit={() => edit(3)}>{[d.city, d.country].filter(Boolean).join(", ")}</ReviewBlock>
      <ReviewBlock title="Let's connect" onEdit={() => edit(4)}>{d.instagram ? `@${handle(d.instagram)}` : "No Instagram"} · {d.linkedin ? "LinkedIn added" : "No LinkedIn"}</ReviewBlock>
      <ReviewBlock title="Your interests" onEdit={() => edit(5)}>{d.interests.length ? d.interests.join(", ") : <span className="text-lavender">None picked yet</span>}</ReviewBlock>
      <ReviewBlock title="Your visibility" onEdit={() => edit(6)}>
        <span className="font-sans text-sm leading-7 text-lavender">
          Networking {d.networking ? "on" : "off"} · {d.networking && d.discoverable ? "In the attendee list" : "Not in the attendee list"}<br />
          Instagram: {yes(d.showInstagram && !!d.instagram)} · LinkedIn: {yes(d.showLinkedin && !!d.linkedin)}<br />
          WhatsApp: {yes(d.showWhatsapp)} · Email: {yes(d.showEmail)}
        </span>
      </ReviewBlock>
      <ReviewBlock title="Your photo" onEdit={() => edit(7)}><span className="text-lavender">Private, only if you added one</span></ReviewBlock>
      <ReviewBlock title="Your ticket" onEdit={() => edit(8)}>{ticket ? <>{ticket.name} · <span className="text-blush">{naira(ticket.priceKobo)}</span></> : <span className="text-lavender">Loading…</span>}</ReviewBlock>

      <fieldset className="mt-8 space-y-4 border-t border-lavender/20 pt-6">
        <legend className="sr-only">Before you continue</legend>
        {[
          { id: "c1", v: agreeData, s: setAgreeData, t: "My details are correct, and I'm happy for Project Code-Hijabi to use them to manage my registration and contact me about the Ball." },
          { id: "c2", v: agreePay, s: setAgreePay, t: "I understand my seat is confirmed only once my payment has been verified." },
        ].map((c) => (
          <label key={c.id} htmlFor={c.id} className="flex cursor-pointer items-start gap-3 font-sans text-sm leading-6 text-lavender">
            <input id={c.id} type="checkbox" checked={c.v} onChange={(e) => c.s(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--rose)]" />
            <span>{c.t}</span>
          </label>
        ))}
      </fieldset>
      {msg && <p role="alert" className="mt-6 border-l-2 border-rose pl-4 font-sans text-sm text-blush">{msg}</p>}
      <Nav back={back} onNext={submit} nextLabel="Continue to payment →" busy={busy} />
    </section>
  );
}

function PaymentStep({ d, back, onPaid }: StepProps & { onPaid: (m: Awaited<ReturnType<typeof getMyRegistration>>) => void }) {
  const pay = useServerFn(startPayment);
  const fetchMine = useServerFn(getMyRegistration);
  const [state, setState] = useState<"loading" | "not_configured" | "no_registration" | "network">("loading");
  const [reg, setReg] = useState<Awaited<ReturnType<typeof getMyRegistration>>>(null);

  const run = async () => {
    setState("loading");
    try {
      const [r, mine] = await Promise.all([pay(), fetchMine()]);
      setReg(mine);
      if (r.status === "already_paid") return onPaid(mine);
      setState(r.status);
    } catch { setState("network"); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, []);

  return (
    <section>
      <StepHead n={11} title="Almost there." sub={`Your ${reg?.ticketName ?? "ticket"} is being held for you, ${d.fullName.split(" ")[0] || "love"}.`} />
      {state === "loading" && <p role="status" className="font-sans text-sm text-lavender">Getting payment ready…</p>}
      {state === "network" && (
        <div role="alert" className="space-y-4">
          <p className="font-serif text-xl text-ivory">Your connection seems to have dropped.</p>
          <p className="font-sans text-sm text-lavender">Nothing has been charged. Please try again.</p>
          <Btn variant="ghost" onClick={run}>Try again</Btn>
        </div>
      )}
      {state === "no_registration" && (
        <div role="alert" className="space-y-4">
          <p className="font-serif text-xl text-ivory">We couldn't find your held seat.</p>
          <Btn variant="ghost" onClick={back}>Go back to review</Btn>
        </div>
      )}
      {state === "not_configured" && (
        <div className="space-y-6">
          {reg && (
            <div className="border border-blush/30 bg-plum/50 p-6">
              <p className="font-sans text-[0.65rem] uppercase tracking-[0.3em] text-blush">Amount due</p>
              <p className="mt-2 font-serif text-5xl text-ivory">{naira(reg.amountKobo)}</p>
              <p className="mt-1 font-sans text-sm text-lavender">{reg.ticketName} · status: waiting for payment</p>
            </div>
          )}
          <div role="status" className="border-l-2 border-rose pl-5">
            <p className="font-serif text-2xl text-ivory">Online payment opens very soon.</p>
            <p className="mt-2 font-sans text-sm leading-6 text-lavender">
              Your details are saved and your seat is held as pending. Secure card and bank payment is still being switched on by the PCH team — please don't send money anywhere else.
              Come back to this page and sign in with your email when payment opens, and you'll pick up right here.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Btn variant="ghost" onClick={run}>Check again</Btn>
            <Btn variant="text" onClick={back}>← Back to review</Btn>
          </div>
        </div>
      )}
    </section>
  );
}

function YoureIn({ name, reg }: { name: string; reg: Awaited<ReturnType<typeof getMyRegistration>> }) {
  const first = useMemo(() => name.split(" ")[0], [name]);
  return (
    <section className="flex min-h-[60dvh] flex-col justify-center">
      <p className="font-sans text-[0.65rem] uppercase tracking-[0.4em] text-blush/85">{EVENT.colourEdition}</p>
      <h1 tabIndex={-1} data-step-heading className="mt-6 font-serif text-6xl leading-none text-ivory outline-none sm:text-7xl">You're in. <span aria-hidden>💜</span></h1>
      <p className="mt-5 font-serif text-2xl italic text-blush">Welcome to the PCH Annual Ball 2026{first ? `, ${first}` : ""}.</p>
      {reg && (
        <div className="relative mt-10 overflow-hidden border border-blush/35 bg-gradient-to-br from-velvet/70 via-plum to-ink p-6 sm:p-8">
          <div aria-hidden className="absolute inset-0 circuit-grid opacity-20" />
          <dl className="relative grid grid-cols-1 gap-5 font-sans text-sm sm:grid-cols-2">
            <div><dt className="text-[0.65rem] uppercase tracking-[0.3em] text-blush">Ticket</dt><dd className="mt-1 font-serif text-xl text-ivory">{reg.ticketName}</dd></div>
            <div><dt className="text-[0.65rem] uppercase tracking-[0.3em] text-blush">Attendee code</dt><dd className="mt-1 font-mono text-lg text-ivory">{reg.attendeeCode}</dd></div>
            <div><dt className="text-[0.65rem] uppercase tracking-[0.3em] text-blush">Date</dt><dd className="mt-1 text-lavender">{EVENT.dayLabel}</dd></div>
            <div><dt className="text-[0.65rem] uppercase tracking-[0.3em] text-blush">Venue</dt><dd className="mt-1 text-lavender">{EVENT.venue}, {EVENT.address}</dd></div>
          </dl>
          <p className="relative mt-6 font-sans text-xs text-lavender/80">
            {reg.badgeActive ? "Your QR entry badge is ready. It will live in your attendee app." : "Your QR entry badge is being prepared."}
          </p>
        </div>
      )}
      <p className="mt-8 font-sans text-sm text-lavender">Your attendee app is on its way — we'll email you when it opens.</p>
      <div className="mt-8"><a href="/ball" className="font-sans text-xs uppercase tracking-[0.3em] text-blush hover:text-ivory">← Back to the Ball</a></div>
    </section>
  );
}

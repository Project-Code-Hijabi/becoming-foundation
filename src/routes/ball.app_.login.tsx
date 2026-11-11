import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { needsPasswordSetup } from "@/lib/speaker-setup";

const title = "Sign in — PCH Annual Ball 2026";
const description = "Sign in to your Ball pass, programme and connections for Becoming, 28 November 2026.";

export const Route = createFileRoute("/ball/app_/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/ball/") ? (s["redirect"] as string) : undefined,
    setup: s["setup"] === "speaker" ? "speaker" : undefined,
  }),
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

const input = "w-full border-b border-lavender/40 bg-transparent py-3 text-ivory placeholder:text-lavender/50 focus:border-blush focus:outline-none";

function Login() {
  const { redirect, setup } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "forgot" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setMode("reset"); });
    if (needsPasswordSetup(setup, window.location.hash)) {
      setMode("reset");
      void supabase.auth.getUser().then(({ data, error }) => {
        setSetupReady(!!data.user && !error);
        if (!data.user || error) setMsg("This invitation link has expired or couldn't be opened. Ask the organiser to resend it, or use Forgot password.");
      });
    }
    return () => data.subscription.unsubscribe();
  }, [setup]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setMsg(error.message.includes("confirm") ? "Please confirm your email first — check your inbox." : "That email and password don't match. Try again?"); return; }
        navigate({ to: redirect ?? "/ball/app", replace: true });
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/ball/app/login` });
        setMsg("If that email has an account, a reset link is on its way.");
      } else {
        const { data: session, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !session.user) { setMsg("Open the secure link from your email before setting your password."); return; }
        if (password.length < 8) { setMsg("Use at least 8 characters."); return; }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { setMsg("We couldn't update your password. Try the link again."); return; }
        navigate({ to: "/ball/app", replace: true });
      }
    } catch { setMsg("We couldn't connect. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <main className="velvet-bg grain flex min-h-screen items-center justify-center px-6 py-16 text-ivory">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-blush">Project Code-Hijabi · Annual Ball 2026</p>
        <h1 className="mt-4 font-serif text-5xl">{mode === "reset" ? (setup === "speaker" ? "Your speaker invitation." : "A new password.") : mode === "forgot" ? "Let's get you back in." : "Welcome back."}</h1>
        {setup === "speaker" && mode === "reset" && <p className="mt-4 text-sm text-lavender">Your complimentary Ball Pass is included. Choose your password, then step into your speaker page.</p>}
        <div className="mt-10 space-y-6">
          {mode !== "reset" && (
            <label className="block"><span className="text-xs uppercase tracking-widest text-lavender">Email</span>
              <input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          )}
          {mode !== "forgot" && (
            <label className="block"><span className="text-xs uppercase tracking-widest text-lavender">{mode === "reset" ? "New password" : "Password"}</span>
              <input className={input} type="password" required autoComplete={mode === "reset" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          )}
        </div>
        {msg && <p role="status" className="mt-6 text-sm text-blush">{msg}</p>}
        <Button disabled={busy || (mode === "reset" && setup === "speaker" && !setupReady)} className="mt-10 h-auto w-full bg-rose py-4 font-sans text-sm uppercase tracking-[0.25em] text-ink transition-colors hover:bg-blush disabled:opacity-60">
          {busy ? "One moment…" : mode === "in" ? "Enter" : mode === "forgot" ? "Send reset link" : "Save password"}
        </Button>
        <div className="mt-6 flex justify-between text-sm text-lavender">
          {mode === "in"
            ? <button type="button" onClick={() => { setMode("forgot"); setMsg(null); }} className="underline-offset-4 hover:underline">Forgot password?</button>
            : <button type="button" onClick={() => { setMode("in"); setMsg(null); }} className="underline-offset-4 hover:underline">Back to sign in</button>}
          {setup !== "speaker" && <Link to="/ball/register" className="underline-offset-4 hover:underline">Get your seat</Link>}
        </div>
      </form>
    </main>
  );
}

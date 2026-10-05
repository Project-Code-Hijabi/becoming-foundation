import { useCallback, useEffect, useState, type ReactNode } from "react";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Role = "super_admin" | "admin" | "staff" | "attendee" | "speaker";

/** Client-side route gate. Real enforcement is RLS + server functions; this only decides which screen to show. */
export async function gate(path: string, need?: "admin" | "staff") {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw redirect({ to: "/ball/app/login", search: { redirect: path } });
  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  const roles = (rows ?? []).map((r) => r.role as Role);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isStaff = isAdmin || roles.includes("staff");
  if (need === "admin" && !isAdmin) throw redirect({ to: "/ball/app" });
  if (need === "staff" && !isStaff) throw redirect({ to: "/ball/app" });
  return { user: { id: data.user.id, email: data.user.email ?? "" }, roles, isAdmin, isStaff };
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      console.error(e);
      setError("Something didn't load. Please try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  return { data, error, loading, reload: run };
}

/** Throws on Supabase error so useLoad can show a friendly message. */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("/ball/app/login");
}

export function State({ loading, error, empty, reload, children, tone = "dark" }: {
  loading: boolean; error: string | null; empty?: boolean | string; reload?: () => void; children: ReactNode; tone?: "dark" | "light";
}) {
  const muted = tone === "dark" ? "text-lavender/80" : "text-plum/70";
  if (loading) return <p className={`py-8 text-sm ${muted}`} role="status">Loading…</p>;
  if (error)
    return (
      <div className={`py-8 text-sm ${muted}`} role="alert">
        {error}{" "}
        {reload && <button onClick={reload} className="underline underline-offset-4">Try again</button>}
      </div>
    );
  if (empty) return <p className={`py-8 text-sm ${muted}`}>{typeof empty === "string" ? empty : "Nothing here yet."}</p>;
  return <>{children}</>;
}

export function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

export function fmtTime(iso?: string | null) {
  if (!iso) return "Time to be announced";
  return new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });
}

export const naira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Public: admin-saved page content for /ball. */
export const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb.from("site_content").select("key, content");
  const rows = (data ?? []) as { key: string; content: any }[];
  // Swap "asset:<path>" image references for short-lived signed links. Storage policy only
  // signs images an admin has published, so unpublished/removed images simply disappear.
  const paths = new Set<string>();
  const walk = (v: any, fn: (s: string) => any): any =>
    typeof v === "string" ? fn(v) : Array.isArray(v) ? v.map((x) => walk(x, fn))
      : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, fn)])) : v;
  rows.forEach((r) => walk(r.content, (s) => { if (s.startsWith("asset:")) paths.add(s.slice(6)); return s; }));
  if (!paths.size) return rows;
  const { data: signed } = await sb.storage.from("event-assets").createSignedUrls([...paths], 60 * 60 * 6);
  const map = new Map((signed ?? []).filter((x) => x.signedUrl && !x.error).map((x) => [x.path, x.signedUrl]));
  return rows.map((r) => ({ key: r.key, content: walk(r.content, (s) => (s.startsWith("asset:") ? map.get(s.slice(6)) ?? "" : s)) }));
});

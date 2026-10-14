import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTIONS, PAGES, PREVIEW_STORAGE, defaultFor, type Page } from "@/features/ball/content";

const field = "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground";
const small = "rounded-sm border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary";

type J = any;

function blankLike(v: J): J {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).map((k) => [k, blankLike(v[k])]));
  return typeof v === "number" ? 0 : "";
}

function Node({ value, onChange, template }: { value: J; onChange: (v: J) => void; template?: J }) {
  if (value === undefined) value = null;
  if (Array.isArray(value)) {
    const proto = value.length ? value[0] : Array.isArray(template) && template.length ? template[0] : "";
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-sm border border-border p-3">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Item {i + 1}</span>
              <span className="flex gap-1">
                <button className={small} disabled={i === 0} onClick={() => { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}>↑</button>
                <button className={small} onClick={() => { if (confirm(`Remove item ${i + 1}?`)) onChange(value.filter((_, j) => j !== i)); }}>Remove</button>
              </span>
            </div>
            <Node value={item} template={Array.isArray(template) ? template[0] : undefined} onChange={(v) => { const n = [...value]; n[i] = v; onChange(n); }} />
          </div>
        ))}
        <button className={small} onClick={() => onChange([...value, blankLike(proto)])}>+ Add item</button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return <ObjectNode value={value} onChange={onChange} template={template} />;
  }
  const long = typeof value === "string" && value.length > 60;
  const Comp: any = long ? "textarea" : "input";
  return <Comp className={field} rows={3} value={value ?? ""} placeholder="(empty)"
    onChange={(e: any) => onChange(typeof value === "number" ? Number(e.target.value) || 0 : e.target.value === "" && value === null ? null : e.target.value)} />;
}

function ObjectNode({ value, onChange, template }: { value: Record<string, J>; onChange: (v: J) => void; template?: J }) {
  const [newKey, setNewKey] = useState("");
  return (
    <div className="space-y-2">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">{k}</label>
            <button className="text-xs text-muted-foreground underline" onClick={() => { if (!confirm(`Remove the field "${k}"?`)) return; const n = { ...value }; delete n[k]; onChange(n); }}>Remove field</button>
          </div>
          <Node value={v} template={template && typeof template === "object" ? template[k] : undefined} onChange={(nv) => onChange({ ...value, [k]: nv })} />
        </div>
      ))}
      <div className="flex gap-2">
        <input className={field} placeholder="New field name" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <button className={small} disabled={!newKey.trim() || newKey in value} onClick={() => { onChange({ ...value, [newKey.trim()]: "" }); setNewKey(""); }}>+ Add field</button>
      </div>
    </div>
  );
}

export function PagesEditor() {
  const [page, setPage] = useState<Page>("ball");
  const [key, setKey] = useState(SECTIONS[0]!.key);
  const [value, setValue] = useState<J>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  const load = (k: string) => {
    setValue(null); setMsg(""); setDirty(false); setLoadErr(false);
    supabase.from("site_content").select("content").eq("key", k).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setLoadErr(true); return; }
        const c = data?.content;
        setValue(c === null || c === undefined ? defaultFor(k) ?? {} : c);
      });
  };
  useEffect(() => { load(key); }, [key]);
  const edit = (v: J) => { setValue(v); setDirty(true); };
  const switchTo = (k: string) => { if (dirty && !confirm("You have unsaved changes. Discard them?")) return; setKey(k); };
  const switchPage = (p: Page) => {
    if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
    setPage(p); setKey(SECTIONS.find((s) => s.page === p)!.key);
  };
  const preview = () => {
    try { localStorage.setItem(PREVIEW_STORAGE, JSON.stringify({ [key]: value })); } catch { setMsg("Couldn't open preview in this browser."); return; }
    const path = PAGES.find((p) => p.id === SECTIONS.find((s) => s.key === key)!.page)!.path;
    window.open(`${path}?preview=1`, "_blank", "noopener");
  };

  const save = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("site_content").upsert({ key, content: value });
    if (error) { setBusy(false); setMsg("Couldn't save. Your changes are still here — try again."); return; }
    const { data: back } = await supabase.from("site_content").select("content").eq("key", key).maybeSingle();
    setBusy(false);
    if (back) { setValue(back.content); setDirty(false); setMsg("Saved — live on the Ball page now."); }
    else setMsg("Saved, but couldn't confirm. Refresh to check.");
  };
  const reset = async () => {
    if (!confirm("Restore this section to its original content?")) return;
    const { error } = await supabase.from("site_content").delete().eq("key", key);
    if (error) { setMsg("Couldn't restore. Try again."); return; }
    setValue(defaultFor(key)); setDirty(false); setMsg("Restored to original.");
  };

  return (
    <div className="space-y-4 text-foreground">
      <p className="text-sm text-muted-foreground">Choose a page and section, edit, press Preview to see it before anyone else does, then Save & publish. Add or remove items and fields as needed. Empty a field to show "Coming soon" where the page supports it.</p>
      <select className={field} aria-label="Page" value={page} onChange={(e) => switchPage(e.target.value as Page)}>
        {PAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select className={field} aria-label="Section" value={key} onChange={(e) => switchTo(e.target.value)}>
        {SECTIONS.filter((s) => s.page === page).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {loadErr ? <p className="text-sm text-muted-foreground" role="alert">Couldn't load this section. <button className="underline" onClick={() => load(key)}>Try again</button></p>
        : value === null ? <p className="text-sm text-muted-foreground">Loading…</p> : <Node value={value} template={defaultFor(key)} onChange={edit} />}
      <div className="flex items-center gap-3">
        <button className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || value === null || !dirty} onClick={save}>{busy ? "Saving…" : "Save & publish"}</button>
        <button className={small} disabled={value === null} onClick={preview}>Preview</button>
        <button className={small} onClick={reset}>Restore original</button>
        {msg && <span className="text-sm text-muted-foreground" role="status">{msg}</span>}
      </div>
    </div>
  );
}

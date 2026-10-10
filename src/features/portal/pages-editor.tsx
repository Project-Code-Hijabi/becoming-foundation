import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTIONS, defaultFor } from "@/features/ball/content";

const field = "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground";
const small = "rounded-sm border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary";

type J = any;

function blankLike(v: J): J {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).map((k) => [k, blankLike(v[k])]));
  return typeof v === "number" ? 0 : "";
}

function Node({ value, onChange }: { value: J; onChange: (v: J) => void }) {
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-sm border border-border p-3">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Item {i + 1}</span>
              <span className="flex gap-1">
                <button className={small} disabled={i === 0} onClick={() => { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}>↑</button>
                <button className={small} onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </div>
            <Node value={item} onChange={(v) => { const n = [...value]; n[i] = v; onChange(n); }} />
          </div>
        ))}
        <button className={small} onClick={() => onChange([...value, value.length ? blankLike(value[0]) : ""])}>+ Add item</button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return <ObjectNode value={value} onChange={onChange} />;
  }
  const long = typeof value === "string" && value.length > 60;
  const Comp: any = long ? "textarea" : "input";
  return <Comp className={field} rows={3} value={value ?? ""} placeholder="(empty)"
    onChange={(e: any) => onChange(typeof value === "number" ? Number(e.target.value) || 0 : e.target.value === "" && value === null ? null : e.target.value)} />;
}

function ObjectNode({ value, onChange }: { value: Record<string, J>; onChange: (v: J) => void }) {
  const [newKey, setNewKey] = useState("");
  return (
    <div className="space-y-2">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">{k}</label>
            <button className="text-xs text-muted-foreground underline" onClick={() => { const n = { ...value }; delete n[k]; onChange(n); }}>Remove field</button>
          </div>
          <Node value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} />
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
  const [key, setKey] = useState(SECTIONS[0]!.key);
  const [value, setValue] = useState<J>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(null); setMsg("");
    supabase.from("site_content").select("content").eq("key", key).maybeSingle()
      .then(({ data }) => setValue(data ? data.content : defaultFor(key)));
  }, [key]);

  const save = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("site_content").upsert({ key, content: value });
    setBusy(false);
    setMsg(error ? "Couldn't save. Try again." : "Saved — live on the Ball page now.");
  };
  const reset = async () => {
    if (!confirm("Restore this section to its original content?")) return;
    await supabase.from("site_content").delete().eq("key", key);
    setValue(defaultFor(key)); setMsg("Restored to original.");
  };

  return (
    <div className="space-y-4 text-foreground">
      <p className="text-sm text-muted-foreground">Edit any text on the public Ball page. Add or remove items and fields, then save. Empty a field to show "Coming soon" where the page supports it.</p>
      <select className={field} value={key} onChange={(e) => setKey(e.target.value)}>
        {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {value === null ? <p className="text-sm text-muted-foreground">Loading…</p> : <Node value={value} onChange={setValue} />}
      <div className="flex items-center gap-3">
        <button className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || value === null} onClick={save}>Save & publish</button>
        <button className={small} onClick={reset}>Restore original</button>
        {msg && <span className="text-sm text-muted-foreground" role="status">{msg}</span>}
      </div>
    </div>
  );
}

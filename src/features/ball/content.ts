// Admin-editable overrides for the public Ball page. Each key maps to a
// module-level object/array in data.ts; saved content replaces it in place.
import * as D from "./data";

type Json = unknown;
export const SECTIONS: { key: string; label: string; get: () => Json }[] = [
  { key: "EVENT", label: "Event details", get: () => D.EVENT },
  { key: "PROGRAMME", label: "Programme chapters", get: () => D.PROGRAMME },
  { key: "KEYNOTES", label: "Keynote speakers", get: () => D.KEYNOTES },
  { key: "HONOREE", label: "Grand honoree", get: () => D.HONOREE },
  { key: "PANEL", label: "Panel", get: () => D.PANEL },
  { key: "FIRESIDE", label: "Fireside chat", get: () => D.FIRESIDE },
  { key: "HACKATHON", label: "Hackathon teams", get: () => D.HACKATHON },
  { key: "HACKATHON_JUDGES", label: "Hackathon judges", get: () => D.HACKATHON_JUDGES },
  { key: "AWARDS", label: "Awards", get: () => D.AWARDS },
];

const DEFAULTS: Record<string, Json> = Object.fromEntries(SECTIONS.map((s) => [s.key, structuredClone(s.get())]));
export const defaultFor = (key: string) => structuredClone(DEFAULTS[key]);

function replaceInPlace(target: any, value: any) {
  if (Array.isArray(target) && Array.isArray(value)) target.splice(0, target.length, ...value);
  else if (target && typeof target === "object" && value && typeof value === "object") {
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, value);
  }
}

/** Applies saved overrides (or restores defaults for keys without one). */
export function applyContent(rows: { key: string; content: Json }[]) {
  for (const s of SECTIONS) {
    const row = rows.find((r) => r.key === s.key);
    replaceInPlace(s.get(), row ? structuredClone(row.content) : defaultFor(s.key));
  }
}

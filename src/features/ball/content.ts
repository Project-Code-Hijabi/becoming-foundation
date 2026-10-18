// Admin-editable overrides for the public Ball pages and attendee area. Each key
// maps to a module-level object/array; saved content replaces it in place.
import { useEffect, useState } from "react";
import * as D from "./data";
import { APP_COPY, REGISTER_COPY } from "./copy";

type Json = unknown;
export type Page = "ball" | "register" | "app";
export const PAGES: { id: Page; label: string; path: string }[] = [
  { id: "ball", label: "Ball page (/ball)", path: "/ball" },
  { id: "register", label: "Registration (/ball/register)", path: "/ball/register" },
  { id: "app", label: "Attendee area (/ball/app)", path: "/ball/app" },
];
export const SECTIONS: { key: string; label: string; page: Page; get: () => Json }[] = [
  { key: "EVENT", label: "Event details", page: "ball", get: () => D.EVENT },
  { key: "PROGRAMME", label: "Programme chapters", page: "ball", get: () => D.PROGRAMME },
  { key: "KEYNOTES", label: "Keynote speakers", page: "ball", get: () => D.KEYNOTES },
  { key: "HONOREE", label: "Grand honoree", page: "ball", get: () => D.HONOREE },
  { key: "PANEL", label: "Panel", page: "ball", get: () => D.PANEL },
  { key: "FIRESIDE", label: "Fireside chat", page: "ball", get: () => D.FIRESIDE },
  { key: "HACKATHON", label: "Hackathon teams", page: "ball", get: () => D.HACKATHON },
  { key: "HACKATHON_JUDGES", label: "Hackathon judges", page: "ball", get: () => D.HACKATHON_JUDGES },
  { key: "AWARDS", label: "Awards", page: "ball", get: () => D.AWARDS },
  { key: "REGISTER_COPY", label: "Registration wording", page: "register", get: () => REGISTER_COPY },
  { key: "APP_COPY", label: "Attendee area wording", page: "app", get: () => APP_COPY },
];

const DEFAULTS: Record<string, Json> = Object.fromEntries(SECTIONS.map((s) => [s.key, structuredClone(s.get())]));
export const defaultFor = (key: string) => structuredClone(DEFAULTS[key]);
/** Shapes for new items in lists whose default is empty, so "+ Add item" gives every field. */
const ITEM_TEMPLATES: Record<string, Json> = {
  HACKATHON: [{ name: "", problem: "", solution: "", members: [""], logo: "" }],
};
export const templateFor = (key: string) => structuredClone(ITEM_TEMPLATES[key] ?? DEFAULTS[key]);
/** Field names the editor treats as an uploadable image. Values are stored as "asset:<path>". */
export const isImageField = (name?: string) => !!name && /^(image|logo)$|(Image|Logo)$/.test(name);
export const ASSET_PREFIX = "asset:";

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

export const PREVIEW_STORAGE = "pch-content-preview";

/** Admin preview: unsaved drafts from the editor (this browser only) layered over published content. */
export function usePreviewContent(rows: { key: string; content: Json }[]) {
  const [preview, setPreview] = useState<Record<string, Json> | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") !== "1") return;
    try {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE);
      if (raw) setPreview(JSON.parse(raw));
    } catch { /* ignore malformed draft */ }
  }, []);
  const merged = preview
    ? [...rows.filter((r) => !(r.key in preview)), ...Object.entries(preview).map(([key, content]) => ({ key, content }))]
    : rows;
  applyContent(merged);
  return !!preview;
}

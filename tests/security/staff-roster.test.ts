import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { PANEL } from "../../src/features/ball/data";

describe("Staff roster privacy", () => {
  test("anonymous callers cannot read confirmed attendees", async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Public connection configuration is required");
    const client = createClient(url, key, { auth: { persistSession: false } });
    const result = await client.rpc("staff_confirmed_attendees", { _search: "", _offset: 0 });
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });
  test("Khadijah Abiola has both approved event roles", () => {
    expect(PANEL.people.find((p) => p.name === "Khadijah Abiola")?.role).toBe("Panelist & Hackathon Judge");
  });
});
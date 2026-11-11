import { describe, expect, test } from "bun:test";
import { needsPasswordSetup, initialPortalTab } from "../../src/lib/speaker-setup";

describe("Speaker invitation entry", () => {
  test("speaker invitation starts password setup even after auth consumes the hash", () => {
    expect(needsPasswordSetup("speaker", "")).toBe(true);
  });
  test("standard invitation and recovery links start password setup", () => {
    expect(needsPasswordSetup(undefined, "#access_token=example&type=invite")).toBe(true);
    expect(needsPasswordSetup(undefined, "#type=recovery")).toBe(true);
  });
  test("ordinary sign-in is not password setup", () => {
    expect(needsPasswordSetup(undefined, "")).toBe(false);
  });
  test("speakers enter their studio instead of attendee registration", () => {
    expect(initialPortalTab(true)).toBe("speaker");
    expect(initialPortalTab(false)).toBe("home");
  });
});
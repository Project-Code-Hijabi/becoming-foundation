/** Invite intent never grants a role; the server-created role remains authoritative. */
export function needsPasswordSetup(setup: unknown, hash: string) {
  return setup === "speaker" || /(?:^|[&#])type=(?:invite|recovery)(?:&|$)/.test(hash);
}

export function initialPortalTab(isSpeaker: boolean): "speaker" | "home" {
  return isSpeaker ? "speaker" : "home";
}
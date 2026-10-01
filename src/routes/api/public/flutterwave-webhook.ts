import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["FLUTTERWAVE_WEBHOOK_HASH"];
        const got = request.headers.get("verif-hash") ?? "";
        if (!expected) return new Response("not configured", { status: 503 });
        const a = Buffer.from(got);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("unauthorized", { status: 401 });

        let txRef: unknown;
        try {
          const body = (await request.json()) as { data?: { tx_ref?: unknown }; txRef?: unknown };
          txRef = body.data?.tx_ref ?? body.txRef;
        } catch {
          return new Response("bad request", { status: 400 });
        }
        if (typeof txRef !== "string" || !/^PCHB26-PAY-[0-9a-f]{32}$/.test(txRef)) return new Response("ok");

        // Never trust the webhook body: re-verify with Flutterwave before finalising.
        const { verifyAndFinalize } = await import("@/lib/flutterwave.server");
        const outcome = await verifyAndFinalize(txRef);
        return new Response(outcome === "unavailable" ? "retry" : "ok", { status: outcome === "unavailable" ? 502 : 200 });
      },
    },
  },
});

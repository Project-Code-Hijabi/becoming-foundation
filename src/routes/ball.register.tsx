import { createFileRoute } from "@tanstack/react-router";
import { RegisterFlow } from "@/features/register/flow";

const title = "Register — Project Code-Hijabi Annual Ball 2026";
const description = "You're coming. Make your seat at the Pink & Purple Edition official — 14 November 2026, Raybam, Lagos.";

export const Route = createFileRoute("/ball/register")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterFlow,
});

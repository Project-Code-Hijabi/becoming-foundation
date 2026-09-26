import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/ball" });
  },
  head: () => ({
    meta: [
      { title: "Project Code-Hijabi Annual Ball 2026" },
      { name: "description", content: "Becoming — the Project Code-Hijabi Annual Ball, 14 November 2026, Lagos." },
      { property: "og:title", content: "Project Code-Hijabi Annual Ball 2026" },
      { property: "og:description", content: "Becoming — the Project Code-Hijabi Annual Ball, 14 November 2026, Lagos." },
    ],
  }),
});

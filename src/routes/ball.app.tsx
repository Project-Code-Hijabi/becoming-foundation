import { createFileRoute } from "@tanstack/react-router";
import { gate, signOut } from "@/features/portal/shared";

export const Route = createFileRoute("/ball/app")({
  ssr: false,
  beforeLoad: () => gate("/ball/app"),
  head: () => ({
    meta: [
      { title: "Your Ball — PCH Annual Ball 2026" },
      { name: "description", content: "Your private space for Becoming, 14 November 2026." },
      { property: "og:title", content: "Your Ball — PCH Annual Ball 2026" },
      { property: "og:description", content: "Your private space for Becoming, 14 November 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();
  return (
    <main className="velvet-bg grain min-h-screen px-6 py-16 text-ivory">
      <h1 className="font-serif text-5xl">You're in. 💜</h1>
      <p className="mt-4 text-lavender">Signed in as {user.email}.</p>
      <button onClick={signOut} className="mt-8 underline underline-offset-4">Sign out</button>
    </main>
  );
}

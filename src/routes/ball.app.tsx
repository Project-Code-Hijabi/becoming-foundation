import { createFileRoute } from "@tanstack/react-router";
import { gate } from "@/features/portal/shared";
import { AttendeeApp } from "@/features/portal/attendee";

export const Route = createFileRoute("/ball/app")({
  ssr: false,
  beforeLoad: () => gate("/ball/app"),
  head: () => ({
    meta: [
      { title: "Your Ball — PCH Annual Ball 2026" },
      { name: "description", content: "Your Ball Pass, programme, connections and Becoming space for 14 November 2026." },
      { property: "og:title", content: "Your Ball — PCH Annual Ball 2026" },
      { property: "og:description", content: "Your Ball Pass, programme, connections and Becoming space for 14 November 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, isAdmin, isStaff } = Route.useRouteContext();
  return (
    <>
      {(isAdmin || isStaff) && (
        <div className="bg-ink px-5 py-2 text-center text-xs text-lavender">
          {isAdmin && <a className="mr-4 underline" href="/ball/admin">Admin</a>}
          {isStaff && <a className="underline" href="/ball/staff">Door / staff</a>}
        </div>
      )}
      <AttendeeApp userId={user.id} email={user.email} />
    </>
  );
}

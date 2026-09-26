import { createFileRoute } from "@tanstack/react-router";
import { CurtainEntry } from "@/features/ball/entry";
import { CursorTrail } from "@/features/ball/primitives";
import {
  Arrived, Awards, BecomingConstellation, Connection, Conversations, Countdown, Finale, Footer,
  Hackathon, Hero, Honoree, Navigation, Programme, Speakers, TerminalMoment, TheRoom, Tickets,
} from "@/features/ball/sections";

const title = "Becoming — Project Code-Hijabi Annual Ball 2026";
const description =
  "An intimate daytime Ball for Muslim women navigating tech, identity and impact. 14 November 2026, Raybam, Lagos.";

export const Route = createFileRoute("/ball/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BallPage,
});

function BallPage() {
  return (
    <>
      <CurtainEntry />
      <CursorTrail />
      <Navigation />
      <main>
        <Hero />
        <Arrived />
        <BecomingConstellation />
        <TerminalMoment />
        <Programme />
        <Speakers />
        <Honoree />
        <Conversations />
        <Hackathon />
        <Connection />
        <TheRoom />
        <Awards />
        <Countdown />
        <Tickets />
        <Finale />
      </main>
      <Footer />
    </>
  );
}

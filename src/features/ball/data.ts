// Structured content for /ball. Shapes mirror the backend tables
// (programme_items, people, hackathon_teams, award_categories, ticket_types)
// so this module can later be swapped for Lovable Cloud queries.
// Never invent names, bios, times or recipients: use null / "Coming soon".

export const EVENT = {
  name: "Project Code-Hijabi",
  edition: "Annual Ball 2026",
  theme: "Becoming",
  subtitle: "Muslim Women Navigating Tech, Identity & Impact",
  dateISO: "2026-11-14T09:00:00+01:00",
  dateLabel: "14 November 2026",
  venue: "Raybam",
  city: "Lagos",
  address: "2 Peace Estate Road, Alimosho, Lagos",
  mapsUrl: "https://maps.app.goo.gl/d8nK3jUztQhCChBy7?g_st=ic",
  registerPath: "/ball/register",
};

export type Chapter = { no: string; title: string; line: string; time: string | null };
export const PROGRAMME: Chapter[] = [
  { no: "01", title: "Arrive", line: "The doors open and the evening begins.", time: null },
  { no: "02", title: "Discover", line: "Keynote conversations on becoming.", time: null },
  { no: "03", title: "Connect", line: "Meet someone you didn't know when you arrived.", time: null },
  { no: "04", title: "Reflect", line: "Becoming, Unscripted — the fireside chat.", time: null },
  { no: "05", title: "Learn", line: "The Realities of Navigating Tech — the panel.", time: null },
  { no: "06", title: "Build", line: "Built By Her — hackathon teams pitch.", time: null },
  { no: "07", title: "Share", line: "Stories, ideas and conversations across the room.", time: null },
  { no: "08", title: "Recognise", line: "Awards and recognition.", time: null },
  { no: "09", title: "Celebrate", line: "We made it here, together.", time: null },
  { no: "10", title: "Leave a Trace", line: "Something to carry home.", time: null },
];

export type Person = { name: string; aka?: string; role?: string | null; topic?: string; bio: string | null; bioMore?: string | null; quote?: string };

export const KEYNOTES: Person[] = [
  {
    name: "Oyin Amood",
    aka: "Lady Soteria",
    role: "Keynote Speaker 01",
    topic: "Becoming: Identity, Purpose & Community in Tech",
    quote: "Who are you becoming — and what are you building from that identity?",
    bio: "Educator, entrepreneur, author and community builder.",
    bioMore:
      "She is the founder of Scholars Do, an EdTech initiative for hands-on learning, and Brunch With The Girls, a community for Nigerian Muslim women.",
  },
  {
    name: "Dr. Falilat Jimoh",
    role: "Keynote Speaker 02",
    topic: "Becoming: Finding Your Place, Building Your Career & Creating Opportunities in Tech",
    bio: null,
  },
];

export const HONOREE = {
  name: "As-Seyyidah Rafatallahi Adejumoke Hassan Muhammad-ul-Awwal",
  title: "Ummul-Khayrr Tijaniyah Yoruba Land, Edo and Delta State",
};

export const PANEL = {
  title: "Becoming: The Realities of Navigating Tech",
  line: "The deeper, practical conversation around Muslim women building careers, businesses and identities in tech.",
  people: [
    {
      name: "Ubaydah Abdulwasiu",
      role: "Engineer",
      bio: "Petroleum Engineering background, with experience in technical leadership and technology communities, and a public speaker on emerging tech trends and careers.",
    },
    { name: "Taofeeqah Balogun", role: "Cybersecurity Manager, CyberSOC Africa", bio: null },
  ] as Person[],
  pending: "2 more voices joining the conversation soon",
};

export const FIRESIDE = {
  title: "Becoming, Unscripted",
  line: "An intimate conversation beyond polished career stories — pivots, doubts, lessons, unexpected turns and quiet moments.",
  people: [
    { name: "Aisha Mudathir", role: "Product Manager · Founder, Muslimah in Tech", bio: "Product Manager, community builder and founder of Muslimah in Tech." },
  ] as Person[],
  pending: "One more voice joining the conversation soon",
};

export type Team = { name: string | null; problem: string | null; solution: string | null; members: string[] };
export const HACKATHON: Team[] = Array.from({ length: 5 }, () => ({ name: null, problem: null, solution: null, members: [] }));

export type Award = { title: string; recipient: string | null };
export const AWARDS: Award[] = [
  { title: "Mentee Award", recipient: null },
  { title: "Male Mentor Award", recipient: null },
  { title: "Female Mentor Award", recipient: null },
  { title: "Muslim Woman in Tech", recipient: null },
  { title: "Teenage Muslim Woman in Tech", recipient: null },
  { title: "Executive Award", recipient: null },
  { title: "Hackathon Winner", recipient: null },
];

export const TICKETS = [
  { code: "EARLY_BIRD", name: "Early Bird", priceKobo: 350000 },
  { code: "REGULAR", name: "Regular", priceKobo: 500000 },
];

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export const NAV = [
  { id: "pch", label: "PCH" },
  { id: "becoming", label: "Becoming" },
  { id: "programme", label: "Programme" },
  { id: "speakers", label: "Speakers" },
  { id: "hackathon", label: "Hackathon" },
  { id: "experience", label: "Experience" },
  { id: "tickets", label: "Tickets" },
];

// Structured content for /ball. Shapes mirror the backend tables
// (programme_items, people, hackathon_teams, award_categories, ticket_types)
// so this module can later be swapped for Lovable Cloud queries.
// Never invent names, bios, times or recipients: use null / "Coming soon".

export const EVENT = {
  name: "Project Code-Hijabi",
  edition: "Annual Ball 2026",
  colourEdition: "Pink & Purple Edition",
  theme: "Becoming",
  subtitle: "Muslim Women Navigating Tech, Identity & Impact",
  dateISO: "2026-11-14T09:00:00+01:00",
  dateLabel: "14 November 2026",
  dayLabel: "Saturday, 14 November 2026",
  venue: "Raybam",
  city: "Lagos",
  address: "20 Peace Estate Road, Alimosho, Lagos",
  mapsUrl: "https://maps.app.goo.gl/d8nK3jUztQhCChBy7?g_st=ic",
  registerPath: "/ball/register",
};

export type Chapter = { no: string; title: string; line: string; time: string | null };
export const PROGRAMME: Chapter[] = [
  { no: "01", title: "Guest Arrival", line: "Doors open from 9:00 AM.", time: null },
  { no: "02", title: "Check-in & Exploration", line: "Collect your Ball Pass and explore the room.", time: null },
  { no: "03", title: "Opening Film", line: "“We Are Becoming” — the film that opens the day.", time: null },
  { no: "04", title: "Host Welcome", line: "It is not only about where we have been. It is about who we are becoming.", time: null },
  { no: "05", title: "Founder Opening", line: "Masturah Babawale, Founder of Project Code-Hijabi.", time: null },
  { no: "06", title: "Keynote 1", line: "Becoming: Identity, Purpose & Community in Tech — Oyin Amood (Lady Soteria).", time: null },
  { no: "07", title: "Interactive / Table Experience", line: "Your table, your missions, your conversations.", time: null },
  { no: "08", title: "Panel", line: "Becoming: The Realities of Navigating Tech.", time: null },
  { no: "09", title: "Hackathon Pitch Block 1", line: "The first finalists pitch live.", time: null },
  { no: "10", title: "Networking & Snacks", line: "Meet someone you didn't know when you arrived.", time: null },
  { no: "11", title: "Keynote 2", line: "Becoming: Finding Your Place, Building Your Career & Creating Opportunities in Tech — Dr. Falilat Jimoh.", time: null },
  { no: "12", title: "Hackathon Pitch Block 2", line: "The remaining finalists pitch live.", time: null },
  { no: "13", title: "PCH Stories", line: "Impact storytelling from the Project Code-Hijabi community.", time: null },
  { no: "14", title: "Becoming, Unscripted", line: "The fireside chat — the audience speaks first.", time: null },
  { no: "15", title: "Awards & Recognition", line: "She built. She led. She mentored. She became.", time: null },
  { no: "16", title: "Dear Future Me", line: "A letter to the woman you are becoming.", time: null },
  { no: "17", title: "Closing", line: "We made it here, together.", time: null },
  { no: "18", title: "Food, Merch & Take-Home", line: "Something to carry home.", time: null },
  { no: "19", title: "Departure", line: "Leave knowing a little more about who you're becoming.", time: null },
];

export type Person = { name: string; aka?: string; role?: string | null; topic?: string; title?: string | null; bio: string | null; bioMore?: string | null; quote?: string };

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
    title: "Head of Innovation and Digital Inclusion | Southwest Zonal Office, NITDA Nigeria",
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
      role: "Panelist",
      title: "Software Engineer, Codematic Technology Services",
      bio: "Petroleum Engineering background, with experience in technical leadership and technology communities, and a public speaker on emerging tech trends and careers.",
    },
    { name: "Taofeeqah Balogun", role: "Panelist", title: "Cybersecurity Manager, CyberSOC Africa", bio: null },
    { name: "Khadijah Abiola", role: "Panelist & Hackathon Judge", bio: null },
    { name: "Masturah Babawale", role: "Moderator", title: "Founder, Project Code-Hijabi", bio: null },
  ] as Person[],
  pending: "" as string,
};

export const FIRESIDE = {
  title: "Becoming, Unscripted",
  line: "An intimate conversation beyond polished career stories — pivots, doubts, lessons, unexpected turns and quiet moments.",
  people: [
    { name: "Aisha Mudathir", role: "Fireside Guest", bio: null },
    { name: "Zainab Adeoye", role: "Moderator", bio: null },
  ] as Person[],
  pending: "" as string,
};

export type Team = { name: string | null; problem: string | null; solution: string | null; members: string[] };
export const HACKATHON: Team[] = [];
export const HACKATHON_JUDGES = ["Khadijah Abiola", "Balikis Bankole"];

export type Award = { title: string; recipient: string | null };
export const AWARDS: Award[] = [
  { title: "Hackathon First Place", recipient: null },
  { title: "Hackathon Second Place", recipient: null },
  { title: "Hackathon Third Place", recipient: null },
  { title: "Muslim Woman in Tech of the Year", recipient: null },
  { title: "Teenage Muslim Woman in Tech of the Year", recipient: null },
  { title: "Best PCH Mentee", recipient: null },
  { title: "Best PCH Community Member", recipient: null },
  { title: "Best PCH Mentor", recipient: null },
  { title: "Executive of the Year", recipient: null },
  { title: "Speaker & Panelist Appreciation", recipient: null },
  { title: "Special Impact Award", recipient: null },
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

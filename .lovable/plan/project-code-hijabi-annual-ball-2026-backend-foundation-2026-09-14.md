# Project Code-Hijabi Annual Ball 2026 — Backend Foundation

Backend only. No frontend pages, no UI, no payment integration in this stage.

## What gets set up

1. **Cloud backend enabled** (managed Postgres + auth + storage + file hosting), with email/password sign-in and Google sign-in.
2. **Database schema** covering people, tickets, payments, QR identity, check-in, networking, content and the "Becoming" experiences.
3. **Roles and permissions** — super admin, admin, staff, attendee, speaker.
4. **Row Level Security** on every table so private information stays private.
5. **Storage buckets** split into public event assets and private attendee files.
6. **A written schema guide** saved in the project (`docs/backend.md`) explaining every table and how they relate.

## Roles

Roles live in their own `user_roles` table (never on the profile) with values:
`super_admin`, `admin`, `staff`, `attendee`, `speaker`. A security-definer
`has_role()` function is used by all policies, plus `is_admin()` for
admin-or-super-admin checks. No one can grant themselves a role; only
super admins can change roles.

## Tables

**Identity & profile**

- `profiles` — one row per signed-up user: full name, email, phone/WhatsApp, profession, organisation, location, Instagram, LinkedIn, interests, skills, networking preferences, photo path. Created automatically on signup.
- `profile_privacy` — per-attendee visibility switches: instagram/linkedin/whatsapp/email visible to connections, profile discoverable, networking enabled. Defaults are private.

**Ticketing & payments**

- `ticket_types` — Early Bird (₦3,500), Regular (₦5,000): name, price in kobo, sales window, quantity cap, active flag.
- `registrations` — one per attendee purchase: ticket type, status (`pending`/`paid`/`cancelled`/`refunded`), human-readable attendee code, timestamps.
- `payments` — provider (`flutterwave`), transaction reference, provider transaction id, amount, currency, status (`pending`/`successful`/`failed`/`cancelled`/`refunded`), raw verification payload, paid_at. Only server-side code may write here; nothing a browser sends can mark a ticket paid.

**QR identity & check-in**

- `attendee_badges` — unique QR token per paid registration, status (`active`/`revoked`), issued_at.
- `check_ins` — badge, staff member who scanned, timestamp, optional session, override flag. Unique constraint prevents duplicate check-ins unless an admin overrides.
- `badge_scans` — log of networking scans (who scanned whom, when), separate from check-in.

**Networking**

- `connection_requests` — requester, recipient, status (`pending`/`accepted`/`declined`/`blocked`), timestamps, one pending request per pair.
- `connections` — accepted pairs, stored once per pair with a canonical ordering.
- A `visible_profile` view/function returns only fields the owner allowed, and only to an accepted connection.

**Event content (admin-editable, no code changes needed)**

- `people` — speakers, panelists, fireside guests, special guests, Grand Honoree: name, title, organisation, bio, photo, socials, `person_type`, display order, published flag.
- `programme_items` — session title, type, description, start/end time, location, order.
- `session_speakers` — links people to programme items with a role.
- `hackathon_teams` and `hackathon_team_members` — team name, description, pitch info, members.
- `award_categories` and `award_recipients` — category, recipient (person or attendee), recognition note, year.
- `announcements` — title, body, published flag, publish_at.

**Becoming experiences**

- `dear_future_me` — private letter per attendee, content, delivery date, created/updated timestamps. Visible to the author only, never to admins by default.
- `becoming_entries` — extensible reflections/memories: type, title, body, media path, visibility. Designed so new experience types can be added without new tables.

## Security rules (summary)

- Public (signed-out) readers: only published `people`, `programme_items`, `announcements`, `hackathon_teams`, awards and active `ticket_types`.
- Attendees: full access to their own profile, privacy settings, registration, payment record, badge, letters and entries. Another attendee's details only through the connection-aware access path.
- Staff: may read badges and write check-ins; no access to payments, letters or contact details beyond what check-in needs.
- Admins: manage content, tickets, registrations, check-ins; read payments. Super admins additionally manage roles.
- `dear_future_me` is owner-only; no admin read policy.
- Every table gets explicit table grants alongside its policies, indexes on all foreign keys and lookup columns, unique constraints on QR tokens, transaction references and attendee codes, and created/updated timestamps.

## Storage

- `event-assets` (public): speaker, honoree and guest photographs, event images.
- `attendee-photos` (private): profile photographs, readable by the owner, admins, and accepted connections through signed URLs.
- `becoming-media` (private): owner-only media for archive entries.

## Technical notes

- Server-side logic uses typed server functions in this app's own runtime — no separate custom backend, no service-role key ever reaching the browser.
- Payment verification is written as a server-only path ready for Flutterwave: the webhook/verification endpoint will be the only writer of `payments.status = successful`. No Flutterwave calls or keys in this stage.
- Schema is delivered as SQL migrations, so the database stays independent of this host and the frontend can later be deployed anywhere.

We don’t want google sign in

The description says:

profiles — one row per signed-up user

That’s good for the overall user system.

But we need to make sure the architecture doesn’t assume every user is an attendee.

A staff member, speaker or admin can have a profile without buying a Ball ticket.

That’s why the separate registrations/user_roles structure is good.

Payment data visibility

It says:

Attendees: full access to their own … payment record.

That’s okay, but when we build the frontend, we need to be careful about what payment information is actually displayed.

An attendee shouldn’t need to see raw Flutterwave verification payloads or internal payment data.

They only need something like:

Payment successful

Ticket: Early Bird

₦3,500

Reference: PCHB26-XXXX

The raw verification payload should remain backend-only.

There should be suppose migrations and supabase integrations added

We don’t want a situation where they pay and then have to fill out essentially the same information again.

## Not in this stage

No homepage, registration form, dashboards, scanner, networking UI, design system, or Flutterwave integration.
# Next phase: full content editing, staff invite test, EmailOctopus confirmations

Already done: Balikis Bankole added as Hackathon Judge; Early Bird closes 10 Nov 2026 at 23:59 (Lagos); Masturah has a free confirmed place, active Ball Pass QR, and staff access.

## 1. Admin can edit every page
- Every section of the public Ball page (headings, lines, programme chapters, speakers, panel, fireside, honoree, hackathon, judges, awards, tickets text, final message) reads from the database instead of fixed text.
- Admin gets a "Pages" area: pick a section, edit any text, add a new item, remove an item, reorder, hide/show, then publish.
- Speakers/people: edit name, title, bio, photo, role; add or remove custom extra details (e.g. "Instagram", "Company") as flexible label/value rows.
- Ticket prices and deadlines editable, with a warning before changing a price.
- Event details (date, venue, address, map link) editable in one place.
- Draft vs published, so nothing goes live by accident.

## 2. End-to-end staff invitation test
- From Admin, invite projectcodehijabi@gmail.com as staff (it is already admin, so it gets staff added, no new password).
- Since there is no second address, invite flow for a brand-new email is tested with a temporary test address, then removed.
- Then sign in as staff, open the door page, scan Masturah's pass, check her in, confirm "Already checked in" on a second scan, then undo the test check-in.

## 3. Confirmation email via EmailOctopus
- EmailOctopus is a newsletter service; it does not send one-off emails directly. Approach: after a payment is verified on the server, add the attendee to an EmailOctopus list with fields (first name, ticket, attendee ID), tagged "paid".
- An EmailOctopus automation "when contact is tagged paid" sends the invitation-style email ("Your place at Becoming is confirmed. 💜", ticket-style block, VIEW MY BALL PASS button to /ball/app). The email design lives in EmailOctopus.
- Sent only once: the server records that the attendee was added, so repeated payment notices do not resend.
- Needs from you: EmailOctopus API key (entered in a secure field), the list ID, and the automation set up in EmailOctopus.

## Technical details
- New `site_content` table (section key, JSON items, published flag, admin-only writes, public read of published).
- Public page loads content through a server function with fallback to current text.
- `registrations.confirmation_email_sent_at` column for idempotency; EmailOctopus call in the verified-payment path only.

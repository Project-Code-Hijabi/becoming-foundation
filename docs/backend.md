# Project Code-Hijabi Annual Ball 2026 — Backend

Theme: *Becoming: Muslim Women Navigating Tech, Identity & Impact* · Saturday 14 November 2026, Lagos.

Status: backend foundation **implemented and security-tested**. No frontend yet. **Flutterwave is NOT integrated.**

## 1. Architecture

- **Database/Auth/Storage:** Lovable Cloud (managed Supabase Postgres, Auth, Storage).
- **App runtime:** TanStack Start. Trusted server logic runs in `createServerFn` handlers or server routes under `src/routes/api/public/*` (for webhooks). There are no separate Edge Functions.
- **Schema:** plain SQL migrations in `supabase/migrations/`, so the database can move to any Postgres/Supabase host.
- **Internal helpers:** these live in the `app_private` schema, which the public API does not expose: `has_role`, `is_admin`, `is_staff`, `are_connected`.

## 2. Authentication

- Email/password only. No Google or other social sign-in, and no anonymous sign-ups.
- The `handle_new_user` trigger on signup creates a `profiles` row and a `profile_privacy` row with private defaults.
- A profile does not make someone an attendee. Attendee status comes from a paid `registrations` row, so staff, speakers and admins can have profiles without a ticket.

## 3. Roles

- Roles are stored in `user_roles` with the enum `app_role`: `super_admin`, `admin`, `staff`, `attendee`, `speaker`. They are never stored on the profile.
- The `guard_user_roles` trigger makes sure only a super admin can grant, change or remove roles. Nobody can change their own roles. `granted_by` is set automatically.

## 4. Tables (summary)

| Area | Tables |
|---|---|
| Identity | `profiles`, `profile_privacy`, `user_roles` |
| Ticketing | `ticket_types` (EARLY_BIRD 350000 kobo = ₦3,500; REGULAR 500000 kobo = ₦5,000), `registrations`, `payments` |
| QR / check-in | `attendee_badges`, `check_ins`, `badge_scans` |
| Networking | `connection_requests`, `connections` |
| Content | `people`, `programme_items`, `session_speakers`, `hackathon_teams`, `hackathon_team_members`, `award_categories`, `award_recipients`, `announcements`, `event_asset_publications` |
| Becoming | `dear_future_me`, `becoming_entries` |

Every table has RLS enabled and explicit grants. Foreign keys and lookup columns are indexed. QR tokens, transaction references and attendee codes are unique.

## 5. Row Level Security model

- **Signed-out visitors:** can read only published content and active ticket types.
- **Attendees:** can read and edit their own profile and privacy settings. They can read their own registration, badge, letters and entries. On their own registration they may change only dietary and accessibility notes (enforced by `guard_registration_update`).
- **Staff:** can look up badges only through `staff_lookup_badge` and record check-ins. They have no access to payments, letters or contact details.
- **Admins:** manage content, tickets, registrations and check-ins, and can read payments.
- **Super admins:** everything admins can do, plus role management.
- **`dear_future_me`:** owner-only. There is no admin read policy.
- **`payments`:** attendees can read only their own records. The browser has no insert, update or delete path.

## 6. Storage (all buckets private)

| Bucket | Contents | Access |
|---|---|---|
| `event-assets` | Speaker, honoree and event images | Private. Published files are listed in `event_asset_publications` and served through signed URLs. Unpublished files cannot be reached. |
| `attendee-photos` | Profile photos under `<user_id>/...` | Owner and admins |
| `becoming-media` | Becoming media under `<user_id>/...` | Owner only |

`event-assets` is private because the platform does not allow public buckets. Signed URLs deliver the same result for published images.

## 7. Attendee privacy and networking

- `profile_privacy` holds `networking_enabled`, `profile_discoverable` and one on/off switch per contact field. Everything defaults to private, and only the owner or an admin can read the row.
- `get_shareable_profile(target)` returns another person's public fields only when that person has networking enabled. It returns a contact field only if the two people are connected **and** that field's switch is on.

### Connection-request flow

1. The requester inserts into `connection_requests` (`requester_id = auth.uid()`, enforced by RLS).
2. The `guard_connection_request_insert` trigger rejects the request unless the **recipient** has `networking_enabled`. This trigger runs with elevated rights so it can check that one flag. Callers cannot read privacy rows, and nobody can call the trigger function directly.
3. `guard_connection_request_update` controls responses: only the recipient can accept, decline or block, and a request can be answered only once. The requester can only withdraw a pending request. The two parties can never be changed.
4. `handle_request_accepted` creates the `connections` row, stored once per pair (least ID first, then greatest). There is no direct insert or update on `connections`.

**Fixed defect (Sep 2026):** the insert guard used to run with the requester's rights. Privacy RLS hid the recipient's row, so every request failed with "not accepting connections". It now runs with elevated rights and anyone's direct execute permission has been removed.

## 8. QR badges and check-in

- One badge per paid registration. Tokens are `PCHB26-` followed by 64 hex characters, generated from random UUIDs, so they cannot be guessed or enumerated.
- `generate_qr_token()` can be run only by trusted server code (anon and authenticated users have no execute permission).
- Staff call `staff_lookup_badge(qr_token)` to get only what they need at the door: name, photo, ticket, badge and registration status, whether the person has already checked in, and dietary/accessibility notes.
- Check-in is recorded by inserting into `check_ins`. The `guard_check_in` trigger requires staff, an active badge and a paid registration, and it fills in `user_id` and `checked_in_by` itself. A unique rule blocks duplicate entry check-ins, except for admin overrides. Nobody can call the guard function directly.

## 9. Payment architecture

- `registrations.status` changes from `pending` to `paid` only through server-side code using the service role. Browser clients cannot change status, amount, reference or paid time.
- `payments.provider_payload` (the raw provider response) stays on the backend only.
- Attendees use `get_my_payment_summary()`, which returns ticket name, amount, currency, status, reference and paid time.
- **Future Flutterwave integration point (NOT implemented):** add `src/routes/api/public/flutterwave-webhook.ts`. It must verify the webhook signature and then re-verify the transaction with Flutterwave's API: amount, currency and `tx_ref` must match the pending registration. Only then should it use the service role to update `payments` and `registrations`, and issue the badge with `generate_qr_token()`. Never trust a client redirect or a client callback.

## 10. Advisory security-definer functions (reviewed, kept on purpose)

| Function | Who | Why it is safe |
|---|---|---|
| `get_my_payment_summary` | Signed in | Filtered by `auth.uid()`, so there is no ID parameter to abuse. It never returns the raw payload. |
| `get_shareable_profile` | Signed in | Respects networking and connection switches. It returns nothing for unknown or opted-out users, and contact details are never exposed without consent. |
| `staff_lookup_badge` | Signed in, staff only | Raises an error for non-staff. It needs a token that cannot be guessed and returns only operational fields, with no token, email, phone or payment data. |

The linter's "signed-in users can execute SECURITY DEFINER function" warning for these three is expected.

## 11. Configuration

Server environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never sent to the browser).
Browser environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
Future: `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_HASH`, stored as secrets.

## 12. Migrations and deployment

Apply `supabase/migrations/*.sql` in filename order to a fresh Supabase project. Then create the three private buckets and seed `ticket_types`. The frontend can be deployed anywhere as long as the environment variables above are set.

## 13. Security testing

- Suite: `tests/security/suite.ts`, 185 checks. It covers anonymous, attendee, staff, admin and super-admin access, privacy, role escalation, payment tampering, QR and check-in, networking, private data, unpublished content, storage, and IDOR (using other people's IDs).
- Run it with: `bun run tests/security/suite.ts` (needs the three server variables).
- The suite creates `@sectest.local` fixtures and deletes all of them at the end.
- Latest result: **185 / 185 passed**, with 0 failed, 0 skipped and 0 errors.

## 14. Production considerations

- Turn on leaked-password protection and email confirmation in auth settings.
- Keep the service role key server-only, and rotate it if it is ever exposed.
- Rerun the security suite after every schema change.
- Use signed URLs with short lifetimes for private media.
- Add rate limiting to the payment webhook once Flutterwave is integrated.

# Becoming Foundation

PROJECT CODE-HIJABI ANNUAL BALL 2026

Backend Architecture & Supabase Foundation — DO NOT BUILD FRONTEND YET

We are building the digital platform for the Project Code-Hijabi Annual Ball 2026.

Theme: Becoming: Muslim Women Navigating Tech, Identity & Impact
Edition: Pink & Purple Edition
Date: Saturday, 14 November 2026
Location: Lagos, Nigeria

VERY IMPORTANT

DO NOT BUILD THE FRONTEND YET.

Do not create the public website.

Do not create the homepage.

Do not create the registration UI.

Do not create the attendee dashboard UI.

Do not create the admin dashboard UI.

Do not create the staff portal UI.

Do not spend this stage designing visual components, layouts, landing pages, navigation, animations or frontend screens.

This stage is ONLY for planning and establishing the backend architecture using Supabase.

We will build the frontend later, after the backend foundation has been properly designed.



1. BACKEND

Use Supabase as the backend for the entire application.

Supabase will eventually handle:

PostgreSQL database

Authentication

User accounts

Roles

Permissions

Attendee profiles

Event content

Speakers

Panelists

Special guests

Grand Honoree

Programme

Hackathon teams

Awards

Ticketing

Payments

Check-in

QR identities

Networking

Connection requests

Privacy settings

Becoming experiences

Announcements

Image/file storage

Do not create a separate custom backend.

Do not use mock/local storage as the permanent data layer.

The application must be designed so the eventual frontend communicates with Supabase through secure, well-structured APIs/queries.



2. FUTURE DEPLOYMENT

The eventual architecture will be:

Frontend: GitHub → Netlify

Backend: Supabase

Payments: Flutterwave

The frontend must eventually be portable and deployable independently from Lovable.

Do not create architecture that requires Lovable to remain the production host.



3. USER AND ROLE ARCHITECTURE

Design the database and authentication architecture to support:

Super Admin

The Project Code-Hijabi Founder/Executive Director.

Full system access.

Admin

Authorised PCH administrators.

Permissions determined by role.

Staff

Event operations staff.

Limited access, such as check-in and QR scanning.

Attendee

Registered and paid Ball attendee.

Access to their own attendee experience, profile, ticket, QR and networking features.

Speaker / Guest

Optional future role if needed.

Use role-based access control.

Do not give every authenticated user the same permissions.



4. ATTENDEE PROFILE ARCHITECTURE

The registration process will eventually collect information that becomes part of the attendee’s Ball profile.

Design the database to support fields such as:

Full name

Email

Phone/WhatsApp

Profession/role

Organisation

Location

Instagram

LinkedIn

Areas of interest

Skills

Networking preferences

Profile photo

Other event-required information

Important privacy rule:

Collecting a person’s information does NOT automatically mean sharing it with other attendees.

Create appropriate privacy/visibility fields.

For example:

Instagram visible to connections: true/false

LinkedIn visible to connections: true/false

WhatsApp visible to connections: true/false

Profile discoverable: true/false

Networking enabled: true/false

The architecture should support granular privacy controls.



5. TICKETING ARCHITECTURE

Create the database structure required for:

Ticket types

Early Bird ticket

Regular ticket

Ticket price

Registration

Ticket status

Payment status

Transaction reference

Flutterwave transaction ID

Payment timestamp

Ticket/attendee ID

Current working prices:

Early Bird: ₦3,500

Regular: ₦5,000

Do NOT integrate Flutterwave yet.

Do NOT create a fake payment flow.

Only establish the database architecture required for future Flutterwave integration.



6. PAYMENT ARCHITECTURE

The eventual payment flow will be:

Registration
→ Flutterwave
→ Flutterwave webhook/callback
→ Server-side verification
→ Supabase payment record
→ Ticket marked paid
→ Attendee access activated

The backend must NOT trust a frontend “payment successful” message.

Design the database to distinguish:

Pending

Successful

Failed

Cancelled

Refunded, if required later



7. EVENT CONTENT ARCHITECTURE

Create appropriate tables/relationships for content that will eventually be managed by the admin.

People

Speakers

Panelists

Fireside guests

Special guests

Grand Honoree

Programme

Programme items

Sessions

Session type

Start time

End time

Description

Speaker/session relationships

Hackathon

Finalist teams

Team name

Team description

Members

Pitch information

Awards

Award categories

Recipients

Recognition information

Announcements

Announcement title

Content

Publication status

Publish date

Content should eventually be editable through the admin interface without changing frontend code.



8. QR / LANYARD ARCHITECTURE

Every paid attendee will eventually have a unique digital identity.

Create the backend structure required for:

Unique attendee ID

Unique QR identifier

QR status

Lanyard identity

Scan records

The physical lanyard will eventually contain the attendee’s QR code.

The same identity should work with their digital attendee experience.

Do not build the scanner UI yet.

Only establish the backend architecture.



9. NETWORKING ARCHITECTURE

Networking is an important part of the Ball.

The eventual flow will be:

Attendee A scans Attendee B’s QR
→ Attendee B’s permitted profile information is displayed
→ A selects “Connect”
→ B receives a connection request
→ B accepts or declines
→ If accepted, they become connections

Create the backend structure for:

Connection requests

Accepted connections

Declined requests

Connection timestamps

Optional blocking/removal later

Scanning must NOT automatically reveal private contact information.

Only information the profile owner has chosen to share should be revealed.



10. CHECK-IN ARCHITECTURE

Staff will eventually be able to scan an attendee’s QR code.

The backend should support:

Check-in status

Check-in timestamp

Staff member who performed check-in

Attendee ID

Event/session if session-level check-in is later implemented

Prevent duplicate check-ins unless an authorised admin explicitly overrides them.

Do not build the scanner UI yet.



11. BECOMING EXPERIENCES

The Ball will eventually include digital experiences such as:

Dear Future Me

Attendees can write a private message to their future selves.

The backend should support:

Attendee ownership

Private content

Creation timestamp

Update timestamp

Becoming Archive

Attendees may eventually save reflections, memories or other Ball-related content.

Design the architecture so these experiences can be expanded later.



12. SECURITY

This is extremely important.

Implement Supabase Row Level Security appropriately.

Examples:

Public users

Can only access information explicitly marked public.

Attendees

Can access their own private profile/data.

They can only see another attendee’s information when the relevant visibility/privacy rules allow it.

Staff

Can only access information required for their assigned role.

Admins

Can access and manage authorised system data.

Do not expose private attendee information through public queries.

Do not expose Supabase service-role keys in frontend/client code.

Use secure authentication and authorisation patterns.



13. STORAGE

Plan Supabase Storage for:

Speaker photographs

Grand Honoree photograph

Guest photographs

Attendee profile photographs

Event images

Other Ball assets

Separate public assets from private assets where appropriate.



14. DATABASE QUALITY

Use:

Proper primary keys

Foreign keys

Appropriate indexes

Timestamps

Unique constraints

Appropriate enums/status fields where useful

Referential integrity

Avoid unnecessary duplication.

Keep naming consistent and understandable.

Design relationships carefully so the database can support the future public website, attendee experience, admin dashboard and staff portal without needing a major rebuild.



15. WHAT WE ARE NOT BUILDING IN THIS STAGE

DO NOT build:

Public homepage

Public website

Hero section

Registration form UI

Ticket page UI

Flutterwave UI

Attendee dashboard

Mobile app interface

Admin dashboard UI

Staff dashboard UI

QR scanner UI

Networking UI

Visual design system

Animations

Marketing pages

Again:

NO FRONTEND YET.



16. WHAT WE NEED AT THE END OF THIS STAGE

At the end of this stage, I want a clean and well-documented Supabase backend foundation that we can confidently build the frontend on top of.

Please provide/establish:

Database schema

Table relationships

Authentication structure

Role structure

Permission strategy

Row Level Security policies

Storage structure

Necessary indexes and constraints

Clear explanation of how the major entities relate

A foundation that can later support the public website, registration, Flutterwave, attendee experience, QR networking, check-in, staff portal and admin portal.

Do not proceed to frontend development until explicitly instructed.

The next development stage will be the frontend, built on top of this Supabase foundation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bcd3792d-8516-4ea5-a33f-758d0c3b8099).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

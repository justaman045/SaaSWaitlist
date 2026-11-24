# SaaS Waitlist

> Discover, showcase, and join waitlists for upcoming SaaS products.

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com)
[![License](https://img.shields.io/github/license/justaman045/SaaSWaitlist)](LICENSE)

A modern waitlist management platform where makers list upcoming SaaS products and visitors join their waitlists. Built with Next.js 16 (App Router), Firebase, and Cloudinary.

**[Live Demo →](https://projektnotify.vercel.app)**

## Features

- **Project showcase** — a featured grid on the landing page, a full `/projects` directory, and rich detail pages (`/projects/[slug]`) with an image gallery, Markdown description, key features, pricing, launch date, and tech stack.
- **Waitlist signup** — visitors join a project's waitlist by email. Entries use a deterministic document id (`<projectId>_<email>`) so the same address cannot register twice, and a Firestore transaction bumps the project's public `waitlistCount` atomically. The public counter is periodically re-derived from the waitlist entries, so a drifted count repairs itself.
- **Tool & feature requests** — a public `/request` page lets visitors ask for a tool that is not in the catalogue (optionally tied to an existing project). Requests land in an admin inbox with a new → reviewing → accepted/rejected workflow. This is the only public submission channel — every "Submit Project" call to action points here.
- **Admin dashboard** — email/password or Google sign-in, email verification, and full project CRUD: Live / Coming Soon status, Cloudinary image gallery upload, a Markdown editor with live preview, plus tags, category, numeric pricing, tech stack, features, and launch date.
- **Demand tracking** — the dashboard ranks every tool by signups plus requests, surfaces signups over the last 30 days, lists the tools people ask for that are *not* in the catalogue yet, and exports the raw signup list to CSV.
- **Admin-managed taxonomy** — categories, tags and tech stack come from a shared option list (Firestore `taxonomy` collection). The project form offers them as dropdowns and can create new ones on the fly; `/admin/taxonomy` renames, deletes and bulk-imports them. Every write is a transactional read-modify-write against the stored list, so two admins editing at the same time cannot overwrite each other.
- **Nexus sync** — projects are mirrored to the nexusprods catalog on create/update, deleted there on removal, and periodically reconciled back into Firestore.
- **Polished UI** — a single dark theme with no flash on load, Framer Motion animation, shadcn/ui components, and a fully responsive layout including a mobile nav.
- **Public API** — `GET /api/projects` with optional `search`, `category`, and `tag` filters, CORS enabled.
- **SEO** — per-project metadata, `sitemap.xml`, `robots.txt`, error/loading/not-found states.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (email/password + Google) |
| Image storage | Cloudinary (unsigned uploads) |
| Styling | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Forms & validation | react-hook-form + Zod |
| Markdown | react-markdown (raw HTML disabled) |
| Deployment | Vercel |

## Getting started

Prerequisites: Node 20+, a Firebase project, and a Cloudinary account.

```bash
git clone https://github.com/justaman045/SaaSWaitlist.git
cd SaaSWaitlist
npm install
```

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

If the Firebase variables are unset, `lib/firebase.ts` falls back to a mock config so the app still boots, but Firestore reads silently return empty and the site renders without any projects.

No other external service is needed to build. The Inter typeface is **self-hosted** from `fonts/` via `next/font/local`, so a build never depends on reaching Google Fonts (Inter is SIL OFL 1.1 — the license ships in `fonts/Inter-LICENSE.txt`).

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client SDK config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase client SDK config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client SDK config |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Comma-separated admin allowlist (defaults to the owner address) |
| `NEXT_PUBLIC_NEXUS_URL` | Nexus website URL override (default `https://nexusprods.vercel.app`) |
| `NEXT_PUBLIC_NEXUS_API_URL` | Nexus products API override (server-side; the browser goes through `/api/nexus/...`) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for sitemap/robots/Open Graph |
| `NEXT_PUBLIC_FIREBASE_EMULATOR` | Set to `true` to run against the local Firebase emulators (inlined at build time) |

## Firebase setup

- Create the Firestore collections `projects`, `waitlist`, `taxonomy` and `requests`.
- Enable the **Email/Password** and **Google** providers in Firebase Authentication, then create admin users manually (there is no self-signup).
- Deploy the rules in `firestore.rules` to project `company-24267`:
  ```bash
  firebase deploy --only firestore:rules --project company-24267
  ```
  (Already done — the hardened rules were released to `company-24267` on 2026-11-23. Re-run this after every edit to the file.)
  Public reads of `projects` are required for pages to populate. `waitlist` is admin-read only (it contains emails); anonymous visitors may create exactly one validated entry per `(project, email)` — the address must be lowercase, whitespace-free, at most 320 characters and must not contain `/` — and may only bump `projects.waitlistCount` by exactly 1. `taxonomy` is publicly readable and admin-writable. `requests` accepts validated public creates but is admin-read only.
- The rules file is **shared with the nexusprods app**, so verify it against the local emulator before every deploy:
  ```bash
  cd /tmp/opencode
  firebase emulators:exec --only firestore --project demo-saaswaitlist \
    --config /path/to/SaaSWaitlist/firebase.emulator.json \
    "node /path/to/SaaSWaitlist/scripts/verify-firestore-rules.cjs"
  ```
  Run it from **outside** the repo: the emulator writes its log files into the current directory, and a `firestore-debug.log` change in the repo root makes Turbopack rebuild in a loop.
- Admin access is enforced **client-side only** (`onAuthStateChanged` in `app/admin/layout.tsx`) plus the Firestore rules. The UI checks `NEXT_PUBLIC_ADMIN_EMAILS`, but the rules are the real server-side boundary.

## Admin dashboard

| Route | What it does |
|-------|--------------|
| `/admin` | Overview — stat cards, signups over the last 30 days, most-wanted tools, demand leaderboard, latest signups |
| `/admin/projects` | The project table with search, status/category filters, sorting and waitlist counts |
| `/admin/signups` | Every waitlist signup with search, filters and CSV export |
| `/admin/requests` | Request inbox with a status workflow and delete |
| `/admin/taxonomy` | Manage the shared category / tag / tech-stack option lists |

The option lists live in the `taxonomy` collection (one document per list) and feed the dropdowns in the project form. Typing a new value in the form adds it to the shared list; `/admin/taxonomy` can rename, delete and import options that are already used by existing projects. Every taxonomy write is a **transactional read-modify-write against the stored list**, so two admins working at the same time cannot overwrite each other's changes. A rename identifies the option by its value rather than by its position in the list, so it always renames the option that was actually edited — and if another admin renamed or deleted that option in the meantime, the rename is refused with a conflict message instead of quietly doing nothing.

`lib/demand.ts` turns signups and requests into the ranking: a tool's demand is `signups + requests`, and requests that are not tied to any project are grouped by title and shown separately as catalogue candidates. The signups are counted from the waitlist entries themselves; the counter stored on the project document is only used as a stand-in when the waitlist collection could not be read at all.

Deleting a request or a project uses a two-step inline confirmation rather than a native browser dialog, removes the row optimistically, and — if the write is rejected — restores the row and shows the exact Firebase reason (for example `permission-denied`) on the card itself. The request status dropdown behaves the same way: the new status is applied immediately and rolled back if the write fails.

The admin header always reports what the Nexus sync is doing: **"Syncing Nexus"** while it runs, **"Nexus sync failed"** (linking to the overview, where the reason is shown) when it errors, and **"Nexus sync paused"** in an emulator build.

### Pricing

Pricing is a number (`29`, `29.99`). Documents created before that rule store free text such as `Free` or `Freemium`; those values are kept as they are — they are shown without a `$` prefix on the public page and survive an edit untouched. The pricing field is a text input (with a numeric keypad on mobile) rather than `type="number"`, because a number input silently reports a legacy value as empty, which React warns about and which would wipe the stored price on save. `parsePrice()` in `lib/price.ts` is the only place that turns a stored value into a number — it accepts plain decimals only, so a value like `0x10` or `1e3` is rejected instead of being silently rewritten to a different price. The Nexus sync uses the same parser, so a malformed or legacy free-text price is left alone rather than being overwritten from a different number.

### Testing the admin flows locally

The admin flows can be exercised end to end against the local Firebase emulators, without touching production data:

```bash
# 1. start the emulators (Auth on 9099, Firestore on 8099)
firebase emulators:start --only auth,firestore --project company-24267 --config firebase.emulator.json

# 2. create a verified admin user + seed some request documents
node scripts/setup-emulator-admin.mjs

# 3. run the app against the emulators (the flag is inlined at build time)
NEXT_PUBLIC_FIREBASE_EMULATOR=true npm run dev
```

Sign in with `developerlife69@gmail.com` / `local-test-password`. The Auth emulator issues real JWTs that the Firestore emulator accepts, so the app's own sign-in form and the Firestore rules work exactly as they do in production. `node scripts/list-emulator-requests.mjs` prints the request documents that currently exist.

> **These credentials only exist in the emulator.** `local-test-password` is created by `scripts/setup-emulator-admin.mjs` inside the local Auth emulator — it is not the production password and it is rejected by the real Firebase project with `auth/invalid-credential`. Without `NEXT_PUBLIC_FIREBASE_EMULATOR=true` the app signs in to the project in `.env.local` and needs that project's real password (or "Sign in with Google").

### Which Firebase project am I talking to?

The admin sign-in form prints the project id and the target underneath the password field, because the same email address can exist in more than one Firebase project and a credential that works in one does not work in the other.

| Project | Role |
|---------|------|
| `company-24267` | The project this repo is configured against (`.firebaserc`, `.env.local`). Shared with **nexusprods** — which is why `firestore.rules` keeps the `products`, `content`, `settings`, `contacts`, `orders` and `licenses` collections intact. The hardened rules are deployed here; the catalogue has **not** been moved yet (see below). |
| `saaswaitlist-7280f` | The project's **previous** Firebase project. It still holds the original catalogue data and is what the currently deployed Vercel build points at. |

`NEXT_PUBLIC_FIREBASE_PROJECT_ID` decides which one the app uses, and the Vercel environment variables decide which one the deployed site uses. Keep them in step, otherwise the local app and the live site read different data (and a sign-in that works locally fails on the live site).

The catalogue and the waitlist entries are moved from `saaswaitlist-7280f` to `company-24267` with `scripts/migrate-to-company-24267.mjs` (dry run by default, `--apply` to write). It preserves the project document ids, re-keys the waitlist entries to `<projectId>_<email>` as the current rules require, and recalculates `waitlistCount`. It writes with a service account so the Firestore rules do not get in the way of the one-off data move:

```bash
# dry run — only needs the source project's API key
SOURCE_API_KEY=... node scripts/migrate-to-company-24267.mjs

# write — needs a service account for company-24267
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
SOURCE_API_KEY=... node scripts/migrate-to-company-24267.mjs --apply
```

The old project still runs its original ruleset, which has no `requests` block and lets anyone read the `waitlist` collection. Nothing writes to it any more.

## Cloudinary setup

- Image uploads use an **unsigned** upload preset called from the browser, so enable unsigned uploads on your preset.
- Required variables: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
- `next.config.ts` only allows remote images from `res.cloudinary.com` and `images.unsplash.com`; add other hostnames there before using them.

## Nexus integration

`lib/nexus.ts` plus `lib/nexus-url.ts` mirror projects to nexusprods:

- Create → `POST /api/products`
- Update → `PATCH /api/products/<id>` (recreates the product if Nexus returns 404)
- Delete → `DELETE /api/products/<id>` (404 is treated as already deleted)
- Periodic reconciliation runs in `app/admin/layout.tsx` every 5 minutes.

All requests require the signed-in admin's Firebase ID token. Nexus does not store a `slug`, so slug changes are never sent. Nexus has no `PUT` endpoint — `src/app/api/products/[id]/route.ts` in the Nexus repo exposes `GET`/`PATCH`/`DELETE` only, and this app's proxy mirrors that.

### The browser never calls Nexus directly

Nexus only returns `Access-Control-Allow-Origin` for a fixed list of origins. A browser on any other origin sees an opaque *"blocked by CORS policy"* error — the real HTTP status is swallowed — so a missing entry in that list looks exactly like a broken integration. The deployed SaaSWaitlist origin was not on the list, which meant **every** Nexus call from the admin dashboard (reconciliation, create, update, delete) failed.

To make the two independently deployed projects immune to each other's configuration, the browser calls this app's own route handler instead:

```
browser ──same-origin──▶ /api/nexus/products        (app/api/nexus/[...path]/route.ts)
                              │  server-side fetch (no CORS involved)
                              ▼
                         nexusprods.vercel.app/api/products
```

`app/api/nexus/[...path]/route.ts` forwards the method, body and `Authorization` header to Nexus and returns its status and body unchanged. Nexus stays the authority on who may write — the proxy only relays the admin's own Firebase ID token. The proxy is deliberately narrow: it only forwards `products` and `products/<id>`, and only ever talks to the configured Nexus base URL. Upstream calls are capped at 15 seconds — a hanging Nexus answers `504` instead of leaving the request open.

Nexus's own allowlist (`src/lib/cors.ts` in the Nexus repo) also lists `https://projektnotify.vercel.app`, so a direct browser call works there too. `ALLOWED_ORIGINS` in the Nexus project overrides the list without a code change.

### Nexus sync is paused against the local emulator

The Firebase emulator issues unsigned (`alg: none`) tokens. Nexus's edge rejects those with **403 Forbidden**, and the browser then reports the missing CORS header instead of the 403 — a confusing error that looks like a site bug. Nexus also validates tokens against the production Firebase project, so a sync could never succeed against the emulator in the first place.

The app therefore skips the Nexus sync entirely in an emulator build (`NEXUS_AVAILABLE` in `lib/nexus.ts`), the admin header shows **"Nexus sync paused"**, and the local catalogue can still be edited freely. The proxy returns a clear `503` if it is ever called from an emulator build.

### Reconciliation is never destructive on its own

Reconciliation compares the local catalogue with Nexus every five minutes:

- **Field drift is corrected automatically** — if a mirrored project was edited on Nexus, the local copy is brought back in line.
- **Projects missing from Nexus are never deleted automatically.** They are listed as *pending deletions* in the admin dashboard, and an admin has to confirm the removal before anything is deleted. A completely empty Nexus response is treated as a broken response and skipped entirely.
- A confirmed deletion also removes the project's waitlist entries, so the visitor email addresses do not outlive the project.

The dry-run planner lives in `lib/nexus-reconciliation.ts`; the admin UI is in `components/nexus-pending-deletions.tsx`.

The waitlist counter is re-derived from the waitlist entries on every reconciliation cycle, independently of the Nexus sync — the number of entries is the truth, and the stored counter is repaired whenever it drifts. If the repair itself fails, the dashboard says so instead of leaving the public signup counts quietly wrong.

## Deployment

The Firestore rules are **done** — the hardened `firestore.rules` were released to `company-24267` on 2026-11-23. Three things still have to happen outside this repository:

1. **Migrate the catalogue.** `company-24267` holds no projects yet, so the local site (and the live site once it is repointed) shows an empty catalogue. Run the migration with a service account for `company-24267`:
   ```bash
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
   SOURCE_API_KEY=... node scripts/migrate-to-company-24267.mjs --apply
   ```
   It moves 2 projects and 1 waitlist entry, re-keys the waitlist entry to `<projectId>_<email>` as the deployed rules require, and recalculates `waitlistCount`. See [Which Firebase project am I talking to?](#which-firebase-project-am-i-talking-to).
2. **Redeploy the Vercel app against `company-24267`.** The currently deployed build still points at the previous Firebase project (`saaswaitlist-7280f`). Update its `NEXT_PUBLIC_FIREBASE_*` variables and redeploy — **after** the migration, or the live site shows an empty catalogue.
3. **Deploy the Nexus CORS change.** The Nexus repo's origin allowlist was extended to include the SaaSWaitlist origin, but that change needs its own deploy on the Nexus side.

`nexusprods` shares `company-24267`, so the rules deploy also touched the collections that app depends on (`products`, `content`, `settings`, `contacts`, `orders`, `licenses`). Smoke-test that app after the rules deploy.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint (flat config) |
| `npx tsc --noEmit` | Type-check (there is no `typecheck` script) |
| `node scripts/audit-routes.mjs http://localhost:3000 "/,/projects,/admin"` | Load routes in a headless browser and report every console error, warning, exception and failed request |
| `firebase emulators:exec --only firestore --project demo-saaswaitlist --config firebase.emulator.json "node scripts/verify-firestore-rules.cjs"` | Verify `firestore.rules` against the local Firestore emulator |

There is currently **no unit test suite** and **no CI** — the automated checks are the Firestore rules verifier and the route auditor above.

`scripts/audit-routes.mjs` signs in through the app's own form (`--login email:password`) or restores a session from a token file (`--token-file <file>`) and then visits each route in a fresh tab, collecting console output, uncaught exceptions, HTTP errors ≥ 400 and failed requests. A route that is *supposed* to fail (for example `/nonexistent-page`) reports its 404 — that is the expected result, not a defect. A `request-cancelled` entry is the Firestore streaming connection being dropped when the audit closes the tab; it is teardown noise, not a failure.

## Rendering & caching

| Route | Strategy |
|-------|----------|
| `/`, `/projects` | Static, revalidated every 60 s |
| `/projects/[slug]` | ISR — rendered on first visit, revalidated every 60 s. `generateStaticParams` returns an empty array so slugs stay runtime-discovered |
| `/sitemap.xml` | Static, revalidated hourly |
| `/request` | Dynamic — it awaits `searchParams` (a Promise in Next 16) |
| `/api/projects` | Dynamic (it reads the query string); CDN caching comes from its `Cache-Control` header |

Server-side Firestore reads go through `unstable_cache` (`lib/db-service.server.ts`), so the origin is not hit on every request.

**A failed read is never cached as an empty catalogue.** `unstable_cache` only writes an entry when the callback resolves, so the cached helpers throw on a Firestore error and the page wrappers return `{ data, error }`:

- `/` and `/projects` show a *"catalogue temporarily unavailable"* notice instead of an empty grid — a visitor must never conclude that no projects exist.
- `/projects/[slug]` **throws** instead of rendering a 404 — a broken read is not a missing project. The error boundary offers a retry.
- `GET /api/projects` answers **503** with `Cache-Control: no-store` rather than a `200` with an empty list, which the CDN would otherwise cache.

A read that *succeeds* with no projects is a different state from a read that failed, and the pages say so: the landing page and `/projects` render "No projects available yet." instead of a bare heading over an empty grid.

The filters (`?search=`, `?category=`, `?tag=`) are applied **outside** the cache, in memory — caching the filtered list would create one cache entry per distinct search term, an unbounded key space a visitor could fill with junk.

## Project structure

```
app/
├── page.tsx                 # Landing page (hero, features, featured projects)
├── layout.tsx               # Root layout (theme bootstrap, header, footer, toaster)
├── projects/
│   ├── page.tsx             # All projects
│   └── [slug]/page.tsx      # Project detail + waitlist
├── admin/                   # Auth-gated dashboard
│   ├── page.tsx             # Overview (stats, charts, demand leaderboard)
│   ├── projects/            # Project table with filters
│   ├── signups/             # Waitlist inbox + CSV export
│   ├── requests/            # Tool/feature request inbox
│   ├── taxonomy/            # Option list manager
│   ├── new/ · edit/[id]/
├── request/page.tsx         # Public "submit a project / request a tool" form
├── api/projects/route.ts    # Public JSON API (CORS + CDN cache)
├── api/nexus/[...path]/route.ts # Same-origin proxy for the Nexus products API
├── signin/page.tsx          # Admin sign-in
├── privacy/ · terms/        # Static legal pages
├── error.tsx · loading.tsx · not-found.tsx
├── sitemap.ts · robots.ts
components/
├── ui/                      # shadcn/ui primitives (incl. image-upload, combobox)
├── admin/
│   ├── charts.tsx           # Hand-rolled StatCard / BarChart / HorizontalBars
│   └── use-admin-data.ts    # Admin data hooks
├── catalogue-unavailable.tsx # Notice shown when the catalogue cannot be read
├── project-form.tsx         # Admin create/edit form
├── nexus-reconciliation-provider.tsx # Reconciliation state (admin only)
├── nexus-pending-deletions.tsx        # Confirmation banner for removals
├── request-form.tsx         # Public request form
├── waitlist-form.tsx        # Email capture (transactional)
├── waitlist-status.tsx      # Joined/not-joined state
└── ...                      # Sections, cards, gallery, theme
lib/
├── firebase.ts              # Firebase client init (mock fallback)
├── firebase-target.ts       # "emulator" vs "production" build target
├── db-service.ts            # Firestore queries (client-safe)
├── db-service.server.ts     # Cached Firestore queries (server-only, error-aware)
├── admin-service.ts         # Taxonomy / waitlist / request reads + writes
├── admin-emails.ts          # Shared admin allowlist
├── demand.ts                # Demand ranking + signup timeline (pure)
├── nexus.ts                 # Nexus create/update/delete API client
├── nexus-reconciliation.ts  # Reconciliation planner + apply (dry run first)
├── nexus-url.ts             # Shared Nexus URL resolution
├── waitlist.ts              # Waitlist storage/id helpers
├── taxonomy.ts              # Option list types, defaults, de-duplication
├── images.ts                # Allowed next/image hosts
├── price.ts                 # Pricing parsing helpers
├── site.ts                  # Canonical site URL
└── utils.ts
scripts/
├── verify-firestore-rules.* # Rules verification against the emulator
├── verify-admin-rules.*     # Admin rules verification against the emulator
├── setup-emulator-admin.mjs # Creates a verified admin + seeds requests locally
├── list-emulator-requests.mjs # Lists the request docs in the local emulator
├── seed-audit-data.mjs      # Seeds the emulator with data for UI audits
├── audit-routes.mjs         # Loads routes in a headless browser and reports
│                            # every console error, warning and failed request
├── mint-admin-token.mjs     # Mints an admin ID token for a route audit
├── inventory-firestore.mjs  # Lists the documents of a project (read-only)
├── dump-firestore.mjs       # Prints the raw documents of a collection
├── read-firestore-admin.mjs # Reads documents with a service account
└── migrate-to-company-24267.mjs # Moves the catalogue to the current project
types/index.ts               # Project, taxonomy, waitlist and request types
fonts/                       # Self-hosted Inter variable subsets (SIL OFL 1.1)
firebase.emulator.json       # Local Auth (9099) + Firestore (8099) emulator config
```

## Roadmap

- Add server-side protection for the admin dashboard.
- Add an automated test suite and CI.
- Wire the public API into a search UI.
- Make the waitlist counter enforceable end-to-end (a Firebase Function that couples the increment to its waitlist entry, so the counter never has to be reconciled).

## License

Released under the [MIT License](LICENSE).

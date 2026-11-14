# AGENTS.md

Single Next.js 16 App Router app (React 19, TypeScript strict). Not a monorepo. No packages/workspaces.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` — runs bare `eslint` (flat config `eslint.config.mjs`), NOT `next lint`. No args/fix flags configured.
- Typecheck: `npx tsc --noEmit` (no `typecheck` script exists).
- There are **no tests** and **no CI**. Do not invent test commands or frameworks.

## Stack notes / gotchas

- **Tailwind is v4** (`tailwindcss@^4` + `@tailwindcss/postcss`). `app/globals.css` starts with `@import "tailwindcss"; @import "tw-animate-css"; @config "../tailwind.config.ts"; @plugin "@tailwindcss/typography";`. Theme tokens are in `tailwind.config.ts` (loaded via `@config`), CSS vars in `app/globals.css`. Dark mode is class-based via `@custom-variant dark (&:is(.dark *));`. Animations come from `tw-animate-css` (NOT the old `tailwindcss-animate`, which is v3-only). `components.json` is shadcn/ui (new-york, RSC, neutral).
- Path alias `@/*` maps to repo root (not `src/`).
- `next.config.ts` restricts `next/image` to `res.cloudinary.com` and `images.unsplash.com`; add hostnames there before using new remote images.

## Firebase / data

- Only the **client** Firebase SDK is used (`lib/firebase.ts`), even for server components. `firebase-admin` was removed from `package.json` (it was an unused dependency); don't reintroduce it or `FIREBASE_SERVICE_ACCOUNT`.
- `lib/firebase.ts` falls back to mock config when `NEXT_PUBLIC_FIREBASE_*` is unset, so dev/build succeeds without credentials but Firestore reads silently return empty (`getProjects` swallows errors and returns `[]`).
- Public pages fetch Firestore from RSC at build/revalidate time; `app/page.tsx` and `app/projects/page.tsx` set `export const revalidate = 60`, `app/admin/page.tsx` is `dynamic = 'force-dynamic'`. Firestore rules must allow public reads for these to populate.
- `getProjects` filters **in memory** after fetching all docs — no composite indexes needed, and adding a Firestore query/index won't change filtering behavior. `getProjects` also populates `waitlistCount` per project by counting waitlist docs. `getProjectBySlug` filters by `status === "active"` so coming_soon projects aren't publicly accessible via direct URL. `components/project-card.tsx` renders a disabled "Coming Soon" button instead of a clickable "View" link for coming_soon projects, preventing users from navigating to their detail pages.
- Admin access is client-side only (`onAuthStateChanged` in `app/admin/layout.tsx`); it is not a server-side security boundary. Firestore security rules live in `firestore.rules` — deployed to Firebase project `company-24267` (shared with nexusprods). Rules use `isAdmin()` (email in allowlist + email_verified == true) for writes. Waitlist writes use a composite document ID (`${projectId}_${email}`) to prevent duplicates at the database level.
## Cloudinary uploads

- The live path is the unsigned **client-side** upload in `components/ui/image-upload.tsx` (used by `components/project-form.tsx`), requiring `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

## Public API

- **`GET /api/projects`** (`app/api/projects/route.ts`) — returns all projects (active + coming_soon) as JSON: `{ projects: Project[], count: number }`.
- Supports query params forwarded to `getProjects()`: `?search=`, `?category=`, `?tag=`.
- Sets CORS headers (`Access-Control-Allow-Origin: *`) for cross-origin use from other websites.
- `export const revalidate = 60` (1-minute stale-while-revalidate, matching public pages).
- Public reads on `projects` are allowed by `firestore.rules`, so no auth is required.

## Waitlist Registration + Nexus Link

- Waitlist signup (`components/waitlist-form.tsx`) saves the email to `localStorage` under key `saaswaitlist_waitlist_<projectId>` on successful signup.
- Project detail page (`app/projects/[slug]/page.tsx`) uses `WaitlistStatus` (`components/waitlist-status.tsx`) which checks localStorage:
  - Not registered → **redirects to Nexus website** (http://localhost:3001 dev / https://nexusprods.vercel.app prod)
  - Already registered → shows "You&apos;re already on the waitlist!" + `NexusLink` button
- **`NexusLink`** (`components/nexus-link.tsx`) — button linking to the Nexus company website:
  - Dev: `http://localhost:3001` (from `NEXT_PUBLIC_NEXUS_URL` or fallback)
  - Production: `https://nexusprods.vercel.app`
  - Shows "5% off subscription" badge
- Add `NEXT_PUBLIC_NEXUS_URL` to `.env.local` to override the Nexus URL.


## Nexus Project Sync

- `lib/nexus.ts` — `syncProjectToNexus(project, idToken)` mirrors a project to nexusprods via `POST /api/products` with `Authorization: Bearer <firebase-id-token>`. Requires the signed-in admin's email to be verified and in `NEXT_PUBLIC_ADMIN_EMAILS`.
- **Nexus URL (dev vs prod):** In development (`NODE_ENV === "development"`), defaults to `http://localhost:3001/api/products` for the API and `http://localhost:3001` for product page links. In production, defaults to `https://nexusprods.vercel.app/api/products` and `https://nexusprods.vercel.app`. Override with `NEXT_PUBLIC_NEXUS_API_URL` and `NEXT_PUBLIC_NEXUS_URL` in `.env.local`.
- **Transactional:** nexus is created FIRST, then local Firestore write. If nexus fails, the local project is NOT written (no orphaned records). Configured in `components/project-form.tsx` `onSubmit`.
- Sync triggers on: new project create, or edit flipping `coming_soon → active`. Edits of already-active projects do NOT re-sync (nexus has no update endpoint).
- Field mapping: `name`←`title`, `price`←`pricing` (string→number, defaults to 0), `category`←`category` (defaults to "General"), `status`←`active`→`live` / `coming_soon`→`upcoming`, `description`/`longDescription`←`description`, `imageUrl`←`imageUrl`, `demoUrl`←`websiteUrl`, `features`←`tags`.
- `Project` type has `nexusProductId?: string` to store the mirrored product's ID on nexus.
- Detail page (`app/projects/[slug]/page.tsx`) shows an "Open on Nexus" button linking to the nexus product page (localhost:3001 in dev, nexusprods.vercel.app in prod) when `status === "active"` and `nexusProductId` exists, alongside the existing "Visit Application" button.

## Nexus Delete Sync (Bidirectional)

- **Local → Nexus:** Deleting a project in the admin edit form also deletes it from nexusprods via `DELETE http://localhost:3001/api/products/<nexusProductId>` (dev) or `DELETE https://nexusprods.vercel.app/api/products/<nexusProductId>` (prod), using the same Bearer token auth. If nexus delete fails, the local delete is aborted.
- **Nexus → Local (periodic):** `app/admin/layout.tsx` runs `syncDeletionsFromNexus()` every 5 minutes when the admin is signed in with a verified email. It fetches all products from nexusprods `GET /api/products` and deletes any local project whose `nexusProductId` no longer exists on nexus (e.g. deleted directly on nexusprods).
- `lib/nexus.ts` exports: `syncProjectToNexus()`, `deleteProductFromNexus()`, `getAllNexusProducts()`, `syncDeletionsFromNexus()`.

## Email Verification (Admin Access)

- `app/admin/layout.tsx` — after sign-in, if `user.emailVerified === false`, shows a "Verify your email" banner with a **Resend Verification Link** button instead of the admin dashboard.
- `sendEmailVerification(user)` from `firebase/auth` is called when the button is clicked. Firebase sends a verification email to the user's address.
- Admin features (project create/edit/delete) are **blocked** until email is verified — required because nexusprods' `POST /api/products` checks `emailVerified === true`.
- Once verified, the user is redirected to the normal admin dashboard on next load.

## Environment

- Prerequisite: **Node 20+** (README). `npm run dev` may fail on older Node.
- `.env*` is gitignored and there is **no `.env.example`**, despite the README telling you to `cp .env.example .env.local`. Create `.env.local` by hand.
- `NEXT_PUBLIC_NEXUS_URL` — Nexus company website URL for waitlist discount link. Defaults to `http://localhost:3001` (dev) or `https://nexusprods.vercel.app` (prod).

## Dependencies / security

- `npm audit` is **clean (0 vulnerabilities)**. This depends on `overrides` in `package.json` — do not delete them without re-running `npm audit`:
  - `@grpc/grpc-js` → `^1.14.6` (fixes the `@firebase/firestore` chain).
  - `postcss-selector-parser` → `^7.1.6` (fixes `@tailwindcss/typography`).
  - `@next/eslint-plugin-next.fast-glob` → aliased to `npm:tinyglobby`. This removes `braces` (and `micromatch`/`chokidar`), whose advisory has **no patched `braces` release**. Tailwind v4 also drops those, so `fast-glob`/`micromatch`/`braces` are gone from the tree.
- `next` and `eslint-config-next` are pinned to the same version (`16.4.2`); bump them together.
- Lint is clean (0 errors) — `npm run lint` exits 0. The 4 remaining warnings are pre-existing and non-blocking (unused `orderBy` import, `` elements, React Hook Form watch incompatibility).

## Do not run

- `fix-layout.py` (repo root) is a one-off throwaway script that rewrites `app/projects/[slug]/page.tsx` via blind string slicing. Running it will clobber that file.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

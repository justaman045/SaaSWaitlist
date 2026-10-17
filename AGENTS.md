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
- `getProjects` filters **in memory** after fetching all docs — no composite indexes needed, and adding a Firestore query/index won't change filtering behavior.
- Admin access is client-side only (`onAuthStateChanged` in `app/admin/layout.tsx`); it is not a server-side security boundary.
- `lib/data.ts` (sample `projects`) and `components/auth-provider.tsx` (`AuthProvider`/`useAuth`) are unused dead code.

## Cloudinary uploads

- The live path is the unsigned **client-side** upload in `components/ui/image-upload.tsx` (used by `components/project-form.tsx`), requiring `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
- `app/api/upload/route.ts` (server-signed upload using `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`) is referenced nowhere. Prefer the existing client path unless intentionally resurrecting the route.

## Environment

- `.env*` is gitignored and there is **no `.env.example`**, despite the README telling you to `cp .env.example .env.local`. Create `.env.local` by hand.

## Dependencies / security

- `npm audit` is **clean (0 vulnerabilities)**. This depends on `overrides` in `package.json` — do not delete them without re-running `npm audit`:
  - `@grpc/grpc-js` → `^1.14.6` (fixes the `@firebase/firestore` chain).
  - `postcss-selector-parser` → `^7.1.6` (fixes `@tailwindcss/typography`).
  - `@next/eslint-plugin-next.fast-glob` → aliased to `npm:tinyglobby`. This removes `braces` (and `micromatch`/`chokidar`), whose advisory has **no patched `braces` release**. Tailwind v4 also drops those, so `fast-glob`/`micromatch`/`braces` are gone from the tree.
- `next` and `eslint-config-next` are pinned to the same version (`16.4.2`); bump them together.

## Do not run

- `fix-layout.py` (repo root) is a one-off throwaway script that rewrites `app/projects/[slug]/page.tsx` via blind string slicing. Running it will clobber that file.

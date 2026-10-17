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

- **Project showcase** — a featured grid on the landing page, a full `/projects` directory, and rich detail pages (`/projects/[slug]`) with an image gallery, Markdown description, key features, and tech stack.
- **Waitlist signup** — visitors join a project's waitlist by email, with per-project duplicate detection.
- **Admin dashboard** — email/password sign-in with full project CRUD: Live / Coming Soon status, Cloudinary image gallery upload, a Markdown editor with live preview, plus tags, category, pricing, tech stack, features, and launch date.
- **Polished UI** — dark/light theme, Framer Motion animations, shadcn/ui components, and a fully responsive layout.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (email/password) |
| Image storage | Cloudinary (unsigned uploads) |
| Styling | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Forms & validation | react-hook-form + Zod |
| Markdown | react-markdown + rehype-raw |
| Deployment | Vercel |

## Getting started

Prerequisites: Node 20+, a Firebase project, and a Cloudinary account.

```bash
git clone https://github.com/justaman045/SaaSWaitlist.git
cd SaaSWaitlist
npm install
```

Create a `.env.local` file in the repo root by hand — there is **no `.env.example`** to copy — and fill in your credentials (see [Environment variables](#environment-variables)).

```bash
npm run dev
```

If the Firebase variables are unset, `lib/firebase.ts` falls back to a mock config so the app still boots, but Firestore reads silently return empty and the site renders without any projects.

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

## Firebase setup

- Create two Firestore collections: `projects` and `waitlist`.
- Enable the **Email/Password** provider in Firebase Authentication, then create admin users manually (there is no self-signup or Google sign-in).
- Public pages read Firestore directly with the client SDK, so your rules must allow public reads of `projects` for content to appear.
- Admin access is enforced **client-side only** (`onAuthStateChanged` in `app/admin/layout.tsx`). It is not a server-side security boundary, so protect write access with Firestore rules rather than relying on the UI.

## Cloudinary setup

- Image uploads use an **unsigned** upload preset called from the browser, so enable unsigned uploads on your preset.
- Required variables: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
- `next.config.ts` only allows remote images from `res.cloudinary.com` and `images.unsplash.com`; add other hostnames there before using them.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint (flat config) |
| `npx tsc --noEmit` | Type-check (there is no `typecheck` script) |

There is currently **no test suite**.

## Project structure

```
app/
├── page.tsx                 # Landing page (hero, features, featured projects)
├── layout.tsx               # Root layout (theme, header, footer, toaster)
├── projects/
│   ├── page.tsx             # All projects
│   └── [slug]/page.tsx      # Project detail + waitlist
├── admin/                   # Auth-gated dashboard (list / new / edit)
├── signin/page.tsx          # Admin sign-in
├── privacy/ · terms/        # Static legal pages
└── api/upload/route.ts      # Unused server-side Cloudinary route
components/
├── ui/                      # shadcn/ui primitives (incl. image-upload)
├── project-form.tsx         # Admin create/edit form
├── waitlist-form.tsx        # Email capture
└── ...                      # Sections, cards, gallery, theme
lib/
├── firebase.ts              # Firebase client init (mock fallback)
├── db-service.ts            # Firestore queries
└── utils.ts
types/index.ts               # Project type
```

## Roadmap

- Wire the existing debounced `SearchInput` component into the projects list.
- Add server-side protection for the admin dashboard.
- Add an automated test suite.

## License

Released under the [MIT License](LICENSE).

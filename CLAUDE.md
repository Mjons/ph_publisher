# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Panel Haus (`ph-reader`) is an independent comic book publishing platform / digital comic reader built with Next.js 15 (App Router) + React 19 + Supabase + Tailwind CSS.

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Next.js ESLint
npm run optimize-images  # One-time: optimize all existing images in Supabase to WebP
npm run rename-files     # One-time: rename all files in Supabase to match comic metadata
```

No test framework is installed.

## Environment Variables

Five variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (browser-exposed)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key (browser-exposed, read-only with RLS)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side only, bypasses RLS (used by API routes)
- `ADMIN_PASSWORD` — Server-side only password for admin login
- `ADMIN_SESSION_SECRET` — Random hex string used to HMAC-sign session cookies

The home page has a mock data fallback when Supabase is not configured.

## Architecture

```
Public pages  → anon key → Supabase (RLS: only published comics readable)
Admin pages   → fetch('/api/comics') → API route (verifies cookie) → service role key → Supabase
```

Admin pages are client components (`'use client'`) that call server-side API routes. The public homepage reads directly from Supabase via the anon key.

### Supabase Clients

- `lib/supabase.ts` — Browser client using anon key (public reads only)
- `lib/supabase-admin.ts` — Server-side client using service role key (full access, used by API routes only)

### Admin Auth

Cookie-based password protection via Next.js middleware with HMAC-signed tokens:
- `lib/auth.ts` — HMAC-SHA256 token signing/verification + `requireAdmin()` helper for API routes
- `middleware.ts` — Verifies `ph_admin_session` cookie on all `/admin/*` routes, allows `/admin/login` and `/api/auth/*` through
- `app/api/auth/login/route.ts` — POST: timing-safe password comparison, HMAC-signed cookie token, rate limiting (5 attempts/IP/15 min)
- `app/api/auth/logout/route.ts` — POST: clears the session cookie
- `app/admin/login/page.tsx` — Password form, redirects to `/admin` on success

### Admin API Routes

All admin API routes call `requireAdmin()` (reads session cookie, returns 401 if invalid):
- `app/api/comics/route.ts` — GET: list all comics (admin dashboard). POST: create comic with file uploads (FormData). Images are optimized via sharp (WebP conversion + resize) before uploading to Supabase.
- `app/api/comics/[id]/route.ts` — GET: fetch single comic by ID. PUT: update comic with optional file uploads (FormData). Same sharp optimization on new uploads.
- `app/api/comics/[id]/view/route.ts` — POST: public endpoint (no auth), atomically increments `view_count` via Supabase RPC `increment_view_count`.

### Image Optimization

All uploaded images are processed via `sharp` before storage:
- **Covers**: Converted to WebP at quality 80, max 800x1200px
- **Pages**: Converted to WebP at quality 85, max 1600px wide (height auto)
- Original format/size is never stored — only optimized WebP

### Key Files

- `app/page.tsx` — Public comic gallery. Fetches published comics via anon key, renders grid with two-tier brand + series filter + sort controls, opens reader overlay. Has mock data fallback mode.
- `components/ComicReader.tsx` — Full-screen reading overlay with keyboard/click navigation, series-aware next/prev issue links, progress pills, and end-of-series card.
- `app/admin/page.tsx` — Admin dashboard listing all comics (published + drafts) with brand/series badges. Fetches via `GET /api/comics`.
- `app/admin/upload/page.tsx` — Upload form: title, brand, optional series info, cover + page files → `POST /api/comics`.
- `app/admin/edit/[id]/page.tsx` — Edit comic: title, brand, series info, publish toggle, cover replacement, page reorder/delete/add. Uses `GET/PUT /api/comics/[id]`.

### Scripts

- `scripts/optimize-existing-images.ts` — Downloads all images from Supabase, optimizes with sharp, re-uploads as WebP, updates DB URLs, deletes originals.
- `scripts/rename-comic-files.ts` — Renames all files in Supabase storage to match comic metadata (e.g., `{series-slug}-issue-{n}-page-01.webp`). Uses `supabase.storage.move()`.

### Supabase Schema

**Table: `comics`** — `id`, `title`, `slug`, `cover_url`, `pages` (string array of URLs), `is_published`, `brand_name`, `brand_slug`, `series_name`, `series_slug`, `issue_number`, `view_count` (integer, default 0), `created_at`

**RPC function: `increment_view_count(comic_id UUID)`** — Atomically increments `view_count` by 1 for the given comic. Called by the public view endpoint.

**Storage bucket: `comics`** — Organized as:
- Series: `{series-slug}/issue-{number}/{series-slug}-issue-{number}-cover.webp` and `{series-slug}/issue-{number}/{series-slug}-issue-{number}-page-{nn}.webp`
- Standalone: `{title-slug}-{uuid}/{title-slug}-cover.webp` and `{title-slug}-{uuid}/{title-slug}-page-{nn}.webp`

All images stored as WebP. Storage URLs are manually constructed via string concatenation (not `getPublicUrl()`).

### Important Patterns

- **Admin auth**: Password-protected via middleware + httpOnly cookie. Login at `/admin/login`. Logout button in admin header.
- **Server-side operations**: All Supabase writes and admin reads go through API routes using the service role key. No Supabase writes happen client-side.
- **Series navigation**: The reader handles series comics (next/prev by issue number) and standalone comics (next/prev by array index) differently.
- **Page ordering**: Upload sorts files by filename before uploading. Edit page supports drag-and-drop + up/down button reordering.
- **Error handling**: Uses `console.error` + `alert()` — no error boundaries or toast system.
- **Brand filter**: The homepage has a **two-tier cascading filter**. The first row filters by brand (indigo chips), the second row filters by series (purple chips). Selecting a brand resets the series filter and narrows which series chips appear. Both are fully dynamic — derived from the `brand_name`/`brand_slug` and `series_name`/`series_slug` fields of loaded comics. No code changes needed when adding new brands or series.
- **Image optimization**: All images are converted to WebP and resized via `sharp` at upload time. Covers: 800x1200 q80. Pages: 1600w q85.
- **`next.config.ts`**: Allows images from any hostname (`'**'`) for Supabase storage URLs.

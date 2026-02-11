# Shareable Comic Links for X (Twitter Cards)

## The Goal

When you paste a link like `panelhaus.com/comics/neon-static-issue-1` into an X post, it should render a rich preview card showing the cover art, title, and a short description — not a generic link.

---

## What X Needs: Twitter Card Meta Tags

X crawls your page's `<meta>` tags to build the preview card. The key tags:

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Neon Static — Issue #1" />
<meta name="twitter:description" content="A Panel Haus comic" />
<meta name="twitter:image" content="https://xyz.supabase.co/storage/v1/object/public/comics/neon-static/issue-1/cover.webp" />

<!-- OpenGraph tags (used by most other platforms + X fallback) -->
<meta property="og:type" content="article" />
<meta property="og:title" content="Neon Static — Issue #1" />
<meta property="og:description" content="A Panel Haus comic" />
<meta property="og:image" content="https://xyz.supabase.co/storage/v1/object/public/comics/neon-static/issue-1/cover.webp" />
<meta property="og:url" content="https://panelhaus.com/comics/neon-static-issue-1" />
<meta property="og:site_name" content="Panel Haus" />
```

X prefers `summary_large_image` for the card type — this gives you the big image preview rather than a tiny thumbnail.

---

## What Needs to Be Built

### 1. A Public Route for Individual Comics

Right now comics only exist inside a modal overlay on the homepage. There's no standalone page X can crawl. You need:

```
app/comics/[slug]/page.tsx
```

The `slug` field already exists in the database (generated on upload from the title), so URLs would look like:

| Comic | URL |
|---|---|
| Standalone comic | `panelhaus.com/comics/neon-static` |
| Series issue | `panelhaus.com/comics/neon-static-issue-1` |

### 2. Dynamic Metadata via `generateMetadata()`

Next.js 15 has first-class support for this. A `generateMetadata` function in the page file fetches the comic from Supabase and returns the meta tags. No extra libraries needed.

```ts
// app/comics/[slug]/page.tsx

import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: comic } = await supabase
    .from('comics')
    .select('title, cover_url, series_name, issue_number')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!comic) return {};

  const title = comic.series_name && comic.issue_number
    ? `${comic.series_name} — Issue #${comic.issue_number}`
    : comic.title;

  const description = comic.series_name
    ? `${comic.series_name} Issue #${comic.issue_number} — read free on Panel Haus`
    : `${comic.title} — read free on Panel Haus`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Panel Haus',
      images: [
        {
          url: comic.cover_url,
          width: 800,
          height: 1200,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [comic.cover_url],
    },
  };
}
```

Next.js automatically renders these into the correct `<meta>` tags in the `<head>`.

### 3. The Page Component Itself

The page needs to display something useful when someone actually clicks the link. Options:

**Option A: Redirect to homepage with reader open (simplest)**
Redirect to `/?read=slug` and have the homepage auto-open the reader overlay for that comic. Minimal new code, but the URL changes after redirect which isn't ideal.

**Option B: Standalone reader page (recommended)**
A dedicated page that renders the `ComicReader` component directly. The person clicking from X lands straight into the reading experience.

```tsx
export default async function ComicPage({ params }: Props) {
  const { slug } = await params;

  const { data: comic } = await supabase
    .from('comics')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!comic) notFound();

  // Fetch sibling issues if it's part of a series
  let seriesComics = [];
  if (comic.series_slug) {
    const { data } = await supabase
      .from('comics')
      .select('id, title, slug, issue_number, cover_url')
      .eq('series_slug', comic.series_slug)
      .eq('is_published', true)
      .order('issue_number');
    seriesComics = data || [];
  }

  return <ComicReaderPage comic={comic} seriesComics={seriesComics} />;
}
```

**Option C: Landing page with "Read Now" button**
A styled card showing the cover, title, page count, and a CTA button that opens the reader. More of a marketing-style page. Gives you room for a description field later.

---

## Image Considerations for X Cards

X has specific requirements for card images:

| Requirement | Value |
|---|---|
| Minimum size | 300 x 157 px |
| Recommended for `summary_large_image` | 800 x 418 px (roughly 1.91:1 ratio) |
| Max file size | 5 MB |
| Formats | JPG, PNG, WebP, GIF |

**The problem:** Comic covers are typically portrait (tall), but X's large image card crops to landscape (wide). Your covers at ~800x1200 will get center-cropped, cutting off the top and bottom.

### Solutions

**A. Use `summary` card type instead of `summary_large_image`**
The `summary` card uses a square thumbnail (1:1), which is a bit more forgiving for portrait images. The card is smaller but the image looks right.

**B. Generate a landscape OG image on the fly**
Create a custom OG image that composites the cover onto a branded background:

```
┌──────────────────────────────────┐
│  [Cover]    NEON STATIC          │
│  [Image]    Issue #1             │
│  [Here ]    Panel Haus           │
└──────────────────────────────────┘
```

Next.js supports this with `ImageResponse` from `next/og` (uses Satori under the hood):

```ts
// app/comics/[slug]/opengraph-image.tsx

import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Fetch comic data...

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        padding: 60,
        alignItems: 'center',
        gap: 60,
      }}>
        {/* Cover art on the left */}
        <img
          src={comic.cover_url}
          width={340}
          height={510}
          style={{ borderRadius: 8, objectFit: 'cover' }}
        />
        {/* Title & branding on the right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: '#ffffff' }}>
            {comic.title}
          </div>
          {comic.series_name && (
            <div style={{ fontSize: 28, color: '#a1a1aa' }}>
              Issue #{comic.issue_number}
            </div>
          )}
          <div style={{ fontSize: 24, color: '#6366f1', marginTop: 24 }}>
            PANEL HAUS
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

When this file exists in the route folder, Next.js automatically sets the `og:image` meta tag to point to this generated image. No manual wiring needed.

**Option B is strongly recommended.** It gives you a branded, consistent look across every share and avoids the awkward crop of portrait covers.

---

## Slug Uniqueness Concern

The current slug generation in the API route is basic:

```ts
title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
```

Two comics with the same title would get the same slug. Before building shareable links, you should either:

1. **Add a unique constraint** on the `slug` column in Supabase and handle conflicts in the API (append a number or short ID)
2. **Include series/issue info** in the slug for series comics (e.g., `neon-static-issue-1` instead of just `neon-static`)

Check what slugs currently look like in your database — the upload route may already be generating unique-enough slugs for your catalog size.

---

## Minimal Implementation Checklist

1. **Create `app/comics/[slug]/page.tsx`** — server component that fetches a comic by slug and renders a reader
2. **Add `generateMetadata()`** in that file — dynamic OG + Twitter Card tags from comic data
3. **Create `app/comics/[slug]/opengraph-image.tsx`** — branded landscape image generator for card previews
4. **Validate with [Twitter Card Validator](https://cards-dev.twitter.com/validator)** — paste a URL, confirm the card renders correctly
5. **Optional:** add a "Share on X" button in the reader UI that copies or opens the share URL

---

## What the X Post Would Look Like

```
Check out the latest issue of Neon Static on @PanelHaus 🔥

panelhaus.com/comics/neon-static-issue-1
```

X renders:

```
┌──────────────────────────────────┐
│                                  │
│  [Cover]    Neon Static          │
│  [Art  ]    Issue #1             │
│  [Here ]    Panel Haus           │
│                                  │
├──────────────────────────────────┤
│ panelhaus.com                    │
└──────────────────────────────────┘
```

No embed code, no special integrations. Just the meta tags + a URL.

# Image Optimization Guide — Panel Haus

## Current State

Right now, images have **no optimization at all**:

- Raw files uploaded to Supabase storage as-is (no compression, no resizing, no format conversion)
- Served via native `<img>` tags (no `next/image`, no `srcset`, no lazy loading)
- No CDN cache headers configured
- No responsive image variants generated
- Original file dimensions and formats preserved

For a comic reader serving full-resolution pages, this means large payloads and slow loads — especially on mobile.

---

## 1. Optimize at Upload Time (Server-Side)

The highest-impact change. Compress and convert images before they ever hit Supabase.

### Option A: Sharp in API Routes (Recommended)

Install [sharp](https://sharp.pixelplumbing.com/) and process images in `app/api/comics/route.ts` before uploading to Supabase.

```bash
npm install sharp
```

```ts
import sharp from 'sharp';

// Before uploading cover
const coverBuffer = Buffer.from(await cover.arrayBuffer());
const optimizedCover = await sharp(coverBuffer)
  .webp({ quality: 80 })       // Convert to WebP, 80% quality
  .resize(800, 1200, {          // Max 800x1200 for covers
    fit: 'inside',
    withoutEnlargement: true,
  })
  .toBuffer();

// Before uploading each page
const pageBuffer = Buffer.from(await page.arrayBuffer());
const optimizedPage = await sharp(pageBuffer)
  .webp({ quality: 85 })       // Higher quality for reading
  .resize(1600, null, {         // Max 1600px wide, auto height
    fit: 'inside',
    withoutEnlargement: true,
  })
  .toBuffer();
```

**What this gives you:**
- PNG → WebP typically saves 50-80% file size
- JPEG → WebP typically saves 25-35% file size
- Resize prevents unnecessarily large uploads
- One-time cost at upload, every reader benefits

**Tradeoffs:**
- Lossy — original quality is not preserved in storage
- `sharp` adds ~30MB to `node_modules` and has native binaries
- Slightly slower uploads (processing time)

### Option B: Generate Multiple Variants

For more control, generate a thumbnail + full-size version per image:

```ts
// Thumbnail for gallery grid
const thumb = await sharp(buffer)
  .webp({ quality: 70 })
  .resize(400, 600, { fit: 'inside', withoutEnlargement: true })
  .toBuffer();

// Full size for reader
const full = await sharp(buffer)
  .webp({ quality: 85 })
  .resize(1600, null, { fit: 'inside', withoutEnlargement: true })
  .toBuffer();

// Upload both
await supabaseAdmin.storage.from('comics').upload(`${folder}/thumb_cover.webp`, thumb, ...);
await supabaseAdmin.storage.from('comics').upload(`${folder}/cover.webp`, full, ...);
```

Then use `thumb_*` URLs on the gallery page and full URLs in the reader.

**Tradeoffs:**
- Doubles storage usage
- More complex URL management (need to track both in DB or derive by convention)
- Best visual results across contexts

---

## 2. Use Supabase Image Transformation (Easiest, Paid)

Supabase Pro plan includes an [image transformation API](https://supabase.com/docs/guides/storage/serving/image-transformations) — a CDN-level resize/format service.

```
// Original
https://[project].supabase.co/storage/v1/object/public/comics/cover.png

// Transformed — 400px wide, WebP
https://[project].supabase.co/storage/v1/render/image/public/comics/cover.png?width=400&format=origin
```

No code changes to upload flow. Just change how you build URLs on the frontend.

**What this gives you:**
- On-the-fly resize and format conversion at the CDN edge
- Cached after first request
- Zero changes to upload logic

**Tradeoffs:**
- Requires Supabase Pro plan ($25/mo)
- First request for each size is slower (cold transform)
- Less control over quality settings

---

## 3. Use `next/image` (Frontend Optimization)

Replace native `<img>` tags with Next.js `<Image>` for automatic optimization.

### Setup

`next.config.ts` already allows all hostnames. Add format preferences:

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],  // Prefer AVIF, fallback WebP
  },
};
```

### Replace `<img>` with `<Image>`

**Gallery covers** (`app/page.tsx`):
```tsx
import Image from 'next/image';

<Image
  src={comic.cover_url}
  alt={comic.title}
  fill
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
  className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
/>
```

**Reader pages** (`components/ComicReader.tsx`):
```tsx
<Image
  src={pages[currentIndex]}
  alt={`Page ${currentIndex + 1}`}
  fill
  sizes="100vw"
  className="object-contain"
  priority  // No lazy load for the current page
/>
```

**What this gives you:**
- Automatic WebP/AVIF conversion at serve time
- Responsive `srcset` generation
- Built-in lazy loading
- Blur placeholders (with `placeholder="blur"` + `blurDataURL`)

**Tradeoffs:**
- Next.js image optimization uses server CPU/memory (or Vercel's edge if deployed there)
- `fill` mode requires a positioned parent container
- Slightly more complex markup

---

## 4. Add Lazy Loading (Quick Win)

If you don't want to switch to `next/image` yet, just add `loading="lazy"` to gallery images:

```tsx
// app/page.tsx — gallery covers
<img
  src={comic.cover_url}
  alt={comic.title}
  loading="lazy"
  className="w-full h-full object-cover ..."
/>
```

Browser-native lazy loading — images below the fold won't load until the user scrolls near them.

**What this gives you:**
- Faster initial page load
- Less bandwidth for users who don't scroll

**Tradeoffs:**
- None. Zero cost, pure improvement.

---

## 5. Optimize Existing Images in Supabase (One-Time Migration)

To optimize images that are **already uploaded**, write a migration script:

```ts
// scripts/optimize-existing.ts
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL, SERVICE_ROLE_KEY);

async function optimizeExisting() {
  // 1. Fetch all comics from DB
  const { data: comics } = await supabase.from('comics').select('*');

  for (const comic of comics) {
    // 2. Download each image
    const { data: coverData } = await supabase.storage
      .from('comics')
      .download(extractPath(comic.cover_url));

    // 3. Optimize with sharp
    const buffer = Buffer.from(await coverData.arrayBuffer());
    const optimized = await sharp(buffer)
      .webp({ quality: 80 })
      .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    // 4. Upload optimized version (new path)
    const newPath = extractPath(comic.cover_url).replace(/\.[^.]+$/, '.webp');
    await supabase.storage
      .from('comics')
      .upload(newPath, optimized, { contentType: 'image/webp', upsert: true });

    // 5. Update DB record with new URL
    const newUrl = `${URL}/storage/v1/object/public/comics/${newPath}`;
    await supabase.from('comics').update({ cover_url: newUrl }).eq('id', comic.id);

    // 6. Repeat for each page in comic.pages[]
  }
}
```

Run once. Back up your bucket first.

---

## 6. CDN & Caching

### Supabase Storage Headers

Supabase storage sets `Cache-Control: max-age=3600` by default for public buckets. You can override per-upload:

```ts
await supabaseAdmin.storage.from('comics').upload(path, buffer, {
  contentType: 'image/webp',
  cacheControl: '31536000',  // 1 year — images don't change once uploaded
});
```

Since comic pages never change after upload, aggressive caching is safe.

### Cloudflare or Vercel CDN

If deployed on Vercel, `next/image` optimizations are cached at the edge automatically. For self-hosted or other platforms, put Cloudflare in front of your Supabase storage URL for edge caching.

---

## Recommended Priority

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Add `loading="lazy"` to gallery images | 1 line | Medium — faster initial load |
| 2 | Install sharp, compress on upload | ~1 hour | **High** — 50-80% smaller files going forward |
| 3 | Switch gallery covers to `next/image` | ~30 min | **High** — automatic format conversion + responsive |
| 4 | Set `cacheControl: '31536000'` on uploads | 1 line | Medium — faster repeat visits |
| 5 | Run one-time migration script on existing images | ~1 hour | **High** — optimizes everything already in storage |
| 6 | Generate thumbnail variants | ~2 hours | Medium — gallery loads even faster with smaller thumbs |
| 7 | Switch reader to `next/image` | ~30 min | Medium — format conversion for reader pages |
| 8 | Supabase image transforms (if on Pro) | Config only | Medium — alternative to sharp if you want zero server processing |

---

## Quality Guidelines for Comics

Comic art has different needs than photos:

- **Line art / flat color comics:** WebP at quality 80-85 is visually lossless. PNG→WebP savings are massive (often 70%+).
- **Painted / detailed art:** Use quality 85-90 to preserve gradients and subtle detail.
- **Text-heavy pages:** Ensure resolution stays high enough that text is crisp. Don't resize below 1200px wide.
- **Covers:** Can be more compressed since they display smaller on the gallery grid. Quality 75-80 is fine.
- **AVIF vs WebP:** AVIF compresses ~20% better than WebP but encoding is slower. Good for pre-processed uploads, not ideal for on-the-fly transforms.

---

## Format Comparison

| Format | Compression | Browser Support | Best For |
|--------|-------------|-----------------|----------|
| PNG | Lossless, large | Universal | Source/archive only |
| JPEG | Lossy, medium | Universal | Photos, painted art |
| WebP | Lossy/lossless, small | 97%+ browsers | **Best default for serving** |
| AVIF | Lossy/lossless, smallest | 92%+ browsers | Max compression when supported |

**Recommendation:** Store as WebP. Use `next/image` to auto-serve AVIF to browsers that support it.

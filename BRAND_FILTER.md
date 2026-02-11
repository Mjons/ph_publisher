# Adding a Brand Layer — Exploration

## The Idea

Right now the content hierarchy is flat:

```
Series (optional) → Issue Number
Standalone Comic
```

Adding **Brand** introduces a level above Series — think of it like a comic publisher's **imprint**. DC has Vertigo and Black Label. Image has Top Cow and Skybound. Panel Haus could have its own imprints, creator labels, or thematic brands.

The new hierarchy:

```
Brand → Series → Issue
Brand → Standalone Comic
Unbranded Standalone Comic
```

This lets the gallery filter work in two tiers: first narrow by Brand, then optionally by Series within that Brand.

---

## What "Brand" Means Here

Some real-world examples of how this could be used:

| Brand | Series | Issue | Example |
|-------|--------|-------|---------|
| Neon Line | Neon Ronin | #1, #2, #3 | Cyberpunk imprint |
| Neon Line | Chrome Saints | #1 | Same imprint, different series |
| Pulp Vault | — | The Midnight Shift | Standalone under a brand |
| *(none)* | — | Hollow City | Fully independent, no brand |

A Brand groups related series and standalones under one umbrella. It could represent:
- **Imprints** — thematic sub-labels (horror, sci-fi, slice-of-life)
- **Creators** — each artist/writer gets their own brand on the platform
- **Partnerships** — external collaborators with their own branding
- **Content tiers** — free vs. premium, all-ages vs. mature

---

## Approach A: Flat Fields on `comics` Table (Recommended)

The simplest approach. Mirrors exactly how `series_name` / `series_slug` already work — just add `brand_name` / `brand_slug` columns.

### Schema Change

```sql
ALTER TABLE comics
  ADD COLUMN brand_name TEXT DEFAULT NULL,
  ADD COLUMN brand_slug TEXT DEFAULT NULL;
```

That's it. No new tables. No joins. No foreign keys.

### Updated Table Shape

| Column | Type | Example |
|--------|------|---------|
| id | UUID | |
| title | TEXT | Neon Ronin #1 |
| slug | TEXT | neon-ronin-1 |
| cover_url | TEXT | |
| pages | TEXT[] | |
| is_published | BOOLEAN | true |
| **brand_name** | TEXT \| NULL | Neon Line |
| **brand_slug** | TEXT \| NULL | neon-line |
| series_name | TEXT \| NULL | Neon Ronin |
| series_slug | TEXT \| NULL | neon-ronin |
| issue_number | INT \| NULL | 1 |
| view_count | INT | 0 |
| created_at | TIMESTAMPTZ | |

### Why This Works

- **Fully dynamic** — same pattern as the existing series filter. Brand options are derived from loaded comics, no config needed. Upload a comic with `brand_name: "Neon Line"` and it appears as a filter chip automatically.
- **Zero migration risk** — existing comics get `NULL` for both fields, which means "no brand" (same as how `NULL` series means "standalone").
- **No joins** — everything lives on one row. The gallery query stays a single `SELECT *` from `comics`.
- **Denormalized by design** — yes, the brand name is duplicated across rows. For a catalog of hundreds (even thousands) of comics, this is a non-issue. The simplicity is worth it.

### Tradeoff

If you rename a brand, you have to update every comic row that references it. At Panel Haus scale this is a one-liner:

```sql
UPDATE comics SET brand_name = 'New Name', brand_slug = 'new-name' WHERE brand_slug = 'old-name';
```

Not a real problem unless you're renaming brands constantly.

---

## Approach B: Separate `brands` Table (Normalized)

A dedicated table for brands with a foreign key on `comics`.

### Schema

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comics
  ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
```

### When This Makes Sense

- Brands have their own **metadata** — logo, description, color theme, landing page
- You want an **admin UI for managing brands** separately (CRUD brands independent of comics)
- Brands need their own **public pages** (e.g., `/brand/neon-line` showing all comics under that brand)
- Multiple admins manage different brands (access control per brand)

### When It's Overkill

- Brands are just a label for filtering — no extra metadata needed
- You don't need brand-specific pages or admin management
- You want to keep the codebase simple

### Tradeoff

- Requires a join (or separate query) to get the brand name when listing comics
- More migration work — new table, foreign key, RLS policy on `brands`
- Admin UI needs a brand management page before you can even assign brands to comics

---

## Approach C: Full Normalization (brands + series tables)

Take it further — normalize both Brand and Series into their own tables.

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, slug)
);

ALTER TABLE comics
  ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN series_id UUID REFERENCES series(id) ON DELETE SET NULL;
-- Drop the old flat columns:
-- ALTER TABLE comics DROP COLUMN series_name, DROP COLUMN series_slug;
```

### When This Makes Sense

- You're building toward a multi-publisher platform
- Series need their own metadata (description, ongoing/completed status, total issue count)
- You want to enforce that a series always belongs to the correct brand (FK constraint)

### When It's Overkill

- You have < 50 series
- Series metadata isn't a feature you need
- You value simplicity and fast iteration over data purity

### Tradeoff

- Significant refactor — every query, API route, and component that touches `series_name` / `series_slug` needs to change
- Three-table joins for the gallery query
- Admin flow becomes: create brand → create series under brand → upload comic under series
- Much more complex than what Panel Haus currently needs

---

## Recommendation: Go With Approach A

For Panel Haus, **flat fields win**. Here's why:

1. **It follows the existing pattern** — `series_name`/`series_slug` already work this way and it's proven
2. **Zero new tables** — no migrations beyond two `ALTER TABLE ADD COLUMN` statements
3. **The filter logic is already built** — adding brand to the homepage filter is copy-paste from the series filter
4. **You can always normalize later** — if brands grow complex enough to need their own table, migrating from flat fields to a `brands` table is straightforward

---

## Implementation Sketch (Approach A)

### 1. Database Migration

```sql
ALTER TABLE comics
  ADD COLUMN brand_name TEXT DEFAULT NULL,
  ADD COLUMN brand_slug TEXT DEFAULT NULL;
```

### 2. API Route Changes

**`app/api/comics/route.ts` — POST (create comic):**

```diff
  const title = formData.get('title') as string | null;
+ const brandName = formData.get('brandName') as string | null;
  const seriesName = formData.get('seriesName') as string | null;
  const issueNumber = formData.get('issueNumber') as string | null;

+ const brandSlug = brandName
+   ? brandName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
+   : null;

  // In the DB insert:
  const { error: dbError } = await supabaseAdmin.from('comics').insert({
    title,
    slug,
+   brand_name: brandSlug ? brandName : null,
+   brand_slug: brandSlug,
    series_name: seriesSlug ? seriesName : null,
    series_slug: seriesSlug,
    // ...rest
  });
```

**`app/api/comics/[id]/route.ts` — PUT (update comic):**

Same pattern — read `brandName` from FormData, generate slug, include in update.

### 3. Storage Path Changes (Optional)

Currently:
```
comics/{series-slug}/issue-{n}/...
comics/{title-slug}-{uuid}/...
```

Could become:
```
comics/{brand-slug}/{series-slug}/issue-{n}/...
comics/{brand-slug}/{title-slug}-{uuid}/...
comics/{title-slug}-{uuid}/...          ← unbranded standalone
```

**This is optional.** Storage paths don't affect functionality — they're just organizational. It makes the bucket easier to browse in the Supabase dashboard but requires changes to the upload path logic.

### 4. Upload Form Changes

**`app/admin/upload/page.tsx`:**

Add a Brand Name field above the existing Series Info section:

```tsx
{/* Brand Info (Optional) */}
<div className="border border-zinc-800 rounded-lg p-4 space-y-4">
  <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
    Optional: Brand
  </p>
  <div>
    <label className="block text-sm font-medium mb-2">Brand Name</label>
    <input
      type="text"
      value={brandName}
      onChange={(e) => setBrandName(e.target.value)}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 ..."
      placeholder="e.g. Neon Line (leave empty for unbranded)"
    />
  </div>
</div>
```

Same for the edit page.

### 5. Homepage Filter — Two-Tier Chips

The gallery gets a **Brand row** above the existing **Series row**. Selecting a brand narrows which series chips are shown.

**State:**
```tsx
const [brandFilter, setBrandFilter] = useState<'all' | string>('all');
const [seriesFilter, setSeriesFilter] = useState<'all' | 'standalone' | string>('all');
```

**Derive brand list dynamically** (same pattern as series):
```tsx
const brandNames = Array.from(
  new Map(
    comics
      .filter((c) => c.brand_name && c.brand_slug)
      .map((c) => [c.brand_slug!, c.brand_name!])
  ).entries()
);
```

**Cascading filter behavior:**
- Selecting a brand resets the series filter to "all"
- The series chips only show series that exist within the selected brand
- "All" brand shows all series chips

**Filter logic:**
```tsx
.filter((c) => {
  // Brand filter
  if (brandFilter !== 'all' && c.brand_slug !== brandFilter) return false;
  // Series filter
  if (seriesFilter === 'all') return true;
  if (seriesFilter === 'standalone') return !c.series_slug;
  return c.series_slug === seriesFilter;
})
```

### 6. Comic Interface Update

```diff
  interface Comic {
    id: string;
    title: string;
    cover_url: string;
    pages: string[];
    created_at: string;
+   brand_name: string | null;
+   brand_slug: string | null;
    series_name: string | null;
    series_slug: string | null;
    issue_number: number | null;
    view_count: number;
  }
```

### 7. Visual Design — Filter Bar

Current filter bar:
```
[Filter icon] [All] [Neon Ronin] [Standalone]          [Newest First]
```

With brands:
```
[Brand]  [All] [Neon Line] [Pulp Vault] [Unbranded]
[Series] [All] [Neon Ronin] [Chrome Saints] [Standalone]   [Newest First]
```

When "Neon Line" brand is selected, only series under that brand appear in the second row. When "All" brand is selected, all series across all brands appear.

**Alternative: Single combined filter** if you want to keep it simpler:
```
[All] [Neon Line: All] [Neon Line: Neon Ronin] [Pulp Vault: All] [Standalone]
```

This is more compact but gets unwieldy with many series.

### 8. Gallery Badge Update

Currently covers show a purple badge for series:
```
┌──────────────┐
│ NEON RONIN #1│  ← purple badge
│              │
│  [cover art] │
│              │
└──────────────┘
```

With brands, add a secondary badge:
```
┌──────────────┐
│ NEON LINE    │  ← brand badge (different color, e.g. zinc/subtle)
│ NEON RONIN #1│  ← series badge (purple, unchanged)
│              │
│  [cover art] │
│              │
└──────────────┘
```

Or a combined badge:
```
│ NEON LINE · NEON RONIN #1 │
```

---

## Things to Decide Before Building

1. **Can a series exist without a brand?** — Probably yes, to stay backward-compatible. Existing series with no brand just have `brand_slug: null`.

2. **Can a branded comic be standalone (no series)?** — Yes. A brand can contain both series and one-off comics. Example: "Pulp Vault" brand with standalone one-shots.

3. **Should brands have metadata?** — If you want brand logos, descriptions, or custom colors on the gallery, Approach B (separate table) becomes more appealing. If brands are just a label, Approach A is fine.

4. **Brand in the URL?** — Could add a `/brand/neon-line` public page that shows all comics under a brand. Not required but a nice future feature. Doesn't affect the filter implementation.

5. **Admin UX** — Should the brand field be a free-text input (like series currently is), or a dropdown of existing brands? Free-text is simpler but risks typos. A dropdown requires fetching existing brands first but ensures consistency.

---

## Migration Path for Existing Data

Since both new columns default to `NULL`, existing comics are unaffected:

- Comics with `brand_slug: null` show as "Unbranded" or simply don't appear in any brand filter
- The gallery behaves identically to today until you start assigning brands
- You can backfill brands on existing comics at any pace via the edit page

No breaking changes. Fully backward-compatible.

---

## Complexity Cost

| What changes | Files touched | Effort |
|-------------|---------------|--------|
| DB migration | Supabase SQL editor | 2 min |
| Comic interface + mock data | `app/page.tsx` | 5 min |
| API route — POST create | `app/api/comics/route.ts` | 10 min |
| API route — PUT update | `app/api/comics/[id]/route.ts` | 10 min |
| API route — GET list | `app/api/comics/route.ts` | 2 min |
| Upload form | `app/admin/upload/page.tsx` | 10 min |
| Edit form | `app/admin/edit/[id]/page.tsx` | 10 min |
| Homepage filter (brand row) | `app/page.tsx` | 30 min |
| Gallery badges | `app/page.tsx` | 10 min |
| Admin dashboard list | `app/admin/page.tsx` | 5 min |
| **Total** | **~7 files** | **~1.5 hours** |

This is a small, self-contained feature. The pattern is already proven by the series filter — Brand is just a second instance of the same concept, one level up.

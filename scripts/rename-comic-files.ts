/**
 * Renames all comic files in Supabase storage to match their database metadata.
 *
 * Covers:  {folder}/cover.webp  (unchanged, already clean)
 * Pages:   {folder}/{series-slug}-issue-{n}-page-{nn}.webp
 *          or {title-slug}-page-{nn}.webp for standalones
 *
 * Uses Supabase storage `move` — no download/re-upload needed.
 *
 * Usage:
 *   npm run rename-files
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET_PREFIX = '/storage/v1/object/public/comics/';

function extractStoragePath(url: string): string {
  const idx = url.indexOf(BUCKET_PREFIX);
  if (idx === -1) throw new Error(`Unexpected URL format: ${url}`);
  return decodeURIComponent(url.slice(idx + BUCKET_PREFIX.length));
}

function buildPublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}${BUCKET_PREFIX}${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
}

function pad(n: number, width: number = 2): string {
  return String(n).padStart(width, '0');
}

async function main() {
  console.log('Fetching all comics from database...\n');

  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, title, series_name, series_slug, issue_number, cover_url, pages');

  if (error || !comics) {
    console.error('Failed to fetch comics:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${comics.length} comics to process.\n`);

  let renamed = 0;
  let skipped = 0;

  for (const comic of comics) {
    console.log(`\n--- ${comic.title} ---`);

    const folder = extractStoragePath(comic.cover_url).split('/').slice(0, -1).join('/');

    // Build the name prefix from metadata
    let prefix: string;
    if (comic.series_slug && comic.issue_number != null) {
      prefix = `${comic.series_slug}-issue-${comic.issue_number}`;
    } else {
      prefix = slugify(comic.title);
    }

    let newCoverUrl = comic.cover_url;
    const newPages: string[] = [];
    let comicChanged = false;

    // Rename cover → {prefix}-cover.webp
    const coverPath = extractStoragePath(comic.cover_url);
    const coverExt = coverPath.split('.').pop();
    const newCoverName = `${prefix}-cover.${coverExt}`;
    const newCoverPath = `${folder}/${newCoverName}`;

    if (coverPath !== newCoverPath) {
      const { error: mvErr } = await supabase.storage
        .from('comics')
        .move(coverPath, newCoverPath);

      if (mvErr) {
        console.error(`  [error] cover move failed: ${mvErr.message}`);
        newCoverUrl = comic.cover_url; // keep old
      } else {
        console.log(`  [cover] ${coverPath.split('/').pop()} → ${newCoverName}`);
        newCoverUrl = buildPublicUrl(newCoverPath);
        comicChanged = true;
        renamed++;
      }
    } else {
      console.log(`  [cover] already named correctly`);
      skipped++;
    }

    // Rename pages → {prefix}-page-01.webp, page-02.webp, ...
    for (let i = 0; i < comic.pages.length; i++) {
      const pagePath = extractStoragePath(comic.pages[i]);
      const pageExt = pagePath.split('.').pop();
      const newPageName = `${prefix}-page-${pad(i + 1)}.${pageExt}`;
      const newPagePath = `${folder}/${newPageName}`;

      if (pagePath !== newPagePath) {
        const { error: mvErr } = await supabase.storage
          .from('comics')
          .move(pagePath, newPagePath);

        if (mvErr) {
          console.error(`  [error] page ${i + 1} move failed: ${mvErr.message}`);
          newPages.push(comic.pages[i]); // keep old URL
        } else {
          console.log(`  [page ${pad(i + 1)}] ${pagePath.split('/').pop()} → ${newPageName}`);
          newPages.push(buildPublicUrl(newPagePath));
          comicChanged = true;
          renamed++;
        }
      } else {
        console.log(`  [page ${pad(i + 1)}] already named correctly`);
        newPages.push(comic.pages[i]);
        skipped++;
      }
    }

    // Update database if anything changed
    if (comicChanged) {
      const { error: updateError } = await supabase
        .from('comics')
        .update({ cover_url: newCoverUrl, pages: newPages })
        .eq('id', comic.id);

      if (updateError) {
        console.error(`  [error] DB update failed: ${updateError.message}`);
      } else {
        console.log(`  [db] Updated URLs for "${comic.title}"`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`Done! ${renamed} files renamed, ${skipped} already correct.`);
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Rename failed:', err);
  process.exit(1);
});

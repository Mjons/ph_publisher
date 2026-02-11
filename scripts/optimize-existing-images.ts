/**
 * One-time migration script to optimize all existing images in Supabase storage.
 *
 * Downloads each cover and page via public URL, converts to WebP via sharp,
 * re-uploads, and updates the database URLs.
 *
 * Usage:
 *   npm run optimize-images
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET_PREFIX = '/storage/v1/object/public/comics/';

/** Extract the storage path from a full Supabase public URL */
function extractStoragePath(url: string): string {
  const idx = url.indexOf(BUCKET_PREFIX);
  if (idx === -1) {
    throw new Error(`URL does not contain expected bucket prefix: ${url}`);
  }
  return decodeURIComponent(url.slice(idx + BUCKET_PREFIX.length));
}

function toWebpPath(storagePath: string): string {
  return storagePath.replace(/\.[^.]+$/, '.webp');
}

function buildPublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}${BUCKET_PREFIX}${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

async function optimizeAndUpload(
  publicUrl: string,
  quality: number,
  maxWidth: number,
  maxHeight: number | null
): Promise<string | null> {
  const storagePath = extractStoragePath(publicUrl);

  // Skip if already WebP
  if (storagePath.endsWith('.webp')) {
    console.log(`  [skip] ${storagePath} — already WebP`);
    return null;
  }

  // Download via public URL (works regardless of path encoding)
  const response = await fetch(publicUrl);
  if (!response.ok) {
    console.error(`  [error] HTTP ${response.status} downloading ${storagePath}`);
    return null;
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer());
  const originalSize = rawBuffer.byteLength;

  // Optimize with sharp
  const optimized = await sharp(rawBuffer)
    .webp({ quality })
    .resize(maxWidth, maxHeight ?? undefined, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const newSize = optimized.byteLength;
  const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

  // Upload optimized version
  const newStoragePath = toWebpPath(storagePath);
  const { error: upError } = await supabase.storage
    .from('comics')
    .upload(newStoragePath, optimized, { contentType: 'image/webp', upsert: true });

  if (upError) {
    console.error(`  [error] Failed to upload ${newStoragePath}:`, upError.message);
    return null;
  }

  console.log(`  [done] ${storagePath} → ${newStoragePath}  (${formatBytes(originalSize)} → ${formatBytes(newSize)}, -${savings}%)`);

  // Delete original if the path changed (different extension)
  if (newStoragePath !== storagePath) {
    const { error: rmError } = await supabase.storage
      .from('comics')
      .remove([storagePath]);

    if (rmError) {
      console.warn(`  [warn] Could not delete old file ${storagePath}:`, rmError.message);
    }
  }

  return buildPublicUrl(newStoragePath);
}

async function main() {
  console.log('Fetching all comics from database...\n');

  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, title, cover_url, pages');

  if (error || !comics) {
    console.error('Failed to fetch comics:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${comics.length} comics to process.\n`);

  let filesProcessed = 0;
  let filesSkipped = 0;

  for (const comic of comics) {
    console.log(`\n--- ${comic.title} (${comic.id}) ---`);

    let newCoverUrl = comic.cover_url;
    let newPages = [...(comic.pages as string[])];
    let comicChanged = false;

    // Optimize cover
    console.log(`  Cover: ${extractStoragePath(comic.cover_url)}`);
    const optimizedCoverUrl = await optimizeAndUpload(comic.cover_url, 80, 800, 1200);
    if (optimizedCoverUrl) {
      newCoverUrl = optimizedCoverUrl;
      comicChanged = true;
      filesProcessed++;
    } else {
      filesSkipped++;
    }

    // Optimize pages
    for (let i = 0; i < newPages.length; i++) {
      console.log(`  Page ${i + 1}: ${extractStoragePath(newPages[i])}`);
      const optimizedPageUrl = await optimizeAndUpload(newPages[i], 85, 1600, null);
      if (optimizedPageUrl) {
        newPages[i] = optimizedPageUrl;
        comicChanged = true;
        filesProcessed++;
      } else {
        filesSkipped++;
      }
    }

    // Update database if any URLs changed
    if (comicChanged) {
      const { error: updateError } = await supabase
        .from('comics')
        .update({ cover_url: newCoverUrl, pages: newPages })
        .eq('id', comic.id);

      if (updateError) {
        console.error(`  [error] DB update failed for ${comic.title}:`, updateError.message);
      } else {
        console.log(`  [db] Updated URLs for "${comic.title}"`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`Done! ${filesProcessed} files optimized, ${filesSkipped} skipped (already WebP).`);
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import sharp from 'sharp';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('comics')
    .select('id, title, cover_url, brand_name, series_name, issue_number, is_published, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const title = formData.get('title') as string | null;
  const brandName = formData.get('brandName') as string | null;
  const seriesName = formData.get('seriesName') as string | null;
  const issueNumber = formData.get('issueNumber') as string | null;
  const cover = formData.get('cover') as File | null;
  const pages = formData.getAll('pages') as File[];

  if (!title || !cover || pages.length === 0) {
    return NextResponse.json({ error: 'Title, cover, and at least one page are required' }, { status: 400 });
  }

  if (seriesName && !issueNumber) {
    return NextResponse.json({ error: 'Issue number required for series comics' }, { status: 400 });
  }
  if (!seriesName && issueNumber) {
    return NextResponse.json({ error: 'Series name required if issue number is set' }, { status: 400 });
  }

  const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  const brandSlug = brandName
    ? brandName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
    : null;
  const seriesSlug = seriesName
    ? seriesName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
    : null;

  const folder = seriesSlug
    ? `${seriesSlug}/issue-${issueNumber}`
    : `${slug}-${crypto.randomUUID()}`;

  try {
    // Upload cover (optimized)
    const coverPath = `${folder}/cover.webp`;
    const rawCoverBuffer = Buffer.from(await cover.arrayBuffer());
    const coverBuffer = await sharp(rawCoverBuffer)
      .webp({ quality: 80 })
      .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    const { error: coverError } = await supabaseAdmin.storage
      .from('comics')
      .upload(coverPath, coverBuffer, { contentType: 'image/webp' });

    if (coverError) throw coverError;

    const coverUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comics/${coverPath}`;

    // Upload pages sorted by filename
    const sortedPages = [...pages].sort((a, b) => a.name.localeCompare(b.name));
    const pageUrls: string[] = [];

    for (const page of sortedPages) {
      const pageName = page.name.replace(/\.[^.]+$/, '.webp');
      const pagePath = `${folder}/${pageName}`;
      const rawPageBuffer = Buffer.from(await page.arrayBuffer());
      const pageBuffer = await sharp(rawPageBuffer)
        .webp({ quality: 85 })
        .resize(1600, null, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      const { error: pageError } = await supabaseAdmin.storage
        .from('comics')
        .upload(pagePath, pageBuffer, { contentType: 'image/webp' });

      if (pageError) throw pageError;

      pageUrls.push(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comics/${pagePath}`);
    }

    // Insert database row
    const { error: dbError } = await supabaseAdmin.from('comics').insert({
      title,
      slug,
      cover_url: coverUrl,
      pages: pageUrls,
      is_published: true,
      brand_name: brandSlug ? brandName : null,
      brand_slug: brandSlug,
      series_name: seriesSlug ? seriesName : null,
      series_slug: seriesSlug,
      issue_number: seriesSlug ? parseInt(issueNumber!, 10) : null,
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('comics')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Comic not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const title = formData.get('title') as string | null;
  const seriesName = formData.get('seriesName') as string | null;
  const issueNumber = formData.get('issueNumber') as string | null;
  const isPublished = formData.get('isPublished') === 'true';
  const existingCoverUrl = formData.get('existingCoverUrl') as string | null;
  const existingPagesJson = formData.get('existingPages') as string | null;
  const cover = formData.get('cover') as File | null;
  const newPages = formData.getAll('newPages') as File[];

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (seriesName && !issueNumber) {
    return NextResponse.json({ error: 'Issue number required for series comics' }, { status: 400 });
  }
  if (!seriesName && issueNumber) {
    return NextResponse.json({ error: 'Series name required if issue number is set' }, { status: 400 });
  }

  if (!existingCoverUrl) {
    return NextResponse.json({ error: 'Existing cover URL is required' }, { status: 400 });
  }

  let existingPages: string[] = [];
  try {
    existingPages = existingPagesJson ? JSON.parse(existingPagesJson) : [];
  } catch {
    return NextResponse.json({ error: 'Invalid existingPages format' }, { status: 400 });
  }

  // Derive folder from existing cover URL
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comics/`;
  const existingFolder = existingCoverUrl.replace(base, '').split('/').slice(0, -1).join('/');

  try {
    let finalCoverUrl = existingCoverUrl;

    // Upload new cover if provided
    if (cover && cover.size > 0) {
      const coverExt = cover.name.split('.').pop();
      const coverPath = `${existingFolder}/cover.${coverExt}`;
      const coverBuffer = Buffer.from(await cover.arrayBuffer());

      const { error: coverError } = await supabaseAdmin.storage
        .from('comics')
        .upload(coverPath, coverBuffer, { upsert: true, contentType: cover.type });

      if (coverError) throw coverError;

      finalCoverUrl = `${base}${coverPath}`;
    }

    // Upload new pages and append to existing
    const finalPages = [...existingPages];

    for (const page of newPages) {
      if (page.size === 0) continue;

      const pagePath = `${existingFolder}/${page.name}`;
      const pageBuffer = Buffer.from(await page.arrayBuffer());

      const { error: pageError } = await supabaseAdmin.storage
        .from('comics')
        .upload(pagePath, pageBuffer, { contentType: page.type });

      if (pageError) throw pageError;

      finalPages.push(`${base}${pagePath}`);
    }

    // Update database
    const newSlug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const newSeriesSlug = seriesName
      ? seriesName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
      : null;

    const { error: dbError } = await supabaseAdmin
      .from('comics')
      .update({
        title,
        slug: newSlug,
        cover_url: finalCoverUrl,
        pages: finalPages,
        series_name: newSeriesSlug ? seriesName : null,
        series_slug: newSeriesSlug,
        issue_number: newSeriesSlug ? parseInt(issueNumber!, 10) : null,
        is_published: isPublished,
      })
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, coverUrl: finalCoverUrl, pages: finalPages });
  } catch (err: any) {
    console.error('Edit error:', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

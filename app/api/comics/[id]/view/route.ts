import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing comic ID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc('increment_view_count', { comic_id: id });

  if (error) {
    console.error('View count increment error:', error);
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

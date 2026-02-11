import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Comic, ComicSibling } from './types';

function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const getComicBySlug = cache(async (slug: string): Promise<Comic | null> => {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('comics')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) return null;
  return data as Comic;
});

export const getSeriesSiblings = cache(async (seriesSlug: string): Promise<ComicSibling[]> => {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('comics')
    .select('id, title, slug, issue_number')
    .eq('series_slug', seriesSlug)
    .eq('is_published', true)
    .order('issue_number', { ascending: true });

  return (data || []) as ComicSibling[];
});

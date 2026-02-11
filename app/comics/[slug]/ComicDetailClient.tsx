'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ComicReader from '@/components/ComicReader';
import type { Comic, ComicSibling } from '@/lib/types';

interface ComicDetailClientProps {
  comic: Comic;
  seriesSiblings: ComicSibling[];
}

export default function ComicDetailClient({ comic, seriesSiblings }: ComicDetailClientProps) {
  const router = useRouter();

  // View tracking (client-side to avoid bot inflation)
  useEffect(() => {
    fetch(`/api/comics/${comic.id}/view`, { method: 'POST' });
  }, [comic.id]);

  // Determine prev/next for series navigation
  let nextComic: ComicSibling | undefined;
  let prevComic: ComicSibling | undefined;

  if (seriesSiblings.length > 0) {
    const currentIndex = seriesSiblings.findIndex((s) => s.id === comic.id);
    if (currentIndex < seriesSiblings.length - 1) {
      nextComic = seriesSiblings[currentIndex + 1];
    }
    if (currentIndex > 0) {
      prevComic = seriesSiblings[currentIndex - 1];
    }
  }

  return (
    <ComicReader
      pages={comic.pages}
      title={comic.title}
      nextTitle={nextComic?.title}
      prevTitle={prevComic?.title}
      onClose={() => router.push('/')}
      onNextComic={nextComic ? () => router.push(`/comics/${nextComic!.slug}`) : undefined}
      onPrevComic={prevComic ? () => router.push(`/comics/${prevComic!.slug}`) : undefined}
    />
  );
}

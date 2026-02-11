import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getComicBySlug, getSeriesSiblings } from '@/lib/comic-queries';
import ComicDetailClient from './ComicDetailClient';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comic = await getComicBySlug(slug);

  if (!comic) {
    return { title: 'Comic Not Found | Panel Haus' };
  }

  const displayTitle = comic.series_name && comic.issue_number
    ? `${comic.series_name} — Issue #${comic.issue_number}`
    : comic.title;

  const description = comic.series_name
    ? `Read ${comic.series_name} Issue #${comic.issue_number} free on Panel Haus`
    : `Read ${comic.title} free on Panel Haus`;

  return {
    title: `${displayTitle} | Panel Haus`,
    description,
    openGraph: {
      title: displayTitle,
      description,
      type: 'article',
      siteName: 'Panel Haus',
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
    },
  };
}

export default async function ComicPage({ params }: Props) {
  const { slug } = await params;
  const comic = await getComicBySlug(slug);

  if (!comic) notFound();

  const seriesSiblings = comic.series_slug
    ? await getSeriesSiblings(comic.series_slug)
    : [];

  return <ComicDetailClient comic={comic} seriesSiblings={seriesSiblings} />;
}

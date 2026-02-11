'use client';

import { useEffect, useState } from 'react';
import ComicReader from '@/components/ComicReader';
import { BookOpen, ArrowUpDown, Eye } from 'lucide-react';

// Define the shape of our data
interface Comic {
  id: string;
  title: string;
  cover_url: string;
  pages: string[];
  created_at: string;
  series_name: string | null;
  series_slug: string | null;
  issue_number: number | null;
  view_count: number;
}

// Mock data for previewing the UI without Supabase
const MOCK_COMICS: Comic[] = [
  // --- Series: "Neon Ronin" (3 issues) ---
  {
    id: '1',
    title: 'Neon Ronin #1',
    cover_url: 'https://placehold.co/400x600/0f3460/e94560?text=Neon+Ronin+%231&font=montserrat',
    pages: [
      'https://placehold.co/800x1200/0f3460/eee?text=NR+1+Page+1&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+1+Page+2&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+1+Page+3&font=montserrat',
    ],
    created_at: '2025-12-01T00:00:00Z',
    series_name: 'Neon Ronin',
    series_slug: 'neon-ronin',
    issue_number: 1,
  },
  {
    id: '2',
    title: 'Neon Ronin #2',
    cover_url: 'https://placehold.co/400x600/0f3460/e94560?text=Neon+Ronin+%232&font=montserrat',
    pages: [
      'https://placehold.co/800x1200/0f3460/eee?text=NR+2+Page+1&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+2+Page+2&font=montserrat',
    ],
    created_at: '2025-12-10T00:00:00Z',
    series_name: 'Neon Ronin',
    series_slug: 'neon-ronin',
    issue_number: 2,
  },
  {
    id: '3',
    title: 'Neon Ronin #3',
    cover_url: 'https://placehold.co/400x600/0f3460/e94560?text=Neon+Ronin+%233&font=montserrat',
    pages: [
      'https://placehold.co/800x1200/0f3460/eee?text=NR+3+Page+1&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+3+Page+2&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+3+Page+3&font=montserrat',
      'https://placehold.co/800x1200/0f3460/eee?text=NR+3+Page+4&font=montserrat',
    ],
    created_at: '2025-12-20T00:00:00Z',
    series_name: 'Neon Ronin',
    series_slug: 'neon-ronin',
    issue_number: 3,
  },
  // --- Standalone Comics ---
  {
    id: '4',
    title: 'The Midnight Shift',
    cover_url: 'https://placehold.co/400x600/1a1a2e/e94560?text=Midnight+Shift&font=montserrat',
    pages: [
      'https://placehold.co/800x1200/1a1a2e/eee?text=MS+Page+1&font=montserrat',
      'https://placehold.co/800x1200/1a1a2e/eee?text=MS+Page+2&font=montserrat',
      'https://placehold.co/800x1200/1a1a2e/eee?text=MS+Page+3&font=montserrat',
    ],
    created_at: '2025-11-15T00:00:00Z',
    series_name: null,
    series_slug: null,
    issue_number: null,
  },
  {
    id: '5',
    title: 'Hollow City',
    cover_url: 'https://placehold.co/400x600/16213e/0f3460?text=Hollow+City&font=montserrat',
    pages: [
      'https://placehold.co/800x1200/16213e/eee?text=HC+Page+1&font=montserrat',
      'https://placehold.co/800x1200/16213e/eee?text=HC+Page+2&font=montserrat',
    ],
    created_at: '2025-11-01T00:00:00Z',
    series_name: null,
    series_slug: null,
    issue_number: null,
  },
];

const USE_MOCK = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'your-project-url';

export default function Home() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComic, setActiveComic] = useState<Comic | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  function recordView(comic: Comic) {
    if (!USE_MOCK) {
      fetch(`/api/comics/${comic.id}/view`, { method: 'POST' });
    }
  }

  function openComic(comic: Comic) {
    setActiveComic(comic);
    recordView(comic);
  }

  // Fetch comics on load (or use mock data)
  useEffect(() => {
    if (USE_MOCK) {
      setComics(MOCK_COMICS);
      setLoading(false);
      return;
    }

    const fetchComics = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('comics')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setComics(data || []);
      } catch (error) {
        console.error('Error fetching comics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComics();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      
      {/* READER OVERLAY */}
      {activeComic && (() => {
        let nextComic: Comic | undefined;
        let prevComic: Comic | undefined;

        if (activeComic.series_slug) {
          // Series mode: navigate within the same series by issue_number
          const seriesComics = comics
            .filter((c) => c.series_slug === activeComic.series_slug)
            .sort((a, b) => (a.issue_number ?? 0) - (b.issue_number ?? 0));
          const seriesIndex = seriesComics.findIndex((c) => c.id === activeComic.id);
          nextComic = seriesIndex < seriesComics.length - 1 ? seriesComics[seriesIndex + 1] : undefined;
          prevComic = seriesIndex > 0 ? seriesComics[seriesIndex - 1] : undefined;
        } else {
          // Standalone mode: navigate by array position
          const activeIndex = comics.findIndex((c) => c.id === activeComic.id);
          nextComic = activeIndex > 0 ? comics[activeIndex - 1] : undefined;
          prevComic = activeIndex < comics.length - 1 ? comics[activeIndex + 1] : undefined;
        }
        return (
          <ComicReader
            pages={activeComic.pages}
            title={activeComic.title}
            nextTitle={nextComic?.title}
            prevTitle={prevComic?.title}
            onClose={() => setActiveComic(null)}
            onNextComic={nextComic ? () => { setActiveComic(nextComic); recordView(nextComic); } : undefined}
            onPrevComic={prevComic ? () => { setActiveComic(prevComic); recordView(prevComic); } : undefined}
          />
        );
      })()}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-6 md:px-12 flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase text-white">
            Panel Haus
          </h1>
          <p className="text-xs text-zinc-500 font-mono tracking-widest mt-1 uppercase">
            Independent Publishing
          </p>
        </div>
        {/* Admin Link (Optional, hidden in plain sight) */}
        <a href="/admin" className="text-zinc-800 hover:text-zinc-600 transition-colors">
          <BookOpen size={20} />
        </a>
      </header>

      {/* GALLERY GRID */}
      <section className="p-6 md:p-12 max-w-7xl mx-auto">

        {/* Sort Toggle */}
        {!loading && comics.length > 0 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              <ArrowUpDown size={14} />
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        )}

        {loading ? (
          // LOADING SKELETON
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="aspect-[2/3] bg-zinc-900 rounded-sm"></div>
                <div className="h-4 bg-zinc-900 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : comics.length === 0 ? (
          // EMPTY STATE
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <BookOpen size={48} className="mb-4 opacity-50" />
            <p>No issues found. Check back soon.</p>
          </div>
        ) : (
          // COMIC GRID
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-10">
            {[...comics].sort((a, b) => {
              const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              return sortOrder === 'newest' ? diff : -diff;
            }).map((comic) => (
              <article 
                key={comic.id}
                onClick={() => openComic(comic)}
                className="group cursor-pointer flex flex-col gap-3"
              >
                {/* Cover Container */}
                <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900 shadow-xl transition-all duration-500 group-hover:shadow-purple-900/20 group-hover:-translate-y-2 border border-white/5">
                  {/* Series Badge */}
                  {comic.series_name && (
                    <div className="absolute top-3 left-3 z-20">
                      <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm shadow-lg">
                        {comic.series_name} #{comic.issue_number}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-500" />
                  
                  <img 
                    src={comic.cover_url} 
                    alt={comic.title}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                  />
                  
                  {/* "Read" Badge on Hover */}
                  <div className="absolute bottom-4 left-4 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <span className="bg-white text-black text-xs font-bold px-3 py-1 uppercase tracking-wider">
                      Read Issue
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-zinc-300 group-hover:text-white transition-colors">
                    {comic.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-zinc-500 font-mono">
                      {new Date(comic.created_at).toLocaleDateString()}
                    </p>
                    {comic.view_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-zinc-600 font-mono">
                        <Eye size={12} />
                        {comic.view_count}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
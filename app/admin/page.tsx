'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Pencil } from 'lucide-react';

interface Comic {
  id: string;
  title: string;
  cover_url: string;
  series_name: string | null;
  issue_number: number | null;
  is_published: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComics = async () => {
      const { data, error } = await supabase
        .from('comics')
        .select('id, title, cover_url, series_name, issue_number, is_published, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comics:', error);
      } else {
        setComics(data || []);
      }
      setLoading(false);
    };
    fetchComics();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin</h1>
            <p className="mt-1 text-zinc-500 text-sm">Panel Haus</p>
          </div>
          <div className="flex gap-3">
            <a href="/" className="text-zinc-500 hover:text-white text-sm transition-colors">
              View Site
            </a>
            <a
              href="/admin/upload"
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md font-medium text-sm hover:bg-zinc-200 transition"
            >
              <Plus size={16} /> Upload New
            </a>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <div className="w-16 h-24 bg-zinc-800 rounded" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-zinc-800 rounded w-1/3" />
                  <div className="h-3 bg-zinc-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : comics.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <p>No comics yet. Upload your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comics.map((comic) => (
              <div
                key={comic.id}
                className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 transition"
              >
                <img
                  src={comic.cover_url}
                  alt={comic.title}
                  className="w-16 h-24 object-cover rounded border border-zinc-700"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{comic.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {comic.series_name && (
                      <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm">
                        {comic.series_name} #{comic.issue_number}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm ${
                      comic.is_published ? 'bg-green-600/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {comic.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(comic.created_at).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`/admin/edit/${comic.id}`}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2 rounded-md text-sm transition"
                >
                  <Pencil size={14} /> Edit
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

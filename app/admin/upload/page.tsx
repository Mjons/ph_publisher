'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pageFiles, setPageFiles] = useState<FileList | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !coverFile || !pageFiles) return alert('Please fill in all fields');
    if (seriesName && !issueNumber) return alert('If a series name is provided, an issue number is required.');
    if (!seriesName && issueNumber) return alert('If an issue number is provided, a series name is required.');

    setLoading(true);
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const seriesSlug = seriesName
      ? seriesName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
      : null;

    // Series comics share a folder; standalone comics get a unique folder
    const folder = seriesSlug
      ? `${seriesSlug}/issue-${issueNumber}`
      : `${slug}-${uuidv4()}`;

    try {
      // 1. Upload Cover
      const coverPath = `${folder}/cover.${coverFile.name.split('.').pop()}`;
      const { error: coverError } = await supabase.storage
        .from('comics')
        .upload(coverPath, coverFile);
      
      if (coverError) throw coverError;
      
      const coverUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comics/${coverPath}`;

      // 2. Upload Pages (Iterate through them)
      const pageUrls: string[] = [];
      
      // Sort files by name to ensure page order is correct (e.g. page-01.png, page-02.png)
      const sortedFiles = Array.from(pageFiles).sort((a, b) => a.name.localeCompare(b.name));

      for (const file of sortedFiles) {
        const pagePath = `${folder}/${file.name}`;
        const { error: pageError } = await supabase.storage
          .from('comics')
          .upload(pagePath, file);

        if (pageError) throw pageError;
        
        pageUrls.push(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comics/${pagePath}`);
      }

      // 3. Save Metadata to Database
      const { error: dbError } = await supabase.from('comics').insert({
        title,
        slug,
        cover_url: coverUrl,
        pages: pageUrls,
        is_published: true,
        series_name: seriesSlug ? seriesName : null,
        series_slug: seriesSlug,
        issue_number: seriesSlug ? parseInt(issueNumber, 10) : null,
      });

      if (dbError) throw dbError;

      alert('Comic Published Successfully!');
      setTitle('');
      setSeriesName('');
      setIssueNumber('');
      setCoverFile(null);
      setPageFiles(null);

    } catch (error: any) {
      console.error(error);
      alert('Error uploading: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Upload New Issue</h1>
          <p className="mt-2 text-zinc-400">Panel Haus Admin</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-6 bg-zinc-900/50 p-8 rounded-xl border border-zinc-800">
          
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
              placeholder="e.g. The Midnight Shift"
            />
          </div>

          {/* Series Info (Optional) */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Optional: Series Info</p>
            <div>
              <label className="block text-sm font-medium mb-2">Series Name</label>
              <input
                type="text"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
                placeholder="e.g. Neon Ronin (leave empty for standalone)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Issue Number</label>
              <input
                type="number"
                min="1"
                value={issueNumber}
                onChange={(e) => setIssueNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
                placeholder="e.g. 1"
              />
            </div>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Image</label>
            <div className="relative border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg p-6 flex flex-col items-center justify-center transition cursor-pointer">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-zinc-500 text-sm">
                {coverFile ? coverFile.name : "Drag cover here or click"}
              </span>
            </div>
          </div>

          {/* Comic Pages */}
          <div>
            <label className="block text-sm font-medium mb-2">Pages (Select all PNGs)</label>
            <div className="relative border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg p-6 flex flex-col items-center justify-center transition cursor-pointer">
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={(e) => setPageFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-zinc-500 text-sm">
                {pageFiles ? `${pageFiles.length} files selected` : "Drag all pages here"}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              * Ensure files are named sequentially (01.png, 02.png) for correct order.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-md font-medium text-black transition ${
              loading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-white hover:bg-zinc-200'
            }`}
          >
            {loading ? 'Publishing...' : 'Publish Comic'}
          </button>

        </form>
      </div>
    </div>
  );
}
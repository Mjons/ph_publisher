'use client';

import { useState } from 'react';

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

    try {
      const formData = new FormData();
      formData.append('title', title);
      if (seriesName) formData.append('seriesName', seriesName);
      if (issueNumber) formData.append('issueNumber', issueNumber);
      formData.append('cover', coverFile);
      for (const file of Array.from(pageFiles)) {
        formData.append('pages', file);
      }

      const res = await fetch('/api/comics', { method: 'POST', body: formData });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Upload failed');

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
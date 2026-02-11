'use client';

import { use, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, ArrowLeft } from 'lucide-react';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [newPageFiles, setNewPageFiles] = useState<File[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    const fetchComic = async () => {
      try {
        const res = await fetch(`/api/comics/${id}`);
        if (!res.ok) {
          alert('Comic not found');
          return;
        }
        const data = await res.json();

        setTitle(data.title);
        setBrandName(data.brand_name || '');
        setSeriesName(data.series_name || '');
        setIssueNumber(data.issue_number?.toString() || '');
        setCoverUrl(data.cover_url);
        setPages(data.pages || []);
        setIsPublished(data.is_published);
        setLoading(false);
      } catch {
        alert('Failed to load comic');
      }
    };
    fetchComic();
  }, [id]);

  const handleDeletePage = (index: number) => {
    if (!confirm(`Delete page ${index + 1}?`)) return;
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const movePageUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...pages];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    setPages(reordered);
  };

  const movePageDown = (index: number) => {
    if (index === pages.length - 1) return;
    const reordered = [...pages];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    setPages(reordered);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('Title is required');
    if (seriesName && !issueNumber) return alert('Issue number required for series comics.');
    if (!seriesName && issueNumber) return alert('Series name required if issue number is set.');

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      if (brandName) formData.append('brandName', brandName);
      if (seriesName) formData.append('seriesName', seriesName);
      if (issueNumber) formData.append('issueNumber', issueNumber);
      formData.append('isPublished', String(isPublished));
      formData.append('existingCoverUrl', coverUrl);
      formData.append('existingPages', JSON.stringify(pages));

      if (newCoverFile) {
        formData.append('cover', newCoverFile);
      }
      for (const file of newPageFiles) {
        formData.append('newPages', file);
      }

      const res = await fetch(`/api/comics/${id}`, { method: 'PUT', body: formData });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Update failed');

      alert('Changes saved!');
      setNewCoverFile(null);
      setNewPageFiles([]);
      setCoverUrl(result.coverUrl);
      setPages(result.pages);
    } catch (error: any) {
      console.error(error);
      alert('Error saving: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        <div className="flex items-center gap-4">
          <a href="/admin" className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </a>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Edit Comic</h1>
            <p className="text-sm text-zinc-500">{title}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 bg-zinc-900/50 p-8 rounded-xl border border-zinc-800">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
            />
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-medium mb-2">Brand</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
              placeholder="Leave empty for unbranded"
            />
          </div>

          {/* Series Info */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Series Info</p>
            <div>
              <label className="block text-sm font-medium mb-2">Series Name</label>
              <input
                type="text"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 focus:ring-2 focus:ring-purple-500 outline-none transition"
                placeholder="Leave empty for standalone"
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
              />
            </div>
          </div>

          {/* Published Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isPublished ? 'bg-green-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isPublished ? 'translate-x-6' : ''}`} />
            </button>
            <span className="text-sm">{isPublished ? 'Published' : 'Draft'}</span>
          </div>

          {/* Cover Image */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Cover Image</p>
            <div className="flex gap-4 items-start">
              <img
                src={newCoverFile ? URL.createObjectURL(newCoverFile) : coverUrl}
                alt="Cover"
                className="w-32 h-48 object-cover rounded border border-zinc-700"
              />
              <div className="flex-1">
                <div className="relative border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg p-4 flex flex-col items-center justify-center transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewCoverFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-zinc-500 text-sm">
                    {newCoverFile ? newCoverFile.name : 'Upload new cover'}
                  </span>
                </div>
                {newCoverFile && (
                  <button
                    type="button"
                    onClick={() => setNewCoverFile(null)}
                    className="text-xs text-zinc-500 hover:text-red-400 mt-2 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Page Management */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
              Pages ({pages.length})
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {pages.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === index) return;
                    const reordered = [...pages];
                    const [moved] = reordered.splice(dragIndex, 1);
                    reordered.splice(index, 0, moved);
                    setPages(reordered);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`relative border rounded-lg p-1.5 cursor-grab transition-all ${
                    dragIndex === index ? 'opacity-30 scale-95' : 'opacity-100'
                  } border-zinc-700 bg-zinc-900 hover:border-zinc-500`}
                >
                  <img
                    src={url}
                    alt={`Page ${index + 1}`}
                    className="w-full aspect-[2/3] object-cover rounded"
                  />
                  <span className="text-[10px] text-zinc-400 mt-1 block text-center">
                    Page {index + 1}
                  </span>

                  {/* Move buttons */}
                  <div className="absolute bottom-7 left-0 right-0 flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => movePageUp(index)}
                      className={`bg-zinc-800/80 hover:bg-zinc-700 rounded p-0.5 ${index === 0 ? 'invisible' : ''}`}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePageDown(index)}
                      className={`bg-zinc-800/80 hover:bg-zinc-700 rounded p-0.5 ${index === pages.length - 1 ? 'invisible' : ''}`}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeletePage(index)}
                    className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {/* New page previews */}
              {newPageFiles.map((file, i) => (
                <div
                  key={file.name}
                  className="relative border-2 border-dashed border-purple-600 rounded-lg p-1.5"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`New ${i + 1}`}
                    className="w-full aspect-[2/3] object-cover rounded"
                  />
                  <span className="text-[10px] text-purple-400 mt-1 block text-center">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewPageFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new pages */}
            <div className="relative border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg p-4 flex flex-col items-center justify-center transition cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setNewPageFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-zinc-500 text-sm">Add new pages</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-3 rounded-md font-medium text-black transition ${
                saving ? 'bg-zinc-700 cursor-not-allowed' : 'bg-white hover:bg-zinc-200'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <a
              href="/admin"
              className="px-6 py-3 rounded-md font-medium text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition text-center"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

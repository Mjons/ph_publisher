'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, ArrowRight, ArrowLeft } from 'lucide-react';

interface ComicReaderProps {
  pages: string[];
  title: string;
  nextTitle?: string; // Title of the next issue
  prevTitle?: string; // Title of the previous issue
  onClose: () => void;
  onNextComic?: () => void;
  onPrevComic?: () => void;
}

export default function ComicReader({ 
  pages, 
  title, 
  nextTitle, 
  prevTitle, 
  onClose, 
  onNextComic, 
  onPrevComic 
}: ComicReaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showEndCard, setShowEndCard] = useState(false);

  // Navigation Logic
  const nextPage = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      window.scrollTo(0, 0);
    } else if (currentIndex === pages.length - 1 && onNextComic) {
      setShowEndCard(true);
    }
  }, [currentIndex, pages.length, onNextComic]);

  const prevPage = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  }, [currentIndex]);

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, onClose]);

  // Reset page when comic changes (if the user clicks 'Next Issue' inside the reader)
  useEffect(() => {
    setCurrentIndex(0);
    setShowEndCard(false);
  }, [title]);

  const isLastPage = currentIndex === pages.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center animate-in fade-in duration-300">

      {/* TOP NAVIGATION BAR */}
      <div className="shrink-0 w-full px-4 py-3 flex justify-between items-center z-50 text-white/50 hover:text-white transition-colors bg-black/60 border-b border-white/5">

        {/* Left Side: Previous Issue & Title */}
        <div className="flex items-center gap-4">
           {onPrevComic && (
            <button
              onClick={onPrevComic}
              className="hidden md:flex items-center gap-2 hover:text-purple-400 text-xs uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="opacity-50">Prev:</span> {prevTitle}
            </button>
          )}
        </div>

        {/* Center: Current Title */}
        <h2 className="text-sm font-bold tracking-widest uppercase text-white hidden md:block">{title}</h2>

        {/* Right Side: Next Issue & Close */}
        <div className="flex items-center gap-6">
          {onNextComic && (
            <button
              onClick={onNextComic}
              className="hidden md:flex items-center gap-2 hover:text-purple-400 text-xs uppercase tracking-widest transition-colors"
            >
              <span className="opacity-50">Next:</span> {nextTitle}
              <ArrowRight size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="relative w-full flex-1 min-h-0 flex items-center justify-center p-4 md:p-8">
        
        {/* Previous Page Click Zone */}
        <div 
          onClick={prevPage} 
          className="absolute left-0 h-full w-1/6 cursor-pointer z-20 hover:bg-white/5 transition-colors group flex items-center justify-start pl-4"
        >
          <ChevronLeft className={`text-white/30 group-hover:text-white transition-transform group-hover:-translate-x-1 ${currentIndex === 0 ? 'hidden' : ''}`} size={48} />
        </div>

        {/* IMAGE DISPLAY */}
        <div className="relative h-full w-full max-w-5xl flex items-center justify-center">
            <img 
              src={pages[currentIndex]} 
              alt={`Page ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain shadow-2xl rounded-sm"
            />

            {/* "READ NEXT" OVERLAY (Appears when user tries to advance past last page) */}
            {showEndCard && onNextComic && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-6 p-8 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md">
                  <h3 className="text-zinc-400 uppercase tracking-widest text-sm">Finished Reading</h3>
                  <h2 className="text-3xl font-black text-white">{nextTitle}</h2>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={onNextComic}
                      className="w-full py-4 bg-white text-black font-bold uppercase tracking-wide hover:bg-purple-400 hover:scale-105 transition-all rounded-md flex items-center justify-center gap-2"
                    >
                      Read Next Issue <ArrowRight size={20} />
                    </button>
                    <button 
                      onClick={onClose}
                      className="text-zinc-500 hover:text-white text-sm mt-2 transition-colors"
                    >
                      Return to Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Next Page Click Zone */}
        <div 
          onClick={nextPage} 
          className="absolute right-0 h-full w-1/6 cursor-pointer z-20 hover:bg-white/5 transition-colors group flex items-center justify-end pr-4"
        >
           {/* Only show chevron if NOT on last page (to avoid conflict with the overlay) */}
          {!isLastPage && (
            <ChevronRight className="text-white/30 group-hover:text-white transition-transform group-hover:translate-x-1" size={48} />
          )}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1 px-4 pb-3 pt-2">
        <div className="w-full max-w-lg flex gap-1">
          {pages.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : idx < currentIndex ? 'bg-white/30' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          PAGE {currentIndex + 1} / {pages.length}
        </div>
      </div>
    </div>
  );
}
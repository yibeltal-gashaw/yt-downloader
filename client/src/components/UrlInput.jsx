import React from 'react';
import { Search, Loader2, X, Link2 } from 'lucide-react';

export default function UrlInput({ url, setUrl, onSubmit, isLoading, disabled }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit();
    }
  };

  const handleClear = () => {
    setUrl('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="youtube-url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL"
            disabled={isLoading || disabled}
            autoFocus
            className="w-full pl-10 pr-10 py-3 text-sm sm:text-base rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-400 dark:focus:border-neutral-600 transition shadow-sm"
          />
          {url && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
              aria-label="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          id="get-video-btn"
          disabled={!url.trim() || isLoading}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-medium text-sm sm:text-base transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm whitespace-nowrap active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching...</span>
            </>
          ) : (
            <span>Get Video</span>
          )}
        </button>
      </div>
    </form>
  );
}

import React from 'react';
import { Download, Loader2, CheckCircle2, ChevronDown, Music, Film } from 'lucide-react';

export default function DownloadOptions({
  formats = [],
  selectedFormat,
  setSelectedFormat,
  selectedQuality,
  setSelectedQuality,
  onDownload,
  downloadStatus, // 'idle' | 'downloading' | 'completed' | 'error'
  progress = { percent: 0, speed: '', size: '', eta: '', stage: '', message: '' },
}) {
  const isDownloading = downloadStatus === 'downloading';
  const isCompleted = downloadStatus === 'completed';

  // Get available video qualities for MP4
  const videoQualities = formats
    .filter((f) => f.format === 'mp4' || !f.format)
    .map((f) => f.quality)
    .filter((val, idx, arr) => arr.indexOf(val) === idx);

  // Audio quality options
  const audioQualities = ['Best Quality (320 kbps)', 'Standard Quality (192 kbps)', 'Compact Quality (128 kbps)'];

  const handleFormatChange = (e) => {
    const nextFormat = e.target.value;
    setSelectedFormat(nextFormat);
    if (nextFormat === 'mp3') {
      setSelectedQuality('Best Quality (320 kbps)');
    } else {
      setSelectedQuality(videoQualities[0] || '720p');
    }
  };

  const currentPercent = Math.min(Math.max(progress.percent || 0, 0), 100);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Format Selector */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="format-select"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
          >
            Format
          </label>
          <div className="relative">
            <select
              id="format-select"
              value={selectedFormat}
              onChange={handleFormatChange}
              disabled={isDownloading}
              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-400 dark:focus:border-neutral-600 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10"
            >
              <option value="mp4">MP4 (Video & Audio)</option>
              <option value="mp3">MP3 (Audio Only)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Quality Selector */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="quality-select"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
          >
            Quality
          </label>
          <div className="relative">
            <select
              id="quality-select"
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              disabled={isDownloading}
              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 focus:border-neutral-400 dark:focus:border-neutral-600 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10"
            >
              {selectedFormat === 'mp4' ? (
                videoQualities.length > 0 ? (
                  videoQualities.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))
                ) : (
                  <option value="best">Best Available</option>
                )
              ) : (
                audioQualities.map((aq) => (
                  <option key={aq} value={aq}>
                    {aq}
                  </option>
                ))
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Display */}
      {isDownloading && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 transition-all duration-200">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
              {progress.message || 'Downloading media...'}
            </span>
            <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {currentPercent}%
            </span>
          </div>

          {/* Progress track & bar */}
          <div className="w-full h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${currentPercent}%` }}
            />
          </div>

          {/* Speed, size, ETA footer */}
          {(progress.speed || progress.size || progress.eta) && (
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              <span>{progress.speed ? `${progress.speed}` : ''} {progress.size ? `• ${progress.size}` : ''}</span>
              {progress.eta && <span>ETA {progress.eta}</span>}
            </div>
          )}
        </div>
      )}

      {/* Download Action */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          id="download-btn"
          onClick={onDownload}
          disabled={isDownloading}
          className={`w-full py-3 px-6 rounded-xl font-medium text-sm sm:text-base flex items-center justify-center gap-2.5 transition shadow-sm select-none active:scale-[0.99] ${
            isCompleted
              ? 'bg-emerald-600 text-white'
              : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Downloading ({currentPercent}%)...</span>
            </>
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ Download complete</span>
            </>
          ) : (
            <>
              {selectedFormat === 'mp3' ? (
                <Music className="w-4 h-4" />
              ) : (
                <Film className="w-4 h-4" />
              )}
              <span>Download {selectedFormat.toUpperCase()}</span>
            </>
          )}
        </button>

        {isDownloading && (
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
            Processing and preparing your download. The file will save automatically.
          </p>
        )}
      </div>
    </div>
  );
}

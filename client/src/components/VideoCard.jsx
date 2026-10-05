import React from 'react';
import { User, Clock } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoCard({ video }) {
  if (!video) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
      {/* Thumbnail */}
      <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            No preview
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-xs font-medium rounded bg-black/80 text-white backdrop-blur-sm">
          {formatDuration(video.duration)}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div>
          <h2
            className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug"
            title={video.title}
          >
            {video.title}
          </h2>
          {video.channel && (
            <div className="flex items-center gap-1.5 mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              <User className="w-3.5 h-3.5" />
              <span className="truncate">{video.channel}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Duration: {formatDuration(video.duration)}</span>
        </div>
      </div>
    </div>
  );
}

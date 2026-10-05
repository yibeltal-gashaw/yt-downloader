import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, AlertCircle, Video } from 'lucide-react';
import UrlInput from './components/UrlInput';
import VideoCard from './components/VideoCard';
import DownloadOptions from './components/DownloadOptions';

// Regex to validate common YouTube URLs
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?.*v=|shorts\/|live\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('yt_downloader_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [url, setUrl] = useState('');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Download and progress state
  const [selectedFormat, setSelectedFormat] = useState('mp4');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'downloading' | 'completed' | 'error'
  const [progress, setProgress] = useState({
    percent: 0,
    speed: '',
    size: '',
    eta: '',
    stage: '',
    message: '',
  });

  const eventSourceRef = useRef(null);

  // Synchronize theme with HTML document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('yt_downloader_theme', theme);
  }, [theme]);

  // Clean up any open EventSource connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleFetchInfo = async () => {
    setErrorMessage('');
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setErrorMessage('Please enter a YouTube URL.');
      return;
    }

    if (!YOUTUBE_REGEX.test(trimmedUrl)) {
      setErrorMessage('Please enter a valid YouTube URL.');
      return;
    }

    setIsFetchingInfo(true);
    setVideoInfo(null);
    setDownloadStatus('idle');

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve video information.');
      }

      setVideoInfo(data);
      // Default to best MP4 quality available
      const mp4Formats = data.formats?.filter((f) => f.format === 'mp4') || [];
      if (mp4Formats.length > 0) {
        setSelectedQuality(mp4Formats[0].quality);
      } else {
        setSelectedQuality('best');
      }
      setSelectedFormat('mp4');
    } catch (err) {
      setErrorMessage(err.message || 'Could not retrieve video information. Please try again.');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo || !url.trim()) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setErrorMessage('');
    setDownloadStatus('downloading');
    setProgress({
      percent: 0,
      speed: '',
      size: '',
      eta: '',
      stage: 'starting',
      message: 'Initializing download...',
    });

    try {
      const response = await fetch('/api/download/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          format: selectedFormat,
          quality: selectedQuality,
          title: videoInfo?.title || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Download failed to start.');
      }

      const { downloadId } = data;

      // Subscribe to real-time progress events
      const es = new EventSource(`/api/download/progress/${downloadId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);

          if (update.stage === 'error') {
            es.close();
            setDownloadStatus('error');
            setErrorMessage(update.error || 'Download failed. Please try again.');
            setTimeout(() => setDownloadStatus('idle'), 4000);
            return;
          }

          setProgress({
            percent: typeof update.percent === 'number' ? update.percent : 0,
            speed: update.speed || '',
            size: update.size || '',
            eta: update.eta || '',
            stage: update.stage || '',
            message: update.message || 'Processing...',
          });

          if (update.stage === 'ready' && update.downloadUrl) {
            es.close();

            // Trigger file download in browser
            const link = document.createElement('a');
            link.href = update.downloadUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setDownloadStatus('completed');
            setTimeout(() => {
              setDownloadStatus('idle');
            }, 4500);
          }
        } catch (parseErr) {
          console.error('Error parsing progress SSE event:', parseErr);
        }
      };

      es.onerror = () => {
        // SSE closed or interrupted
      };
    } catch (err) {
      setDownloadStatus('error');
      setErrorMessage(err.message || 'Download failed. Please try again.');
      setTimeout(() => {
        setDownloadStatus('idle');
      }, 4000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Top Navbar */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm shadow-red-500/20">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight">
            YouTube Downloader
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl mx-auto w-full my-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            YouTube Downloader
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Download videos for personal use
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-7 shadow-sm transition-all duration-200">
          <UrlInput
            url={url}
            setUrl={(newUrl) => {
              setUrl(newUrl);
              if (errorMessage) setErrorMessage('');
            }}
            onSubmit={handleFetchInfo}
            isLoading={isFetchingInfo}
            disabled={downloadStatus === 'downloading'}
          />

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMessage}</p>
            </div>
          )}

          {/* Video Information & Download Options */}
          {videoInfo && (
            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-5">
              <VideoCard video={videoInfo} />

              <DownloadOptions
                formats={videoInfo.formats || []}
                selectedFormat={selectedFormat}
                setSelectedFormat={setSelectedFormat}
                selectedQuality={selectedQuality}
                setSelectedQuality={setSelectedQuality}
                onDownload={handleDownload}
                downloadStatus={downloadStatus}
                progress={progress}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full pt-8 text-center text-xs text-neutral-400 dark:text-neutral-600">
        <p>Simple local utility. For authorized personal use only.</p>
      </footer>
    </div>
  );
}

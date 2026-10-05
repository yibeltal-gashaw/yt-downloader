const { spawn, execFile, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check for ffmpeg: prioritize system PATH, fallback to @ffmpeg-installer/ffmpeg
let ffmpegPath = null;
let ffmpegDir = null;

try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegPath = 'ffmpeg';
} catch {
  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    if (installer && installer.path && fs.existsSync(installer.path)) {
      ffmpegPath = installer.path;
      ffmpegDir = path.dirname(installer.path);
    }
  } catch (err) {
    console.warn('Could not load @ffmpeg-installer/ffmpeg:', err.message);
  }
}

// Find yt-dlp executable
function getYtDlpPath() {
  const localExe = process.platform === 'win32'
    ? path.join(__dirname, 'bin', 'yt-dlp.exe')
    : path.join(__dirname, 'bin', 'yt-dlp');

  if (fs.existsSync(localExe)) {
    return localExe;
  }

  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const sysPath = execSync(cmd, { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (sysPath && fs.existsSync(sysPath)) {
      return sysPath;
    }
  } catch {
    // Not in PATH
  }

  return 'yt-dlp';
}

function sanitizeFilename(name) {
  if (!name) return 'video';
  const sanitized = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return sanitized || 'video';
}

// In-memory cache for video info (1 hour TTL)
const infoCache = new Map();

/**
 * Fetch video metadata from YouTube
 */
async function getVideoInfo(url, maxDuration = 7200) {
  const trimmedUrl = (url || '').trim();
  const cached = infoCache.get(trimmedUrl);
  if (cached && (Date.now() - cached.timestamp < 3600000)) {
    return cached.data;
  }

  const ytDlp = getYtDlpPath();

  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes', 'node:node',
  ];

  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  } else if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  args.push(trimmedUrl);

  return new Promise((resolve, reject) => {
    execFile(ytDlp, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const errorText = (stderr || error.message).toLowerCase();
        if (errorText.includes('private') || errorText.includes('unavailable') || errorText.includes('not available')) {
          return reject(new Error('This video is unavailable.'));
        }
        return reject(new Error('Could not retrieve video information. Please verify the URL.'));
      }

      try {
        const data = JSON.parse(stdout);

        if (maxDuration && data.duration && data.duration > maxDuration) {
          const maxMinutes = Math.floor(maxDuration / 60);
          return reject(new Error(`Video exceeds maximum allowed duration limit (${maxMinutes} minutes).`));
        }

        // Extract available video resolutions
        const heightsSet = new Set();
        if (Array.isArray(data.formats)) {
          for (const f of data.formats) {
            if (f.height && typeof f.height === 'number' && f.vcodec !== 'none') {
              heightsSet.add(f.height);
            }
          }
        }

        const sortedHeights = Array.from(heightsSet).sort((a, b) => b - a);
        const standardQualities = [2160, 1440, 1080, 720, 480, 360, 240, 144];
        const availableQualities = [];

        for (const std of standardQualities) {
          if (sortedHeights.some((h) => h >= std)) {
            availableQualities.push(`${std}p`);
          }
        }

        if (availableQualities.length === 0 && sortedHeights.length > 0) {
          availableQualities.push(`${sortedHeights[0]}p`);
        } else if (availableQualities.length === 0) {
          availableQualities.push('720p', '360p');
        }

        const formats = availableQualities.map((q) => ({
          quality: q,
          format: 'mp4',
        }));

        const result = {
          title: data.title || data.fulltitle || 'YouTube Video',
          thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails[0]?.url) || '',
          duration: data.duration || 0,
          channel: data.uploader || data.channel || '',
          formats,
        };

        infoCache.set(trimmedUrl, {
          timestamp: Date.now(),
          data: result,
        });

        resolve(result);
      } catch (parseError) {
        reject(new Error('Failed to parse video metadata.'));
      }
    });
  });
}

/**
 * Download and process media (MP4 or MP3) with real-time percentage progress callback
 */
function downloadMedia({ url, format, quality, outputPath, timeout = 1800000, onProgress }) {
  const ytDlp = getYtDlpPath();

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline', // Output progress on new lines for easy parsing
    '--js-runtimes', 'node:node',
    '--concurrent-fragments', '5', // Download up to 5 fragments simultaneously
    '--http-chunk-size', '10M',    // Request 10MB chunks to avoid YouTube speed throttling
    '--buffer-size', '1024K',      // 1MB buffer to smooth I/O throughput
    '--retries', '5',
    '--fragment-retries', '5',
    '--throttled-rate', '100K',    // Automatically restart connection if throttled below 100K
    '--no-mtime',
  ];

  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  } else if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  if (format === 'mp3') {
    let audioQualityArg = '0'; // default best (VBR 0)
    if (quality && quality.includes('192')) audioQualityArg = '2';
    if (quality && quality.includes('128')) audioQualityArg = '4';

    args.push(
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', audioQualityArg,
      '-o', outputPath
    );
  } else {
    // Format is MP4
    const heightMatch = quality ? quality.match(/(\d+)p/) : null;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : null;

    let formatSelector;
    if (height) {
      // Prioritize mp4/m4a streams, fallback to any best video/audio
      formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
    } else {
      formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
    }

    args.push(
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '--postprocessor-args', 'Merger:-c:v copy -c:a aac',
      '-o', outputPath
    );
  }

  args.push(url);

  let timer = null;
  let proc = null;

  const promise = new Promise((resolve, reject) => {
    proc = spawn(ytDlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderrBuffer = '';
    let currentStreamIndex = 1; // 1 for video/first stream, 2 for audio stream
    let totalStreams = format === 'mp4' ? 2 : 1;
    let destinationCount = 0;

    if (timeout > 0) {
      timer = setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill();
          reject(new Error('Download timed out.'));
        }
      }, timeout);
    }

    const parseLine = (line) => {
      // Stream transition check
      if (line.includes('Downloading 1 format(s):')) {
        if (line.includes('+')) {
          totalStreams = 2;
        } else {
          totalStreams = 1;
        }
      }

      if (line.includes('[download] Destination:')) {
        destinationCount++;
        if (destinationCount > 1) {
          currentStreamIndex = 2;
        }
      }

      // Check for merger or audio extraction
      if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
        if (typeof onProgress === 'function') {
          onProgress({
            percent: 98,
            speed: '',
            size: '',
            eta: '',
            stage: 'processing',
            message: format === 'mp3' ? 'Converting to MP3...' : 'Merging video and audio...',
          });
        }
        return;
      }

      // Regex for progress line: [download]  45.2% of 15.20MiB at 2.45MiB/s ETA 00:03
      const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*\w+)(?:\s+(?:at\s+([\d.]+\s*\w+\/s)|in\s+[\d:]+))?(?:\s+at\s+([\d.]+\s*\w+\/s))?(?:\s+ETA\s+([\d:]+))?/i);
      if (progressMatch && typeof onProgress === 'function') {
        const rawPercent = parseFloat(progressMatch[1]);
        const size = progressMatch[2] || '';
        const speed = progressMatch[3] || progressMatch[4] || '';
        const eta = progressMatch[5] || '';

        // Calculate overall blended progress for dual streams
        let displayPercent = rawPercent;
        let message = 'Downloading media...';

        if (totalStreams === 2) {
          if (currentStreamIndex === 1) {
            // First stream is 0% to 75%
            displayPercent = Math.min(Math.round(rawPercent * 0.75), 75);
            message = `Downloading video (${Math.round(rawPercent)}%)...`;
          } else {
            // Second stream is 75% to 95%
            displayPercent = Math.min(75 + Math.round(rawPercent * 0.20), 95);
            message = `Downloading audio (${Math.round(rawPercent)}%)...`;
          }
        } else {
          displayPercent = Math.min(Math.round(rawPercent * 0.95), 95);
          message = `Downloading (${Math.round(rawPercent)}%)...`;
        }

        onProgress({
          percent: displayPercent,
          rawPercent,
          speed,
          size,
          eta,
          stage: 'downloading',
          message,
        });
      }
    };

    proc.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          parseLine(line.trim());
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          parseLine(line.trim());
        }
      }
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);

      if (code !== 0) {
        console.error('Download process exited with code', code, stderrBuffer);
        return reject(new Error('Download or processing failed. Please try again.'));
      }

      if (typeof onProgress === 'function') {
        onProgress({
          percent: 100,
          speed: '',
          size: '',
          eta: '',
          stage: 'completed',
          message: 'Download complete!',
        });
      }

      if (fs.existsSync(outputPath)) {
        return resolve(outputPath);
      }

      const baseNoExt = outputPath.replace(/\.[^/.]+$/, '');
      const possibleFiles = [
        `${baseNoExt}.${format}`,
        `${baseNoExt}.temp.${format}`,
        outputPath,
      ];

      for (const p of possibleFiles) {
        if (fs.existsSync(p)) {
          return resolve(p);
        }
      }

      reject(new Error('Processing failed: output file not found.'));
    });
  });

  return {
    proc,
    promise,
  };
}

module.exports = {
  getVideoInfo,
  downloadMedia,
  sanitizeFilename,
};

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const downloader = require('./downloader');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_VIDEO_DURATION = parseInt(process.env.MAX_VIDEO_DURATION || '7200', 10);
const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT || '1800000', 10);

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// In-memory store for active downloads and progress tracking
const activeDownloads = new Map();

// Periodic cleanup of stale jobs (> 30 mins)
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of activeDownloads.entries()) {
    if (now - job.createdAt > 1800000) {
      if (job.filePath) safeUnlink(job.filePath);
      activeDownloads.delete(id);
    }
  }
}, 300000);

// Middleware
app.use(cors());
app.use(express.json());

// YouTube URL validation
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?.*v=|shorts\/|live\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!YOUTUBE_REGEX.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    return host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be';
  } catch {
    return false;
  }
}

function safeUnlink(filePath) {
  try {
    if (!filePath) return;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const baseNoExt = filePath.replace(/\.[^/.]+$/, '');
    const dir = path.dirname(filePath);
    const baseName = path.basename(baseNoExt);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith(baseName) && file !== '.gitkeep') {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch {}
        }
      }
    }
  } catch (err) {
    // Ignore cleanup error
  }
}

// API: Get Video Info
app.post('/api/info', async (req, res) => {
  const { url } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  }

  try {
    const info = await downloader.getVideoInfo(url.trim(), MAX_VIDEO_DURATION);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message || 'This video is unavailable.' });
  }
});

// API: Start Download with Real-Time Progress Tracking
app.post('/api/download/start', async (req, res) => {
  const { url, format, quality, title: passedTitle } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  }

  const normalizedFormat = (format || 'mp4').toLowerCase();
  if (normalizedFormat !== 'mp4' && normalizedFormat !== 'mp3') {
    return res.status(400).json({ error: 'This format or quality is not available.' });
  }

  const downloadId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const tempFilename = `media-${Date.now()}-${downloadId.slice(0, 8)}.${normalizedFormat}`;
  const tempFilePath = path.join(downloadsDir, tempFilename);

  const job = {
    id: downloadId,
    percent: 0,
    speed: '',
    size: '',
    eta: '',
    stage: 'starting', // starting | downloading | processing | ready | error
    message: 'Starting download...',
    error: null,
    filePath: tempFilePath,
    fileName: `video.${normalizedFormat}`,
    listeners: new Set(),
    createdAt: Date.now(),
    proc: null,
  };

  activeDownloads.set(downloadId, job);

  // Return downloadId immediately to client
  res.json({ downloadId });

  // Run download asynchronously
  (async () => {
    try {
      let title = passedTitle || 'video';
      if (!passedTitle) {
        try {
          const info = await downloader.getVideoInfo(url.trim(), MAX_VIDEO_DURATION);
          if (info.title) title = info.title;
        } catch {
          // Fallback title
        }
      }

      const sanitizedBase = downloader.sanitizeFilename(title);
      job.fileName = `${sanitizedBase}.${normalizedFormat}`;

      const { proc, promise } = downloader.downloadMedia({
        url: url.trim(),
        format: normalizedFormat,
        quality: quality || '720p',
        outputPath: tempFilePath,
        timeout: DOWNLOAD_TIMEOUT,
        onProgress: (p) => {
          job.percent = p.percent;
          job.speed = p.speed || job.speed;
          job.size = p.size || job.size;
          job.eta = p.eta || job.eta;
          job.stage = p.stage;
          job.message = p.message || job.message;

          // Notify SSE listeners
          const payload = JSON.stringify({
            percent: job.percent,
            speed: job.speed,
            size: job.size,
            eta: job.eta,
            stage: job.stage,
            message: job.message,
          });

          for (const listener of job.listeners) {
            listener.write(`data: ${payload}\n\n`);
          }
        },
      });

      job.proc = proc;
      const createdFile = await promise;
      job.filePath = createdFile;
      job.stage = 'ready';
      job.percent = 100;
      job.message = '✓ Download complete!';

      const finalPayload = JSON.stringify({
        percent: 100,
        speed: '',
        size: job.size,
        eta: '',
        stage: 'ready',
        message: '✓ Download complete!',
        downloadUrl: `/api/download/file/${downloadId}`,
      });

      for (const listener of job.listeners) {
        listener.write(`data: ${finalPayload}\n\n`);
        listener.end();
      }
      job.listeners.clear();
    } catch (err) {
      console.error('Job error:', err.message);
      job.stage = 'error';
      job.error = err.message || 'Download failed. Please try again.';
      safeUnlink(job.filePath);

      const errPayload = JSON.stringify({
        stage: 'error',
        error: job.error,
      });

      for (const listener of job.listeners) {
        listener.write(`data: ${errPayload}\n\n`);
        listener.end();
      }
      job.listeners.clear();
    }
  })();
});

// API: Stream Real-Time Progress via SSE
app.get('/api/download/progress/:id', (req, res) => {
  const { id } = req.params;
  const job = activeDownloads.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Download task not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current state immediately
  const initialPayload = JSON.stringify({
    percent: job.percent,
    speed: job.speed,
    size: job.size,
    eta: job.eta,
    stage: job.stage,
    message: job.message,
    error: job.error,
    downloadUrl: job.stage === 'ready' ? `/api/download/file/${id}` : undefined,
  });
  res.write(`data: ${initialPayload}\n\n`);

  if (job.stage === 'ready' || job.stage === 'error') {
    res.end();
    return;
  }

  job.listeners.add(res);

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    job.listeners.delete(res);
  });
});

// API: Download the Prepared File
app.get('/api/download/file/:id', (req, res) => {
  const { id } = req.params;
  const job = activeDownloads.get(id);

  if (!job || job.stage !== 'ready' || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).send('File not found or not ready yet.');
  }

  const filePath = job.filePath;
  const fileName = job.fileName;

  res.download(filePath, fileName, (err) => {
    safeUnlink(filePath);
    activeDownloads.delete(id);
    if (err && !res.headersSent) {
      res.status(500).send('Error delivering file.');
    }
  });
});

// API: Direct Download (Legacy / Fallback endpoint)
app.post('/api/download', async (req, res) => {
  const { url, format, quality, title: passedTitle } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  }

  const normalizedFormat = (format || 'mp4').toLowerCase();
  if (normalizedFormat !== 'mp4' && normalizedFormat !== 'mp3') {
    return res.status(400).json({ error: 'This format or quality is not available.' });
  }

  const uniqueId = crypto.randomBytes(8).toString('hex');
  const tempFilename = `media-${Date.now()}-${uniqueId}.${normalizedFormat}`;
  const tempFilePath = path.join(downloadsDir, tempFilename);

  let createdFile = tempFilePath;
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    safeUnlink(createdFile);
  });

  try {
    let title = passedTitle || 'video';
    if (!passedTitle) {
      try {
        const info = await downloader.getVideoInfo(url.trim(), MAX_VIDEO_DURATION);
        if (info.title) title = info.title;
      } catch {
        // Fallback
      }
    }

    const sanitizedBase = downloader.sanitizeFilename(title);
    const finalDownloadName = `${sanitizedBase}.${normalizedFormat}`;

    const { promise } = downloader.downloadMedia({
      url: url.trim(),
      format: normalizedFormat,
      quality: quality || '720p',
      outputPath: tempFilePath,
      timeout: DOWNLOAD_TIMEOUT,
    });

    createdFile = await promise;

    if (clientDisconnected) {
      safeUnlink(createdFile);
      return;
    }

    res.download(createdFile, finalDownloadName, (err) => {
      safeUnlink(createdFile);
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Download failed. Please try again.' });
      }
    });
  } catch (err) {
    safeUnlink(createdFile);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed. Please try again.' });
    }
  }
});

// API: Get Network Info for Phone / LAN Access
app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!net.address.startsWith('169.254.')) {
          addresses.push({
            name,
            ip: net.address,
          });
        }
      }
    }
  }

  addresses.sort((a, b) => {
    const isPrefA = /wi-?fi|wlan/i.test(a.name) ? 2 : /ethernet|lan/i.test(a.name) ? 1 : 0;
    const isPrefB = /wi-?fi|wlan/i.test(b.name) ? 2 : /ethernet|lan/i.test(b.name) ? 1 : 0;
    return isPrefB - isPrefA;
  });

  res.json({
    addresses,
    serverPort: PORT,
  });
});

// Serve frontend in production or if client/dist exists
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Start server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`YouTube Downloader server running at http://localhost:${PORT}`);
  const interfaces = os.networkInterfaces();
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        console.log(`  - Network Access (${name}): http://${net.address}:${PORT} (UI at port 5173 during dev)`);
      }
    }
  }
});

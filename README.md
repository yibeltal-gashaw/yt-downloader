# YouTube Downloader

A simple, fast, and minimal local YouTube downloader web application for personal use. Built with React, Vite, Tailwind CSS, Express, and yt-dlp + FFmpeg.

## Features

- **Minimalist & Fast**: Single-page flow inspired by Linear/Raycast/Vercel utilities.
- **Multiple Formats**: Download high-quality MP4 (video + audio) or convert directly to MP3 (audio only).
- **Available Resolutions**: Automatically detects real resolutions (1080p, 720p, 480p, 360p).
- **Real-Time Progress**: Live percentage progress bar with speed, size, and ETA indicators.
- **Light & Dark Theme**: Built-in theme toggle with localStorage persistence.
- **Auto Cleanup**: Media files are processed in a temporary directory and deleted immediately after transfer.
- **Privacy & Safety**: Zero databases, zero telemetry, no accounts, and strictly runs locally.

---

## Requirements

- **Node.js** (v18 or newer recommended)
- **FFmpeg** (Recommended for system-wide use; fallback automated installer is included)

---

## Installation

Clone or extract the repository and install all dependencies:

```bash
npm install
```

*(This automatically installs dependencies for both client and server).*

---

## Development

Run both the frontend (Vite) and backend (Express) concurrently:

```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

---

## Production

Build the client application and start the unified server:

```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Phone / Mobile Access Over Local Network

You can access the downloader from your smartphone (iPhone, Android) over your local Wi-Fi:

1. Ensure your phone and computer are connected to the **same Wi-Fi network**.
2. Start the app with `npm run dev` (or `npm start` in production).
3. In the web interface, click the **"Use on Phone"** button in the top navbar to reveal your network URL and a **QR Code**.
4. Scan the QR code with your phone's camera, or navigate to:
   - **Dev Mode**: `http://<YOUR_LOCAL_IP>:5173` (e.g., `http://172.16.239.125:5173`)
   - **Production**: `http://<YOUR_LOCAL_IP>:3000` (e.g., `http://172.16.239.125:3000`)
5. Downloaded media files are automatically saved to your phone's storage.

---

## FFmpeg Installation

FFmpeg is used for merging video/audio streams and converting audio to MP3. While the project bundles an automated fallback, having FFmpeg on your system PATH is recommended:

### Windows
1. Using **winget**:
   ```powershell
   winget install Gyan.FFmpeg
   ```
2. Or using **Chocolatey**:
   ```powershell
   choco install ffmpeg
   ```
3. Or using **Scoop**:
   ```powershell
   scoop install ffmpeg
   ```

### macOS
Using **Homebrew**:
```bash
brew install ffmpeg
```

### Linux (Ubuntu / Debian)
Using **APT**:
```bash
sudo apt update
sudo apt install -y ffmpeg
```

Verify your installation:
```bash
ffmpeg -version
```

---

## Usage

1. Open the application in your browser.
2. Paste a YouTube URL (e.g. `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`).
3. Click **Get Video**.
4. Select your desired format (**MP4** or **MP3**) and quality.
5. Click **Download**.
6. Track live percentage progress as the file is downloaded and processed. The browser will automatically trigger file save upon completion.

> **Notice**: This tool is designed strictly for personal use to download content you own or have explicit authorization/permission to download. Do not use this application to download unauthorized copyrighted material.

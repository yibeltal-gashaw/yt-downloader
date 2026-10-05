import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X, Copy, Check, Wifi, HelpCircle } from 'lucide-react';

export default function PhoneConnectModal({ isOpen, onClose }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [selectedIp, setSelectedIp] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    fetch('/api/network-info')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch network info');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setNetworkInfo(data);
        if (data.addresses && data.addresses.length > 0) {
          // If current host is one of our IPs, default to that, else default to first
          const currentHostname = window.location.hostname;
          const match = data.addresses.find((a) => a.ip === currentHostname);
          setSelectedIp(match ? match.ip : data.addresses[0].ip);
        } else {
          setSelectedIp(window.location.hostname || '127.0.0.1');
        }
      })
      .catch((err) => {
        console.warn('Network info unavailable, falling back to local host:', err);
        if (!isMounted) return;
        setSelectedIp(window.location.hostname || '127.0.0.1');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Use current port (5173 during Vite dev, or production port)
  const currentPort = window.location.port ? `:${window.location.port}` : '';
  const phoneUrl = selectedIp
    ? `http://${selectedIp}${currentPort}`
    : window.location.href;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phoneUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 sm:p-7 overflow-hidden text-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Connect via Phone</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Access YouTube &amp; TikTok Downloader over your local Wi-Fi
            </p>
          </div>
        </div>

        {/* Network IP Selector (if multiple interfaces detected) */}
        {networkInfo?.addresses && networkInfo.addresses.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
              Network Connection
            </label>
            <div className="flex gap-2 flex-wrap">
              {networkInfo.addresses.map((addr) => (
                <button
                  key={addr.ip}
                  type="button"
                  onClick={() => setSelectedIp(addr.ip)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                    selectedIp === addr.ip
                      ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-500/60 dark:text-red-300'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{addr.name}: {addr.ip}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center my-4">
          <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
            {isLoading ? (
              <div className="w-48 h-48 flex items-center justify-center text-neutral-400 text-xs">
                Detecting network...
              </div>
            ) : (
              <QRCodeSVG
                value={phoneUrl}
                size={180}
                level="M"
                includeMargin={false}
                className="rounded"
              />
            )}
          </div>
          <p className="mt-2.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            Scan with phone camera or QR scanner
          </p>
        </div>

        {/* URL Box & Copy Button */}
        <div className="mt-4 flex items-center gap-2 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700">
          <span className="flex-1 px-2 text-xs font-mono truncate text-neutral-800 dark:text-neutral-200 select-all">
            {phoneUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-medium transition flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Instructions */}
        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
            How to use on phone:
          </h3>
          <ol className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5 pl-4 list-decimal">
            <li>Ensure your phone is on the <strong>same Wi-Fi</strong> network as this PC.</li>
            <li>Scan the QR code above or open the URL in Chrome or Safari.</li>
            <li>Download MP4 videos or MP3 audio directly to your phone.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

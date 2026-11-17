import React from 'react';

export const CLX_LOGO_URL = '/assets/aistudio/clx_launcher_icon_7f548a42.png';

interface ClxLogoProps {
  size?: number;
  className?: string;
  framed?: boolean;
}

/**
 * Official PT. CLX (PT. Connectivity Leads eXcellence) logo component.
 * Uses the authentic company emblem at /assets/aistudio/clx_launcher_icon_7f548a42.png.
 */
export const ClxLogoMark: React.FC<ClxLogoProps> = ({
  size = 44,
  className = '',
  framed = false,
}) => {
  if (framed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70 ${className}`}
      >
        <img
          src={CLX_LOGO_URL}
          alt="Logo PT. CLX"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <img
      src={CLX_LOGO_URL}
      alt="Logo PT. CLX"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
};

let cachedLogoDataUrl: string | null = null;

/**
 * Loads the official PT. CLX PNG logo into an offscreen canvas and returns a PNG data URL
 * suitable for embedding in jsPDF A4 documents.
 */
export async function loadClxLogoPngDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        cachedLogoDataUrl = canvas.toDataURL('image/png');
        resolve(cachedLogoDataUrl);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = CLX_LOGO_URL;
  });
}

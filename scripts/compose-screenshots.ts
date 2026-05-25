// Composite the raw 400x600 popup screenshots onto a 1280x800 branded canvas
// so the Chrome Web Store gallery uses the full image dimensions instead of
// letterboxing a tiny popup in the middle. Each screenshot gets a headline
// and subhead on the open side that highlights the feature visible in the
// popup itself.

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'screenshots', 'store', 'raw');
const OUT_DIR = path.join(ROOT, 'screenshots', 'store');

const CANVAS_W = 1280;
const CANVAS_H = 800;
const POPUP_W = 400;
const POPUP_H = 600;
const POPUP_RADIUS = 14;
const POPUP_X = CANVAS_W - POPUP_W - 96; // right side, 96px margin
const POPUP_Y = (CANVAS_H - POPUP_H) / 2; // vertically centered
const SHADOW_BLUR = 32;

interface Slide {
  raw: string;
  out: string;
  eyebrow: string;
  headline: string;
  subhead: string;
}

const slides: Slide[] = [
  {
    raw: '1-main.png',
    out: '1-main-view.png',
    eyebrow: 'Your tab library',
    headline: 'Every session,\nin one place.',
    subhead: 'Save 40 tabs for a research session, 12 for tomorrow’s standup, and the ones you pinned stay on top.',
  },
  {
    raw: '2-detail.png',
    out: '2-session-detail.png',
    eyebrow: 'Inside a session',
    headline: 'Tab groups,\nintact.',
    subhead: 'Group names, colors, and collapsed state come back exactly how you left them. One click restores the whole window.',
  },
  {
    raw: '3-recording.png',
    out: '3-recording.png',
    eyebrow: 'Live recording',
    headline: 'Capture as\nyou browse.',
    subhead: 'Hit record, follow the trail across tabs, then save the whole path — with URL dedup baked in.',
  },
  {
    raw: '4-settings.png',
    out: '4-settings.png',
    eyebrow: 'Privacy controls',
    headline: 'You decide\nwhat’s saved.',
    subhead: 'Exclude domains you never want captured — banking, mail, internal tools. Subdomains match the parent rule.',
  },
];

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function backgroundSvg(slide: Slide): string {
  const textX = 96;
  const lines = slide.headline.split('\n').map(escapeXml);
  // Headline lines stacked, then subhead beneath
  const headlineY = 320;
  const lineGap = 78;
  return `
<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15161b"/>
      <stop offset="100%" stop-color="#0c0d11"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#glow)"/>

  <!-- Brand wordmark -->
  <g transform="translate(${textX}, 200)">
    <rect x="0" y="-26" width="36" height="36" rx="9" fill="#3b82f6"/>
    <text x="46" y="2" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" font-weight="600" fill="#f4f4f5" dominant-baseline="middle">SnapTabs</text>
  </g>

  <!-- Eyebrow -->
  <text x="${textX}" y="270" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="14" font-weight="600" fill="#3b82f6" letter-spacing="2">${escapeXml(slide.eyebrow.toUpperCase())}</text>

  <!-- Headline (multi-line) -->
  ${lines
    .map(
      (line, i) =>
        `<text x="${textX}" y="${headlineY + i * lineGap}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="68" font-weight="700" fill="#f4f4f5" letter-spacing="-1.2">${line}</text>`,
    )
    .join('\n  ')}

  <!-- Subhead -->
  ${wrapSubhead(slide.subhead, textX, headlineY + lines.length * lineGap + 32, 560)}
</svg>`;
}

function wrapSubhead(text: string, x: number, startY: number, maxWidth: number): string {
  // Approximate character width for 22px sans-serif.
  const approxCharWidth = 11.2;
  const maxChars = Math.floor(maxWidth / approxCharWidth);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current ? current + ' ' : '') + w;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${startY + i * 32}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" font-weight="400" fill="#a1a1aa">${escapeXml(line)}</text>`,
    )
    .join('\n  ');
}

function roundedMaskSvg(): string {
  return `
<svg width="${POPUP_W}" height="${POPUP_H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${POPUP_W}" height="${POPUP_H}" rx="${POPUP_RADIUS}" ry="${POPUP_RADIUS}" fill="#fff"/>
</svg>`;
}

function shadowLayerSvg(): string {
  // A soft drop shadow rendered as a rounded rect with a Gaussian blur.
  return `
<svg width="${POPUP_W + SHADOW_BLUR * 2}" height="${POPUP_H + SHADOW_BLUR * 2}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${SHADOW_BLUR / 2}"/>
    </filter>
  </defs>
  <rect x="${SHADOW_BLUR}" y="${SHADOW_BLUR + 8}" width="${POPUP_W}" height="${POPUP_H}" rx="${POPUP_RADIUS}" fill="rgba(0,0,0,0.55)" filter="url(#blur)"/>
</svg>`;
}

async function composeSlide(slide: Slide): Promise<void> {
  const rawPath = path.join(RAW_DIR, slide.raw);
  const outPath = path.join(OUT_DIR, slide.out);
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw screenshot missing: ${rawPath}. Run capture first.`);
  }

  // Round the popup corners.
  const popupRounded = await sharp(rawPath)
    .composite([{ input: Buffer.from(roundedMaskSvg()), blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Render shadow once per slide (size is constant; cheap).
  const shadow = await sharp(Buffer.from(shadowLayerSvg())).png().toBuffer();

  await sharp(Buffer.from(backgroundSvg(slide)))
    .composite([
      { input: shadow, top: POPUP_Y - SHADOW_BLUR, left: POPUP_X - SHADOW_BLUR },
      { input: popupRounded, top: POPUP_Y, left: POPUP_X },
    ])
    .png()
    .toFile(outPath);

  console.log(`[compose] ✓ ${slide.out}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const slide of slides) {
    await composeSlide(slide);
  }
  console.log(`[compose] Done. Listing PNGs in ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((e) => {
  console.error('[compose] Failed:', e);
  process.exit(1);
});

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
const ICON_PATH = path.join(ROOT, 'src', 'public', 'icon', '128.png');

const CANVAS_W = 1280;
const CANVAS_H = 800;
const POPUP_W = 400;
const POPUP_H = 600;
const POPUP_RADIUS = 14;
const POPUP_X = CANVAS_W - POPUP_W - 96; // right side, 96px margin
const POPUP_Y = (CANVAS_H - POPUP_H) / 2; // vertically centered (= 100)
const SHADOW_BLUR = 32;

// Text column geometry
const TEXT_X = 96;
const TEXT_MAX_W = POPUP_X - TEXT_X - 56; // breathing room before popup
const LOGO_SIZE = 44;
const WORDMARK_SIZE = 22;
const EYEBROW_SIZE = 13;
const HEADLINE_SIZE = 64;
const HEADLINE_LINE_H = 76;
const SUBHEAD_SIZE = 21;
const SUBHEAD_LINE_H = 32;

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

function wrapText(text: string, maxWidth: number, approxCharWidth: number): string[] {
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
  return lines;
}

// Render the text block as one <g> translated to vertically center the
// whole stack against the popup, so the headline aligns with popup center
// rather than floating in the upper third.
function backgroundSvg(slide: Slide): string {
  const headlineLines = slide.headline.split('\n').map(escapeXml);
  const subheadLines = wrapText(slide.subhead, TEXT_MAX_W, 10.8).map(escapeXml);

  // Vertical layout, offsets measured from the top of the text block (y=0).
  const brandTop = 0;
  const eyebrowGap = 34; // from brand bottom
  const headlineGap = 22; // from eyebrow bottom
  const subheadGap = 28; // from last headline baseline

  const brandBottom = brandTop + LOGO_SIZE;
  const eyebrowBaseline = brandBottom + eyebrowGap + EYEBROW_SIZE; // baseline
  const headlineFirstBaseline = eyebrowBaseline + headlineGap + HEADLINE_SIZE * 0.78;
  const headlineLastBaseline = headlineFirstBaseline + (headlineLines.length - 1) * HEADLINE_LINE_H;
  const subheadFirstBaseline = headlineLastBaseline + subheadGap + SUBHEAD_SIZE * 0.4;
  const subheadLastBaseline = subheadFirstBaseline + (subheadLines.length - 1) * SUBHEAD_LINE_H;

  // Treat brand-top as the block top and last subhead baseline + descender as bottom.
  const blockHeight = subheadLastBaseline + SUBHEAD_SIZE * 0.3 - brandTop;
  // Vertically center against the popup, not the canvas, so they read together.
  const blockTop = POPUP_Y + (POPUP_H - blockHeight) / 2;

  const wordmarkX = LOGO_SIZE + 14;
  const wordmarkY = LOGO_SIZE / 2; // local; we use dominant-baseline=middle

  const headlineSvg = headlineLines
    .map(
      (line, i) =>
        `<text x="0" y="${headlineFirstBaseline + i * HEADLINE_LINE_H}" font-family="${FONT_FAMILY}" font-size="${HEADLINE_SIZE}" font-weight="700" fill="#f4f4f5" letter-spacing="-1.4">${line}</text>`,
    )
    .join('\n    ');

  const subheadSvg = subheadLines
    .map(
      (line, i) =>
        `<text x="0" y="${subheadFirstBaseline + i * SUBHEAD_LINE_H}" font-family="${FONT_FAMILY}" font-size="${SUBHEAD_SIZE}" font-weight="400" fill="#a1a1aa">${line}</text>`,
    )
    .join('\n    ');

  return `
<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15161b"/>
      <stop offset="100%" stop-color="#0c0d11"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#glow)"/>

  <!-- Text block, vertically centered against the popup. The real icon
       PNG is composited on top of this group at (TEXT_X, blockTop) and
       sized LOGO_SIZE x LOGO_SIZE. -->
  <g transform="translate(${TEXT_X}, ${blockTop})">
    <!-- Wordmark — placeholder offset for the icon PNG -->
    <text x="${wordmarkX}" y="${wordmarkY}" font-family="${FONT_FAMILY}" font-size="${WORDMARK_SIZE}" font-weight="600" fill="#f4f4f5" dominant-baseline="middle">SnapTabs</text>

    <!-- Eyebrow -->
    <text x="0" y="${eyebrowBaseline}" font-family="${FONT_FAMILY}" font-size="${EYEBROW_SIZE}" font-weight="700" fill="#60a5fa" letter-spacing="2.4">${escapeXml(slide.eyebrow.toUpperCase())}</text>

    <!-- Headline -->
    ${headlineSvg}

    <!-- Subhead -->
    ${subheadSvg}
  </g>
</svg>`;
}

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Returns the top-left coordinates where the real icon PNG should be
// composited so it visually replaces the missing logomark in the SVG.
function logoPosition(blockTopAbs: number): { top: number; left: number; size: number } {
  return { top: blockTopAbs, left: TEXT_X, size: LOGO_SIZE };
}

// Recompute the same blockTop the background SVG used, given the slide,
// so the composited PNG icon lands exactly on the wordmark row.
function computeBlockTop(slide: Slide): number {
  const headlineLines = slide.headline.split('\n');
  const subheadLines = wrapText(slide.subhead, TEXT_MAX_W, 10.8);
  const brandTop = 0;
  const eyebrowGap = 34;
  const headlineGap = 22;
  const subheadGap = 28;
  const brandBottom = brandTop + LOGO_SIZE;
  const eyebrowBaseline = brandBottom + eyebrowGap + EYEBROW_SIZE;
  const headlineFirstBaseline = eyebrowBaseline + headlineGap + HEADLINE_SIZE * 0.78;
  const headlineLastBaseline = headlineFirstBaseline + (headlineLines.length - 1) * HEADLINE_LINE_H;
  const subheadFirstBaseline = headlineLastBaseline + subheadGap + SUBHEAD_SIZE * 0.4;
  const subheadLastBaseline = subheadFirstBaseline + (subheadLines.length - 1) * SUBHEAD_LINE_H;
  const blockHeight = subheadLastBaseline + SUBHEAD_SIZE * 0.3 - brandTop;
  return POPUP_Y + (POPUP_H - blockHeight) / 2;
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

  // Use the real SnapTabs icon (the production 128x128 PNG) as the logomark
  // next to the wordmark, instead of a flat blue square drawn in the SVG.
  const logoPng = await sharp(ICON_PATH).resize(LOGO_SIZE, LOGO_SIZE).png().toBuffer();
  const logo = logoPosition(computeBlockTop(slide));

  const svg = backgroundSvg(slide);
  if (process.env.DUMP_SVG) {
    fs.writeFileSync(path.join(OUT_DIR, slide.out.replace(/\.png$/, '.svg')), svg);
  }
  await sharp(Buffer.from(svg))
    .composite([
      { input: logoPng, top: Math.round(logo.top), left: logo.left },
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

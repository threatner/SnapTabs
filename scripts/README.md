# scripts/

Standalone scripts for repo-level tasks (not part of the extension build).

## Chrome Web Store screenshot pipeline

Generates the 1280×800 listing images for the Chrome Web Store gallery in one command. Designed to be re-run every release so the screenshots reflect the latest UI without manual capture.

```bash
npm run screenshots
```

Runs three steps:

1. `npm run build` — produces `.output/chrome-mv3/` from current source.
2. `npm run screenshots:capture` (`scripts/capture-screenshots.ts`) — launches Chromium with the built extension, seeds the realistic demo data from `scripts/demo-data.ts` into `chrome.storage`, navigates the popup through four views, and writes raw 400×600 PNGs into `screenshots/store/raw/`.
3. `npm run screenshots:compose` (`scripts/compose-screenshots.ts`) — composites each raw popup onto a 1280×800 branded canvas with a feature-specific headline and subhead on the open side, soft drop shadow, and rounded corners. Writes final PNGs into `screenshots/store/`.

You can run each step independently if needed (e.g. iterate on the compose step's visual treatment without re-launching the browser).

### The four views captured

| Output | View | Highlights |
|---|---|---|
| `1-main-view.png` | Main popup, 8 sessions seeded | Pinned session at top, tab-group chips, mix of manual + auto-save badges |
| `2-session-detail.png` | Project Phoenix detail | Two colored tab groups (Specs purple, Code blue), real-looking tab titles |
| `3-recording.png` | Live recording active | Red REC bar with elapsed timer, recent-tabs preview, session list visible below |
| `4-settings.png` | Settings scrolled to Snapshot section | Excluded-domain chips visible (mail, bank, 1password, internal.acme.com), v1.5.0 pill |

### Changing the demo content

All seed data lives in `scripts/demo-data.ts`:

- `buildDemoSessions(now?)` — array of 8 sessions. Timestamps are computed relative to `now` (defaults to capture time) so the "Just now / 23h ago / 2d ago" displays stay fresh release after release.
- `demoSettings` — feature-rich settings with excluded domains populated and all auto-save toggles on.
- `buildDemoRecording()` — recording state computed at runtime (the elapsed timer is live, so a static timestamp would render `-N:NN` once the source file ages).

When you add a new feature worth showcasing, either:
- Extend `demo-data.ts` and `compose-screenshots.ts`'s `slides` array to add a fifth screenshot (CWS allows up to 5), or
- Replace one of the existing four if the new feature deserves the spot more than what's there.

### Visual treatment

The canvas styling lives entirely in `compose-screenshots.ts`:

- Background: dark linear gradient (#15161b → #0c0d11) with a subtle blue radial glow in the upper-left
- Brand row at the top of the text column: SnapTabs wordmark in a blue rounded-square logomark
- Eyebrow text (blue, uppercase, letter-spaced) — short category label
- Headline (68px, semi-bold, white) — up to two lines
- Subhead (22px, regular, muted) — wraps to ~50 chars per line
- Popup: positioned 96px from the right edge, vertically centered, 14px corner radius, soft 32px Gaussian shadow

To restyle: edit the `backgroundSvg`, `roundedMaskSvg`, and `shadowLayerSvg` helpers and the layout constants at the top of the file.

### Release checklist

See [`STORE_LISTING.md` → Release checklist](../STORE_LISTING.md#release-checklist) for the end-to-end flow from "code is ready" to "submitted to CWS for review".

## Promo tile pipeline

The CWS small (440×280) and marquee (1400×560) promo tiles are SVG-source:

```bash
npm run promo
```

Edit `src/assets/promo-small.svg` and `src/assets/promo-marquee.svg`, then re-run.

# scripts/

Standalone scripts for repo-level tasks (not part of the extension build).

## Chrome Web Store screenshot pipeline

Generates the 1280×800 listing images for the Chrome Web Store gallery in one command. Designed to be re-run every release so the screenshots reflect the latest UI without manual capture.

```bash
npm run screenshots
```

Runs three steps:

1. `npm run build` — produces `.output/chrome-mv3/` from current source.
2. `npm run screenshots:capture` (`scripts/capture-screenshots.ts`) — launches Chromium with the built extension, seeds the realistic demo data from `scripts/demo-data.ts` into `chrome.storage`, navigates the popup through five views, and writes raw 400×600 PNGs into `screenshots/store/raw/`.
3. `npm run screenshots:compose` (`scripts/compose-screenshots.ts`) — composites each raw popup onto a 1280×800 branded canvas with a feature-specific headline and subhead on the open side, soft drop shadow, and rounded corners. Writes final PNGs into `screenshots/store/`.

You can run each step independently if needed (e.g. iterate on the compose step's visual treatment without re-launching the browser).

### The five views captured

| Output | View | Highlights |
|---|---|---|
| `1-restore.png` | Main popup, 10 sessions seeded | Every card with its Restore button, pinned session on top, Rolling backup and a closed group |
| `2-how-it-works.png` | Guide (`welcome.html?from=help`) at 400×600 | The three steps with replicas of the Snapshot and Restore buttons |
| `3-tab-groups.png` | Project Phoenix detail | Two coloured tab groups (Specs purple, Code blue), favicons from the local cache |
| `4-safety-nets.png` | Main popup with only the automatic saves | Rolling backup, "Work (closed group)", Browser close |
| `5-search.png` | Main popup, search "phoenix" | Matches across sessions |

### Changing the demo content

All seed data lives in `scripts/demo-data.ts`:

- `buildDemoSessions(now?)` — array of 9 sessions (including the rolling backup). Timestamps are computed relative to `now` (defaults to capture time) so the "Just now / 23h ago / 2d ago" displays stay fresh release after release.
- `demoSettings` — feature-rich settings with excluded domains populated and all auto-save toggles on.
- `buildDemoRecording()` — recording state computed at runtime (the elapsed timer is live, so a static timestamp would render `-N:NN` once the source file ages).

When you add a new feature worth showcasing, either:
- Replace one of the existing five (CWS allows at most 5) if the new feature deserves the spot more than what's there. The capture script also seeds a dismissed rating prompt so the one-time banner never appears in listing images.

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

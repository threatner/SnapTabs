# Changelog

All notable changes to SnapTabs are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-04-24

### Changed

- **Auto-snapshot on browser close now defaults to OFF.** Turn it on in `Settings > Auto-Save` whenever you want browser-close snapshot behaviour. Nothing is written to storage without an explicit opt-in from the user. The feature and UI are unchanged; only the default flipped.

### Added

- "Latest version" row in the README at-a-glance table. The Chrome Web Store shield badge at the top still auto-updates from the live store version; this row gives visitors the current source version without waiting for CWS review.

## [1.3.0] - 2026-04-24

### Added

- **Auto-snapshot on browser close.** When the last Chrome window closes, SnapTabs saves the open tabs as an auto-session named `Browser close - <date>`. Multi-window `Cmd+Q` is captured as a single combined session via a pending-close buffer with a 5-second staleness window.
- **Chrome Web Store promo tiles.** New 440×280 small promo tile (what CWS uses in search autocomplete, and whose absence is why the listing showed name-only) and 1400×560 marquee tile. SVG sources live in `src/assets/promo-*.svg`; `npm run promo` rerenders the PNGs into `screenshots/store/`.
- `STORE_LISTING.md` as the source of truth for Chrome Web Store copy and assets.

### Changed

- Extension name uses a hyphen instead of an em-dash: `SnapTabs - Save & Restore Browser Tabs`.
- `package.json` and `wxt.config.ts` descriptions reworded and em-dashes removed.
- README rewritten around SEO/GEO patterns: definition block up front, at-a-glance facts table, FAQ with seven natural-language questions, specific numbers, comparison against Chrome's built-in history.
- `CLAUDE.md` updated for every shipped feature, new storage keys, new message actions, and an accurate test count (81).

### Internal

- In-memory tab cache now covers every window (previously incognito-only) so closed-window tabs remain accessible inside `chrome.windows.onRemoved`.
- Pending-close buffer persisted to `chrome.storage.session` so service-worker restarts mid-close do not drop the accumulated tabs.

## [1.2.0] - 2026-04-23

### Added

- **Session pinning.** Pin sessions from the card context menu or the detail-view toolbar. Pinned sessions sort to the top of the list and are never pruned when storage fills up.
- **Omnibox search.** Type `st` in Chrome's address bar, press space, then a query, to fuzzy-search tab titles and URLs across every saved session without opening the popup. Enter opens the selected tab; raw text with no selection falls back to a Google search.

### Changed

- `getSessions()` returns results sorted pinned-first, then by timestamp descending.
- `enforceLimit()` now skips pinned sessions when pruning, preferring auto-saves first and never removing pinned entries. If everything prunable is pinned, the limit becomes a soft cap.

## [1.1.0] - 2026-04-23

### Added

- **Import / Export sessions as JSON.** Download every session as `snaptabs-export-YYYY-MM-DD.json` or load from a previous export. Import handles ID collisions by renaming on conflict and skips exact re-imports (same `id + timestamp`).
- Settings page polish:
  - Storage usage card nested under the Storage section; bar turns amber past 80% usage.
  - Version pill in the Settings header.
  - New "Data" section with Export and Import buttons side by side.
- Warmer first-run empty state with a primary-tinted icon, bolded CTA words, and a gently bouncing arrow pointing at the Snapshot button.
- Session-card hover gains a 3 px primary-color left-edge accent, a chevron nudge, and an active state, so cards feel clickable.

## [1.0.0] - 2026-03-15

### Added

- Initial Chrome Web Store release.
- One-click snapshot of the current window or every open window, with optional custom name and timestamp-based auto-naming.
- Tab group preservation: group name, color, and collapsed state are captured and restored.
- Incognito support with proactive tab caching so tabs are captured before the window closes.
- Optional auto-save when an incognito window closes.
- Live recording: captures each new tab as it opens, with URL deduplication and a pulsing badge indicator.
- Session restore to the current window or a new window, with optional auto-delete after restore.
- Real-time search across session names, tab titles, and URLs.
- Storage management: 10 MB quota, configurable max-sessions limit from 1 to 500, automatic pruning of oldest auto-saves, visual usage bar in Settings.
- Keyboard shortcut `Alt+Shift+S` to snapshot without opening the popup.
- Right-click "Save all tabs with SnapTabs" context menu on the toolbar icon.
- Manifest V3, Chrome 93+, four minimum-necessary permissions (`tabs`, `tabGroups`, `storage`, `contextMenus`).
- All data stored locally in `chrome.storage.local`. No cloud sync, no analytics, no outbound network requests.

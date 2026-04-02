# SnapTabs — Save & Restore Browser Tabs

> Chrome tab manager that snapshots and restores your tabs — including tab groups, pinned tabs, and incognito tabs.

Too many tabs open? SnapTabs saves your entire browser session with one click so you can close everything and restore it later. Unlike other tab managers, SnapTabs preserves **tab group names and colors**, captures **incognito tabs**, and supports **live recording** of browsing sessions.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/cgkpmhbpejmdjgeipmkbihbjcniflpnl)](https://chromewebstore.google.com/detail/snaptabs-%E2%80%94-save-restore-b/cgkpmhbpejmdjgeipmkbihbjcniflpnl)

## Features

- **Snapshot tabs** — Save all open tabs from the current window or all windows with one click
- **Tab group support** — Preserves tab group names, colors, and collapsed state
- **Incognito support** — Captures incognito tabs (with extension enabled in incognito mode) and restores them to incognito windows
- **Live recording** — Record new tabs as they open, then save the session
- **Auto-save** — Optionally auto-save incognito tabs when an incognito window closes
- **Search** — Filter saved sessions by name, tab title, or URL
- **Keyboard shortcut** — `Alt+Shift+S` to snapshot all tabs instantly
- **Context menu** — Right-click the extension icon to save all tabs
- **Storage management** — Automatic pruning of old sessions, configurable limits, storage usage display

## Screenshots

| Main View | Session Detail | Settings |
|---|---|---|
| ![Main popup view](screenshots/popup-main.png) | ![Session detail with tab groups](screenshots/tab-detail.png) | ![Settings view](screenshots/settings.png) |

## Install

### Chrome Web Store

**[Install SnapTabs from the Chrome Web Store](https://chromewebstore.google.com/detail/snaptabs-%E2%80%94-save-restore-b/cgkpmhbpejmdjgeipmkbihbjcniflpnl)**

### From Source

```bash
git clone https://github.com/rc22-rahul/SnapTabs.git
cd snaptabs
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

## Development

```bash
npm run dev            # Start dev server with hot reload
npm run build          # Production build
npm run zip            # Package for distribution
npm test               # Run unit tests
npm run test:watch     # Run unit tests in watch mode
npm run test:coverage  # Run unit tests with coverage
npm run test:e2e       # Run E2E tests (requires build first)
npm run test:e2e:debug # Run E2E tests in debug mode
```

## Tech Stack

- [Svelte 5](https://svelte.dev) — UI framework
- [WXT](https://wxt.dev) — Extension framework (Manifest V3)
- [Tailwind CSS 4](https://tailwindcss.com) — Styling
- [TypeScript](https://www.typescriptlang.org) — Type safety
- [Vitest](https://vitest.dev) — Unit testing
- [Playwright](https://playwright.dev) — E2E testing

## Architecture

```
Popup (Svelte UI)  ──sendMessage──►  Background (Service Worker)
                                          │
                                     Chrome APIs
                                   (tabs, windows,
                                    storage, tabGroups)
```

All tab-creating operations go through the background service worker. The popup sends messages and receives responses — it never calls `chrome.tabs.create()` directly, because the popup closes the instant Chrome creates or focuses a tab.

Data is stored locally using `chrome.storage.local` (persistent) and `chrome.storage.session` (ephemeral). Nothing is sent to external servers.

## Project Structure

```
src/
├── assets/             # SVG icon source
├── components/         # Svelte UI components
├── entrypoints/
│   ├── background.ts   # Service worker (message handler, events)
│   └── popup/          # Extension popup (Svelte app)
├── lib/
│   ├── types.ts        # Interfaces, constants, helpers
│   ├── storage.ts      # Chrome storage CRUD
│   └── tabs.ts         # Tab capture/restore logic
└── public/
    └── icon/           # Extension icons (16, 32, 48, 128 PNG)
tests/                  # Unit tests (Vitest)
├── setup.ts            # Chrome API mocks
├── types.test.ts
├── storage.test.ts
└── tabs.test.ts
e2e/                    # E2E tests (Playwright)
├── playwright.config.ts
├── fixtures/           # Browser + extension launch fixture
├── helpers/            # Storage seeding utilities
└── tests/              # Test specs (9 files, 54 tests)
```

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Query and create tabs for snapshot and restore |
| `tabGroups` | Read and recreate tab group names, colors, and state |
| `storage` | Persist sessions and settings locally |
| `contextMenus` | Right-click "Save all tabs" option |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

SnapTabs stores all data locally on your device. No data is sent to external servers. See [PRIVACY.md](PRIVACY.md) for details.

## License

[MIT](LICENSE)

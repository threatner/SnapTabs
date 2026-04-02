# Contributing to SnapTabs

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/rc22-rahul/SnapTabs.git
cd snaptabs
npm install
npm run dev
```

This starts the WXT dev server with hot reload. Load the extension from `.output/chrome-mv3` in `chrome://extensions` with Developer mode enabled.

## Running Tests

### Unit Tests

```bash
npm test               # Run once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### E2E Tests

E2E tests use Playwright to launch real Chromium with the extension loaded. They open actual websites, take snapshots, restore sessions, and verify recording — testing the full extension end-to-end.

```bash
npm run build          # Build the extension first
npm run test:e2e       # Run E2E tests
npm run test:e2e:debug # Run in debug mode (step through tests)
```

E2E tests run headed (Chrome extensions cannot run headless). The `e2e/` directory and `@playwright/test` are dev-only — they are never included in the extension build.

## Project Conventions

- **Svelte 5** — Do not use `$effect` (causes infinite loops in this codebase). Use `$derived` or `$derived.by()` instead. Do not use `$bindable`.
- **Message passing** — All tab-creating operations must go through the background service worker via `chrome.runtime.sendMessage()`. Never call `chrome.tabs.create()` from the popup.
- **URL filtering** — Use `isRestorable()` from `src/lib/tabs.ts` to check if a URL can be restored.
- **Storage** — Use the functions in `src/lib/storage.ts`, not raw `chrome.storage` calls.
- **Styling** — Tailwind CSS 4 with oklch color space. Theme variables are in `src/entrypoints/popup/style.css`.

## Updating Icons

The SVG source is `src/assets/icon.svg`. After editing, regenerate PNGs:

```bash
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/128.png -- resize 128 128
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/48.png -- resize 48 48
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/32.png -- resize 32 32
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/16.png -- resize 16 16
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Add tests for new functionality
3. Make sure `npm test`, `npm run build`, and `npm run test:e2e` pass
4. Open a PR with a clear description of the change

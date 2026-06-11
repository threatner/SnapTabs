# Chrome Web Store listing

Source of truth for the SnapTabs listing copy **and** promotional assets. Update this file first, then upload to the Chrome Web Store Developer Dashboard.

---

## Required assets

The Chrome Web Store uses different images in different surfaces. Missing any of these causes the listing to render incompletely (for example, name-only in search autocomplete with no icon).

| Asset | Size | Source (in repo) | Dashboard field | Used by |
|---|---|---|---|---|
| Extension icon | 128×128 | `src/public/icon/128.png` | Manifest icon (auto) | Detail page, install button |
| Small promo tile | **440×280** | `screenshots/store/promo-small-440x280.png` | "Small promo tile" | **Search autocomplete**, category lists, related items |
| Marquee promo tile | 1400×560 | `screenshots/store/promo-marquee-1400x560.png` | "Marquee promo tile" | Featured placement, homepage carousel |
| Screenshots (up to 5) | 1280×800 | `screenshots/store/1-main-view.png`, etc. | "Screenshots" | Detail page gallery |

**If your listing shows the name with no icon in search suggestions, the small promo tile is most likely missing.** Upload `promo-small-440x280.png` in the dashboard under *Store listing → Graphic assets → Small promo tile*.

### Regenerating promo tiles

The SVG sources are in `src/assets/promo-small.svg` and `src/assets/promo-marquee.svg`. Edit them, then run:

```bash
npm run promo
```

This rasterizes both PNGs into `screenshots/store/`.

### Upload steps

1. Go to https://chrome.google.com/webstore/devconsole
2. Open the SnapTabs item → **Store listing** tab
3. Scroll to **Graphic assets**
4. Upload the small promo tile (440×280) and marquee promo tile (1400×560)
5. Replace screenshots if the UI has changed
6. Click **Save draft** then **Submit for review**

Reviews typically take 1-3 business days.

---

## Release checklist

Run through this for every CWS submission so the listing never lags the source again.

1. **Bump version** in `package.json` and update `CHANGELOG.md` with the new entry.
2. **Run tests + build**: `npm test` and `npm run build` both clean.
3. **Regenerate listing screenshots**: `npm run screenshots` (builds, captures four popup views with the realistic demo data in `scripts/demo-data.ts`, composites onto branded 1280×800 canvases in `screenshots/store/`). Visually skim each PNG. If a new feature deserves a screenshot, edit `scripts/demo-data.ts` and add a slide in `scripts/compose-screenshots.ts`.
4. **Regenerate promo tiles only if the SVGs changed**: `npm run promo`.
5. **Update the listing copy** below (long description, features, FAQ) to reflect any new features in this release.
6. **Build the upload zip**: `npm run zip` → produces `.output/snaptabs-<version>-chrome.zip`.
7. **Upload to the CWS Developer Dashboard**:
   - Item page → Package tab → upload the new zip.
   - Store listing tab → Graphic assets → re-upload the 4 screenshots from `screenshots/store/`.
   - Store listing tab → paste the updated long description / features / FAQ from this file.
   - Save draft, then Submit for review.
8. **Merge the release PR** to `main` once submitted.

---

## Name (45 char max)

SnapTabs - Save & Restore Browser Tabs

## Summary / short description (132 char max)

Save, restore, and organize Chrome tabs. Tab groups, incognito, live recording, crash-safe auto-save. Local only.

## Category

Productivity

---

## Long description

SnapTabs saves every tab in your Chrome window with one click so you can close everything and bring it back later.

Open 40 tabs for a research session, save them, close them. Open 12 tabs for tomorrow's standup, save them, close them. Now your browser is quiet and nothing is lost. When you need them, one click restores every tab, pinned, grouped, and in the right window.

Unlike other tab managers, SnapTabs keeps tab group names and colors intact, captures incognito tabs, and auto-saves your session when you quit Chrome — with a recovery-snapshot fallback so a crash or an aggressive browser shutdown doesn't cost you your work.

Everything lives on your device. No accounts. No cloud sync. No network requests.

## Features

**One-click snapshot**
Save the current window or every open window. Name the session, or let SnapTabs timestamp it. Restore from the popup or the right-click menu.

**Duplicate snapshot warning**
About to save tabs that match your most recent session? SnapTabs asks before creating a copy. Compares URL sets, ignoring order, fragments, and trailing slashes. Turn off in Settings if you'd rather every click save unconditionally.

**Tab groups, preserved**
Group names, group colors, collapsed state. All of it comes back exactly how you left it — on manual snapshots and on auto-saves when you quit the browser.

**Incognito support**
Flip the switch in Chrome to let SnapTabs run in incognito, and your private tabs are captured and restored to an incognito window automatically.

**Auto-snapshot on browser close**
Turn it on in Settings, and the next time you quit Chrome with Cmd+Q or close the last window, your tabs are captured as a "Browser close" session. Multi-window quits are combined into a single session. If the browser kills the extension during shutdown (more common in Brave than Chrome), SnapTabs falls back to a recovery snapshot kept on disk, so your tabs come back on next launch either way. Off by default so nothing is saved without your explicit opt-in.

**Excluded domains**
List domains you never want captured — banking, email, internal tools. Tabs from those domains are skipped in snapshots, recordings, and auto-saves. Subdomains match the parent rule, so adding `github.com` also excludes `api.github.com`.

**Session pinning**
Pin the sessions you rely on. Pinned sessions stay at the top of the list and are never pruned, even when storage fills up.

**Live recording**
Hit record, start browsing. Every new tab you open is captured in real time with URL dedup, so you can stop recording whenever the research trail ends and save the whole path.

**Omnibox search**
Type `st` in Chrome's address bar, press space, type a query. SnapTabs searches every tab across every saved session and opens the one you pick. No popup, no clicks.

**Import and export**
Download every session as a JSON file for backup or to move to another computer. Load the file on the other side and everything is restored, with duplicate-import handling built in.

**Search and sort your sessions**
Filter by session name, tab title, or URL — works across thousands of saved tabs. Reorder the list by newest, oldest, name, or most tabs from the sort menu next to the search box. Pinned sessions always stay on top.

**Keyboard shortcut**
`Alt+Shift+S` saves all tabs without opening the popup.

**Flexible restore**
Restore into the current window or a fresh one. Auto-delete the session after restore, or keep it. Incognito tabs go to an incognito window when the setting is on.

**Storage built in**
10 MB quota, visible progress bar, configurable session limit from 1 to 500. Oldest auto-saves are pruned first. Pinned sessions never get pruned.

## Who it's for

- Researchers saving topic-based browsing sessions and returning to them weeks later
- Developers juggling three project workspaces in parallel
- Students organizing readings by subject instead of by "which tab was I on"
- Anyone who has 60+ tabs open right now and feels it

## Privacy

- All data stays on your device
- No cloud sync, no backend service
- No analytics, no tracking, no outbound requests
- No account required
- Open source. Every line of code is auditable on GitHub

## Permissions (four, all minimum-necessary)

- **tabs**: read the tabs you have open, create tabs when you restore a session
- **tabGroups**: preserve and recreate tab group names and colors
- **storage**: keep sessions and settings on your device
- **contextMenus**: the "Save all tabs" item on the right-click icon menu

No network permission. No history permission. No cookie or identity access.

## FAQ

**Does SnapTabs send my browsing data anywhere?**
No. Storage is local. The extension makes zero outbound requests. You can verify this in Chrome's network inspector, or in the source on GitHub.

**What happens to my tabs if Chrome (or Brave) crashes?**
Turn on "Save on browser close" in Settings (it's off by default). While it's on, every window's tabs land in a combined "Browser close" session when the last window closes — including the multi-window Cmd+Q case. If the browser kills the extension's service worker mid-shutdown before the save lands (Brave is more aggressive about this than Chrome), SnapTabs falls back to a continuously-updated snapshot it keeps in local storage. On the next browser start, that snapshot is promoted to a "Browser close (recovered)" session. Either way your tabs come back. For critical tab sets, also take a manual snapshot (`Alt+Shift+S`) as belt-and-braces.

**Will my tab groups come back?**
Yes. Name, color, collapsed state — on manual snapshots and on browser-close auto-saves alike. Pinned tabs come back pinned. The only thing SnapTabs cannot restore is the exact window position, because Chrome does not expose that to extensions.

**Can I sync my sessions across devices?**
Not automatically. Use Settings > Data > Export to download a JSON file, then Import on the other machine.

**How big can my library get?**
10 MB local storage and up to 500 sessions, configurable. Expect to comfortably hold thousands of tabs across hundreds of sessions before hitting the cap. The Settings panel shows you a live usage bar.

**Does it work in Chromium-based browsers like Brave or Arc?**
Yes, any Chromium browser that supports Manifest V3. The v1.5.0 release specifically hardened browser-close reliability on Brave, where the extension's service worker can be terminated more aggressively during shutdown than in Chrome. Firefox requires a separate build that isn't shipped today.

**Is it really free?**
Yes. No paid tier. The code is MIT-licensed on GitHub.

## Open source

Source code: https://github.com/threatner/SnapTabs

Bug reports and feature requests: https://github.com/threatner/SnapTabs/issues

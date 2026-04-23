# Chrome Web Store listing

Source of truth for the SnapTabs listing copy. Update this file first, then paste into the Chrome Web Store dashboard.

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

Unlike other tab managers, SnapTabs keeps tab group names and colors intact, captures incognito tabs, and auto-saves your session when you quit Chrome so a crash doesn't cost you your work.

Everything lives on your device. No accounts. No cloud sync. No network requests.

## Features

**One-click snapshot**
Save the current window or every open window. Name the session, or let SnapTabs timestamp it. Restore from the popup or the right-click menu.

**Tab groups, preserved**
Group names, group colors, collapsed state. All of it comes back exactly how you left it.

**Incognito support**
Flip the switch in Chrome to let SnapTabs run in incognito, and your private tabs are captured and restored to an incognito window automatically.

**Auto-snapshot on browser close** (on by default)
Quit Chrome with Cmd+Q or close the last window. When you come back, your last session is waiting as a "Browser close" entry, ready to restore with one click. Multi-window quits are captured as a single combined session.

**Session pinning**
Pin the sessions you rely on. Pinned sessions stay at the top of the list and are never pruned, even when storage fills up.

**Live recording**
Hit record, start browsing. Every new tab you open is captured in real time with URL dedup, so you can stop recording whenever the research trail ends and save the whole path.

**Omnibox search**
Type `st` in Chrome's address bar, press space, type a query. SnapTabs searches every tab across every saved session and opens the one you pick. No popup, no clicks.

**Import and export**
Download every session as a JSON file for backup or to move to another computer. Load the file on the other side and everything is restored, with duplicate-import handling built in.

**Search inside the popup**
Filter by session name, tab title, or URL. Works on thousands of saved tabs.

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

**What happens to my tabs if Chrome crashes?**
If "Save on browser close" is enabled (default), your tabs are captured when the last window closes and saved as a "Browser close" session. Open SnapTabs after recovery and restore it.

**Will my tab groups come back?**
Yes. Name, color, collapsed state. Pinned tabs come back pinned. The only thing SnapTabs cannot restore is the exact window position, because Chrome does not expose that to extensions.

**Can I sync my sessions across devices?**
Not automatically. Use Settings > Data > Export to download a JSON file, then Import on the other machine.

**How big can my library get?**
10 MB local storage and up to 500 sessions, configurable. Expect to comfortably hold thousands of tabs across hundreds of sessions before hitting the cap. The Settings panel shows you a live usage bar.

**Does it work in Chromium-based browsers like Brave or Arc?**
Yes, any Chromium browser that supports Manifest V3. Firefox requires a separate build that isn't shipped today.

**Is it really free?**
Yes. No paid tier. The code is MIT-licensed on GitHub.

## Open source

Source code: https://github.com/threatner/SnapTabs

Bug reports and feature requests: https://github.com/threatner/SnapTabs/issues

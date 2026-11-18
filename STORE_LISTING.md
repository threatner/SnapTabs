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
| Screenshots (5) | 1280×800 | `screenshots/store/1-restore.png` … `5-search.png` | "Screenshots" | Detail page gallery |

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
3. **Regenerate listing screenshots**: `npm run screenshots` (builds, captures five popup views with the realistic demo data in `scripts/demo-data.ts`, composites onto branded 1280×800 canvases in `screenshots/store/`). Visually skim each PNG. If a new feature deserves a screenshot, edit `scripts/demo-data.ts` and add a slide in `scripts/compose-screenshots.ts`.
4. **Regenerate promo tiles only if the SVGs changed**: `npm run promo`.
5. **Update the listing copy** below (long description, features, FAQ) to reflect any new features in this release.
6. **Build the upload zip**: `npm run zip` → produces `.output/snaptabs-<version>-chrome.zip`.
7. **Upload to the CWS Developer Dashboard**:
   - Item page → Package tab → upload the new zip.
   - Store listing tab → Graphic assets → re-upload the 5 screenshots from `screenshots/store/` in file order: `1-restore`, `2-how-it-works`, `3-tab-groups`, `4-safety-nets`, `5-search` (D17; the first two matter most).
   - Store listing tab → paste `docs/growth/listing-draft.txt` into Description (see **Long description**).
   - Privacy practices tab → if the permissions changed, add a justification for each new one (see **Privacy practices tab** below).
   - Save draft, then Submit for review.
8. **Merge the release PR** to `main` once submitted.

---

## Name (45 char max)

SnapTabs - Save Tabs & Session Manager

Set by `name` in `wxt.config.ts` (the store reads it from the package); changing it needs a release.

## Summary / short description (132 char max)

Session manager and tab saver: save all open tabs in one click, restore them later with tab groups intact. Free, no account, local.

Set by `description` in `wxt.config.ts`; changing it needs a release.

## Category

Productivity › Workflow & Planning (already set in the dashboard).

## Long description

The description lives in [`docs/growth/listing-draft.txt`](docs/growth/listing-draft.txt): plain ASCII, ready to paste into the dashboard's **Description** field as is. It is the only copy; edit it there (an older copy here went stale and was removed in v1.10). Copy it to the clipboard with a UTF-8 locale so nothing gets garbled:

```bash
LANG=en_US.UTF-8 pbcopy < docs/growth/listing-draft.txt
```

## Privacy practices tab (developer dashboard)

Not shown on the listing. The dashboard's **Privacy practices** tab asks for a single-purpose statement and a justification for every permission. v1.9.0 added `alarms` and v1.10.0 adds `favicon`; paste the text below for any permission the dashboard asks about. (`alarms` shows no install-time warning, so updating users are not asked to re-approve anything and the extension is not disabled.)

**Single purpose**
> SnapTabs saves the user's open browser tabs as named sessions (including tab groups, pinned and incognito tabs) and restores them later, entirely on the user's device.

**Permission justifications**

| Permission | Justification |
|---|---|
| `tabs` | Read the URL, title, and position of open tabs to save them as a session, and create tabs to restore a saved session. |
| `tabGroups` | Read tab group names, colors, and collapsed state so they are saved with a session, and recreate the groups on restore. |
| `storage` | Store saved sessions and settings locally with chrome.storage. Nothing is synced or sent off the device. |
| `contextMenus` | Adds a "Save all tabs with SnapTabs" item to the extension icon's right-click menu. |
| `alarms` | Schedules the optional Rolling backup, which the user can turn on to refresh a local backup of their open tabs every 5 to 60 minutes. No network activity. |
| `favicon` | Shows the site icons of saved tabs from Chrome's local favicon cache, so viewing saved sessions makes no network requests. Its warning is covered by `tabs`. |

**Remote code:** No, I am not using remote code.

**Data usage:** unchanged by this release. The extension still transmits no user data. The uninstall form is a Google Form the browser opens after uninstall; anything in it is typed and submitted voluntarily by the person, and the extension attaches nothing to it.


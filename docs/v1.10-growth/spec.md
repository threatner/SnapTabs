# v1.10 growth fixes

Status: spec, as of 2026-11-18. Branch: `release/v1.10.0`. Ships in v1.10.0. Research: [ASO plan](../growth/aso-2026-11-18.md), [UX review](../growth/ux-review-2026-11-18.md).

## Why

SnapTabs is not in the top 10 for any core store search (verified 2026-11-18); title keywords and the Featured badge decide ranking at its size (verified). The listing's "zero outbound requests" claim is false today because the session detail view loads favicons from google.com and from each site (from code), which also blocks a Featured nomination. On the main list, Restore hides behind a hover-only menu (from code), and restoring into a window that already has some of the tabs duplicates them; uninstall answers mention restore trouble and ask for duplicate skipping (seen once).

## Scope

| Requirement | Acceptance criterion |
| --- | --- |
| R1. No network for favicons | Favicons in the popup come only from Chrome's local favicon cache (`/_favicon/` with the `favicon` permission). Proven by a real-browser check through a logging proxy: opening session details makes zero network requests. No new install warning (the `tabs` permission supersedes `favicon`'s, documented). |
| R2. Restore in one click | Every session card shows a visible **Restore** button (not hover-only) that restores the session. |
| R3. Skip tabs already open | Restoring into the current window skips tabs whose URL (fragment- and trailing-slash-insensitive) is already open in that window. The toast says how many were skipped ("Restored 18 tabs, 4 already open"); if every tab is already open, nothing is created and the toast says so. New windows have nothing to skip. |
| R4. New store name and summary | Manifest `name` = "SnapTabs - Save Tabs & Session Manager", `description` = "Session manager and tab saver: save all open tabs in one click, restore them later with tab groups intact. Free, no account, local." |
| R5. New gallery | `npm run screenshots` produces five 1280×800 images in the ASO order (outcome first, no Settings screenshots), each with the footer "Free - No account - Stays on your device". |
| R6. Readable small promo tile | The 440×280 tile shows only the icon, "SnapTabs" and "Save tabs. Restore later.", legible at half size. |
| R7. True privacy claims | Store listing, README and PRIVACY.md describe network use accurately after R1. |

## Not in scope

The "Save N tabs" save bar, renaming Snapshot to Save, smarter default names, regrouping Settings, a new icon, video and translations (v1.11, see the research). The marquee tile stays as is.

## Decisions

Rows added to [the register](../decisions/README.md): D14 to D17.

## Validation

| Check | Passing evidence |
| --- | --- |
| Unit | `npm run check` passes with tests for skipping already-open URLs (current window only, normalised URLs, all-open case) and the restore result counts. |
| Real browser (proxy) | Chromium launched through a local logging proxy, popup showing session details with favicons: the proxy logs no requests. |
| E2E | Cards show a Restore button that restores; restoring a session whose tabs are partly open reports the skipped count. |
| Visual | The five gallery images and the promo tile reviewed at full and half size. |
| Live check (user) | After release, the store shows the new name and summary. |

## Milestones

1. Favicons from the local cache (R1, R7). **Done 2026-11-18**: proxy check passes (0 requests to saved sites) and fails on the old code.
2. Restore button and duplicate skipping (R2, R3). **Done 2026-11-18**: 5 unit + 2 E2E tests; disabling the skip breaks 3 unit and 1 E2E test; card screenshot reviewed (long names truncate).
3. Name, summary, gallery and promo tile (R4 to R6).

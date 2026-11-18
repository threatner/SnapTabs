# UI refresh

Status: spec, as of 2026-11-18. Branch: `release/v2.0.0`. Ships in v2.0.0 together with the v1.10 work (user: "We will do a big release itself", "call it 2.0.0"). Research: [UI review](../growth/ui-review-2026-11-18.md).

## Why

The popup works, but Settings is hard to scan (7 sections, one of them a single toggle that does nothing), the styling has drifted (9 button styles, 6 corner radii, three title styles), the first save confirms twice, the session detail header squeezes the title to ~120px, and keyboard and screen-reader users miss controls that only appear on hover (from code, from screenshot).

## Scope

| Requirement | Acceptance criterion |
| --- | --- |
| R1. No dead settings | The "Incognito save warning" toggle and the `showIncognitoWarning` setting are gone (D20). The incognito notice still shows whenever an All windows snapshot includes incognito tabs. |
| R2. Settings in 4 sections + Help | Sections, in order: **Save automatically**, **Saving**, **Restoring**, **Storage & data**, **Help**; titles say what happens ("When I quit the browser"); the version sits in a footer; the two incognito rows show only when SnapTabs is allowed in incognito (D21). Every working setting is still there. |
| R3. One style system | Radius, type-size and button tokens in `style.css`; buttons use shared `.btn` / `.btn-sm` / `.icon-btn` classes; the tip and rating banners are one `Banner` component. |
| R4. Calm, readable toasts | Toasts sit at the bottom, use the card surface with a coloured icon (text contrast ≥ 4.5:1), and live in a `role="status"` region. The first manual snapshot shows the "Saved!" tip instead of a toast (D22). |
| R5. Cards | Meta reads "8 tabs · 1 window · 2h ago" with correct singulars; dates older than a week read "Nov 4" (year added when not this year); the card "…" menu has Pin, Rename, Delete (no duplicate Restore); the "…" button shows on keyboard focus; the Private badge doesn't pulse. |
| R6. Recording state | While recording: "Stop & save" is the primary button, Snapshot turns secondary, Cancel is a quiet text button, and the record toggle is hidden (one way to stop). |
| R7. Detail header in two rows | Row 1: back, name (up to two lines), "8 tabs · 1 window · saved 2h ago". Row 2: Restore (primary) and a "…" menu with Pin, Rename, Delete, the same as cards. |
| R8. Keyboard, motion, labels | One `:focus-visible` ring everywhere; `prefers-reduced-motion` stops all animation; only recording loops; record button has `aria-label` + `aria-pressed`; scope button and group headers have `aria-expanded`; the duplicate modal is `aria-modal`, closes on Escape, and focuses "Save anyway". |
| R9. Wording | Sentence case ("This window", "All windows", "Stop & save"); "the browser", not "Chrome", in descriptions; imports report "sessions"; "Clear All Data" becomes "Delete all sessions…" (quiet red text; armed state names the count). |
| R10. Header | **?**, a GitHub link and Settings. The GitHub link points at the repository and says it's open source (D26, replacing D23's header-without-GitHub). |
| R12. Open source is visible | The header's GitHub link ("SnapTabs is open source. View it on GitHub"), a first Help row in Settings ("SnapTabs is open source: view it on GitHub"), a Settings footer "SnapTabs <version> · Free and open source", and a line on the welcome page beside Done ("Free and open source. View SnapTabs on GitHub"). All point at the repository, from one `REPO_URL` in `links.ts`. |
| R11. Welcome page | Option titles match Settings; caption "Off by default. Everything stays on this device."; step numbers sit inline with their headings and the button replicas sit on the right, so all text starts at one left edge at every width, and options span the card width. Replicas match the current buttons (Snapshot primary, the card's small Restore). |

## Not in scope

Renaming Snapshot to Save, a "Save N tabs" bar, smarter default names, a new icon, video and translations (UX review backlog). No behaviour changes beyond R1, R4's toast swap and R6's hidden toggle.

## Decisions

Rows added to [the register](../decisions/README.md): D20 to D26.

## Validation

| Check | Passing evidence |
| --- | --- |
| Unit | `npm run check` passes, with tests for the date and byte formatting helpers and the 11-field `DEFAULT_SETTINGS`. |
| E2E | Settings sections and titles; incognito rows hidden without incognito access; first snapshot shows the tip and no toast; card menu has no Restore; Escape closes the duplicate modal; recording shows one stop control; detail menu pins, renames and deletes; "Delete all sessions…" confirm. |
| Visual | Before/after screenshots of every popup state and the welcome page (desktop and 375px), reviewed. |
| Gallery | Store screenshots regenerated with `npm run screenshots` so they match the new UI. |

## Milestones

1. Tokens, primitives, Banner, toast, focus and motion (R3, R4, R8).
2. Cards, recording, detail header, header (R5 to R7, R10).
3. Settings and welcome page (R1, R2, R9, R11).
4. Tests, screenshots, docs, version 2.0.0.

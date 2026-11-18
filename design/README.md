# Design notes

## Brief: v2.0 UI refresh

- **Job:** make the popup and Settings easy to scan and consistent; it's opened many times a day for a few seconds.
- **The attractive part:** the session list and the Restore action; Settings should read like plain sentences.
- **Reject:** new colours, new features, a light theme, illustrations, any looping animation other than recording.
- **Reference:** SnapTabs' own v1.10 UI (table below), made consistent with tokens. Findings: [UI review](../docs/growth/ui-review-2026-11-18.md); spec: [UI refresh](../docs/ui-refresh/spec.md).
- **Product rules that win:** D15 (visible Restore), D04 (one banner at a time), 400×600 popup, dark only.

### Tokens adopted (2026-11-18)

| Token | Value | Why |
| --- | --- | --- |
| `--r-sm` / `--r` / `--r-lg` / `--r-pill` | 4 / 6 / 8 / 999 px | replaced six radii (4, 5, 6, 8, 10, 12) |
| `--text-xs` … `--text-lg` | 11 / 12 / 13 / 14 px | replaced three title styles |
| `--primary-fill` | oklch(0.56 0.2 258) | white on `--primary` was ~3.3:1; this is ~4.8:1 (estimate) |
| `--fg-muted` | 0.6 → 0.65 lightness | ~4.4:1 on `--muted` surfaces was under 4.5 |
| `--destructive` | 0.55 → 0.63 lightness | now used as text only; passes on `--bg` and `--card` |
| `--success` | oklch(0.72 0.16 150) | toast and "Pinned" check icons |

### Shape table (v2.0)

| Kind of content | Shape | Rule |
| --- | --- | --- |
| Main action on a screen | `.btn-primary` | one per view: Snapshot (main), Stop & save (recording), Restore N tabs (detail), Save anyway (modal) |
| Per-row action | `.btn-sm .btn-secondary` | card Restore |
| Secondary actions on a session | "…" `SessionMenu` | Pin, Rename, Delete, same on card and detail |
| Confirmation of a click | toast at the bottom | not when a tip already confirms it (D22) |
| Destructive bulk action | red text button, two clicks, names the count | never a filled red button |
| Session meta | "8 tabs · 1 window · 2h ago" | singular for 1; "Nov 4" after a week |

### Decision log (v2.0)

- 2026-11-18: User: "We will do a big release itself", "and call it 2.0.0 maybe", "after ui changes show me what all you changed". Built the whole UI review in one go (D20 to D25). Before/after renders of every popup state and the welcome page were compared before shipping.
- 2026-11-18: User: "I want to let people know that this is open source. I want people to go to GitHub as well", "in the same release itself". GitHub icon back in the header (now to the repo, titled as open source), a first Help row in Settings, "Free and open source" in the Settings footer, a line on the welcome page (D26, replaces D23).
- 2026-11-18: Welcome page: step numbers inline with headings and replicas on the right, so every card's text starts at the same edge (fixes the two-column misalignment on desktop and the narrow column on phones together).


## Brief: v1.10 onboarding

- **Job:** explain SnapTabs' core loop (save, close, restore) to someone who just installed it or got confused, in under 15 seconds of reading. The welcome page is seen once on install and again whenever someone clicks **?**. The popup tips are seen once each.
- **The attractive part:** the three-step "How SnapTabs works" explanation, with replicas of the real buttons so people recognise them in the popup.
- **Reject:** a feature tour, carousels or slides, animations that loop, illustrations that don't match the real UI, more than one line per step, anything that pops up over other tabs.
- **Reference:** SnapTabs' own popup and welcome page (below). No outside design system.
- **Product rules that win:** the welcome page stays minimal (v1.9 decision); tips are one-time and dismissible ([spec](../docs/onboarding/spec.md), D04 to D06 in the [register](../docs/decisions/README.md)); the popup is fixed at 400×600 and dark-only.

## Reference: the existing SnapTabs UI (from code)

| Role | Value | Source |
| --- | --- | --- |
| Page background | `--bg` oklch(0.13 0.008 280) | `src/entrypoints/popup/style.css` |
| Card | `--card` oklch(0.16 0.008 280), 1px `--border`, radius 12px (welcome steps), 8px (popup cards) | `Welcome.svelte`, `Settings.svelte` |
| Primary action | `--primary` oklch(0.65 0.19 255), white text, 6px radius, 12px/600 | `.snap-btn` in `SnapshotBar.svelte` |
| Secondary action | `--secondary` background, 1px `--border`, `--fg` text | `.restore-btn` in `SessionDetail.svelte` |
| Text | `--fg` 0.95, `--fg-muted` 0.6 | `style.css` |
| Popup banner | primary tint at 10% fill, 25% border, 8px radius, 12px/600 title + 11px body, ✕ dismiss | `Banner.svelte` (was `RatingPrompt.svelte`) |
| Welcome step | numbered 26px circle, 15px/600 title, 13px muted body | `Welcome.svelte` |

Adopted: all of the above, unchanged. Tips reuse the rating banner's shape so the popup has one banner style.

## Shape table

| Kind of content | Shape | Rule |
| --- | --- | --- |
| A step in the loop | replica of the real control + one-line title + one muted line | the replica must look exactly like the popup control (same colours, icon, radius) |
| A step with no control ("Close them") | the browser's own tab close mark (×) in a neutral chip | never a fake button |
| One-time tip | popup banner (rating-banner shape), title + one line, ✕ | one banner at a time; dismiss is permanent |

## Mockups

| Mockup | Idea | Reads best for | Status |
| --- | --- | --- | --- |
| a-steps | one card, three rows, replica on the left | scanning top to bottom; narrow screens | **Chosen** (built) |
| b-flow | three tiles in a row joined by arrows | showing it as a loop at a glance | Not chosen: each description wraps to 3 lines in a tile, and on a phone it becomes three boxed tiles plus arrows, much taller than A |

## Decision log

- 2026-11-07: User reviewed the built screens and replied "confirmed" (D02-D07 and mockup A).
- 2026-11-06: Rendered A and B at 1280 and 390. Found: in both, the step title repeated the button label ("Snapshot" next to a Snapshot button). Chose A (user confirmed 2026-11-07) with outcome titles: "Save your tabs", "Close them", "Bring them back".
- 2026-11-06: User asked for "some sort of onboarding or a welcome page, simple, where we explain stuff", then "go ahead with all three" (guide, ways to reopen it, tips).

## Open questions

- Should the help-opened guide hide the pin step once SnapTabs is pinned? (Current plan: it shows "Pinned" with a check, which still reads fine.)

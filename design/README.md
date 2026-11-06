# Design notes

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
| Popup banner | primary tint at 10% fill, 25% border, 8px radius, 12px/600 title + 11px body, ✕ dismiss | `RatingPrompt.svelte` |
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

- 2026-11-06: Rendered A and B at 1280 and 390. Found: in both, the step title repeated the button label ("Snapshot" next to a Snapshot button). Chose A (Assumed, shown to the user for veto) with outcome titles: "Save your tabs", "Close them", "Bring them back".
- 2026-11-06: User asked for "some sort of onboarding or a welcome page, simple, where we explain stuff", then "go ahead with all three" (guide, ways to reopen it, tips).

## Open questions

- Should the help-opened guide hide the pin step once SnapTabs is pinned? (Current plan: it shows "Pinned" with a check, which still reads fine.)

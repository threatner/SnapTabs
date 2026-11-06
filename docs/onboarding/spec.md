# Onboarding

Status: spec, as of 2026-11-06. Branch: `release/v1.10.0`. Ships in v1.10.0.

## Why

Two of eight uninstall-form answers (as of 2026-11-06) said "I didn't understand how to use it", and the user hears the same from people directly ("tough to use"). The v1.9 welcome page explains setup (pin, auto-save switches) but never the core idea, *save your tabs, close them, bring them back*. It is shown once, only to brand-new installs, and can't be reopened, so nobody who installed before v1.9 has seen it. A snapshot also leaves every tab open, so a first click on **Snapshot** changes nothing visible in the browser (guess: this is where people get lost).

Evidence labels: uninstall answers and comments are **seen once** (8 answers, 2 comments). The welcome page, the empty-state copy and "snapshot doesn't close tabs" are **from code** (`src/entrypoints/welcome/Welcome.svelte`, `src/components/SessionList.svelte`, `src/lib/tabs.ts`). Whether the tips reduce confusion is **unknown** until real users have them.

## Scope

| Requirement | Acceptance criterion |
| --- | --- |
| R1. The welcome page explains how SnapTabs works | Above the existing pin and auto-save steps, a "How SnapTabs works" section shows three steps (Snapshot, Close them, Restore). Each step is one line, and Snapshot and Restore show a small replica of the real popup button. |
| R2. The guide can be reopened any time | A **?** button in the popup header and a "How to use SnapTabs" card in Settings both open the guide in a new tab. |
| R3. Opened from help, the page reads as a guide | `welcome.html?from=help` shows the heading "How to use SnapTabs" instead of "SnapTabs is installed". Everything else is identical, including the pin and auto-save steps (still useful later). |
| R4. Tip after the first snapshot | The first manual snapshot a user ever takes (popup, shortcut or right-click) makes the popup show, once, a dismissible tip: "Saved! Your tabs are still open. Close them whenever you like and restore them from here." |
| R5. Tip after the first restore | The first restore a user ever does, with **Sleep restored tabs** on and at least one background tab, makes the next popup open show, once, a dismissible tip that background tabs sleep until clicked, with a link to the setting. |
| R6. Tips never nag | Each tip shows until dismissed and never again. At most one banner shows at a time; a pending tip wins over the rating banner. Users whose stats were backfilled from older versions never get the first-snapshot tip. |
| R7. Nothing opens by itself for existing users | No tab, window or notification appears on update. Existing users reach the guide through R2. |

## Not in scope

- An interactive tour or coach marks inside the popup: too much UI for a 400×600 popup, and the uninstall data doesn't show where in the flow people get stuck.
- A video: maintenance cost on every UI change.
- Explaining every feature (recording, omnibox, export): the guide covers the save → close → restore loop only; the welcome page stays short (see D03 in the register).
- Notifications (`chrome.notifications`): needs a new permission and interrupts other tabs.
- Translations: separate growth work.

## Decisions

Rows added to [the register](../decisions/README.md): D01 to D06. Rejected: a separate guide page (duplicates the welcome content), toasts for tips (gone after 2.5 s), notifications for tips (new permission, intrusive), auto-opening the guide on update (annoying, invites bad reviews).

## Validation

| Check | Passing evidence |
| --- | --- |
| Unit: tip state | `npm run check` passes with tests showing: the 0→1 transitions set a pending tip; a backfilled user with snapshots gets no first-snapshot tip; dismissing clears it for good; the restore tip needs sleeping on and a background tab. |
| E2E: welcome guide | The welcome page shows the three how-it-works steps; `?from=help` changes only the heading. |
| E2E: help entry points | Clicking **?** in the popup and the Settings card each opens `welcome.html?from=help` (asserted through `chrome.tabs.query`). |
| E2E: tips | First popup snapshot shows the snapshot tip; after dismiss it never returns; a seeded first restore shows the sleep tip; a pending tip hides the rating banner and the banner returns after dismiss. |
| Visual | Screenshots of the welcome page at 1280 and 375 wide and of the popup with each tip, checked before merge. |
| Live check (user) | The user installs the build fresh in a test profile and in their normal profile (existing data), and confirms the flow reads clearly. Recorded here when done. |

## Milestones

1. **Guide**: R1 to R3 and R7. Done when the welcome and help E2E checks pass and the screenshots are reviewed.
2. **Tips**: R4 to R6. Done when the unit and tip E2E checks pass and the popup screenshots are reviewed.
3. **Release notes**: CHANGELOG, CLAUDE.md, README updated in the same change as the code.

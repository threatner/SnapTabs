# Decision register

Every material choice gets a row. Status says who decided: `User decision YYYY-MM-DD`, `Proposed` (awaiting the user), `Assumed` (made without being able to ask; needs confirming), `Code review YYYY-MM-DD`, `Measured YYYY-MM-DD`, or `Superseded by Dnn`. Replaced rows stay; add a new row instead of editing an old decision. A choice whose reasoning needs more than three sentences gets its own ADR file.

This register starts with v1.10. Earlier choices live in `CHANGELOG.md` and `CLAUDE.md`.

| ID | Decision | Status | Reason / consequence |
| --- | --- | --- | --- |
| D01 | v1.10 onboarding has three parts: a "How SnapTabs works" section on the welcome page, ways to reopen it (popup **?** button and a Settings card), and two one-time popup tips (after the first snapshot, after the first restore). | User decision 2026-11-06 | "Didn't understand how to use it" in uninstall answers and direct feedback. Spec: [onboarding](../onboarding/spec.md). |
| D02 | The guide is the welcome page itself. `welcome.html?from=help` only swaps the heading. | User decision 2026-11-07 (confirmed) | One page to keep accurate. Rejected: a separate guide page (two copies of the same explanation drift apart). |
| D03 | The guide explains only the save → close → restore loop. Other features stay discoverable in the popup and the store listing. | User decision 2026-11-07 (confirmed) | The user asked for a simple page and earlier trimmed the welcome page to essentials (v1.9). Rejected: a full feature tour. |
| D04 | Tips are inline, dismissible cards in the popup, one at a time. A pending tip takes the rating banner's place until dismissed. | User decision 2026-11-07 (confirmed) | Visible where the user is already looking; no new permission. Rejected: toasts (gone after 2.5 s), `chrome.notifications` (new permission, interrupts other tabs). |
| D05 | A tip becomes pending in the service worker at the moment its count goes from 0 to 1, not by checking counts later. | User decision 2026-11-07 (confirmed) | Long-time users whose counts were backfilled in v1.9 never see "your first snapshot" advice. Rejected: "show while count ≤ N" (would show to veterans after backfill). |
| D06 | Nothing opens by itself on update; existing users find the guide through the **?** button or Settings. | User decision 2026-11-07 (confirmed) | Same reasoning as the v1.9 welcome page (only for genuinely new users): unexpected tabs annoy people and invite bad reviews. |
| D07 | `npm run check` is the one command that proves a change is done: docs check, type check, unit tests, build. Browser suites (`test:e2e`, `test:e2e:cdp`) stay separate because they open browser windows; CI runs them. | User decision 2026-11-07 (confirmed) | Gives every session one gate to run before claiming done, as the user's working rules ask. |

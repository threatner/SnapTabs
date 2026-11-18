# Save tab groups when they're closed

Status: built (milestones 1 and 2 done), as of 2026-11-18. Awaiting the user's live check with a real **Close group** click. Branch: `release/v1.10.0`. Ships in v1.10.0.

## Why

An uninstall-form comment (seen once, 2026-11-06): "I use tab groups. So most of my tabs are organized at groups, that maybe are closed. I need a tool to save all tabs even if they are closed." Two other answers said SnapTabs "didn't restore my tabs correctly", which may be the same problem (guess): tabs in closed groups were never saved, so they never came back.

Chrome gives extensions no way to read a group after it's closed (documented: `chrome.tabGroups` exposes only open groups). But it does report the close as it happens, so SnapTabs can save the group at that moment.

## Research (2026-11-18)

| Finding | Label |
| --- | --- |
| `chrome.tabGroups` and `chrome.tabs` expose only open groups and tabs; nothing reads saved/closed groups | documented |
| Collapsed groups are open: their tabs, name and collapsed state are saved by a normal snapshot | verified (real Chromium) |
| Closing a whole group (all tabs removed in one call): each tab gets `groupId → -1` then `onRemoved`, all within 11 ms; `tabGroups.onRemoved` fires in the middle of that burst, sometimes before the last tab's `onRemoved` | seen once (headless Chromium, `chrome.tabs.remove(ids)`) |
| Closing the group's tabs one by one (600 ms apart): `tabGroups.onRemoved` fires with the last tab | seen once |
| Ungroup: `groupId → -1` for each tab and `tabGroups.onRemoved`, but no `tabs.onRemoved` | seen once |
| Closing a window with a group: every `tabs.onRemoved` has `isWindowClosing: true` | seen once |
| SnapTabs' window cache can't be trusted at that moment: it still held all 3 tabs after the burst only because its refresh happened to be slow, and held 1 of 3 after the one-by-one close | seen once |
| The service worker may be asleep when a group is closed; Chrome wakes it with these events, so in-memory state is empty | from code / documented MV3 behaviour |
| What a real **Close group** click (Chrome's saved groups, Brave) fires | unknown: user live check below |

## Scope

| Requirement | Acceptance criterion |
| --- | --- |
| R1. Opt-in setting | Settings > Auto-Save has "Save tab groups when you close them", off by default. The welcome page's auto-save step offers the same switch. |
| R2. Save on a whole-group close | With R1 on, closing a whole tab group in a normal window saves a session with exactly that group's tabs (URLs, titles, order) and the group's name, colour and collapsed state, named "<group name> (closed group)" ("Unnamed group (closed group)" if it had no name), marked Auto. |
| R3. Only real closes | No session is saved when: the group is ungrouped (tabs stay open); its tabs are closed one at a time (the removals span more than 500 ms); its window or the browser closes; the window is incognito; the setting is off. |
| R4. Survives a sleeping service worker | Closing a group while SnapTabs' service worker is stopped still saves it. |
| R5. No pile-up | Closing the same group again with the same tabs replaces the earlier copy instead of adding another. A different set of tabs makes a new session. |
| R6. Respects existing rules | Excluded domains are skipped (nothing saved if nothing is left), non-restorable tabs are kept like any snapshot, the session counts toward the limit and is pruned like other auto-saves, and it counts as an auto-save in usage stats. |
| R7. Restores as a group | Restoring the session recreates the tab group with its name and colour. |

## Not in scope

- Reading groups that were closed before this feature existed, or while SnapTabs was disabled: impossible (no API).
- Restoring into Chrome's own saved-groups list: no API.
- Incognito groups: kept out on purpose; incognito saving stays under the separate "Save incognito on close" setting.
- A per-group on/off switch: one setting is enough until someone asks.

## Decisions

Rows added to [the register](../decisions/README.md): D08 to D11 and D13 (D12 superseded by the simpler D13). Rejected: on by default (could flood the list for people who close groups all day, and breaks the opt-in rule since v1.3.1); a new session on every close (duplicates); reading SnapTabs' window cache at close time (proven unreliable above).

## Validation

| Check | Passing evidence |
| --- | --- |
| Unit: detection | `npm run check` passes with tests for the tracker: whole-group burst → save; one-by-one → no save; ungroup → no save; window closing → no save; group event before the last tab's removal → still a full save; lookups still work after the cache refresh drops the tabs. |
| Unit: storage | Replace-on-reclose with the same tabs, new session with different tabs, excluded domains, pruning. |
| Real browser (CDP) | With the setting on: whole-group close saves a session with the right tabs, name, colour; ungroup, one-by-one, window close and setting-off save nothing; closing a group right after the service worker is stopped still saves it; restoring the session recreates the group. |
| E2E | The Settings switch and the welcome-page switch write `saveClosedGroups`. |
| Live check (user) | In Chrome and in Brave: make a group, right-click it → **Close group**; it appears in SnapTabs as "<name> (closed group)". Recorded here when done. |

## Milestones

1. **Detection and save**: R2 to R7 behind the setting, with unit and real-browser checks. **Done 2026-11-18**: 13 unit tests; 8 real-browser checks pass (incl. a stopped service worker); widening the burst window breaks the one-by-one unit and real-browser checks.
2. **Setting UI**: R1 in Settings and on the welcome page, with E2E checks and screenshots. **Done 2026-11-18.**
3. **Docs**: CHANGELOG, CLAUDE.md, store listing copy.

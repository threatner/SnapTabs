// Realistic, aspirational demo data for Chrome Web Store listing screenshots.
// Not test fixtures — these strings are what users see in the store, so they
// must feel like a real, lived-in tab library.
//
// All timestamps are computed at capture time relative to `now` so the
// "Just now / 23h ago / 2d ago" displays stay fresh release after release
// rather than drifting into "210d ago" when the source file ages.

import type { Session, SavedTab, SnapTabsSettings, LiveRecording } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function tab(url: string, title: string, opts: Partial<SavedTab> = {}): SavedTab {
  return { url, title, pinned: false, isIncognito: false, index: 0, ...opts };
}

function withIndex(tabs: SavedTab[]): SavedTab[] {
  return tabs.map((t, i) => ({ ...t, index: i }));
}

function autoName(prefix: string, ts: number): string {
  return `${prefix} - ${new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

// ── Sessions (8 total, mix of pinned / manual / auto-save, varied sizes) ──

export function buildDemoSessions(now: number = Date.now()): Session[] {
  const browserCloseTs = now - 1 * DAY;
  const olderAutoSaveTs = now - 14 * DAY;

  return [
    {
      id: 'demo-phoenix',
      name: 'Project Phoenix — Sprint 24 kickoff',
      pinned: true,
      timestamp: now - 2 * HOUR,
      tabs: withIndex([
        tab('https://www.notion.so/acme/Phoenix-Sprint-24-c8a9', 'Sprint 24 brief — Notion', { groupId: 1 }),
        tab('https://linear.app/acme/team/PHX/active', 'PHX active issues — Linear', { groupId: 1 }),
        tab('https://www.figma.com/file/Phoenix-Dashboard-v3', 'Phoenix dashboard v3 — Figma', { groupId: 1 }),
        tab('https://github.com/acme/phoenix-api', 'acme/phoenix-api', { groupId: 2 }),
        tab('https://github.com/acme/phoenix-api/pull/142', 'feat: add auth middleware #142 — acme/phoenix-api', { groupId: 2 }),
        tab('https://github.com/acme/phoenix-web/issues/87', 'Empty-state regression on profile #87 — acme/phoenix-web', { groupId: 2 }),
        tab('https://stackoverflow.com/questions/12345', 'How to refresh OAuth tokens cleanly — Stack Overflow'),
        tab('https://news.ycombinator.com/item?id=987654', 'Show HN: Building Phoenix-style auth — Hacker News'),
      ]),
      tabGroups: [
        { id: 1, title: 'Specs', color: 'purple' as chrome.tabGroups.ColorEnum, collapsed: false },
        { id: 2, title: 'Code', color: 'blue' as chrome.tabGroups.ColorEnum, collapsed: false },
      ],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-research',
      name: 'Offline-first sync — research',
      timestamp: now - 5 * HOUR,
      tabs: withIndex([
        tab('https://martin.kleppmann.com/2020/12/02/bloom-filter-debounce.html', 'Bloom filter debouncing — Martin Kleppmann'),
        tab('https://riffle.systems/essays/prelude/', 'Riffle — Reactive Relational State'),
        tab('https://www.electricsql.com/docs/intro/local-first', 'Local-first — ElectricSQL docs'),
        tab('https://github.com/automerge/automerge', 'automerge/automerge'),
        tab('https://news.ycombinator.com/item?id=local-first-2026', 'Ask HN: Local-first stack in 2026 — HN'),
        tab('https://jlongster.com/CRDT-Replicache', 'CRDTs, Replicache, and the local-first toolbox'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-browser-close',
      name: autoName('Browser close', browserCloseTs),
      timestamp: browserCloseTs,
      tabs: withIndex([
        tab('https://mail.google.com/mail/u/0/#inbox', 'Inbox (12) — Gmail'),
        tab('https://calendar.google.com/calendar/u/0/r/week', 'Week of — Google Calendar'),
        tab('https://app.slack.com/client/T123/C456', '#eng-platform — Slack'),
        tab('https://github.com/acme/phoenix-api/pulls', 'Pull requests · acme/phoenix-api'),
        tab('https://linear.app/acme/my-issues', 'My issues — Linear'),
        tab('https://www.notion.so/acme/Weekly-standup-bca8', 'Weekly standup — Notion'),
        tab('https://1password.com/vaults/personal', '1Password — Personal'),
        tab('https://app.datadoghq.com/dashboard/abc', 'Phoenix API — Datadog'),
        tab('https://docs.google.com/document/d/abc/edit', 'Onboarding plan v2 — Google Docs'),
        tab('https://github.com/sveltejs/svelte/discussions/12500', 'Runes mode discussion — sveltejs/svelte'),
        tab('https://stackoverflow.com/a/777', 'Migrating to Svelte 5 — answer'),
        tab('https://medium.com/@kleppmann/local-first', 'Local-first software, five years in'),
        tab('https://news.ycombinator.com/news', 'Hacker News'),
        tab('https://kagi.com/search?q=svelte+runes+migration', 'svelte runes migration — Kagi'),
      ]),
      tabGroups: [],
      windowCount: 3,
      hasIncognitoTabs: false,
      isAutoSave: true,
    },
    {
      id: 'demo-onboarding',
      name: 'Onboarding reading — week 1',
      timestamp: now - 2 * DAY,
      tabs: withIndex([
        tab('https://www.notion.so/acme/Welcome-aa11', 'Welcome to Acme — Notion'),
        tab('https://www.notion.so/acme/Engineering-handbook-bb22', 'Engineering handbook — Notion'),
        tab('https://github.com/acme/onboarding', 'acme/onboarding'),
        tab('https://acme.com/blog/intro', 'Intro to the Acme stack — Engineering blog'),
        tab('https://app.lever.co/acme/onboarding-checklist', 'Onboarding checklist — Lever'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-flights',
      name: 'Holiday flights — Lisbon Oct',
      timestamp: now - 4 * DAY,
      tabs: withIndex([
        tab('https://www.google.com/travel/flights', 'BLR → LIS, Oct 8-22 — Google Flights'),
        tab('https://www.skyscanner.net/transport/flights/blr/lis', 'BLR → LIS — Skyscanner'),
        tab('https://www.kayak.com/flights/BLR-LIS/2026-10-08', 'BLR-LIS Oct 8 — KAYAK'),
        tab('https://www.airbnb.com/s/Lisbon', 'Stays in Lisbon — Airbnb'),
        tab('https://www.lonelyplanet.com/portugal/lisbon', 'Lisbon — Lonely Planet'),
        tab('https://www.reddit.com/r/Lisbon/top', 'r/Lisbon — top of all time'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-tax',
      name: 'Tax research — Q1',
      timestamp: now - 7 * DAY,
      tabs: withIndex([
        tab('https://incometax.gov.in/iec/foportal/', 'Income Tax e-filing portal'),
        tab('https://cleartax.in/s/itr-filing', 'ITR filing guide — ClearTax'),
        tab('https://www.reddit.com/r/IndiaTax/top', 'r/IndiaTax — top of week'),
        tab('https://taxguru.in/income-tax/itr-2026.html', 'ITR FY 2025-26 changes — TaxGuru'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-reading',
      name: 'Reading list — long-form',
      timestamp: now - 12 * DAY,
      tabs: withIndex([
        tab('https://www.newyorker.com/magazine/2026/05/whats-new', 'The week in review — The New Yorker'),
        tab('https://stratechery.com/2026/llm-platforms', 'The LLM platform wars — Stratechery'),
        tab('https://every.to/p/the-end-of-organic-search', 'The end of organic search — Every'),
        tab('https://aeon.co/essays/why-deep-work-still-matters', 'Why deep work still matters — Aeon'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    },
    {
      id: 'demo-interview',
      name: autoName('Browser close', olderAutoSaveTs),
      timestamp: olderAutoSaveTs,
      tabs: withIndex([
        tab('https://www.example.com', 'Example'),
        tab('https://github.com/threatner/SnapTabs', 'threatner/SnapTabs'),
        tab('https://en.wikipedia.org/wiki/Manifest_V3', 'Manifest V3 — Wikipedia'),
      ]),
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: true,
    },
  ];
}

// ── Settings (showcase the v1.4.0 + v1.5.0 features) ──

export const demoSettings: SnapTabsSettings = {
  ...DEFAULT_SETTINGS,
  autoSnapshotOnBrowserClose: true,
  autoSnapshotOnClose: true,
  warnOnDuplicateSnapshot: true,
  excludedDomains: [
    'mail.google.com',
    'bank.com',
    '1password.com',
    'internal.acme.com',
  ],
  maxSessions: 100,
};

// ── Live recording in progress ──
//
// startedAt must be computed at runtime: the RecordingBar shows live elapsed
// seconds, so a fixed past timestamp would render a huge (or negative)
// elapsed value depending on when the popup is actually rendered.
export function buildDemoRecording(): LiveRecording {
  return {
    id: 'demo-recording',
    name: 'Recording — research trail',
    startedAt: Date.now() - (4 * 60_000 + 17_000), // 4m 17s ago
    windowId: -1,
    tabs: withIndex([
      tab('https://martin.kleppmann.com/papers/crdts.pdf', 'Conflict-free replicated data types (PDF)'),
      tab('https://github.com/yjs/yjs', 'yjs/yjs'),
      tab('https://www.electricsql.com/blog/2026/local-first', 'The local-first toolbox in 2026 — ElectricSQL'),
      tab('https://news.ycombinator.com/item?id=crdt-2026', 'Ask HN: which CRDT lib in 2026? — HN'),
    ]),
    isActive: true,
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import {
  getMeta, recordUsage, backfillUsageStats, dismissRatingPrompt, shouldShowRatingPrompt, saveSession,
  RATING_PROMPT_AFTER_RESTORES, RATING_PROMPT_AFTER_MANUAL_SNAPSHOTS,
} from '../src/lib/storage';
import type { Session } from '../src/lib/types';

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id, name: id, timestamp: 1000, tabs: [], tabGroups: [], windowCount: 1,
    hasIncognitoTabs: false, isAutoSave: false, ...overrides,
  };
}

async function times(n: number, fn: () => Promise<void>) {
  for (let i = 0; i < n; i++) await fn();
}

describe('usage stats', () => {
  beforeEach(() => resetChromeStorage());

  it('starts empty', async () => {
    const meta = await getMeta();
    expect(meta.ratingPromptDone).toBe(false);
    expect(meta.statsBackfilled).toBe(false);
    expect(meta.stats).toEqual({
      manualSnapshots: 0, recordings: 0, autoSaves: 0, restores: 0,
      restoresOfManualSessions: 0, restoresOfAutoSaves: 0, firstSeenAt: 0,
    });
  });

  it('counts each kind of action', async () => {
    await recordUsage('manualSnapshot', undefined, 500);
    await recordUsage('recording');
    await recordUsage('autoSave');
    await recordUsage('restore', { isAutoSave: false });
    await recordUsage('restore', { isAutoSave: true });
    await recordUsage('restore', { isAutoSave: true });
    const { stats } = await getMeta();
    expect(stats).toEqual({
      manualSnapshots: 1, recordings: 1, autoSaves: 1, restores: 3,
      restoresOfManualSessions: 1, restoresOfAutoSaves: 2, firstSeenAt: 500,
    });
  });

  it('keeps the first-seen time from the first action', async () => {
    await recordUsage('manualSnapshot', undefined, 500);
    await recordUsage('manualSnapshot', undefined, 900);
    expect((await getMeta()).stats.firstSeenAt).toBe(500);
  });

  it('ignores a pre-release meta shape without failing', async () => {
    await chrome.storage.local.set({ snaptabs_meta: { restoreCount: 7, ratingPromptDone: false } });
    const meta = await getMeta();
    expect(meta.stats.restores).toBe(0);
    await recordUsage('restore', { isAutoSave: false });
    expect((await getMeta()).stats.restores).toBe(1);
  });
});

describe('backfillUsageStats (users from before v1.9)', () => {
  beforeEach(() => resetChromeStorage());

  it('seeds counts and first-seen time from saved sessions', async () => {
    await saveSession(session('m1', { timestamp: 300 }));
    await saveSession(session('m2', { timestamp: 800 }));
    await saveSession(session('a1', { isAutoSave: true, timestamp: 900 }));
    await saveSession(session('b', { isAutoSave: true, isBackup: true, timestamp: 950 }));
    await backfillUsageStats(5000);
    const meta = await getMeta();
    expect(meta.statsBackfilled).toBe(true);
    expect(meta.stats.manualSnapshots).toBe(2);
    expect(meta.stats.autoSaves).toBe(1);
    expect(meta.stats.restores).toBe(0);
    expect(meta.stats.firstSeenAt).toBe(300);
  });

  it('runs only once', async () => {
    await saveSession(session('m1'));
    await backfillUsageStats();
    await backfillUsageStats();
    expect((await getMeta()).stats.manualSnapshots).toBe(1);
  });

  it('for a new user just records now as first seen', async () => {
    await backfillUsageStats(5000);
    const { stats, statsBackfilled } = await getMeta();
    expect(statsBackfilled).toBe(true);
    expect(stats.manualSnapshots).toBe(0);
    expect(stats.firstSeenAt).toBe(5000);
  });

  it('adds to counts recorded before it ran', async () => {
    await saveSession(session('m1'));
    await recordUsage('restore', { isAutoSave: false }, 100);
    await backfillUsageStats(5000);
    const { stats } = await getMeta();
    expect(stats.manualSnapshots).toBe(1);
    expect(stats.restores).toBe(1);
    expect(stats.firstSeenAt).toBe(100);
  });
});

describe('rating prompt rule', () => {
  beforeEach(() => resetChromeStorage());

  it(`shows after ${RATING_PROMPT_AFTER_RESTORES} restores`, async () => {
    await times(RATING_PROMPT_AFTER_RESTORES - 1, () => recordUsage('restore', { isAutoSave: false }));
    expect(shouldShowRatingPrompt(await getMeta())).toBe(false);
    await recordUsage('restore', { isAutoSave: true });
    expect(shouldShowRatingPrompt(await getMeta())).toBe(true);
  });

  it(`shows after ${RATING_PROMPT_AFTER_MANUAL_SNAPSHOTS} manual snapshots`, async () => {
    await times(RATING_PROMPT_AFTER_MANUAL_SNAPSHOTS - 1, () => recordUsage('manualSnapshot'));
    expect(shouldShowRatingPrompt(await getMeta())).toBe(false);
    await recordUsage('manualSnapshot');
    expect(shouldShowRatingPrompt(await getMeta())).toBe(true);
  });

  it('auto-saves and recordings alone never trigger it', async () => {
    await times(20, () => recordUsage('autoSave'));
    await times(20, () => recordUsage('recording'));
    expect(shouldShowRatingPrompt(await getMeta())).toBe(false);
  });

  it('a long-time user with 5+ saved snapshots is asked after the update', async () => {
    for (let i = 0; i < RATING_PROMPT_AFTER_MANUAL_SNAPSHOTS; i++) await saveSession(session(`m${i}`));
    await backfillUsageStats();
    expect(shouldShowRatingPrompt(await getMeta())).toBe(true);
  });

  it('never shows again once dismissed', async () => {
    await times(RATING_PROMPT_AFTER_RESTORES, () => recordUsage('restore', { isAutoSave: false }));
    await dismissRatingPrompt();
    await times(10, () => recordUsage('manualSnapshot'));
    expect(shouldShowRatingPrompt(await getMeta())).toBe(false);
  });
});

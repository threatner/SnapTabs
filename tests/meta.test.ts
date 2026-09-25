import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import {
  getMeta, recordRestore, dismissRatingPrompt, shouldShowRatingPrompt, RATING_PROMPT_AFTER_RESTORES,
} from '../src/lib/storage';

describe('rating prompt meta', () => {
  beforeEach(() => resetChromeStorage());

  it('starts with no restores and the prompt not done', async () => {
    expect(await getMeta()).toEqual({ restoreCount: 0, ratingPromptDone: false });
  });

  it('counts restores', async () => {
    await recordRestore();
    await recordRestore();
    expect((await getMeta()).restoreCount).toBe(2);
  });

  it(`shows the prompt only from the ${RATING_PROMPT_AFTER_RESTORES}rd restore on`, async () => {
    for (let i = 0; i < RATING_PROMPT_AFTER_RESTORES - 1; i++) await recordRestore();
    expect(shouldShowRatingPrompt(await getMeta())).toBe(false);
    await recordRestore();
    expect(shouldShowRatingPrompt(await getMeta())).toBe(true);
  });

  it('never shows the prompt again once dismissed', async () => {
    for (let i = 0; i < RATING_PROMPT_AFTER_RESTORES; i++) await recordRestore();
    await dismissRatingPrompt();
    await recordRestore();
    const meta = await getMeta();
    expect(meta.restoreCount).toBe(RATING_PROMPT_AFTER_RESTORES + 1);
    expect(shouldShowRatingPrompt(meta)).toBe(false);
  });
});

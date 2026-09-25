import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureUninstallSurvey, REVIEW_URL, CHROME_WEB_STORE_ID } from '../src/lib/links';

describe('links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('review URL points at this extension on the Chrome Web Store', () => {
    expect(REVIEW_URL).toBe(`https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`);
  });

  it('sets the uninstall survey URL as given, with nothing appended', async () => {
    await configureUninstallSurvey('https://forms.gle/example');
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith('https://forms.gle/example');
  });

  it('does nothing while no survey URL is configured', async () => {
    await configureUninstallSurvey('');
    expect(chrome.runtime.setUninstallURL).not.toHaveBeenCalled();
  });

  it('never throws if Chrome rejects the URL', async () => {
    vi.mocked(chrome.runtime.setUninstallURL).mockRejectedValueOnce(new Error('Invalid url'));
    await expect(configureUninstallSurvey('not a url')).resolves.toBeUndefined();
  });
});

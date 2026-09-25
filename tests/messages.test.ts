import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage } from '../src/lib/messages';

describe('sendMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ pinned: true });
    await expect(sendMessage({ action: 'togglePin', sessionId: 'x' })).resolves.toEqual({ pinned: true });
  });

  it('passes through null responses', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(null);
    await expect(sendMessage({ action: 'stopRecording' })).resolves.toBeNull();
  });

  it('throws when the service worker reports an error', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ error: 'Error: Session not found' });
    await expect(sendMessage({ action: 'restore', sessionId: 'gone' })).rejects.toThrow('Session not found');
  });
});

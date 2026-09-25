import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleepTabsWhenLoaded } from '../src/lib/sleepTabs';

type MockEvent = { emit: (...args: unknown[]) => void; hasListeners: () => boolean };
const onUpdated = () => chrome.tabs.onUpdated as unknown as MockEvent;

// Fake tab table the chrome.tabs.get mock reads from.
let tabs: Record<number, Partial<chrome.tabs.Tab>>;

function setTab(id: number, props: Partial<chrome.tabs.Tab>) {
  tabs[id] = { id, active: false, discarded: false, ...tabs[id], ...props };
}

function update(id: number, props: Partial<chrome.tabs.Tab>) {
  setTab(id, props);
  onUpdated().emit(id, props, tabs[id]);
}

const loading = (url: string) => ({ url: '', pendingUrl: url, status: 'loading' as const });
const committed = (url: string) => ({ url, pendingUrl: undefined, status: 'loading' as const });
const complete = (url: string) => ({ url, pendingUrl: undefined, status: 'complete' as const });

describe('sleepTabsWhenLoaded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    tabs = {};
    vi.mocked(chrome.tabs.get).mockImplementation(async (id: number) => {
      if (!tabs[id]) throw new Error('No tab with id');
      return tabs[id] as chrome.tabs.Tab;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('discards a tab once it finishes loading', async () => {
    setTab(1, loading('https://a.com'));
    const done = sleepTabsWhenLoaded([1]);
    await vi.advanceTimersByTimeAsync(0);
    expect(chrome.tabs.discard).not.toHaveBeenCalled();

    update(1, committed('https://a.com'));
    await vi.advanceTimersByTimeAsync(0);
    expect(chrome.tabs.discard).not.toHaveBeenCalled();

    update(1, complete('https://a.com'));
    await done;
    expect(chrome.tabs.discard).toHaveBeenCalledWith(1);
  });

  it('discards a tab that already finished loading before listening started', async () => {
    setTab(1, complete('https://a.com'));
    await sleepTabsWhenLoaded([1]);
    expect(chrome.tabs.discard).toHaveBeenCalledWith(1);
  });

  it('never discards a tab whose navigation has not committed, even on timeout', async () => {
    setTab(1, loading('https://slow.com'));
    const done = sleepTabsWhenLoaded([1], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(chrome.tabs.discard).not.toHaveBeenCalled();
  });

  it('discards a committed but still-loading tab on timeout', async () => {
    setTab(1, committed('https://slow.com'));
    const done = sleepTabsWhenLoaded([1], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(chrome.tabs.discard).toHaveBeenCalledWith(1);
  });

  it('does not discard a tab the user switched to', async () => {
    setTab(1, loading('https://a.com'));
    const done = sleepTabsWhenLoaded([1]);
    await vi.advanceTimersByTimeAsync(0);
    setTab(1, { active: true });
    update(1, complete('https://a.com'));
    await done;
    expect(chrome.tabs.discard).not.toHaveBeenCalled();
  });

  it('resolves quietly when a tab is closed before it loads', async () => {
    setTab(1, loading('https://a.com'));
    const done = sleepTabsWhenLoaded([1], 1000);
    delete tabs[1];
    await vi.advanceTimersByTimeAsync(1000);
    await expect(done).resolves.toBeUndefined();
    expect(chrome.tabs.discard).not.toHaveBeenCalled();
  });

  it('ignores updates for other tabs and handles many tabs independently', async () => {
    setTab(1, loading('https://a.com'));
    setTab(2, loading('https://b.com'));
    const done = sleepTabsWhenLoaded([1, 2]);
    await vi.advanceTimersByTimeAsync(0);
    update(3, complete('https://c.com'));
    update(2, complete('https://b.com'));
    await vi.advanceTimersByTimeAsync(0);
    expect(chrome.tabs.discard).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.discard).toHaveBeenCalledWith(2);
    update(1, complete('https://a.com'));
    await done;
    expect(chrome.tabs.discard).toHaveBeenCalledTimes(2);
  });

  it('removes its onUpdated listener when all tabs are settled', async () => {
    setTab(1, loading('https://a.com'));
    const done = sleepTabsWhenLoaded([1]);
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdated().hasListeners()).toBe(true);
    update(1, complete('https://a.com'));
    await done;
    expect(onUpdated().hasListeners()).toBe(false);
  });

  it('survives a discard failure', async () => {
    vi.mocked(chrome.tabs.discard).mockRejectedValueOnce(new Error('Cannot discard'));
    setTab(1, complete('https://a.com'));
    await expect(sleepTabsWhenLoaded([1])).resolves.toBeUndefined();
  });
});

// Puts freshly restored background tabs to sleep (chrome.tabs.discard) once
// they have loaded, so restoring a big session leaves one live tab instead of
// dozens. A discarded tab keeps its URL, title and favicon in the tab strip
// and reloads when the user clicks it.
//
// A tab must never be discarded before its navigation commits: it would sleep
// with url '' and nothing to show. So we wait for `status: 'complete'`, and on
// timeout only discard if the URL has at least committed.

export const SLEEP_TIMEOUT_MS = 15_000;

type Waiter = (tab: chrome.tabs.Tab) => void;
const waiters = new Map<number, Waiter>();

function onUpdated(tabId: number, _info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
  waiters.get(tabId)?.(tab);
}

function isCommitted(tab: chrome.tabs.Tab): boolean {
  return !!tab.url && !tab.pendingUrl;
}

function isLoaded(tab: chrome.tabs.Tab): boolean {
  return tab.status === 'complete' && isCommitted(tab);
}

function addWaiter(tabId: number, waiter: Waiter) {
  if (waiters.size === 0) chrome.tabs.onUpdated.addListener(onUpdated);
  waiters.set(tabId, waiter);
}

function removeWaiter(tabId: number) {
  if (!waiters.delete(tabId)) return;
  if (waiters.size === 0) chrome.tabs.onUpdated.removeListener(onUpdated);
}

function sleepWhenLoaded(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeWaiter(tabId);
      try {
        // Re-read the tab: the user may have switched to it or closed it.
        const tab = await chrome.tabs.get(tabId);
        if (!tab.active && !tab.discarded && isCommitted(tab)) await chrome.tabs.discard(tabId);
      } catch { /* tab closed, or discard refused */ }
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    addWaiter(tabId, (tab) => { if (isLoaded(tab)) void finish(); });
    // The tab may have finished loading before we started listening.
    chrome.tabs.get(tabId).then((tab) => { if (isLoaded(tab)) void finish(); }, () => void finish());
  });
}

export async function sleepTabsWhenLoaded(tabIds: number[], timeoutMs = SLEEP_TIMEOUT_MS): Promise<void> {
  await Promise.all(tabIds.map((id) => sleepWhenLoaded(id, timeoutMs)));
}

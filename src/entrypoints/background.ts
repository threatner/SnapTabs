import { defineBackground } from 'wxt/sandbox';
import type { Session, SavedTab, SnapTabsSettings } from '../lib/types';
import { uuid, formatSessionName, isExcludedUrl } from '../lib/types';
import { createSnapshot, restoreSession, getTabStats, toSavedTab, isRestorable } from '../lib/tabs';
import {
  KEYS,
  getSessions,
  getSettings,
  updateSettings,
  deleteSession,
  saveSession,
  togglePin,
  getRecording,
  startRecording,
  addTabToRecording,
  stopRecording,
  cancelRecording,
  getWindowMap,
  saveWindowMap,
  getIncognitoCache,
  saveIncognitoCache,
  saveLastSnapshot,
  clearLastSnapshot,
} from '../lib/storage';
import { createCloseChain, processNormalWindowClose, recoverLastSnapshot } from '../lib/browserClose';

export default defineBackground(() => {
  const windowMap = new Map<number, boolean>();
  const tabCache = new Map<number, SavedTab[]>();

  // Serializes chrome.windows.onRemoved processing. Without this, concurrent
  // multi-window close events (e.g. Cmd+Q with N windows) race on the
  // pending-close buffer and on chrome.windows.getAll(), so some windows'
  // tabs get dropped or remaining===0 triggers more than once.
  const closeChain = createCloseChain();
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Persistence helpers ──

  async function persistWindowMap() {
    try { await saveWindowMap(Object.fromEntries(windowMap)); } catch {}
  }

  async function persistTabCache() {
    try {
      const obj: Record<string, SavedTab[]> = {};
      for (const [k, v] of tabCache) obj[String(k)] = v;
      await saveIncognitoCache(obj);
    } catch {}
  }

  async function restoreState() {
    try {
      const wm = await getWindowMap();
      for (const [k, v] of Object.entries(wm)) windowMap.set(Number(k), v as boolean);
      const cache = await getIncognitoCache();
      for (const [k, v] of Object.entries(cache)) tabCache.set(Number(k), v as SavedTab[]);
    } catch {}
  }

  async function refreshWindowCache(windowId: number) {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      tabCache.set(windowId, tabs.map(toSavedTab));
      await persistTabCache();
      scheduleSnapshotUpdate();
    } catch {}
  }

  // ── Last-snapshot fallback (browser-close recovery) ──
  //
  // Brave (and Chrome under load) can terminate the MV3 service worker
  // mid-shutdown before the onRemoved handler finishes writing the
  // combined session. We continuously persist a "what an auto-save would
  // look like right now" snapshot to chrome.storage.local, then promote it
  // on next browser start if the handler-path session didn't land.

  function scheduleSnapshotUpdate() {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => { snapshotTimer = null; void writeLastSnapshot(); }, 1000);
  }

  async function writeLastSnapshot() {
    try {
      const settings = await getSettings();
      if (!settings.autoSnapshotOnBrowserClose) return;

      const allTabs: SavedTab[] = [];
      let windowCount = 0;
      for (const [windowId, isIncognito] of windowMap) {
        if (isIncognito) continue;
        const cached = tabCache.get(windowId);
        if (!cached || cached.length === 0) continue;
        const filtered = settings.excludedDomains.length > 0
          ? cached.filter((t) => !isExcludedUrl(t.url, settings.excludedDomains))
          : cached;
        if (filtered.length === 0) continue;
        allTabs.push(...filtered);
        windowCount += 1;
      }

      if (allTabs.length === 0) {
        await clearLastSnapshot();
        return;
      }
      await saveLastSnapshot({ tabs: allTabs, windowCount, updatedAt: Date.now() });
    } catch {}
  }

  async function recoverLastSnapshotIfFreshStart() {
    try {
      const settings = await getSettings();
      const recovered = await recoverLastSnapshot(settings);
      if (recovered) await updateBadge();
    } catch (e) {
      console.error('[SnapTabs] recoverLastSnapshot error:', e);
    }
  }

  // ── Badge ──

  async function updateBadge() {
    try {
      if (isRecordingActive) {
        await chrome.action.setBadgeText({ text: '●' });
        await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        return;
      }
      const sessions = await getSessions();
      await chrome.action.setBadgeText({ text: sessions.length > 0 ? String(sessions.length) : '' });
      await chrome.action.setBadgeBackgroundColor({ color: '#18181b' });
    } catch {}
  }

  // ── Context menu ──

  async function setupContextMenus() {
    try {
      await chrome.contextMenus.removeAll();
      chrome.contextMenus.create({
        id: 'snaptabs-save-all',
        title: 'Save all tabs with SnapTabs',
        contexts: ['action'],
      });
    } catch {}
  }

  // ── Event listeners ──

  chrome.windows.onCreated.addListener(async (w) => {
    if (w.id === undefined) return;
    windowMap.set(w.id, w.incognito);
    await persistWindowMap();
    await refreshWindowCache(w.id);
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    // Serialize all close handling so concurrent multi-window close events
    // can't clobber pendingClose or both see remaining===0.
    closeChain.enqueue(() => handleWindowRemoved(windowId));
  });

  async function handleWindowRemoved(windowId: number) {
    const wasIncognito = windowMap.get(windowId);
    const cached = tabCache.get(windowId);
    windowMap.delete(windowId);
    tabCache.delete(windowId);
    await Promise.all([persistWindowMap(), persistTabCache()]);

    if (!cached || cached.length === 0) return;

    try {
      const settings = await getSettings();
      const remaining = await chrome.windows.getAll();
      const filtered = settings.excludedDomains.length > 0
        ? cached.filter((t) => !isExcludedUrl(t.url, settings.excludedDomains))
        : cached;
      if (filtered.length === 0) return;

      if (wasIncognito) {
        // Incognito window closed while browser still open
        if (!settings.autoSnapshotOnClose) return;
        if (remaining.length === 0) return;
        const session: Session = {
          id: uuid(),
          name: formatSessionName('Auto-save'),
          timestamp: Date.now(),
          tabs: filtered,
          tabGroups: [],
          windowCount: 1,
          hasIncognitoTabs: true,
          isAutoSave: true,
        };
        await saveSession(session);
        await updateBadge();
      } else {
        // Normal window close — accumulate into pending buffer so multi-window
        // Cmd+Q captures every window's tabs, not just the last one.
        if (!settings.autoSnapshotOnBrowserClose) return;
        const saved = await processNormalWindowClose(filtered, remaining.length === 0);
        if (saved) await updateBadge();
      }
    } catch {}
  }

  chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.windowId !== undefined) await refreshWindowCache(tab.windowId);
  });

  chrome.tabs.onRemoved.addListener(async (_tabId, info) => {
    if (!info.isWindowClosing && windowMap.has(info.windowId)) await refreshWindowCache(info.windowId);
  });

  // ── Recording state (in-memory to avoid storage reads on every tab update) ──

  let isRecordingActive = false;
  let recordingWindowId = -1;
  const recordedTabIds = new Set<number>();

  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (tab.windowId !== undefined && changeInfo.status === 'complete') {
      await refreshWindowCache(tab.windowId);
    }
    if (changeInfo.status !== 'complete' || !tab.url) return;
    if (!isRestorable(tab.url)) return;
    if (!isRecordingActive) return;

    try {
      if (recordingWindowId !== -1 && tab.windowId !== recordingWindowId) return;
      if (tab.id !== undefined && recordedTabIds.has(tab.id)) return;

      const settings = await getSettings();
      if (isExcludedUrl(tab.url, settings.excludedDomains)) return;

      if (tab.id !== undefined) recordedTabIds.add(tab.id);
      await addTabToRecording(toSavedTab(tab));
      await updateBadge();
    } catch {}
  });

  chrome.runtime.onInstalled.addListener(async (details) => {
    await setupContextMenus();
    if (details.reason === 'install') await updateSettings({});
    await updateBadge();
  });

  chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === 'snaptabs-save-all') {
      try { await createSnapshot(); await updateBadge(); } catch {}
    }
  });

  if (chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (cmd) => {
      if (cmd === 'snapshot-tabs') {
        try { await createSnapshot(); await updateBadge(); } catch {}
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEYS.sessions]) updateBadge();
  });

  // ── Omnibox ──

  if (chrome.omnibox) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'Search your SnapTabs sessions and saved tabs',
    });

    chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
      try {
        suggest(await buildOmniboxSuggestions(text));
      } catch {
        suggest([]);
      }
    });

    chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
      try {
        const url = text.startsWith('http://') || text.startsWith('https://')
          ? text
          : `https://www.google.com/search?q=${encodeURIComponent(text)}`;
        await openOmniboxUrl(url, disposition);
      } catch {}
    });
  }

  function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  async function buildOmniboxSuggestions(rawQuery: string): Promise<chrome.omnibox.SuggestResult[]> {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return [];
    const sessions = await getSessions();
    const seenUrls = new Set<string>();
    const scored: { score: number; result: chrome.omnibox.SuggestResult }[] = [];

    for (const session of sessions) {
      const sessionMatch = session.name.toLowerCase().includes(q);
      for (const tab of session.tabs) {
        const title = tab.title || tab.url;
        const titleMatch = title.toLowerCase().includes(q);
        const urlMatch = tab.url.toLowerCase().includes(q);
        if (!titleMatch && !urlMatch && !sessionMatch) continue;
        if (seenUrls.has(tab.url)) continue;
        seenUrls.add(tab.url);

        const score =
          (titleMatch ? 100 : 0) +
          (urlMatch ? 40 : 0) +
          (sessionMatch ? 10 : 0) +
          (session.pinned ? 5 : 0);

        scored.push({
          score,
          result: {
            content: tab.url,
            description: `<match>${escapeXml(title)}</match> <dim>— ${escapeXml(session.name)}</dim>`,
          },
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.result);
  }

  async function openOmniboxUrl(url: string, disposition: chrome.omnibox.OnInputEnteredDisposition): Promise<void> {
    if (disposition === 'currentTab') {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active?.id !== undefined) {
        await chrome.tabs.update(active.id, { url });
        return;
      }
    }
    await chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
  }

  // ── Message handler ──

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handleMessage(msg).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true;
  });

  async function handleMessage(msg: { action: string; [k: string]: unknown }): Promise<unknown> {
    switch (msg.action) {
      case 'snapshot': {
        const session = await createSnapshot(
          typeof msg.name === 'string' ? msg.name : undefined,
          false,
          typeof msg.windowId === 'number' ? msg.windowId : undefined,
        );
        await updateBadge();
        return session;
      }
      case 'restore': {
        const sessions = await getSessions();
        const session = sessions.find((s) => s.id === msg.sessionId);
        if (!session) throw new Error('Session not found');
        const settings = await getSettings();
        await restoreSession(session, settings.restoreIncognitoToIncognito, settings.restoreInNewWindow);
        if (settings.autoDeleteAfterRestore) await deleteSession(session.id);
        await updateBadge();
        return { success: true };
      }
      case 'delete': {
        await deleteSession(msg.sessionId as string);
        await updateBadge();
        return { success: true };
      }
      case 'togglePin': {
        const pinned = await togglePin(msg.sessionId as string);
        return { pinned };
      }
      case 'getSessions': return getSessions();
      case 'getStats': return getTabStats();
      case 'getSettings': return getSettings();
      case 'updateSettings': {
        await updateSettings(msg.settings as Partial<SnapTabsSettings>);
        return { success: true };
      }
      case 'startRecording': {
        recordedTabIds.clear();
        recordingWindowId = typeof msg.windowId === 'number' ? msg.windowId : -1;
        const rec = await startRecording(
          typeof msg.name === 'string' ? msg.name : '',
          recordingWindowId,
        );
        isRecordingActive = true;
        await updateBadge();
        return rec;
      }
      case 'stopRecording': {
        isRecordingActive = false;
        recordingWindowId = -1;
        recordedTabIds.clear();
        const session = await stopRecording();
        await updateBadge();
        return session;
      }
      case 'cancelRecording': {
        isRecordingActive = false;
        recordingWindowId = -1;
        recordedTabIds.clear();
        await cancelRecording();
        await updateBadge();
        return { success: true };
      }
      case 'getRecording': return getRecording();
      default: throw new Error(`Unknown action: ${msg.action}`);
    }
  }

  // ── Init ──

  async function init() {
    try {
      await restoreState();
      // Run recovery BEFORE we touch windowMap / refreshWindowCache so the
      // pre-existing lastSnapshot reflects the previous browser session,
      // not whatever Chrome restored this time.
      await recoverLastSnapshotIfFreshStart();
      // Restore in-memory recording flags in case service worker restarted
      const rec = await getRecording();
      if (rec?.isActive) {
        isRecordingActive = true;
        recordingWindowId = rec.windowId;
      }
      const windows = await chrome.windows.getAll();
      const refreshes: Promise<void>[] = [];
      for (const w of windows) {
        if (w.id !== undefined) {
          windowMap.set(w.id, w.incognito);
          refreshes.push(refreshWindowCache(w.id));
        }
      }
      await Promise.all(refreshes);
      await persistWindowMap();
      await setupContextMenus();
      await updateBadge();
    } catch (e) {
      console.error('[SnapTabs] Init error:', e);
    }
  }

  init();
});

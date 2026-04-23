<script lang="ts">
  import { onMount } from 'svelte';
  import type { Session, SnapTabsSettings, LiveRecording } from '@/lib/types';
  import { DEFAULT_SETTINGS } from '@/lib/types';
  import { getSessions, renameSession, deleteAllSessions, getSettings, updateSettings, getStorageUsage, getRecording, buildExportPayload, importSessions } from '@/lib/storage';
  import { getTabStats } from '@/lib/tabs';
  import Header from '@/components/Header.svelte';
  import SnapshotBar from '@/components/SnapshotBar.svelte';
  import RecordingBar from '@/components/RecordingBar.svelte';
  import SessionList from '@/components/SessionList.svelte';
  import SessionDetail from '@/components/SessionDetail.svelte';
  import Settings from '@/components/Settings.svelte';
  import Toast from '@/components/Toast.svelte';

  type View = 'main' | 'detail' | 'settings';

  let view: View = $state('main');
  let sessions: Session[] = $state([]);
  let settings: SnapTabsSettings = $state({ ...DEFAULT_SETTINGS });
  let incognitoTabs = $state(0);
  let storageUsed = $state(0);
  let storageTotal = $state(10_485_760);
  let recording: LiveRecording | null = $state(null);
  let scopeAllWindows = $state(false);
  let searchQuery = $state('');
  let selectedSession: Session | null = $state(null);
  let loading = $state(true);

  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType: 'success' | 'error' | 'warning' = $state('success');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  let filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.tabs.some((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    );
  });

  function toast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    clearTimeout(toastTimer);
    toastMessage = msg;
    toastType = type;
    toastVisible = true;
    toastTimer = setTimeout(() => { toastVisible = false; }, 2500);
  }

  async function loadData() {
    try {
      const [sess, sett, stats, storage, rec] = await Promise.all([
        getSessions(), getSettings(), getTabStats(), getStorageUsage(), getRecording(),
      ]);
      sessions = sess;
      settings = sett;
      incognitoTabs = stats.incognitoTabs;
      storageUsed = storage.used;
      storageTotal = storage.total;
      recording = rec;
    } catch (err) {
      console.error('Load failed:', err);
      toast('Failed to load data', 'error');
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    const [sess, storage] = await Promise.all([getSessions(), getStorageUsage()]);
    sessions = sess;
    storageUsed = storage.used;
  }

  async function handleSnapshot(name: string) {
    try {
      let windowId: number | undefined;
      if (!scopeAllWindows) {
        const w = await chrome.windows.getCurrent();
        windowId = w.id;
      }
      await chrome.runtime.sendMessage({ action: 'snapshot', name: name || undefined, windowId });
      await refresh();
      toast('Snapshot saved!');
    } catch {
      toast('Failed to take snapshot', 'error');
    }
  }

  async function handleRestore(session: Session) {
    try {
      await chrome.runtime.sendMessage({ action: 'restore', sessionId: session.id });
      toast(`Restored: ${session.name}`);
      await refresh();
    } catch {
      toast('Failed to restore', 'error');
    }
  }

  async function handleDelete(session: Session) {
    try {
      await chrome.runtime.sendMessage({ action: 'delete', sessionId: session.id });
      sessions = sessions.filter((s) => s.id !== session.id);
      const storage = await getStorageUsage();
      storageUsed = storage.used;
      if (view === 'detail') view = 'main';
      toast('Session deleted');
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  async function handleRename(session: Session, newName: string) {
    try {
      await renameSession(session.id, newName);
      sessions = sessions.map((s) => s.id === session.id ? { ...s, name: newName } : s);
      if (selectedSession?.id === session.id) selectedSession = { ...selectedSession, name: newName };
      toast('Session renamed');
    } catch {
      toast('Failed to rename', 'error');
    }
  }

  async function handleDeleteAll() {
    try {
      await deleteAllSessions();
      sessions = [];
      const storage = await getStorageUsage();
      storageUsed = storage.used;
      toast('All sessions deleted');
      view = 'main';
    } catch {
      toast('Failed to delete sessions', 'error');
    }
  }

  async function handleExport() {
    try {
      const payload = await buildExportPayload();
      if (payload.sessions.length === 0) {
        toast('No sessions to export', 'warning');
        return;
      }
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `snaptabs-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Exported ${payload.sessions.length} session${payload.sessions.length === 1 ? '' : 's'}`);
    } catch {
      toast('Export failed', 'error');
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await importSessions(data);
      await refresh();
      if (result.imported === 0) {
        toast('Nothing new to import', 'warning');
      } else {
        const noun = result.imported === 1 ? 'snapshot' : 'snapshots';
        toast(`${result.imported} ${noun} imported`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast(msg, 'error');
    }
  }

  async function handleUpdateSettings(partial: Partial<SnapTabsSettings>) {
    try {
      await updateSettings(partial);
      settings = { ...settings, ...partial };
    } catch {
      toast('Failed to save settings', 'error');
    }
  }

  async function handleRecordingToggle() {
    if (recording?.isActive) {
      await handleStopRecording();
    } else {
      // Start
      try {
        let windowId = -1;
        if (!scopeAllWindows) {
          const w = await chrome.windows.getCurrent();
          windowId = w.id ?? -1;
        }
        const result = await chrome.runtime.sendMessage({ action: 'startRecording', name: '', windowId });
        recording = result as LiveRecording;
        toast('Recording started');
      } catch {
        toast('Failed to start recording', 'error');
      }
    }
  }

  async function handleStopRecording() {
    try {
      const session = await chrome.runtime.sendMessage({ action: 'stopRecording' }) as Session | null;
      recording = null;
      if (session) {
        await refresh();
        toast(`Recording saved: ${session.name}`);
      }
    } catch {
      toast('Failed to stop recording', 'error');
    }
  }

  async function handleCancelRecording() {
    try {
      await chrome.runtime.sendMessage({ action: 'cancelRecording' });
      recording = null;
      toast('Recording cancelled', 'warning');
    } catch {
      toast('Failed to cancel', 'error');
    }
  }

  function handleSessionClick(session: Session) {
    selectedSession = session;
    view = 'detail';
  }

  onMount(() => { loadData(); });
</script>

<Toast visible={toastVisible} message={toastMessage} type={toastType} />

<main class="popup">
  {#if loading}
    <div class="loader">
      <div class="loader-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
          <rect x="2" y="7" width="20" height="7" rx="1" />
        </svg>
      </div>
      <p class="loader-text">Loading...</p>
    </div>
  {:else if view === 'settings'}
    <Settings
      {settings}
      {storageUsed}
      {storageTotal}
      onBack={() => view = 'main'}
      onUpdateSettings={handleUpdateSettings}
      onDeleteAll={handleDeleteAll}
      onExport={handleExport}
      onImport={handleImport}
    />
  {:else if view === 'detail' && selectedSession}
    <SessionDetail
      session={selectedSession}
      onBack={() => view = 'main'}
      onRestore={handleRestore}
      onDelete={handleDelete}
      onRename={handleRename}
    />
  {:else}
    <Header
      {recording}
      onSettingsClick={() => view = 'settings'}
    />

    <SnapshotBar
      {scopeAllWindows}
      isRecording={recording?.isActive ?? false}
      incognitoTabs={scopeAllWindows ? incognitoTabs : 0}
      onSnapshot={handleSnapshot}
      onToggleScope={() => scopeAllWindows = !scopeAllWindows}
      onRecordingToggle={handleRecordingToggle}
    />

    <RecordingBar
      {recording}
      onStopRecording={handleStopRecording}
      onCancelRecording={handleCancelRecording}
    />

    <SessionList
      sessions={filtered}
      {searchQuery}
      onSessionClick={handleSessionClick}
      onRestore={handleRestore}
      onDelete={handleDelete}
      onRename={handleRename}
      onSearchChange={(q) => searchQuery = q}
    />
  {/if}
</main>

<style>
  .popup {
    width: 400px;
    height: 600px;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .loader {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .loader-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: oklch(0.65 0.19 255 / 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
    animation: breathe 2s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.05); opacity: 1; }
  }
  .loader-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-muted);
  }
</style>

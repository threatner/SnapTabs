<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SnapTabsSettings } from '@/lib/types';
  import { DEFAULT_SETTINGS } from '@/lib/types';
  import { getSettings, updateSettings } from '@/lib/storage';

  // Interval offered here; the full set of choices lives in Settings.
  const WELCOME_BACKUP_MINUTES = 15;

  let settings: SnapTabsSettings = $state({ ...DEFAULT_SETTINGS });
  let loaded = $state(false);
  // Settings writes are read-modify-write; run them one at a time.
  let writes: Promise<void> = Promise.resolve();
  // null = unknown (API unavailable), so we just show the instructions.
  let pinned: boolean | null = $state(null);
  let shortcut = $state('');
  let pinTimer: ReturnType<typeof setInterval> | undefined;

  async function checkPinned() {
    try {
      if (typeof chrome.action?.getUserSettings !== 'function') return;
      pinned = (await chrome.action.getUserSettings()).isOnToolbar;
      if (pinned) stopPinPolling();
    } catch { /* leave as unknown */ }
  }

  // The toolbar pin can't be observed, so poll while the user is pinning.
  function stopPinPolling() {
    clearInterval(pinTimer);
    pinTimer = undefined;
  }

  async function loadShortcut() {
    try {
      const cmd = (await chrome.commands.getAll()).find((c) => c.name === 'snapshot-tabs');
      shortcut = cmd?.shortcut ?? '';
    } catch { /* leave empty */ }
  }

  function set(partial: Partial<SnapTabsSettings>) {
    settings = { ...settings, ...partial };
    writes = writes.then(() => updateSettings(partial)).catch(() => {});
  }

  function openShortcutSettings() {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }

  async function closeTab() {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
  }

  onMount(() => {
    getSettings().then((s) => { settings = s; }).catch(() => {}).finally(() => { loaded = true; });
    loadShortcut();
    checkPinned().then(() => {
      if (pinned === false) pinTimer = setInterval(checkPinned, 1500);
    });
  });

  onDestroy(stopPinPolling);
</script>

<main class="welcome">
  <header class="hero">
    <img src="/icon/128.png" alt="" width="56" height="56" class="hero-icon" />
    <h1>SnapTabs is installed</h1>
    <p class="hero-sub">Three quick steps to make sure you never lose your tabs.</p>
  </header>

  <section class="step" data-step="pin">
    <div class="step-num" class:step-num--done={pinned === true}>
      {#if pinned === true}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      {:else}1{/if}
    </div>
    <div class="step-body">
      <h2>Pin SnapTabs to your toolbar</h2>
      {#if pinned === true}
        <p class="step-text step-text--ok">Pinned. SnapTabs is one click away.</p>
      {:else}
        <p class="step-text">
          Click the <strong>puzzle-piece</strong> icon at the top right of Chrome, then the
          <strong>pin</strong> next to SnapTabs.
        </p>
      {/if}
    </div>
  </section>

  <section class="step" data-step="autosave">
    <div class="step-num">2</div>
    <div class="step-body">
      <h2>Choose how SnapTabs keeps you safe</h2>
      <p class="step-text">Both are off until you turn them on, and everything stays on this device.</p>

      <label class="option">
        <div class="option-text">
          <p class="option-title">Save my tabs when I close Chrome</p>
          <p class="option-desc">Every window is saved when you quit, ready to restore next time.</p>
        </div>
        <input type="checkbox" class="tv-switch" aria-label="Save my tabs when I close Chrome" disabled={!loaded}
          checked={settings.autoSnapshotOnBrowserClose}
          onchange={() => set({ autoSnapshotOnBrowserClose: !settings.autoSnapshotOnBrowserClose })} />
      </label>

      <label class="option">
        <div class="option-text">
          <p class="option-title">Keep a rolling backup</p>
          <p class="option-desc">Refreshes one backup of your open tabs every {WELCOME_BACKUP_MINUTES} minutes, in case Chrome crashes or a window closes.</p>
        </div>
        <input type="checkbox" class="tv-switch" aria-label="Keep a rolling backup" disabled={!loaded}
          checked={settings.autoBackupMinutes > 0}
          onchange={() => set({ autoBackupMinutes: settings.autoBackupMinutes > 0 ? 0 : WELCOME_BACKUP_MINUTES })} />
      </label>
    </div>
  </section>

  <section class="step" data-step="shortcuts">
    <div class="step-num">3</div>
    <div class="step-body">
      <h2>Save and find tabs without opening anything</h2>
      <ul class="tips">
        <li>
          {#if shortcut}
            Press <kbd class="shortcut">{shortcut}</kbd> to save every open tab, in all windows.
          {:else}
            Set a keyboard shortcut for saving tabs in
            <button class="link-btn" onclick={openShortcutSettings}>Chrome's shortcut settings</button>.
          {/if}
        </li>
        <li>
          Type <kbd>st</kbd> then <kbd>Space</kbd> in the address bar to search every tab you've saved.
        </li>
        <li>Right-click the SnapTabs icon and choose <strong>Save all tabs with SnapTabs</strong>.</li>
      </ul>
    </div>
  </section>

  <footer class="footer">
    <p class="footer-note">You can change any of this later in SnapTabs &rsaquo; Settings.</p>
    <button class="done-btn" onclick={closeTab}>Done</button>
  </footer>
</main>

<style>
  :global(body) {
    min-height: 100vh;
  }
  .welcome {
    max-width: 560px;
    margin: 0 auto;
    padding: 56px 16px 64px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .hero {
    text-align: center;
    margin-bottom: 18px;
  }
  .hero-icon {
    border-radius: 14px;
    margin: 0 auto 16px;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--fg);
  }
  .hero-sub {
    margin-top: 8px;
    font-size: 14px;
    color: var(--fg-muted);
  }

  .step {
    display: flex;
    gap: 14px;
    padding: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .step-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    background: oklch(0.65 0.19 255 / 0.18);
    color: var(--primary);
  }
  .step-num--done {
    background: oklch(0.65 0.18 145 / 0.2);
    color: oklch(0.72 0.17 145);
  }
  .step-body {
    flex: 1;
    min-width: 0;
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
    color: var(--fg);
    margin-top: 3px;
  }
  .step-text {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--fg-muted);
  }
  .step-text strong {
    color: var(--fg);
    font-weight: 600;
  }
  .step-text--ok {
    color: oklch(0.72 0.17 145);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 12px;
    padding: 12px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
  }
  .option-text {
    flex: 1;
    min-width: 0;
  }
  .option-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
  }
  .option-desc {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--fg-muted);
  }

  .tips {
    margin-top: 8px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--fg-muted);
  }
  .tips strong {
    color: var(--fg);
    font-weight: 600;
  }
  kbd {
    display: inline-block;
    padding: 0 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 20px;
    color: var(--fg);
    background: var(--secondary);
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 5px;
  }
  .link-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--primary);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .footer-note {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .done-btn {
    padding: 9px 22px;
    font-size: 13px;
    font-weight: 600;
    color: var(--primary-fg);
    background: var(--primary);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .done-btn:hover { filter: brightness(1.1); }
</style>

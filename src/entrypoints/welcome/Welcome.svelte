<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SnapTabsSettings } from '@/lib/types';
  import { DEFAULT_SETTINGS } from '@/lib/types';
  import { getSettings } from '@/lib/storage';
  import { sendMessage } from '@/lib/messages';
  import { REPO_URL } from '@/lib/links';

  // Interval offered here; the full set of choices lives in Settings.
  const WELCOME_BACKUP_MINUTES = 15;

  // The same page is the install welcome and the guide behind the popup's
  // ? button and Settings card (welcome.html?from=help); only the heading
  // changes (D02 in docs/decisions).
  const fromHelp = new URLSearchParams(location.search).get('from') === 'help';

  let settings: SnapTabsSettings = $state({ ...DEFAULT_SETTINGS });
  let loaded = $state(false);
  // Settings are written by the service worker so a write completes even if
  // this tab is closed right after a toggle. Done waits for pending writes.
  let pending: Promise<unknown>[] = [];
  // null = unknown (API unavailable), so we just show the instructions.
  let pinned: boolean | null = $state(null);
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

  function set(partial: Partial<SnapTabsSettings>) {
    const previous = Object.fromEntries(
      Object.keys(partial).map((k) => [k, settings[k as keyof SnapTabsSettings]]),
    ) as Partial<SnapTabsSettings>;
    settings = { ...settings, ...partial };
    // If the write fails, flip the toggle back rather than show a false "on".
    pending.push(sendMessage({ action: 'updateSettings', settings: partial }).catch(() => {
      settings = { ...settings, ...previous };
    }));
  }

  async function closeTab() {
    await Promise.all(pending);
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
  }

  onMount(() => {
    getSettings().then((s) => { settings = s; }).catch(() => {}).finally(() => { loaded = true; });
    checkPinned().then(() => {
      if (pinned === false) pinTimer = setInterval(checkPinned, 1500);
    });
  });

  onDestroy(stopPinPolling);
</script>

<main class="welcome">
  <header class="hero">
    <img src="/icon/128.png" alt="" width="56" height="56" class="hero-icon" />
    <h1>{fromHelp ? 'How to use SnapTabs' : 'SnapTabs is installed'}</h1>
    <p class="hero-sub">
      {fromHelp ? 'Save your tabs, close them, and bring them back any time.' : "Here's how it works, plus a few quick settings."}
    </p>
  </header>

  <section class="how" data-step="how" aria-labelledby="how-heading">
    <h2 id="how-heading" class="how-heading">How SnapTabs works</h2>
    <ol class="how-list">
      <li class="how-row">
        <div class="how-text">
          <p class="how-title">Save your tabs</p>
          <p class="how-desc">Click <strong>Snapshot</strong> in the SnapTabs popup. Every tab in the window is saved, and your tabs stay open.</p>
        </div>
        <div class="how-rep" aria-hidden="true">
          <span class="btn btn-primary rep rep-primary">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Snapshot
          </span>
        </div>
      </li>
      <li class="how-row">
        <div class="how-text">
          <p class="how-title">Close them</p>
          <p class="how-desc">Close tabs whenever you like. They're safe in SnapTabs.</p>
        </div>
        <div class="how-rep" aria-hidden="true">
          <span class="rep rep-tab">
            <span class="tab-title">Research…</span>
            <span class="tab-x"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
          </span>
        </div>
      </li>
      <li class="how-row">
        <div class="how-text">
          <p class="how-title">Bring them back</p>
          <p class="how-desc">Open the popup and click <strong>Restore</strong> next to a saved session. Your tabs come back.</p>
        </div>
        <div class="how-rep" aria-hidden="true">
          <span class="btn btn-sm btn-secondary rep rep-secondary">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Restore
          </span>
        </div>
      </li>
    </ol>
  </section>

  <section class="step" data-step="pin">
    <div class="step-body">
      <h2 class="step-heading">
        <span class="step-num" class:step-num--done={pinned === true}>
          {#if pinned === true}
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="Done"><polyline points="20 6 9 17 4 12" /></svg>
          {:else}1{/if}
        </span>
        Pin SnapTabs to your toolbar
      </h2>
      {#if pinned === true}
        <p class="step-text step-text--ok">Pinned. SnapTabs is one click away.</p>
      {:else}
        <p class="step-text">
          Click the extensions icon
          <span class="ui-icon" role="img" aria-label="extensions (puzzle piece) icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" /></svg>
          </span>
          at the top right of your browser, then the pin
          <span class="ui-icon" role="img" aria-label="pin icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" /></svg>
          </span>
          next to SnapTabs.
        </p>
      {/if}
    </div>
  </section>

  <section class="step" data-step="autosave">
    <div class="step-body">
      <h2 class="step-heading"><span class="step-num">2</span>Choose what SnapTabs saves automatically</h2>
      <p class="step-text">Off by default. Everything stays on this device. You can change these later in Settings.</p>

      <label class="option">
        <div class="option-text">
          <p class="option-title">When I quit the browser</p>
          <p class="option-desc">Saves all open windows as one session.</p>
        </div>
        <input type="checkbox" class="tv-switch" aria-label="When I quit the browser" disabled={!loaded}
          checked={settings.autoSnapshotOnBrowserClose}
          onchange={() => set({ autoSnapshotOnBrowserClose: !settings.autoSnapshotOnBrowserClose })} />
      </label>

      <label class="option">
        <div class="option-text">
          <p class="option-title">When I close a tab group</p>
          <p class="option-desc">Keeps a copy of the group's tabs.</p>
        </div>
        <input type="checkbox" class="tv-switch" aria-label="When I close a tab group" disabled={!loaded}
          checked={settings.saveClosedGroups}
          onchange={() => set({ saveClosedGroups: !settings.saveClosedGroups })} />
      </label>

      <label class="option">
        <div class="option-text">
          <p class="option-title">Rolling backup every {WELCOME_BACKUP_MINUTES} minutes</p>
          <p class="option-desc">Keeps one up-to-date copy of your open tabs in case the browser crashes.</p>
        </div>
        <input type="checkbox" class="tv-switch" aria-label="Rolling backup every {WELCOME_BACKUP_MINUTES} minutes" disabled={!loaded}
          checked={settings.autoBackupMinutes > 0}
          onchange={() => set({ autoBackupMinutes: settings.autoBackupMinutes > 0 ? 0 : WELCOME_BACKUP_MINUTES })} />
      </label>
    </div>
  </section>

  <footer class="footer">
    <a class="gh-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 2.89-.39c.98 0 1.96.13 2.89.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
      Free and open source. View SnapTabs on GitHub
    </a>
    <button class="btn btn-primary done-btn" onclick={closeTab}>Done</button>
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

  /* "How SnapTabs works": replicas copy the popup's real controls
     (.snap-btn in SnapshotBar, .restore-btn in SessionDetail). */
  .how {
    padding: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .how-heading {
    margin: 0 0 14px;
  }
  .how-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .how-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .how-text {
    flex: 1;
    min-width: 0;
  }
  /* Fixed column so the three replicas line up. */
  .how-rep {
    flex: 0 0 120px;
    display: flex;
  }
  .how-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
  }
  .how-desc {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--fg-muted);
  }
  .how-desc strong {
    color: var(--fg);
    font-weight: 600;
  }
  /* Replicas use the popup's own button classes; they aren't clickable. */
  .rep { cursor: default; pointer-events: none; }
  .rep-tab {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px 6px 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    background: var(--secondary);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 8px 8px 0 0;
  }
  .tab-title {
    color: var(--fg-muted);
  }
  .tab-x {
    display: inline-flex;
    padding: 2px;
    color: var(--fg);
    background: var(--accent);
    border-radius: 4px;
  }
  @media (max-width: 480px) {
    .how-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .how-rep { flex: none; }
  }

  .step {
    padding: 18px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .step-heading {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    background: oklch(0.65 0.19 255 / 0.18);
    color: var(--primary);
  }
  .step-num--done {
    background: oklch(0.65 0.18 145 / 0.2);
    color: var(--success);
  }
  h2 {
    font-size: 15px;
    font-weight: 600;
    color: var(--fg);
  }
  .step-text {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--fg-muted);
  }
  .step-text--ok {
    color: var(--success);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
    padding: 12px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
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


  .footer {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 16px;
  }
  .gh-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-muted);
    text-decoration: none;
  }
  .gh-link:hover { color: var(--fg); text-decoration: underline; }
  .done-btn { margin-left: auto; }
  /* Inline stand-in for a browser toolbar button. */
  .ui-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: 0 2px;
    vertical-align: -6px;
    color: var(--fg);
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .done-btn { height: 36px; padding: 0 22px; font-size: 13px; }
</style>

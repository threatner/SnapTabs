<script lang="ts">
  import type { SnapTabsSettings } from '@/lib/types';
  import { normalizeDomain } from '@/lib/types';
  import { BACKUP_INTERVALS } from '@/lib/backup';
  import { REVIEW_URL } from '@/lib/links';
  import { sendMessage } from '@/lib/messages';
  import { formatBytes, plural } from '@/lib/format';
  import { onMount } from 'svelte';

  interface Props {
    settings: SnapTabsSettings;
    sessionCount: number;
    storageUsed: number;
    storageTotal: number;
    onBack: () => void;
    onUpdateSettings: (partial: Partial<SnapTabsSettings>) => void;
    onDeleteAll: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
  }

  let { settings, sessionCount, storageUsed, storageTotal, onBack, onUpdateSettings, onDeleteAll, onExport, onImport }: Props = $props();

  let confirmDeleteAll = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let newDomain = $state('');

  function addExcludedDomain() {
    const normalized = normalizeDomain(newDomain);
    if (!normalized) return;
    if (settings.excludedDomains.includes(normalized)) {
      newDomain = '';
      return;
    }
    onUpdateSettings({ excludedDomains: [...settings.excludedDomains, normalized] });
    newDomain = '';
  }

  function removeExcludedDomain(domain: string) {
    onUpdateSettings({ excludedDomains: settings.excludedDomains.filter((d) => d !== domain) });
  }

  function handleDomainKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExcludedDomain();
    }
  }

  // The review link goes to the Chrome Web Store, so it's hidden on Edge.
  const showRateLink = !navigator.userAgent.includes('Edg/');

  // Someone who rates from here shouldn't get the one-time banner later.
  function handleRateClick() {
    sendMessage({ action: 'dismissRatingPrompt' }).catch(() => {});
  }

  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '';

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onImport(file);
    input.value = '';
  }

  let pct = $derived(storageTotal > 0 ? Math.min((storageUsed / storageTotal) * 100, 100) : 0);

  // The incognito rows do nothing unless SnapTabs may run in incognito, so
  // they're hidden then (D24). Unknown (check failed) shows them.
  let incognitoAllowed = $state(false);
  onMount(() => {
    try {
      Promise.resolve(chrome.extension.isAllowedIncognitoAccess())
        .then((allowed) => { incognitoAllowed = allowed !== false; })
        .catch(() => { incognitoAllowed = true; });
    } catch {
      incognitoAllowed = true;
    }
  });

  function handleDeleteAll() {
    if (confirmDeleteAll) {
      onDeleteAll();
      confirmDeleteAll = false;
    } else {
      confirmDeleteAll = true;
      setTimeout(() => { confirmDeleteAll = false; }, 4000);
    }
  }
</script>

<div class="settings">
  <div class="settings-header">
    <button class="icon-btn back-btn" onclick={onBack} aria-label="Back" title="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
    <h2>Settings</h2>
  </div>

  <div class="settings-body">
    <section class="section" aria-labelledby="sec-auto">
      <h3 id="sec-auto" class="section-label">Save automatically</h3>
      <p class="section-caption">Off by default. Everything stays on this device.</p>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">When I quit the browser</p>
          <p class="setting-desc">Saves all open windows as one session.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.autoSnapshotOnBrowserClose}
          onchange={() => onUpdateSettings({ autoSnapshotOnBrowserClose: !settings.autoSnapshotOnBrowserClose })} />
      </label>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">When I close a tab group</p>
          <p class="setting-desc">Keeps a copy of the group's tabs.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.saveClosedGroups}
          onchange={() => onUpdateSettings({ saveClosedGroups: !settings.saveClosedGroups })} />
      </label>
      {#if incognitoAllowed}
        <label class="setting-row">
          <div class="setting-text">
            <p class="setting-title">When I close an incognito window</p>
            <p class="setting-desc">Saves its tabs before they're gone.</p>
          </div>
          <input type="checkbox" class="tv-switch" checked={settings.autoSnapshotOnClose}
            onchange={() => onUpdateSettings({ autoSnapshotOnClose: !settings.autoSnapshotOnClose })} />
        </label>
      {/if}
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Rolling backup</p>
          <p class="setting-desc">Keeps one up-to-date copy of your open tabs in case the browser crashes.</p>
        </div>
        <select
          class="select-input"
          aria-label="Rolling backup interval"
          value={settings.autoBackupMinutes}
          onchange={(e) => onUpdateSettings({ autoBackupMinutes: Number((e.currentTarget as HTMLSelectElement).value) })}
        >
          {#each BACKUP_INTERVALS as m (m)}
            <option value={m}>{m === 0 ? 'Off' : `Every ${m} min`}</option>
          {/each}
        </select>
      </label>
    </section>

    <section class="section" aria-labelledby="sec-saving">
      <h3 id="sec-saving" class="section-label">Saving</h3>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Ask before saving a duplicate</p>
          <p class="setting-desc">When your tabs match your last session.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.warnOnDuplicateSnapshot}
          onchange={() => onUpdateSettings({ warnOnDuplicateSnapshot: !settings.warnOnDuplicateSnapshot })} />
      </label>
      <div class="setting-row setting-row--block">
        <div class="setting-text">
          <p class="setting-title" id="excluded-title">Never save these sites</p>
          <p class="setting-desc">Applies to every save, including automatic ones. Subdomains included.</p>
        </div>

        {#if settings.excludedDomains.length > 0}
          <ul class="domain-chips" aria-labelledby="excluded-title">
            {#each settings.excludedDomains as domain (domain)}
              <li class="domain-chip">
                {domain}
                <button type="button" class="chip-remove" aria-label="Remove {domain}" onclick={() => removeExcludedDomain(domain)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="domain-input-wrap">
          <input
            type="text"
            class="domain-input"
            placeholder="Add a site, e.g. mail.google.com"
            aria-label="Add a site to never save"
            bind:value={newDomain}
            onkeydown={handleDomainKeydown}
          />
          {#if newDomain.trim()}
            <button type="button" class="btn btn-sm btn-primary domain-add" onclick={addExcludedDomain}>Add</button>
          {/if}
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="sec-restoring">
      <h3 id="sec-restoring" class="section-label">Restoring</h3>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Open in a new window</p>
          <p class="setting-desc">Otherwise tabs open in this window.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.restoreInNewWindow}
          onchange={() => onUpdateSettings({ restoreInNewWindow: !settings.restoreInNewWindow })} />
      </label>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Sleep restored tabs</p>
          <p class="setting-desc">Background tabs load when you click them. Saves memory.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.sleepRestoredTabs}
          onchange={() => onUpdateSettings({ sleepRestoredTabs: !settings.sleepRestoredTabs })} />
      </label>
      {#if incognitoAllowed}
        <label class="setting-row">
          <div class="setting-text">
            <p class="setting-title">Incognito tabs open in an incognito window</p>
            <p class="setting-desc">Otherwise they open as normal tabs.</p>
          </div>
          <input type="checkbox" class="tv-switch" checked={settings.restoreIncognitoToIncognito}
            onchange={() => onUpdateSettings({ restoreIncognitoToIncognito: !settings.restoreIncognitoToIncognito })} />
        </label>
      {/if}
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Delete a session after restoring it</p>
          <p class="setting-desc">Pinned sessions too.</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.autoDeleteAfterRestore}
          onchange={() => onUpdateSettings({ autoDeleteAfterRestore: !settings.autoDeleteAfterRestore })} />
      </label>
    </section>

    <section class="section" aria-labelledby="sec-data">
      <h3 id="sec-data" class="section-label">Storage &amp; data</h3>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Keep up to</p>
          <p class="setting-desc">When full, the oldest automatic saves are removed first. Pinned sessions are never removed.</p>
        </div>
        <span class="num-wrap">
          <input
            type="number"
            min="1"
            max="500"
            value={settings.maxSessions}
            aria-label="Maximum number of sessions"
            onchange={(e) => {
              const v = parseInt((e.currentTarget as HTMLInputElement).value);
              if (!isNaN(v) && v > 0) onUpdateSettings({ maxSessions: v });
            }}
            class="num-input"
          />
          <span class="num-unit">sessions</span>
        </span>
      </label>

      <div class="storage">
        <p class="storage-val">
          {formatBytes(storageUsed)} of {formatBytes(storageTotal)} used
        </p>
        <div class="storage-track" role="meter" aria-label="Storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}>
          <div class="storage-fill" class:storage-fill--warn={pct > 80} style="width: {pct}%"></div>
        </div>
        {#if pct > 80}
          <p class="storage-warn">Storage is almost full. Delete sessions you no longer need.</p>
        {/if}
      </div>

      <div class="data-row">
        <button class="btn btn-secondary data-btn" onclick={onExport}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
        <button class="btn btn-secondary data-btn" onclick={() => fileInput?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import
        </button>
      </div>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="file-input" onchange={handleFileChange} />
      <p class="data-hint">Export saves every session to a file. Import adds the sessions from an export.</p>

      <div class="danger-row">
        <button class="btn btn-sm btn-danger-text danger-btn" class:danger-active={confirmDeleteAll} onclick={handleDeleteAll} disabled={sessionCount === 0}>
          {confirmDeleteAll ? `Click again to delete ${plural(sessionCount, 'session')}` : 'Delete all sessions…'}
        </button>
      </div>
    </section>

    <section class="section" aria-labelledby="sec-help">
      <h3 id="sec-help" class="section-label">Help</h3>
      <a class="link-row" data-testid="guide-link" href="/welcome.html?from=help" target="_blank" rel="noopener">
        How to use SnapTabs
        {@render external()}
      </a>
      {#if showRateLink}
        <a class="link-row" data-testid="rate-link" href={REVIEW_URL} target="_blank" rel="noopener noreferrer" onclick={handleRateClick}>
          Rate SnapTabs on the Chrome Web Store
          {@render external()}
        </a>
      {/if}
      <a class="link-row" data-testid="issues-link" href="https://github.com/threatner/SnapTabs/issues" target="_blank" rel="noopener noreferrer">
        Report a problem or suggest a feature
        {@render external()}
      </a>
    </section>

    {#if version}
      <p class="settings-footer">SnapTabs {version}</p>
    {/if}
  </div>
</div>

{#snippet external()}
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="link-arrow" aria-hidden="true">
    <path d="M7 7h10v10"/><path d="M7 17 17 7"/>
  </svg>
{/snippet}

<style>
  .settings {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .settings-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    flex-shrink: 0;
  }
  .back-btn { margin-left: -6px; }
  .settings-header h2 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--fg);
  }

  .settings-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 16px 12px;
  }

  .section { margin-bottom: 24px; }
  .section-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .section-caption {
    margin-top: 2px;
    font-size: var(--text-xs);
    color: var(--fg-muted);
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }
  .setting-row--block {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    cursor: default;
  }
  .setting-text { flex: 1; min-width: 0; }
  .setting-title {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--fg);
    line-height: 1.3;
  }
  .setting-desc {
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--fg-muted);
    margin-top: 2px;
  }

  .num-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .num-unit { font-size: var(--text-sm); color: var(--fg-muted); }
  .num-input, .select-input {
    height: 28px;
    padding: 0 6px;
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--r);
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--fg);
    transition: border-color 0.15s;
  }
  .num-input { width: 56px; text-align: center; }
  .select-input { cursor: pointer; flex-shrink: 0; }
  .num-input:focus, .select-input:focus { border-color: var(--ring); }

  .domain-chips {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 90px;
    overflow-y: auto;
  }
  .domain-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px 2px 8px;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--fg);
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    max-width: 100%;
  }
  .chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    flex-shrink: 0;
  }
  .chip-remove:hover {
    background: oklch(0.63 0.2 25 / 0.18);
    color: var(--destructive);
  }

  .domain-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 3px 0 10px;
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--r);
    transition: border-color 0.15s;
  }
  .domain-input-wrap:focus-within { border-color: var(--ring); }
  .domain-input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    font-family: inherit;
    font-size: var(--text-sm);
    color: var(--fg);
    outline: none;
  }
  .domain-input::placeholder { color: var(--fg-muted); }

  .storage { padding: 12px 0 4px; }
  .storage-val { font-size: var(--text-sm); color: var(--fg-muted); margin-bottom: 6px; }
  .storage-track {
    height: 4px;
    border-radius: var(--r-pill);
    background: var(--muted);
    overflow: hidden;
  }
  .storage-fill {
    height: 100%;
    border-radius: var(--r-pill);
    background: var(--primary);
    transition: width 0.4s ease;
  }
  .storage-fill--warn { background: var(--warning); }
  .storage-warn { margin-top: 6px; font-size: var(--text-xs); color: var(--warning); }

  .data-row { display: flex; gap: 8px; margin-top: 12px; }
  .data-btn { flex: 1; }
  .file-input { display: none; }
  .data-hint {
    margin-top: 6px;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--fg-muted);
  }
  .danger-row { margin-top: 12px; margin-left: -10px; }
  .danger-btn:disabled { opacity: 0.4; }
  .danger-active { background: oklch(0.63 0.2 25 / 0.12); }

  .link-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--fg);
    text-decoration: none;
  }
  .link-row:last-child { border-bottom: none; }
  .link-arrow { flex-shrink: 0; color: var(--fg-muted); transition: color 0.15s; }
  .link-row:hover { color: var(--primary); }
  .link-row:hover .link-arrow { color: var(--primary); }

  .settings-footer {
    padding: 4px 0 8px;
    font-size: var(--text-xs);
    color: var(--fg-muted);
    text-align: center;
  }
</style>

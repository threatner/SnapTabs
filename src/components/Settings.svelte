<script lang="ts">
  import type { SnapTabsSettings } from '@/lib/types';
  import { normalizeDomain } from '@/lib/types';

  interface Props {
    settings: SnapTabsSettings;
    storageUsed: number;
    storageTotal: number;
    onBack: () => void;
    onUpdateSettings: (partial: Partial<SnapTabsSettings>) => void;
    onDeleteAll: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
  }

  let { settings, storageUsed, storageTotal, onBack, onUpdateSettings, onDeleteAll, onExport, onImport }: Props = $props();

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

  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '';

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onImport(file);
    input.value = '';
  }

  function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  }

  let pct = $derived(storageTotal > 0 ? Math.min((storageUsed / storageTotal) * 100, 100) : 0);

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
  <!-- Header -->
  <div class="settings-header">
    <button class="back-btn" onclick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
    <h2>Settings</h2>
    {#if version}
      <span class="version-pill">v{version}</span>
    {/if}
  </div>

  <div class="settings-body">
    <!-- Auto-Save -->
    <h3 class="section-label">Auto-Save</h3>
    <div class="section">
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Save on browser close</p>
          <p class="setting-desc">Snapshot open tabs when you quit Chrome so you can restore them later</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.autoSnapshotOnBrowserClose}
          onchange={() => onUpdateSettings({ autoSnapshotOnBrowserClose: !settings.autoSnapshotOnBrowserClose })} />
      </label>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Save incognito on close</p>
          <p class="setting-desc">Automatically save tabs when closing incognito windows</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.autoSnapshotOnClose}
          onchange={() => onUpdateSettings({ autoSnapshotOnClose: !settings.autoSnapshotOnClose })} />
      </label>
    </div>

    <!-- Snapshot -->
    <h3 class="section-label">Snapshot</h3>
    <div class="section">
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Warn on duplicate snapshot</p>
          <p class="setting-desc">Ask before saving when tabs match your most recent snapshot</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.warnOnDuplicateSnapshot}
          onchange={() => onUpdateSettings({ warnOnDuplicateSnapshot: !settings.warnOnDuplicateSnapshot })} />
      </label>
      <div class="setting-row setting-row--block">
        <div class="setting-text setting-text--with-meta">
          <div>
            <p class="setting-title">Excluded domains</p>
            <p class="setting-desc">Skip these domains in snapshots, recordings, and auto-saves</p>
          </div>
          {#if settings.excludedDomains.length > 0}
            <span class="count-pill">{settings.excludedDomains.length}</span>
          {/if}
        </div>

        <div class="domain-card">
          {#if settings.excludedDomains.length === 0}
            <div class="domain-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <p>No domains excluded yet</p>
              <span>Add one below to skip it when capturing tabs</span>
            </div>
          {:else}
            <ul class="domain-list">
              {#each settings.excludedDomains as domain (domain)}
                <li class="domain-item">
                  <span class="domain-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  </span>
                  <span class="domain-text">{domain}</span>
                  <button type="button" class="domain-remove" aria-label="Remove {domain}" onclick={() => removeExcludedDomain(domain)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}

          <div class="domain-input-wrap" class:domain-input-wrap--filled={!!newDomain.trim()}>
            <svg class="domain-input-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <input
              type="text"
              class="domain-input"
              placeholder="Add a domain — e.g. mail.google.com"
              bind:value={newDomain}
              onkeydown={handleDomainKeydown}
            />
            {#if newDomain.trim()}
              <button type="button" class="domain-add" onclick={addExcludedDomain}>Add</button>
            {:else}
              <kbd class="domain-kbd">↵</kbd>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Restore -->
    <h3 class="section-label">Restore</h3>
    <div class="section">
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Open in new window</p>
          <p class="setting-desc">Always restore sessions in a new window</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.restoreInNewWindow}
          onchange={() => onUpdateSettings({ restoreInNewWindow: !settings.restoreInNewWindow })} />
      </label>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Auto-delete after restore</p>
          <p class="setting-desc">Remove session data after restoring</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.autoDeleteAfterRestore}
          onchange={() => onUpdateSettings({ autoDeleteAfterRestore: !settings.autoDeleteAfterRestore })} />
      </label>
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Restore private to private</p>
          <p class="setting-desc">Open incognito tabs in an incognito window</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.restoreIncognitoToIncognito}
          onchange={() => onUpdateSettings({ restoreIncognitoToIncognito: !settings.restoreIncognitoToIncognito })} />
      </label>
    </div>

    <!-- Warnings -->
    <h3 class="section-label">Warnings</h3>
    <div class="section">
      <label class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Incognito save warning</p>
          <p class="setting-desc">Show warning when saving private tabs</p>
        </div>
        <input type="checkbox" class="tv-switch" checked={settings.showIncognitoWarning}
          onchange={() => onUpdateSettings({ showIncognitoWarning: !settings.showIncognitoWarning })} />
      </label>
    </div>

    <!-- Storage -->
    <h3 class="section-label">Storage</h3>
    <div class="section">
      <div class="setting-row">
        <div class="setting-text">
          <p class="setting-title">Max stored sessions</p>
          <p class="setting-desc">Oldest auto-saves removed when limit reached</p>
        </div>
        <input
          type="number"
          min="1"
          max="500"
          value={settings.maxSessions}
          onchange={(e) => {
            const v = parseInt((e.currentTarget as HTMLInputElement).value);
            if (!isNaN(v) && v > 0) onUpdateSettings({ maxSessions: v });
          }}
          class="num-input"
        />
      </div>
      <div class="storage-card">
        <div class="storage-top">
          <span class="storage-label">Storage Used</span>
          <span class="storage-val">{fmtBytes(storageUsed)} / {fmtBytes(storageTotal)}</span>
        </div>
        <div class="storage-track">
          <div class="storage-fill" class:storage-fill--warn={pct > 80} style="width: {pct}%"></div>
        </div>
        {#if pct > 80}
          <p class="storage-warn">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            Consider deleting old sessions
          </p>
        {/if}
      </div>
    </div>

    <!-- Data -->
    <h3 class="section-label">Data</h3>
    <div class="section data-section">
      <div class="data-row">
        <button class="data-btn" onclick={onExport}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
        <button class="data-btn" onclick={() => fileInput?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import
        </button>
      </div>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="file-input" onchange={handleFileChange} />
      <p class="data-hint">Download all sessions as JSON, or restore from a previous export.</p>
    </div>

    <div class="danger-zone">
      <button class="danger-btn" class:danger-active={confirmDeleteAll} onclick={handleDeleteAll}>
        {confirmDeleteAll ? 'Click again to confirm' : 'Clear All Data'}
      </button>
    </div>
  </div>
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    height: 100%;
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
  .settings-header h2 {
    font-size: 14px;
    font-weight: 500;
    color: var(--fg);
  }
  .version-pill {
    font-size: 10px;
    font-weight: 500;
    color: var(--fg-muted);
    padding: 2px 6px;
    border-radius: 10px;
    background: var(--muted);
    border: 1px solid var(--border);
    letter-spacing: 0.02em;
  }
  .back-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  .back-btn:hover { background: var(--accent); color: var(--fg); }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .storage-card {
    padding: 12px;
    border-radius: 8px;
    background: oklch(0.22 0.008 280 / 0.3);
    border: 1px solid var(--border);
    margin-top: 8px;
  }
  .storage-fill--warn {
    background: var(--warning);
  }
  .storage-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .storage-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
  }
  .storage-val {
    font-size: 12px;
    color: var(--fg-muted);
  }
  .storage-track {
    height: 6px;
    border-radius: 10px;
    background: var(--muted);
    overflow: hidden;
  }
  .storage-fill {
    height: 100%;
    border-radius: 10px;
    background: var(--primary);
    transition: width 0.4s ease;
  }
  .storage-warn {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 11px;
    color: var(--warning);
  }

  .section-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .section {
    margin-bottom: 20px;
  }
  .setting-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }
  .setting-row:last-child { border-bottom: none; }
  .setting-text {
    flex: 1;
    padding-right: 16px;
  }
  .setting-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    line-height: 1.3;
  }
  .setting-desc {
    font-size: 11px;
    color: var(--fg-muted);
    margin-top: 2px;
  }

  .num-input {
    width: 56px;
    padding: 4px 6px;
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    text-align: center;
    outline: none;
    transition: all 0.15s;
  }
  .num-input:focus {
    border-color: var(--ring);
    box-shadow: 0 0 0 2px oklch(0.65 0.19 255 / 0.15);
  }

  .setting-row--block {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .setting-row--block .setting-text {
    padding-right: 0;
  }
  .setting-text--with-meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .count-pill {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: oklch(0.65 0.19 255 / 0.15);
    color: var(--primary);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }

  .domain-card {
    background: oklch(0.22 0.008 280 / 0.3);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .domain-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 20px 12px;
    text-align: center;
    color: var(--fg-muted);
  }
  .domain-empty svg {
    opacity: 0.5;
    margin-bottom: 4px;
  }
  .domain-empty p {
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
  }
  .domain-empty span {
    font-size: 11px;
    color: var(--fg-muted);
  }

  .domain-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 168px;
    overflow-y: auto;
  }
  .domain-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid oklch(0.3 0.008 280 / 0.4);
    animation: domain-in 0.18s ease;
  }
  .domain-item:last-child { border-bottom: none; }
  @keyframes domain-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .domain-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: oklch(0.65 0.19 255 / 0.12);
    color: var(--primary);
    flex-shrink: 0;
  }
  .domain-text {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-feature-settings: "tnum";
  }
  .domain-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    transition: all 0.1s;
    flex-shrink: 0;
    opacity: 0;
  }
  .domain-item:hover .domain-remove { opacity: 1; }
  .domain-remove:focus-visible { opacity: 1; }
  .domain-remove:hover {
    background: oklch(0.55 0.2 25 / 0.15);
    color: var(--destructive);
  }

  .domain-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid var(--border);
    background: oklch(0.16 0.008 280 / 0.4);
    transition: background 0.15s, border-color 0.15s;
  }
  .domain-input-wrap:focus-within {
    background: oklch(0.18 0.008 280 / 0.5);
  }
  .domain-input-icon {
    color: var(--fg-muted);
    flex-shrink: 0;
  }
  .domain-input-wrap:focus-within .domain-input-icon {
    color: var(--primary);
  }
  .domain-input {
    flex: 1;
    padding: 2px 0;
    background: none;
    border: none;
    font-size: 12px;
    color: var(--fg);
    outline: none;
    min-width: 0;
  }
  .domain-input::placeholder { color: var(--fg-muted); }
  .domain-add {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    background: var(--primary);
    color: var(--primary-fg);
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    animation: btn-in 0.15s ease;
  }
  @keyframes btn-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .domain-add:hover { filter: brightness(1.1); }
  .domain-kbd {
    font-family: inherit;
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--muted);
    border: 1px solid var(--border);
    color: var(--fg-muted);
    flex-shrink: 0;
  }

  .data-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .data-row {
    display: flex;
    gap: 8px;
  }
  .data-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1;
    padding: 9px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--muted);
    color: var(--fg);
    cursor: pointer;
    transition: all 0.15s;
  }
  .data-btn:hover {
    background: var(--card);
    border-color: var(--primary);
    color: var(--primary);
  }
  .data-btn:active {
    transform: scale(0.98);
  }
  .file-input {
    display: none;
  }
  .data-hint {
    font-size: 11px;
    color: var(--fg-muted);
    margin-top: 2px;
    line-height: 1.4;
  }

  .danger-zone {
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .danger-btn {
    width: 100%;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: none;
    color: var(--destructive);
    cursor: pointer;
    transition: all 0.15s;
  }
  .danger-btn:hover {
    background: oklch(0.55 0.2 25 / 0.1);
  }
  .danger-active {
    background: var(--destructive) !important;
    border-color: var(--destructive) !important;
    color: white !important;
  }
</style>

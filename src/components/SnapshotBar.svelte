<script lang="ts">
  interface Props {
    scopeAllWindows: boolean;
    isRecording: boolean;
    incognitoTabs: number;
    onSnapshot: (name: string) => Promise<void>;
    onToggleScope: () => void;
    onRecordingToggle: () => void;
  }

  let { scopeAllWindows, isRecording, incognitoTabs, onSnapshot, onToggleScope, onRecordingToggle }: Props = $props();

  let saving = $state(false);
  let dropdownOpen = $state(false);

  async function handleSnapshot() {
    if (saving) return;
    saving = true;
    try {
      await onSnapshot('');
    } finally {
      saving = false;
    }
  }

  function selectScope(all: boolean) {
    if (all !== scopeAllWindows) onToggleScope();
    dropdownOpen = false;
  }
</script>

<div class="controls">
  {#if incognitoTabs > 0}
    <div class="incognito-notice">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <line x1="1" x2="23" y1="1" y2="23"/>
      </svg>
      <span>{incognitoTabs} incognito tab{incognitoTabs !== 1 ? 's' : ''} included</span>
    </div>
  {/if}

  <div class="row">
    <!-- Scope dropdown -->
    <div class="dropdown-wrap">
      <button class="scope-btn" onclick={() => dropdownOpen = !dropdownOpen}>
        <span>{scopeAllWindows ? 'All Windows' : 'Current Window'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {#if dropdownOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-backdrop" onclick={() => dropdownOpen = false} onkeydown={() => {}}></div>
        <div class="dropdown-menu">
          <button class="dropdown-item" onclick={() => selectScope(false)}>Current Window</button>
          <button class="dropdown-item" onclick={() => selectScope(true)}>All Windows</button>
        </div>
      {/if}
    </div>

    <!-- Snapshot button -->
    <button class="snap-btn" onclick={handleSnapshot} disabled={saving}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <span>{saving ? 'Saving...' : 'Snapshot'}</span>
    </button>

    <!-- Record toggle -->
    <button
      class="rec-toggle"
      class:rec-active={isRecording}
      onclick={onRecordingToggle}
      title={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {#if isRecording}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: oklch(0.16 0.008 280 / 0.5);
  }
  .incognito-notice {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--warning);
    padding: 6px 10px;
    background: oklch(0.75 0.18 85 / 0.08);
    border: 1px solid oklch(0.75 0.18 85 / 0.15);
    border-radius: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Scope dropdown */
  .dropdown-wrap {
    position: relative;
    flex: 1;
  }
  .scope-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .scope-btn:hover { border-color: var(--fg-muted); }
  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 160px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: dropdown-in 0.15s ease;
  }
  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .dropdown-item {
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .dropdown-item:hover { background: var(--accent); }

  /* Snapshot button */
  .snap-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--primary-fg);
    background: var(--primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .snap-btn:hover { filter: brightness(1.1); }
  .snap-btn:active { transform: scale(0.97); }
  .snap-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* Record toggle */
  .rec-toggle {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--secondary);
    color: var(--fg-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .rec-toggle:hover {
    background: var(--accent);
    color: var(--fg);
  }
  .rec-active {
    background: var(--destructive) !important;
    border-color: var(--destructive) !important;
    color: white !important;
  }
  .rec-active:hover { filter: brightness(1.1); }
</style>

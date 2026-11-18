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
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <line x1="1" x2="23" y1="1" y2="23"/>
      </svg>
      <span>{incognitoTabs} incognito tab{incognitoTabs !== 1 ? 's' : ''} included</span>
    </div>
  {/if}

  <div class="row">
    <!-- Scope dropdown -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown-wrap" onkeydown={(e) => { if (e.key === 'Escape' && dropdownOpen) { e.stopPropagation(); dropdownOpen = false; } }}>
      <button
        class="scope-btn"
        onclick={() => dropdownOpen = !dropdownOpen}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
        aria-label="What to save: {scopeAllWindows ? 'All windows' : 'This window'}"
      >
        <span>{scopeAllWindows ? 'All windows' : 'This window'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {#if dropdownOpen}
        <div class="menu-backdrop" onclick={() => dropdownOpen = false} onkeydown={() => {}}></div>
        <div class="menu dropdown-menu" role="menu">
          <button class="menu-item dropdown-item" role="menuitemradio" aria-checked={!scopeAllWindows} onclick={() => selectScope(false)}>This window</button>
          <button class="menu-item dropdown-item" role="menuitemradio" aria-checked={scopeAllWindows} onclick={() => selectScope(true)}>All windows</button>
        </div>
      {/if}
    </div>

    <!-- Snapshot button: secondary while recording, so "Stop & save" leads (R6) -->
    <button class="btn snap-btn {isRecording ? 'btn-secondary' : 'btn-primary'}" onclick={handleSnapshot} disabled={saving}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <span>{saving ? 'Saving…' : 'Snapshot'}</span>
    </button>

    <!-- Record toggle: hidden while recording; the recording bar has the one stop control -->
    {#if !isRecording}
      <button
        class="btn btn-secondary rec-toggle"
        onclick={onRecordingToggle}
        aria-label="Record new tabs"
        aria-pressed="false"
        title="Record: add every new tab you open to a session"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg>
      </button>
    {/if}
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
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--warning);
    padding: 6px 10px;
    background: oklch(0.75 0.18 85 / 0.08);
    border: 1px solid oklch(0.75 0.18 85 / 0.15);
    border-radius: var(--r);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dropdown-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .scope-btn {
    width: 100%;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 0 10px;
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--r);
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .scope-btn:hover { border-color: var(--fg-muted); }
  .dropdown-menu { left: 0; width: 160px; }
  .dropdown-item[aria-checked='true'] { color: var(--primary); }
  .rec-toggle { width: 32px; padding: 0; color: var(--fg-muted); }
  .rec-toggle:hover { color: var(--recording); }
</style>

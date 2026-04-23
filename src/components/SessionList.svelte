<script lang="ts">
  import type { Session } from '@/lib/types';
  import SessionCard from './SessionCard.svelte';

  interface Props {
    sessions: Session[];
    searchQuery: string;
    onSessionClick: (session: Session) => void;
    onRestore: (session: Session) => void;
    onDelete: (session: Session) => void;
    onRename: (session: Session, newName: string) => void;
    onSearchChange: (query: string) => void;
  }

  let { sessions, searchQuery, onSessionClick, onRestore, onDelete, onRename, onSearchChange }: Props = $props();
</script>

<div class="list-area">
  <!-- Search -->
  <div class="search-wrap">
    <div class="search-box">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        type="text"
        value={searchQuery}
        oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
        placeholder="Search sessions or URLs..."
        class="search-input"
      />
      {#if searchQuery}
        <button onclick={() => onSearchChange('')} class="search-clear" aria-label="Clear">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- List -->
  {#if sessions.length === 0}
    <div class="empty">
      <div class="empty-icon" class:empty-icon--cta={!searchQuery}>
        {#if searchQuery}
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><rect x="2" y="7" width="20" height="7" rx="1"/>
          </svg>
        {/if}
      </div>
      <h3 class="empty-title">{searchQuery ? 'No results found' : 'Ready for your first snapshot'}</h3>
      <p class="empty-desc">
        {#if searchQuery}
          Try a different search term
        {:else}
          Tap <strong>Snapshot</strong> above to save your open tabs, or start <strong>Recording</strong> to capture new tabs as you browse.
        {/if}
      </p>
      {#if !searchQuery}
        <div class="empty-arrow" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>
          </svg>
        </div>
      {/if}
    </div>
  {:else}
    <div class="list">
      {#each sessions as session (session.id)}
        <SessionCard
          {session}
          onClick={() => onSessionClick(session)}
          {onRestore}
          {onDelete}
          {onRename}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .list-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .search-wrap {
    padding: 8px 16px;
    flex-shrink: 0;
  }
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 10px;
    color: var(--fg-muted);
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 32px 0 32px;
    font-size: 13px;
    font-weight: 400;
    color: var(--fg);
    background: oklch(0.22 0.008 280 / 0.5);
    border: 1px solid transparent;
    border-radius: 6px;
    outline: none;
    transition: all 0.15s;
  }
  .search-input::placeholder { color: var(--fg-muted); }
  .search-input:focus {
    border-color: var(--border);
    background: var(--muted);
  }
  .search-clear {
    position: absolute;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  .search-clear:hover { color: var(--fg); background: var(--accent); }

  .list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  /* Divider lines between cards */
  .list > :global(*) + :global(*) {
    border-top: 1px solid var(--border);
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    text-align: center;
  }
  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: oklch(0.22 0.008 280 / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-muted);
    margin-bottom: 16px;
  }
  .empty-icon--cta {
    background: oklch(0.65 0.19 255 / 0.15);
    color: var(--primary);
    animation: breathe 2.4s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  .empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    margin-bottom: 6px;
  }
  .empty-desc {
    font-size: 12px;
    color: var(--fg-muted);
    max-width: 260px;
    line-height: 1.55;
  }
  .empty-desc :global(strong) {
    color: var(--fg);
    font-weight: 600;
  }
  .empty-arrow {
    margin-top: 14px;
    color: var(--primary);
    opacity: 0.6;
    animation: nudge 1.6s ease-in-out infinite;
  }
  @keyframes nudge {
    0%, 100% { transform: translateY(0); opacity: 0.5; }
    50% { transform: translateY(-4px); opacity: 0.9; }
  }
</style>

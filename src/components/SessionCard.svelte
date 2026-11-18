<script lang="ts">
  import { tick } from 'svelte';
  import type { Session } from '@/lib/types';
  import { TAB_GROUP_COLORS } from '@/lib/types';
  import { plural, relativeTime } from '@/lib/format';
  import SessionMenu from './SessionMenu.svelte';

  interface Props {
    session: Session;
    onClick: () => void;
    onRestore: (session: Session) => void;
    onDelete: (session: Session) => void;
    onRename: (session: Session, newName: string) => void;
    onTogglePin: (session: Session) => void;
  }

  let { session, onClick, onRestore, onDelete, onRename, onTogglePin }: Props = $props();

  let renaming = $state(false);
  let renameValue = $state('');
  let renameInput: HTMLInputElement | undefined = $state(undefined);

  async function startRename() {
    renameValue = session.name;
    renaming = true;
    await tick();
    renameInput?.select();
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(session, trimmed);
    }
    renaming = false;
  }

  function cancelRename() {
    renaming = false;
  }

  function onRenameKeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
  }

  let tabCount = $derived(session.tabs.length);
  let time = $derived(relativeTime(session.timestamp));

  let displayGroups = $derived.by(() => {
    const counts = new Map<number, number>();
    for (const t of session.tabs) {
      if (t.groupId !== undefined) counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
    }
    return session.tabGroups.map((g) => ({
      title: g.title || 'Untitled',
      color: TAB_GROUP_COLORS[g.color] || TAB_GROUP_COLORS.grey,
      count: counts.get(g.id) ?? 0,
    }));
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card" onclick={(e) => { if (!renaming) onClick(); }} onkeydown={(e) => { if (e.key === 'Enter' && !renaming) onClick(); }} tabindex="0" role="button">
  <div class="card-content">
    <div class="card-top">
      {#if session.pinned}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="pin-icon" aria-label="Pinned">
          <path d="M12 17v5"/>
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
        </svg>
      {/if}
      {#if renaming}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="rename-wrap" onclick={(e) => e.stopPropagation()}>
          <input
            bind:this={renameInput}
            bind:value={renameValue}
            onkeydown={onRenameKeydown}
            onblur={commitRename}
            class="rename-input"
          />
        </div>
      {:else}
        <h3 class="card-name">{session.name}</h3>
      {/if}
      {#if session.isBackup}
        <span class="badge badge-auto" title="Refreshed automatically with your open tabs">Backup</span>
      {:else if session.isAutoSave}
        <span class="badge badge-auto">Auto</span>
      {/if}
      {#if session.hasIncognitoTabs}
        <span class="badge badge-private" title="Includes incognito tabs">Private</span>
      {/if}
    </div>

    <p class="card-meta">
      {plural(tabCount, 'tab')}<span class="meta-sep" aria-hidden="true">·</span>{plural(session.windowCount, 'window')}<span class="meta-sep" aria-hidden="true">·</span>{time}
    </p>

    {#if displayGroups.length > 0}
      <div class="card-groups">
        {#each displayGroups.slice(0, 4) as group}
          <div class="group-chip">
            <span class="group-dot" style="background: {group.color}"></span>
            <span class="group-name">{group.title}</span>
            <span class="group-count">{group.count}</span>
          </div>
        {/each}
        {#if displayGroups.length > 4}
          <span class="groups-more">+{displayGroups.length - 4}</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Shown on hover and on keyboard focus -->
  <div class="card-actions">
    <SessionMenu
      name={session.name}
      pinned={!!session.pinned}
      onTogglePin={() => onTogglePin(session)}
      onRename={startRename}
      onDelete={() => onDelete(session)}
    />
  </div>

  <!-- Always visible: restoring is the main thing to do with a session (D15). -->
  <button
    class="btn btn-sm btn-secondary card-restore"
    onclick={(e) => { e.stopPropagation(); onRestore(session); }}
    onkeydown={(e) => e.stopPropagation()}
    aria-label="Restore {session.name}"
    title="Restore these tabs"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
    Restore
  </button>
</div>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    position: relative;
    outline: none;
    box-shadow: inset 3px 0 0 transparent;
  }
  .card:hover {
    background: oklch(0.26 0.014 280 / 0.75);
    box-shadow: inset 3px 0 0 var(--primary);
  }
  .card:focus-visible {
    background: oklch(0.26 0.014 280 / 0.75);
    box-shadow: inset 3px 0 0 var(--primary);
  }
  .card:active { background: oklch(0.24 0.012 280 / 0.9); }
  .card-content {
    flex: 1;
    min-width: 0;
  }
  .card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .card-name {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pin-icon {
    color: var(--primary);
    flex-shrink: 0;
  }

  /* Inline rename */
  .rename-wrap { flex: 1; min-width: 0; }
  .rename-input {
    width: 100%;
    padding: 2px 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    background: var(--bg);
    border: 1.5px solid var(--primary);
    border-radius: var(--r-sm);
    outline: none;
    box-shadow: 0 0 0 2px oklch(0.65 0.19 255 / 0.2);
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--r-sm);
    flex-shrink: 0;
    line-height: 16px;
  }
  .badge-auto {
    background: var(--secondary);
    color: var(--fg-muted);
  }
  .badge-private {
    background: oklch(0.65 0.22 25 / 0.15);
    color: var(--recording);
  }

  .card-meta {
    font-size: var(--text-sm);
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta-sep { margin: 0 6px; opacity: 0.6; }

  .card-groups {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .group-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--r-sm);
    background: oklch(0.22 0.008 280 / 0.5);
  }
  .group-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .group-name {
    font-size: 10px;
    color: var(--fg-muted);
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group-count {
    font-size: 10px;
    color: var(--fg-muted);
  }
  .groups-more {
    font-size: 10px;
    color: var(--fg-muted);
  }

  /* "…" menu: on hover, on keyboard focus anywhere in the card, and while open */
  .card-actions {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .card:hover .card-actions,
  .card:focus-within .card-actions {
    opacity: 1;
  }
  .card-restore:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--secondary);
  }
</style>

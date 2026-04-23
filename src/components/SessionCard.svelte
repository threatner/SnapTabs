<script lang="ts">
  import { tick } from 'svelte';
  import type { Session } from '@/lib/types';
  import { TAB_GROUP_COLORS } from '@/lib/types';

  interface Props {
    session: Session;
    onClick: () => void;
    onRestore: (session: Session) => void;
    onDelete: (session: Session) => void;
    onRename: (session: Session, newName: string) => void;
  }

  let { session, onClick, onRestore, onDelete, onRename }: Props = $props();

  let menuOpen = $state(false);
  let renaming = $state(false);
  let renameValue = $state('');
  let renameInput: HTMLInputElement | undefined = $state(undefined);

  async function startRename() {
    menuOpen = false;
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

  function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
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
      {#if session.isAutoSave}
        <span class="badge badge-auto">Auto</span>
      {/if}
      {#if session.hasIncognitoTabs}
        <span class="badge badge-private">
          <span class="private-dot"></span>
          Private
        </span>
      {/if}
    </div>

    <div class="card-meta">
      <span>{tabCount} tabs</span>
      <span class="meta-sep">|</span>
      <span>{session.windowCount} {session.windowCount === 1 ? 'window' : 'windows'}</span>
      <span class="meta-sep">|</span>
      <span>{time}</span>
    </div>

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

  <!-- Hover actions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="card-actions" onclick={(e) => e.stopPropagation()}>
    <div class="menu-wrap">
      <button class="action-btn" onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }} aria-label="Actions">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="menu-backdrop" onclick={() => menuOpen = false} onkeydown={() => {}}></div>
        <div class="context-menu">
          <button class="menu-item" onclick={() => { menuOpen = false; onRestore(session); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Restore Session
          </button>
          <button class="menu-item" onclick={startRename}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
            </svg>
            Rename
          </button>
          <div class="menu-divider"></div>
          <button class="menu-item menu-item--danger" onclick={() => { menuOpen = false; onDelete(session); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            Delete
          </button>
        </div>
      {/if}
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </div>
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
  .card:hover .chevron { transform: translateX(2px); }
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
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    border-radius: 4px;
    outline: none;
    box-shadow: 0 0 0 2px oklch(0.65 0.19 255 / 0.2);
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
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
  .private-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .meta-sep { color: var(--border); }

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
    border-radius: 4px;
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
    color: oklch(0.6 0.01 280 / 0.6);
  }
  .groups-more {
    font-size: 10px;
    color: var(--fg-muted);
  }

  /* Hover actions */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .card:hover .card-actions { opacity: 1; }
  .chevron {
    color: var(--fg-muted);
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  .action-btn {
    width: 28px;
    height: 28px;
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
  .action-btn:hover { background: var(--accent); color: var(--fg); }

  /* Context menu */
  .menu-wrap { position: relative; }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .context-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 180px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    animation: menu-in 0.12s ease;
  }
  @keyframes menu-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
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
  .menu-item:hover { background: var(--accent); }
  .menu-item--danger { color: var(--destructive); }
  .menu-item--danger:hover { background: oklch(0.55 0.2 25 / 0.1); }
  .menu-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>

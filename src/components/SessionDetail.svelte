<script lang="ts">
  import { tick } from 'svelte';
  import type { Session } from '@/lib/types';
  import { TAB_GROUP_COLORS } from '@/lib/types';

  interface Props {
    session: Session;
    onBack: () => void;
    onRestore: (session: Session) => void;
    onDelete: (session: Session) => void;
    onRename: (session: Session, newName: string) => void;
    onTogglePin: (session: Session) => void;
  }

  let { session, onBack, onRestore, onDelete, onRename, onTogglePin }: Props = $props();

  let confirmDelete = $state(false);
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

  function cancelRename() { renaming = false; }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
  }

  // Group tabs in a single O(n) pass
  let groupedTabs = $derived.by(() => {
    const tabsByGroup = new Map<number, typeof session.tabs>();
    const ungrouped: typeof session.tabs = [];
    const groupMeta = new Map(session.tabGroups.map((g) => [g.id, g]));

    for (const tab of session.tabs) {
      if (tab.groupId !== undefined && groupMeta.has(tab.groupId)) {
        let arr = tabsByGroup.get(tab.groupId);
        if (!arr) { arr = []; tabsByGroup.set(tab.groupId, arr); }
        arr.push(tab);
      } else {
        ungrouped.push(tab);
      }
    }

    const groups = [...tabsByGroup.entries()].map(([gid, tabs]) => {
      const g = groupMeta.get(gid)!;
      return {
        id: gid,
        title: g.title || 'Untitled Group',
        color: TAB_GROUP_COLORS[g.color] || TAB_GROUP_COLORS.grey,
        tabs,
      };
    });

    return { groups, ungrouped };
  });

  function faviconUrl(tab: { url: string; favIconUrl?: string }): string {
    if (tab.favIconUrl?.startsWith('http')) return tab.favIconUrl;
    try { return `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=16`; }
    catch { return ''; }
  }

  function openTab(url: string) { chrome.tabs.create({ url }); }

  function handleDelete() {
    if (confirmDelete) {
      onDelete(session);
      confirmDelete = false;
    } else {
      confirmDelete = true;
      setTimeout(() => { confirmDelete = false; }, 3000);
    }
  }

  // All groups start expanded - use $derived to properly track session prop
  let initialGroups = $derived(new Set(session.tabGroups.map((g) => g.id)));
  let expandedOverrides = $state<Map<number, boolean>>(new Map());
  let expandedGroups = $derived.by(() => {
    const result = new Set(initialGroups);
    for (const [id, expanded] of expandedOverrides) {
      if (expanded) result.add(id); else result.delete(id);
    }
    return result;
  });

  function toggleGroup(id: number) {
    const next = new Map(expandedOverrides);
    next.set(id, !expandedGroups.has(id));
    expandedOverrides = next;
  }
</script>

<div class="detail">
  <!-- Header -->
  <div class="detail-header">
    <button class="back-btn" onclick={onBack} aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
    <div class="detail-title">
      {#if renaming}
        <input
          bind:this={renameInput}
          bind:value={renameValue}
          onkeydown={onRenameKeydown}
          onblur={commitRename}
          class="rename-input"
        />
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <h2 ondblclick={startRename} title="Double-click to rename">{session.name}</h2>
      {/if}
      <p>{session.tabs.length} tabs in {session.windowCount} {session.windowCount === 1 ? 'window' : 'windows'}</p>
    </div>
    <button class="restore-btn" onclick={() => onRestore(session)}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
      Restore
    </button>
    <button class="pin-btn" class:pin-active={session.pinned} onclick={() => onTogglePin(session)} aria-label={session.pinned ? 'Unpin' : 'Pin'} title={session.pinned ? 'Unpin' : 'Pin to top'}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={session.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5"/>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
    </button>
    <button class="rename-btn" onclick={startRename} aria-label="Rename">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
      </svg>
    </button>
    <button class="del-btn" class:del-active={confirmDelete} onclick={handleDelete} aria-label="Delete">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
    </button>
  </div>

  <!-- Tab list -->
  {#snippet tabItem(tab: import('@/lib/types').SavedTab)}
    {@const favicon = faviconUrl(tab)}
    <button class="tab-item" onclick={() => openTab(tab.url)} title={tab.url}>
      <div class="tab-icon">
        {#if favicon}
          <img src={favicon} alt="" width="14" height="14" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
        {/if}
      </div>
      <span class="tab-title">{tab.title || tab.url}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-ext">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    </button>
  {/snippet}

  <div class="detail-body">
    {#each groupedTabs.groups as group}
      <div class="tab-group">
        <button class="group-header" onclick={() => toggleGroup(group.id!)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-chevron" class:group-expanded={expandedGroups.has(group.id!)}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="group-dot" style="background: {group.color}"></span>
          <span class="group-title">{group.title}</span>
          <span class="group-badge">{group.tabs.length}</span>
        </button>
        {#if expandedGroups.has(group.id!)}
          <div class="group-tabs">
            {#each group.tabs as tab}
              {@render tabItem(tab)}
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    {#if groupedTabs.ungrouped.length > 0}
      <div class="ungrouped">
        {#if groupedTabs.groups.length > 0}
          <p class="ungrouped-label">Ungrouped tabs</p>
        {/if}
        {#each groupedTabs.ungrouped as tab}
          {@render tabItem(tab)}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .detail-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    flex-shrink: 0;
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
    flex-shrink: 0;
  }
  .back-btn:hover { background: var(--accent); color: var(--fg); }
  .detail-title {
    flex: 1;
    min-width: 0;
  }
  .detail-title h2 {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: text;
  }
  .detail-title h2:hover { color: var(--primary); }
  .rename-input {
    width: 100%;
    padding: 1px 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    background: var(--bg);
    border: 1.5px solid var(--primary);
    border-radius: 4px;
    outline: none;
    box-shadow: 0 0 0 2px oklch(0.65 0.19 255 / 0.2);
  }
  .detail-title p {
    font-size: 11px;
    color: var(--fg-muted);
  }
  .restore-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg);
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .restore-btn:hover { background: var(--accent); }
  .rename-btn {
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
    flex-shrink: 0;
  }
  .rename-btn:hover { background: var(--accent); color: var(--fg); }
  .pin-btn {
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
    flex-shrink: 0;
  }
  .pin-btn:hover { background: var(--accent); color: var(--fg); }
  .pin-active {
    color: var(--primary) !important;
    background: oklch(0.65 0.19 255 / 0.12);
  }
  .del-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: none;
    color: var(--destructive);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
    flex-shrink: 0;
  }
  .del-btn:hover { background: oklch(0.55 0.2 25 / 0.1); }
  .del-active {
    background: var(--destructive) !important;
    color: white !important;
  }

  .detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .tab-group { margin-bottom: 12px; }
  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    background: oklch(0.22 0.008 280 / 0.3);
    border: none;
    cursor: pointer;
    transition: background 0.1s;
  }
  .group-header:hover { background: oklch(0.22 0.008 280 / 0.5); }
  .group-chevron {
    color: var(--fg-muted);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .group-expanded { transform: rotate(90deg); }
  .group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .group-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
    flex: 1;
    text-align: left;
  }
  .group-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--fg-muted);
    background: var(--secondary);
    padding: 1px 6px;
    border-radius: 4px;
  }
  .group-tabs {
    margin-left: 20px;
    margin-top: 4px;
  }

  .ungrouped { margin-top: 8px; }
  .ungrouped-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-muted);
    padding: 4px 8px;
    margin-bottom: 4px;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border-radius: 4px;
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.1s;
    text-align: left;
  }
  .tab-item:hover { background: oklch(0.25 0.012 280 / 0.5); }
  .tab-icon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    color: var(--fg-muted);
  }
  .tab-title {
    flex: 1;
    font-size: 12px;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab-ext {
    color: var(--fg-muted);
    opacity: 0;
    transition: opacity 0.1s;
    flex-shrink: 0;
  }
  .tab-item:hover .tab-ext { opacity: 1; }
</style>

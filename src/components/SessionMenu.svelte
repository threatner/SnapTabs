<script lang="ts">
  // The "…" menu shared by session cards and the session detail view:
  // Pin, Rename, Delete. Restore is always a visible button instead (D15).
  interface Props {
    name: string;
    pinned: boolean;
    onTogglePin: () => void;
    onRename: () => void;
    onDelete: () => void;
  }

  let { name, pinned, onTogglePin, onRename, onDelete }: Props = $props();

  let open = $state(false);

  function run(fn: () => void) {
    open = false;
    fn();
  }

  // Keys pressed inside the menu must not reach the session card, which
  // opens the detail view on Enter.
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-wrap" onkeydown={onKeydown}>
  <button
    class="icon-btn action-btn"
    onclick={(e) => { e.stopPropagation(); open = !open; }}
    aria-label="More actions for {name}"
    aria-haspopup="menu"
    aria-expanded={open}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  </button>
  {#if open}
    <div class="menu-backdrop" onclick={(e) => { e.stopPropagation(); open = false; }} onkeydown={() => {}}></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="menu context-menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <button class="menu-item" role="menuitem" onclick={() => run(onTogglePin)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 17v5"/>
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
        </svg>
        {pinned ? 'Unpin' : 'Pin to top'}
      </button>
      <button class="menu-item" role="menuitem" onclick={() => run(onRename)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
        </svg>
        Rename
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item menu-item--danger" role="menuitem" onclick={() => run(onDelete)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
        Delete
      </button>
    </div>
  {/if}
</div>

<style>
  .menu-wrap { position: relative; }
  .context-menu { right: 0; width: 160px; }
</style>

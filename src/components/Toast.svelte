<script lang="ts">
  // Bottom of the popup, on the card surface with a coloured icon (D22).
  // The status region is always in the DOM so screen readers announce changes.
  interface Props {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  }

  let { visible, message, type }: Props = $props();
</script>

<div class="toast-region" role="status" aria-live="polite">
  {#if visible}
    <div class="toast-wrap">
      <div class="toast toast--{type}">
        <span class="toast-icon" aria-hidden="true">
          {#if type === 'success'}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {:else if type === 'error'}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          {/if}
        </span>
        <span class="toast-text">{message}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .toast-wrap {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 32px);
    /* Above content and menus (50), below the duplicate dialog (100). */
    z-index: 90;
    pointer-events: none;
    animation: slide-in 0.25s var(--ease-out);
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: var(--r-lg);
    background: var(--accent);
    border: 1px solid var(--border);
    color: var(--fg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .toast-icon { display: flex; align-items: center; flex-shrink: 0; }
  .toast--success .toast-icon { color: var(--success); }
  .toast--error .toast-icon { color: var(--destructive); }
  .toast--warning .toast-icon { color: var(--warning); }
  .toast-text {
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

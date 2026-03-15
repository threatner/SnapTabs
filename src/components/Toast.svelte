<script lang="ts">
  interface Props {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  }

  let { visible, message, type }: Props = $props();

  let bg = $derived(
    type === 'success' ? 'var(--primary)'
    : type === 'error' ? 'var(--destructive)'
    : 'var(--warning)'
  );
</script>

{#if visible}
  <div class="toast-wrap">
    <div class="toast" style="background: {bg}">
      <span class="toast-icon">
        {#if type === 'success'}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        {:else if type === 'error'}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        {/if}
      </span>
      <span class="toast-text">{message}</span>
    </div>
  </div>
{/if}

<style>
  .toast-wrap {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    pointer-events: none;
    animation: slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translate(-50%, -12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    color: white;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .toast-icon { display: flex; align-items: center; }
  .toast-text { font-size: 12px; font-weight: 600; white-space: nowrap; }
</style>

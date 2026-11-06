<script lang="ts">
  // One-time popup tip (docs/onboarding/spec.md R4-R6). Same shape as the
  // rating banner so the popup has a single banner style (design/README.md).
  interface Props {
    title: string;
    body: string;
    actionLabel?: string;
    onAction?: () => void;
    onDismiss: () => void;
  }

  let { title, body, actionLabel, onAction, onDismiss }: Props = $props();
</script>

<div class="tip" role="status">
  <p class="tip-text">
    <span class="tip-title">{title}</span>
    {body}
  </p>
  {#if actionLabel && onAction}
    <button class="tip-btn" onclick={onAction}>{actionLabel}</button>
  {/if}
  <button class="tip-close" onclick={onDismiss} aria-label="Dismiss tip" title="Got it">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
</div>

<style>
  .tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 16px 0;
    padding: 8px 8px 8px 12px;
    background: oklch(0.65 0.19 255 / 0.1);
    border: 1px solid oklch(0.65 0.19 255 / 0.25);
    border-radius: 8px;
    flex-shrink: 0;
  }
  .tip-text {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--fg-muted);
  }
  .tip-title {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg);
  }
  .tip-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--fg);
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .tip-btn:hover { background: var(--accent); }
  .tip-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: none;
    border: none;
    border-radius: 5px;
    color: var(--fg-muted);
    cursor: pointer;
    flex-shrink: 0;
  }
  .tip-close:hover {
    background: var(--accent);
    color: var(--fg);
  }
</style>

<script lang="ts">
  // The popup's one banner style: one-time tips (docs/onboarding/spec.md)
  // and the rating prompt. Only one shows at a time (D04).
  interface Props {
    kind: 'tip' | 'rating';
    title: string;
    body: string;
    actionLabel?: string;
    onAction?: () => void;
    onDismiss: () => void;
    dismissLabel: string;
    dismissTitle: string;
  }

  let { kind, title, body, actionLabel, onAction, onDismiss, dismissLabel, dismissTitle }: Props = $props();
</script>

<div class="banner {kind}" role="status">
  <p class="banner-text">
    <span class="banner-title">{title}</span>
    {body}
  </p>
  {#if actionLabel && onAction}
    <button class="btn btn-sm btn-secondary banner-btn {kind}-btn" onclick={onAction}>{actionLabel}</button>
  {/if}
  <button class="icon-btn banner-close {kind}-close" onclick={onDismiss} aria-label={dismissLabel} title={dismissTitle}>
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 16px 0;
    padding: 8px 6px 8px 12px;
    background: oklch(0.65 0.19 255 / 0.1);
    border: 1px solid oklch(0.65 0.19 255 / 0.25);
    border-radius: var(--r-lg);
    flex-shrink: 0;
  }
  .banner-text {
    flex: 1;
    min-width: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--fg-muted);
  }
  .banner-title {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--fg);
  }
  .banner-close { width: 24px; height: 24px; }
</style>

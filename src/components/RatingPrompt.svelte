<script lang="ts">
  interface Props {
    onRate: () => void;
    onDismiss: () => void;
  }

  let { onRate, onDismiss }: Props = $props();
</script>

<div class="rating" role="status">
  <p class="rating-text">
    <span class="rating-title">Enjoying SnapTabs?</span>
    A quick rating helps other people find it.
  </p>
  <button class="rating-btn" onclick={onRate}>Rate it</button>
  <button class="rating-close" onclick={onDismiss} aria-label="Dismiss rating prompt" title="Don't ask again">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
</div>

<style>
  .rating {
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
  .rating-text {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--fg-muted);
  }
  .rating-title {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg);
  }
  .rating-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--primary-fg);
    background: var(--primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: filter 0.15s;
  }
  .rating-btn:hover { filter: brightness(1.1); }
  .rating-close {
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
  .rating-close:hover {
    background: var(--accent);
    color: var(--fg);
  }
</style>

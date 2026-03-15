<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { LiveRecording } from '@/lib/types';

  interface Props {
    recording: LiveRecording | null;
    onStopRecording: () => Promise<void>;
    onCancelRecording: () => Promise<void>;
  }

  let { recording, onStopRecording, onCancelRecording }: Props = $props();

  let stopping = $state(false);
  let elapsed = $state('');
  let interval: ReturnType<typeof setInterval> | undefined;

  function fmt(ms: number): string {
    const s = Math.floor((Date.now() - ms) / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  let tabCount = $derived(recording?.tabs.length ?? 0);
  let recentTabs = $derived(recording?.tabs.slice(-3).reverse() ?? []);

  onMount(() => {
    if (recording?.isActive) {
      elapsed = fmt(recording.startedAt);
      interval = setInterval(() => {
        if (recording?.isActive) elapsed = fmt(recording.startedAt);
        else if (interval) { clearInterval(interval); interval = undefined; }
      }, 1000);
    }
  });

  onDestroy(() => { if (interval) clearInterval(interval); });

  async function stop() {
    if (stopping) return;
    stopping = true;
    try { await onStopRecording(); } finally { stopping = false; }
  }
</script>

{#if recording?.isActive}
  <div class="rec-bar">
    <div class="rec-info">
      <div class="rec-meta">
        <span class="rec-dot"></span>
        <span class="rec-label">REC</span>
        <span class="rec-time">{elapsed}</span>
      </div>
      <span class="rec-count">{tabCount} tab{tabCount !== 1 ? 's' : ''} captured</span>
    </div>

    {#if recentTabs.length > 0}
      <div class="rec-tabs">
        {#each recentTabs as tab}
          <div class="rec-tab">
            <span class="rec-tab-dot"></span>
            <span class="rec-tab-title">{tab.title || tab.url}</span>
          </div>
        {/each}
        {#if tabCount > 3}
          <span class="rec-more">+{tabCount - 3} more</span>
        {/if}
      </div>
    {/if}

    <div class="rec-actions">
      <button class="rec-stop" onclick={stop} disabled={stopping}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        {stopping ? 'Saving...' : 'Stop & Save'}
      </button>
      <button class="rec-cancel" onclick={onCancelRecording}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  .rec-bar {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: oklch(0.55 0.2 25 / 0.06);
  }
  .rec-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .rec-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rec-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--recording);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .rec-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--recording);
    letter-spacing: 0.05em;
  }
  .rec-time {
    font-size: 12px;
    font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
    font-weight: 600;
    color: var(--recording);
  }
  .rec-count {
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-muted);
  }
  .rec-tabs {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rec-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 8px;
    border-radius: 4px;
    background: oklch(0.55 0.2 25 / 0.04);
  }
  .rec-tab-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--recording);
    opacity: 0.5;
    flex-shrink: 0;
  }
  .rec-tab-title {
    font-size: 11px;
    color: var(--fg-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rec-more {
    font-size: 10px;
    font-weight: 500;
    color: var(--fg-muted);
    opacity: 0.5;
    padding-left: 8px;
  }
  .rec-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .rec-stop {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg);
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rec-stop:hover { background: var(--accent); }
  .rec-stop:disabled { opacity: 0.4; }
  .rec-cancel {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--destructive);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rec-cancel:hover { background: oklch(0.55 0.2 25 / 0.08); }
</style>

<script lang="ts">
  import type { LiveRecording } from '@/lib/types';
  import { REPO_URL } from '@/lib/links';

  interface Props {
    recording: LiveRecording | null;
    sessionCount: number;
    onSettingsClick: () => void;
  }

  let { recording, sessionCount, onSettingsClick }: Props = $props();
</script>

<header class="header">
  <div class="brand">
    <div class="logo-box">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
        <rect x="2" y="7" width="20" height="7" rx="1" />
      </svg>
    </div>
    <div class="brand-text">
      <h1>SnapTabs</h1>
      {#if recording?.isActive}
        <span class="rec-indicator">
          <span class="rec-dot" aria-hidden="true"></span>
          Recording
        </span>
      {:else if sessionCount > 0}
        <span class="session-count">{sessionCount} session{sessionCount === 1 ? '' : 's'} saved</span>
      {/if}
    </div>
  </div>
  <div class="actions">
    <a
      class="icon-btn"
      href="/welcome.html?from=help"
      target="_blank"
      rel="noopener"
      aria-label="How to use SnapTabs"
      title="How to use SnapTabs"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
    </a>
    <a
      class="icon-btn"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="SnapTabs on GitHub (open source)"
      title="SnapTabs is open source. View it on GitHub"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 2.89-.39c.98 0 1.96.13 2.89.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
    </a>
    <button class="icon-btn" onclick={onSettingsClick} aria-label="Settings" title="Settings">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--card);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo-box {
    width: 32px;
    height: 32px;
    border-radius: var(--r-lg);
    background: oklch(0.65 0.19 255 / 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
  }
  .brand-text {
    display: flex;
    flex-direction: column;
  }
  .brand-text h1 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--fg);
  }
  .session-count {
    font-size: var(--text-xs);
    color: var(--fg-muted);
  }
  .rec-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 500;
    color: var(--recording);
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
    50% { opacity: 0.4; }
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>

// Small display helpers shared by the popup components.

/** "1 tab", "8 tabs". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "Just now", "5m ago", "3h ago", "Yesterday", "4d ago", then a short date
 * ("Nov 4"), with the year only when it isn't the current year.
 */
export function relativeTime(ts: number, now = Date.now(), locale?: string): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "512 B", "11.2 KB", "3.4 MB", "10 MB" (no ".0"). */
export function formatBytes(b: number): string {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${trim(b / 1024)} KB`;
  return `${trim(b / 1048576)} MB`;
}

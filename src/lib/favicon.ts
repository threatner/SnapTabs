// Favicons come only from Chrome's local favicon cache, never from the network
// (D14 in docs/decisions). Needs the "favicon" permission, whose install
// warning is superseded by "tabs".
export function localFaviconUrl(pageUrl: string, size = 32): string {
  if (!/^https?:\/\//.test(pageUrl)) return '';
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

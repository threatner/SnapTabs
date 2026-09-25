// Popup/page → service worker messaging. The service worker reports a failed
// action by replying `{ error }` rather than rejecting, so callers that only
// awaited chrome.runtime.sendMessage treated failures as success.
export async function sendMessage<T = unknown>(msg: { action: string; [k: string]: unknown }): Promise<T> {
  const res = await chrome.runtime.sendMessage(msg);
  if (res && typeof res === 'object' && 'error' in res) throw new Error(String((res as { error: unknown }).error));
  return res as T;
}

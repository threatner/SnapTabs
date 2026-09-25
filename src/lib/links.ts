// External links used by the extension.

export const CHROME_WEB_STORE_ID = 'cgkpmhbpejmdjgeipmkbihbjcniflpnl';
export const REVIEW_URL = `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`;

// Short optional survey Chrome opens after SnapTabs is uninstalled. Nothing
// is appended to the URL: no ids, versions, or usage data. Empty = disabled.
// The form (Google Forms) collects no email and needs no sign-in.
export const UNINSTALL_SURVEY_URL = 'https://forms.gle/MDhCnNiG4tGSHGEi8';

export async function configureUninstallSurvey(url: string = UNINSTALL_SURVEY_URL): Promise<void> {
  if (!url) return;
  try { await chrome.runtime.setUninstallURL(url); } catch { /* invalid URL or unsupported */ }
}

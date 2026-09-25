# Privacy Policy for SnapTabs

**Last updated:** September 25, 2026

## What SnapTabs Does

SnapTabs is a Chrome extension that lets you snapshot and restore your browser tabs. It saves tab session data so you can recover your workspace later.

## Data Collection

SnapTabs collects the following information **only from your open browser tabs**, when you take a snapshot, record a session, or when an automatic save you have turned on runs (save on browser close, save incognito on close, or rolling backup):

- Tab URLs
- Tab titles
- Favicon URLs
- Tab pinned state
- Tab group names and colors
- Whether a tab was in an incognito window

## Data Storage

All data is stored **locally on your device** using Chrome's built-in `chrome.storage.local` API. SnapTabs does **not**:

- Send any data to external servers
- Use analytics or tracking services
- Share data with third parties
- Sync data across devices
- Collect any personally identifiable information beyond what is visible in your browser tabs

## Data Retention

Session data persists in your browser's local storage until you manually delete it or until automatic pruning removes the oldest sessions when the configured limit is exceeded. You can delete individual sessions or all data at any time from the extension's Settings page.

Uninstalling SnapTabs removes all stored data.

## Automatic Saves

All automatic saves are off until you turn them on, either in Settings or on the welcome page shown after install.

- **Save on browser close** saves your open tabs when you quit the browser.
- **Rolling backup** keeps a single, periodically refreshed copy of your open tabs (every 5, 15, 30, or 60 minutes). It never includes incognito windows.

Both are stored locally, exactly like manual snapshots.

## Incognito Mode

When granted incognito access, SnapTabs can snapshot tabs from incognito windows. These snapshots are stored alongside regular sessions in local storage. SnapTabs caches incognito tab data ephemerally (using `chrome.storage.session`, which is cleared when the browser closes) to support auto-save on incognito window close.

## Permissions

SnapTabs requests only the permissions necessary for its functionality:

| Permission | Purpose |
|---|---|
| `tabs` | Query and create tabs for snapshot and restore |
| `tabGroups` | Read and recreate tab group names, colors, and state |
| `storage` | Persist sessions and settings locally |
| `contextMenus` | Provide right-click "Save all tabs" option |
| `alarms` | Schedule the optional rolling backup |

## Uninstall Feedback

When you uninstall SnapTabs, your browser may open a short, optional feedback form asking why you left. SnapTabs attaches nothing to that page: no identifiers, usage data, or tab data. Answering is entirely voluntary.

## Changes to This Policy

If this privacy policy changes, the updated version will be included with the extension update.

## Contact

For questions about this privacy policy, please open an issue on the [SnapTabs GitHub repository](https://github.com/threatner/SnapTabs).

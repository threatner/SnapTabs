import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'SnapTabs - Save Tabs & Session Manager',
    description: 'Session manager and tab saver: save all open tabs in one click, restore them later with tab groups intact. Free, no account, local.',
    permissions: ['tabs', 'tabGroups', 'storage', 'contextMenus', 'alarms', 'favicon'],
    omnibox: { keyword: 'st' },
    incognito: 'spanning',
    minimum_chrome_version: '93',
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    commands: {
      'snapshot-tabs': {
        suggested_key: {
          default: 'Alt+Shift+S',
          mac: 'Alt+Shift+S',
        },
        description: 'Snapshot all open tabs',
      },
    },
  },
});

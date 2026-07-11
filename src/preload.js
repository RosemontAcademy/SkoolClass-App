// Bridge exposed to the SkoolClass web app. The page feature-detects it:
// `window.skoolDesktop?.setBadge(count)` — absent in browsers/PWA, so the
// web app needs no knowledge of Electron beyond this optional call.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skoolDesktop', {
  shell: 'electron',
  setBadge: (count) => ipcRenderer.send('skool:badge', count),
});

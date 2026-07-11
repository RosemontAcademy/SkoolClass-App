// SkoolClass desktop shell — loads the production web console and adds what a
// browser can't: tray residency (close = hide, not quit), a taskbar unread
// badge fed by the page via the preload bridge, launch-at-login, and
// GitHub-releases auto-update. All product features live in the web app;
// deploying the web app updates this shell's content instantly.
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');

const APP_URL = 'https://skoolclass.vercel.app';
const ASSETS = path.join(__dirname, '..', 'assets');

// Hosts allowed to load inside the app window/popups. Everything else opens in
// the default browser. The auth suffixes must stay internal so OAuth redirects
// and the widget-preview social-login popups (postMessage back) can complete.
const INTERNAL_HOST_SUFFIXES = [
  'skoolclass.vercel.app',
  'supabase.co',
  'google.com',
  'accounts.youtube.com', // Google sign-in bounces through here for session sync
  'kakao.com',
  'daum.net',
  'naver.com',
];

function isInternalUrl(url) {
  try {
    const host = new URL(url).hostname;
    return INTERNAL_HOST_SUFFIXES.some(s => host === s || host.endsWith('.' + s));
  } catch {
    return false;
  }
}

let win = null;
let tray = null;
let isQuitting = false;

const startHidden = process.argv.includes('--hidden');

// Second launch (e.g. desktop icon while running in tray) surfaces the window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  // Google rejects OAuth from user agents that advertise an embedded shell
  // (disallowed_useragent) — present as plain Chrome.
  app.userAgentFallback = app.userAgentFallback
    .replace(/\sSkoolClass\/[\d.]+/i, '')
    .replace(/\sElectron\/[\d.]+/, '');

  app.whenReady().then(() => {
    // Must match build.appId or Windows toasts show no app name/icon.
    app.setAppUserModelId('kr.rosemont.skoolclass');
    createWindow();
    createTray();
    setupAutoUpdate();
    ipcMain.on('skool:badge', (_e, n) => setBadge(Number(n) || 0));
    ipcMain.on('skool:show', () => showWindow());
  });

  app.on('before-quit', () => { isQuitting = true; });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: !startHidden,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    icon: path.join(ASSETS, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false,
    },
  });

  if (process.env.SKOOL_DEBUG) {
    win.webContents.on('did-navigate', (_e, url) => console.log('[nav]', url));
    win.webContents.on('did-navigate-in-page', (_e, url) => console.log('[nav-spa]', url));
  }

  win.loadURL(APP_URL);

  // Close = hide to tray (ChannelTalk behavior). Real quit is the tray menu.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Tray residency keeps one SPA instance alive for days, so web deploys
  // wouldn't reach the app until a manual restart. Refresh after long hidden
  // stretches; a visible window is never interrupted (no draft loss).
  const RELOAD_AFTER_HIDDEN_MS = 4 * 60 * 60 * 1000;
  let hiddenAt = null;
  win.on('hide', () => { hiddenAt = Date.now(); });
  win.on('show', () => {
    if (hiddenAt && Date.now() - hiddenAt >= RELOAD_AFTER_HIDDEN_MS) win.webContents.reload();
    hiddenAt = null;
  });
  setInterval(() => {
    if (hiddenAt && Date.now() - hiddenAt >= 24 * 60 * 60 * 1000) {
      win.loadURL(APP_URL);
      hiddenAt = Date.now(); // re-arm: refresh again tomorrow if still hidden
    }
  }, 30 * 60 * 1000);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (!isInternalUrl(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Network failure → local offline page (it retries APP_URL on its own).
  // -3 (ERR_ABORTED) fires on ordinary SPA navigation cancels; not a failure.
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) {
      win.loadFile(path.join(__dirname, 'offline.html'));
    }
  });
}

// ── Taskbar unread badge ─────────────────────────────────────────────────────
// Windows has no Badging API; the web app sends its unread total through the
// preload bridge and we pin a numbered overlay on the taskbar icon.
function setBadge(count) {
  if (!win) return;
  const n = Math.max(0, Math.floor(count));
  if (n > 0) {
    const name = n > 9 ? '9plus' : String(n);
    const icon = nativeImage.createFromPath(path.join(ASSETS, 'overlay', `overlay-${name}.png`));
    win.setOverlayIcon(icon, `안읽음 ${n}건`);
  } else {
    win.setOverlayIcon(null, '');
  }
  if (tray) tray.setToolTip(n > 0 ? `SkoolClass — 안읽음 ${n}건` : 'SkoolClass');
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(path.join(ASSETS, 'tray.png'));
  tray.setToolTip('SkoolClass');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'SkoolClass 열기', click: showWindow },
    { type: 'separator' },
    {
      label: '시작 시 자동 실행',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      // --hidden: boot launches straight to tray instead of opening the window
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
    },
    { label: '업데이트 확인', click: () => checkForUpdates() },
    { type: 'separator' },
    { label: '종료', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

// ── Auto-update (GitHub Releases) ────────────────────────────────────────────
function checkForUpdates() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  // Downloads in the background, notifies, installs on quit.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

function setupAutoUpdate() {
  checkForUpdates();
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

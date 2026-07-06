const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DEFAULT_URL } = require('./config.js');

// --- Config: the server URL is saved in userData so it survives updates and
// can be changed from the menu without rebuilding. Falls back to DEFAULT_URL. ---
const configPath = () => path.join(app.getPath('userData'), 'minutes-config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  try { fs.writeFileSync(configPath(), JSON.stringify(next, null, 2)); } catch { /* ignore */ }
  return next;
}

const isPlaceholder = (url) => !url || url.includes('REPLACE-WITH-YOUR-RAILWAY-URL');

function configuredUrl() {
  const saved = readConfig().serverUrl;
  if (!isPlaceholder(saved)) return saved;
  return isPlaceholder(DEFAULT_URL) ? '' : DEFAULT_URL;
}

function originOf(url) {
  try { return new URL(url).origin; } catch { return null; }
}

let mainWindow = null;

function loadPromptOrApp() {
  const url = configuredUrl();
  if (url) mainWindow.loadURL(url);
  else mainWindow.loadFile(path.join(__dirname, 'url-prompt.html'));
}

function createWindow() {
  const bounds = readConfig().bounds || {};
  mainWindow = new BrowserWindow({
    width: bounds.width || 1200,
    height: bounds.height || 820,
    x: bounds.x,
    y: bounds.y,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0F1B2D',
    title: 'Minutes',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadPromptOrApp();

  // Links to a different origin open in the system browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (originOf(url) !== originOf(configuredUrl())) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return; // the local prompt page
    if (originOf(url) !== originOf(configuredUrl())) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const persistBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) writeConfig({ bounds: mainWindow.getBounds() });
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC for the first-run / change-URL prompt page ---
ipcMain.handle('minutes:get-url', () => {
  const saved = readConfig().serverUrl;
  return isPlaceholder(saved) ? (isPlaceholder(DEFAULT_URL) ? '' : DEFAULT_URL) : saved;
});
ipcMain.on('minutes:set-url', (_event, url) => {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) return;
  writeConfig({ serverUrl: clean });
  if (mainWindow) mainWindow.loadURL(clean);
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Set Server URL…', click: () => { if (mainWindow) mainWindow.loadFile(path.join(__dirname, 'url-prompt.html')); } },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { label: 'Toggle Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Keep it to a single running instance.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

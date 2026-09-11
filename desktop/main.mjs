import { app, BrowserWindow, protocol, ipcMain, dialog, shell, safeStorage } from 'electron';
import { readFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import { join, dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DesktopStorage, DesktopFailure, validate } from './storage.mjs';
import { request } from './transport.mjs';
import { DesktopAuthorization } from './authorization.mjs';
import { DesktopAuthError } from './loopback.mjs';
import { loadAuthConfig } from './auth-config.mjs';

app.setName('Weekaboo');
// Use an app-owned profile in development too; never inherit Electron's generic profile.
const selectedProfile = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', selectedProfile ? resolve(selectedProfile) : join(app.getPath('appData'), 'Weekaboo'));
// Test evidence uses a separate empty profile. Normal runs never borrow browser/native data.
if (process.env.WEEKABOO_TEST_PROFILE && !app.isPackaged) app.setPath('userData', resolve(process.env.WEEKABOO_TEST_PROFILE));
app.setPath('sessionData', join(app.getPath('userData'), 'chromium'));
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
protocol.registerSchemesAsPrivileged([{ scheme: 'weekaboo', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const here = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../dist-desktop');
const origin = 'weekaboo://app';
let window, storage, authStorage, authorization, fileBusy = false;
const trusted = event => {
  if (event.sender !== window?.webContents || event.senderFrame !== event.sender.mainFrame) return false;
  const url = new URL(event.senderFrame.url);
  return url.protocol === 'weekaboo:' && url.host === 'app' && !url.username && !url.password;
};
const openExternal = url => { try { const value = new URL(url); if (value.protocol === 'https:' && !value.username && !value.password) void shell.openExternal(value.href).catch(() => {}); } catch {} };
async function fileOperation(method, input) {
  if (fileBusy) throw new DesktopFailure('busy'); fileBusy = true;
  try {
    if (method === 'pickFile') {
      const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Weekaboo task backup', extensions: ['json'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const file = await open(result.filePaths[0], 'r');
      try {
        if ((await file.stat()).size > 4_000_000) throw new DesktopFailure('validation');
        const bytes = Buffer.alloc(4_000_001); let count = 0;
        while (count < bytes.length) { const { bytesRead } = await file.read(bytes, count, bytes.length - count, null); if (!bytesRead) break; count += bytesRead; }
        validate(count <= 4_000_000); return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, count));
      } finally { await file.close(); }
    }
    validate(typeof input?.name === 'string' && /^weekaboo-tasks-[0-9-]+\.json$/.test(input.name) && typeof input.contents === 'string' && Buffer.byteLength(input.contents) <= 4_000_000);
    const result = await dialog.showSaveDialog(window, { defaultPath: input.name, filters: [{ name: 'Weekaboo task backup', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return false;
    const temporary = join(dirname(result.filePath), `.weekaboo-export-${randomUUID()}.tmp`);
    try { await writeFile(temporary, input.contents, { mode: 0o600, flag: 'wx' }); await rename(temporary, result.filePath); return true; }
    finally { await unlink(temporary).catch(() => {}); }
  } finally { fileBusy = false; }
}
// Electron waits for the entry module before emitting ready; never await it at module scope.
void app.whenReady().then(() => {
if (!primaryInstance) return;
if (process.platform !== 'darwin') { dialog.showErrorBox('Weekaboo preview', 'This desktop preview currently supports macOS.'); app.quit(); }
else {
  authStorage = new DesktopStorage(join(app.getPath('userData'), 'identity'), safeStorage, { maxCredentialBytes: 2_000_000 });
  authorization = new DesktopAuthorization(loadAuthConfig(join(here, 'native-auth.json')), authStorage, async url => {
    const target = new URL(url);
    validate(target.protocol === 'https:' && !target.username && !target.password && !target.port && ['accounts.google.com', 'login.microsoftonline.com'].includes(target.hostname));
    await shell.openExternal(url);
  });
  storage = new DesktopStorage(join(app.getPath('userData'), 'local'), safeStorage);
  protocol.handle('weekaboo', async request => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'app' || url.username || url.password || request.method !== 'GET') return new Response('', { status: 403 });
      const path = resolve(assets, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(assets + sep)) return new Response('', { status: 403 });
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.json': 'application/json' }[extname(path)] || 'application/octet-stream';
      return new Response(await readFile(path), { headers: { 'Content-Type': mime, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff' } });
    } catch { return new Response('', { status: 404 }); }
  });
  const storageMethods = new Set(['readTasks', 'writeTasks', 'readDocument', 'writeDocument', 'vaultGet', 'vaultPut', 'vaultRemove']);
  ipcMain.handle('weekaboo:operation', async (event, method, input) => {
    try {
      validate(trusted(event));
      let value;
      if (storageMethods.has(method)) value = storage[method](input || {});
      else if (method === 'authSetup') value = authorization.setup();
      else if (method === 'authCancel') { authorization.cancelInteractive(); value = {}; }
      else if (method === 'authAcquire') value = await authorization.acquire(input);
      else if (method === 'authForget') value = await authorization.forget(input);
      else if (method === 'request') value = await request(input || {});
      else if (method === 'pickFile' || method === 'saveFile') value = await fileOperation(method, input);
      else throw new DesktopFailure('validation');
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: { code: error instanceof DesktopFailure || error instanceof DesktopAuthError ? error.code : 'unavailable', message: 'Native operation could not complete. Your existing data has been retained.' } };
    }
  });
  const createWindow = () => {
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 360, minHeight: 500, title: 'Weekaboo', backgroundColor: '#f6f5ef',
      webPreferences: { preload: join(here, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, spellcheck: false } });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
    window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) { event.preventDefault(); openExternal(url); } });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.on('focus', () => window.webContents.send('weekaboo:activity', true));
    window.on('blur', () => window.webContents.send('weekaboo:activity', false));
    window.on('closed', () => { authorization.cancel(); window = null; });
    void window.loadURL(origin + '/');
  };
  createWindow();
  app.on('activate', () => { if (!window) createWindow(); });
  app.on('before-quit', () => { authorization.cancel(); storage?.close(); authStorage?.close(); });
}
}).catch(() => { dialog.showErrorBox('Weekaboo could not start', 'Local storage could not be opened. Your existing data has been retained.'); app.quit(); });

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { ServiceManager } from './ServiceManager';
import Store from 'electron-store';
import fixPath from 'fix-path';
import { autoUpdater } from 'electron-updater';

// Fix PATH for GUI apps on macOS/Linux
fixPath();

// Auto Update
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const store = new Store();
const serviceManager = new ServiceManager();
let mainWindow: BrowserWindow | null = null;

// ─── Chat persistence via electron-store (no native deps needed) ─────────────
interface ChatSession { id: string; preview: string; createdAt: number; }
interface ChatMessage { id: string; role: string; content: string; timestamp: number; }

const chatStore = new Store({ name: 'chat_history' }) as any;

function getSessions(): ChatSession[] {
  return (chatStore.get('sessions') as ChatSession[]) || [];
}
function saveSessions(sessions: ChatSession[]) {
  chatStore.set('sessions', sessions);
}
function getMessages(chatId: string): ChatMessage[] {
  return (chatStore.get(`messages.${chatId}`) as ChatMessage[]) || [];
}
function saveMessages(chatId: string, messages: ChatMessage[]) {
  chatStore.set(`messages.${chatId}`, messages);
}

// ─── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#ffffff',
      height: 40,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
  });

  // Push status every 2 s
  setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const status = await serviceManager.getStatus();
      mainWindow.webContents.send('status-update', status);
    }
  }, 2000);
}

// ─── Auto Updater ────────────────────────────────────────────────────────────
autoUpdater.on('update-available', () =>
  mainWindow?.webContents.send('update-status', { status: 'available' })
);
autoUpdater.on('update-not-available', () =>
  mainWindow?.webContents.send('update-status', { status: 'uptodate' })
);
autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-status', { status: 'ready' });
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'La actualización se ha descargado. Reinicia para aplicar los cambios.',
    buttons: ['Reiniciar ahora', 'Más tarde'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });
});
autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
  mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
});
autoUpdater.on('download-progress', (p) =>
  mainWindow?.webContents.send('update-progress', p)
);

// ─── App Ready ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // chat_history store auto-initializes, no initDb needed
  createWindow();

  await serviceManager.startN8n();

  const hardware = await serviceManager.getHardwareSpecs();
  console.log('Hardware detected:', hardware);

  serviceManager.checkAndInstallOllama().then((ollamaStatus) => {
    if (ollamaStatus !== 'failed') {
      serviceManager.pullModel(hardware.recommendedModel);
    }
  });

  const savedToken = store.get('tunnel_token') as string;
  serviceManager.startTunnel(savedToken);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  serviceManager.stopN8n();
  serviceManager.stopTunnel();
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Store ──────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => store.set(key, value));

// ─── IPC: Services ───────────────────────────────────────────────────────────
ipcMain.handle('service:start-tunnel', (_, token?: string) => serviceManager.startTunnel(token));
ipcMain.handle('service:stop-tunnel', () => serviceManager.stopTunnel());
ipcMain.handle('service:get-status', () => serviceManager.getStatus());
ipcMain.handle('service:get-hardware', () => serviceManager.getHardwareSpecs());
ipcMain.handle('service:send-support-email', async () => {
  const status = await serviceManager.getStatus();
  if (status.publicUrl) {
    await serviceManager.sendUrlEmail(status.publicUrl);
    return true;
  }
  return false;
});

// ─── IPC: Ollama ─────────────────────────────────────────────────────────────
ipcMain.handle('ollama:list-models', () => serviceManager.getInstalledModels());

ipcMain.handle('ollama:pull-model', async (_, model: string) => {
  return serviceManager.pullModelWithProgress(model, (data) => {
    mainWindow?.webContents.send('ollama-pull-progress', data);
  });
});

// ─── IPC: Chat Sessions (electron-store) ─────────────────────────────────────
ipcMain.handle('chat:get-sessions', () => getSessions());

ipcMain.handle('chat:create-session', (_, session: ChatSession) => {
  const sessions = getSessions();
  if (!sessions.find(s => s.id === session.id)) {
    saveSessions([session, ...sessions]);
  }
  return true;
});

ipcMain.handle('chat:update-preview', (_, chatId: string, preview: string) => {
  const sessions = getSessions().map(s => s.id === chatId ? { ...s, preview } : s);
  saveSessions(sessions);
  return true;
});

ipcMain.handle('chat:delete-session', (_, chatId: string) => {
  saveSessions(getSessions().filter(s => s.id !== chatId));
  chatStore.delete(`messages.${chatId}`);
  return true;
});

ipcMain.handle('chat:get-messages', (_, chatId: string) => getMessages(chatId));

ipcMain.handle('chat:save-message', (_, chatId: string, msg: ChatMessage) => {
  // Ensure session exists
  const sessions = getSessions();
  if (!sessions.find(s => s.id === chatId)) {
    saveSessions([{ id: chatId, preview: 'Nueva conversación', createdAt: Date.now() }, ...sessions]);
  }
  const messages = getMessages(chatId);
  if (!messages.find(m => m.id === msg.id)) {
    saveMessages(chatId, [...messages, msg]);
  }
  return true;
});

// ─── IPC: Shell & Updates ────────────────────────────────────────────────────
ipcMain.handle('shell:open', (_, url) => shell.openExternal(url));
ipcMain.handle('update:check', () => { if (app.isPackaged) autoUpdater.checkForUpdates(); });
ipcMain.handle('update:install', () => autoUpdater.quitAndInstall(false, true));

// ─── IPC: Registration ───────────────────────────────────────────────────────
ipcMain.handle('registration:check', () => serviceManager.isRegistered());
ipcMain.handle('registration:register', (_, data) => serviceManager.registerClient(data));

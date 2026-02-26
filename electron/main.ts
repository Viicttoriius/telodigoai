import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { ServiceManager } from './ServiceManager';
import Store from 'electron-store';
import fixPath from 'fix-path';
import { autoUpdater } from 'electron-updater';

// Fix PATH for GUI apps on macOS/Linux (good practice generally)
fixPath();

// Auto Update Configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const store = new Store();
const serviceManager = new ServiceManager();
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);

  // Verify preload exists
  try {
    const fs = require('fs');
    if (fs.existsSync(preloadPath)) {
      console.log('Preload file exists');
    } else {
      console.error('Preload file DOES NOT EXIST at path:', preloadPath);
      // Try to find it in likely locations for debugging
      console.log('Current __dirname:', __dirname);
      console.log('Files in __dirname:', fs.readdirSync(__dirname));
    }
  } catch (e) {
    console.error('Error checking preload:', e);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // Temporary for debugging CORS/Network issues if any
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#ffffff',
      height: 40
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Check for updates once window is ready
  mainWindow.once('ready-to-show', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Send status updates periodically
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status-update', serviceManager.getStatus());
    }
  }, 2000);
}

// --- AUTO UPDATER EVENTS ---
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-status', { status: 'available' });
  // No dialog needed, auto downloading
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-status', { status: 'uptodate' });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-status', { status: 'ready' });
  // Optional: notify user via dialog or just rely on UI button
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'La actualización se ha descargado. Por favor reinicia la aplicación para aplicar los cambios.',
    buttons: ['Reiniciar ahora', 'Más tarde']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
  mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('update-progress', progressObj);
});

// --- REGISTRATION IPC ---
ipcMain.handle('registration:check', async () => {
  return serviceManager.isRegistered();
});

ipcMain.handle('registration:register', async (_, data) => {
  return await serviceManager.registerClient(data);
});

app.whenReady().then(async () => {
  createWindow();

  // Initialize Services
  await serviceManager.startN8n();

  // Check Hardware & Ollama
  const hardware = await serviceManager.getHardwareSpecs();
  console.log('Hardware detected:', hardware);

  // Run Ollama setup in background to not block UI
  serviceManager.checkAndInstallOllama().then((ollamaStatus) => {
    if (ollamaStatus !== 'failed') {
      serviceManager.pullModel(hardware.recommendedModel);
    }
  });

  // Auto-start tunnel (Persistent if token exists, otherwise Temporary/TryCloudflare)
  const savedToken = store.get('tunnel_token') as string;
  serviceManager.startTunnel(savedToken);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  serviceManager.stopN8n();
  serviceManager.stopTunnel();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC HANDLERS ---

// Store
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => store.set(key, value));

// Services
ipcMain.handle('service:start-tunnel', (_, token?: string) => serviceManager.startTunnel(token));
ipcMain.handle('service:stop-tunnel', () => serviceManager.stopTunnel());
ipcMain.handle('service:get-status', () => serviceManager.getStatus());
ipcMain.handle('service:get-hardware', () => serviceManager.getHardwareSpecs());
ipcMain.handle('service:send-support-email', async () => {
  const status = serviceManager.getStatus();
  if (status.publicUrl) {
    await serviceManager.sendUrlEmail(status.publicUrl);
    return true;
  }
  return false;
});

// Ollama Model Pull with realtime progress
ipcMain.handle('ollama:pull-model', async (_, model: string) => {
  return serviceManager.pullModelWithProgress(model, (data) => {
    mainWindow?.webContents.send('ollama-pull-progress', data);
  });
});

// Shell
ipcMain.handle('shell:open', (_, url) => shell.openExternal(url));

// Updates
ipcMain.handle('update:check', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

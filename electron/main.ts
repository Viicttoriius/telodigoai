import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { ServiceManager } from './ServiceManager';
import Store from 'electron-store';
import fixPath from 'fix-path';
import { autoUpdater } from 'electron-updater';
// Types bypassed to avoid module resolution errors

// Fix PATH for GUI apps on macOS/Linux
fixPath();

// Auto Update
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const store = new Store();
const serviceManager = new ServiceManager();
let mainWindow: BrowserWindow | null = null;

// ─── SQLite DB (via better-sqlite3, loaded lazily to survive asar) ───────────
let db: any;

function initDb() {
  // better-sqlite3 must be required at runtime because it's a native addon
  // and lives in asarUnpack — not statically importable at module load time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'telodigo.db');
  db = new Database(dbPath, { verbose: (msg: any) => console.log('[DB]', msg) });
  db.pragma('journal_mode = WAL');  // Better performance for concurrent reads
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ── Chat sessions ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id         TEXT PRIMARY KEY,
      preview    TEXT NOT NULL DEFAULT 'Nueva conversación',
      role       TEXT NOT NULL DEFAULT 'Assistant',
      created_at INTEGER NOT NULL
    );

    -- ── Chat messages ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content    TEXT NOT NULL,
      timestamp  INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- ── AI Memory (per session context / facts) ───────────────────────────────
    CREATE TABLE IF NOT EXISTS ai_memory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- ── Automations config ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS automations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      webhook_id  TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      last_run    INTEGER
    );

    -- ── Automation execution log ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS automation_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id TEXT NOT NULL,
      status        TEXT NOT NULL CHECK(status IN ('ok','error')),
      result        TEXT,
      ran_at        INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
    );

    -- ── Seed default automations if table is empty ───────────────────────────
    INSERT OR IGNORE INTO automations (id, name, description, webhook_id) VALUES
      ('auto-001', 'Reporte Diario',      'Generar resumen del día',        'reporte-diario'),
      ('auto-002', 'Sincronizar Correos', 'Descargar nuevos emails',        'sync-emails'),
      ('auto-003', 'Alerta de Stock',     'Verificar inventario bajo',      'stock-alert');
  `);

  console.log('[DB] SQLite initialized at', dbPath);
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

// ─── Auto Updater events ─────────────────────────────────────────────────────
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
    message: 'La nueva versión de Telodigo AI está descargada. ¿Reiniciar ahora para aplicar los cambios?',
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
  initDb();
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
  try { db?.close(); } catch { }
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

ipcMain.handle('ollama:pull-model', async (_, model: string) =>
  serviceManager.pullModelWithProgress(model, (data) => {
    mainWindow?.webContents.send('ollama-pull-progress', data);
  })
);

// ─── IPC: Chat Sessions ───────────────────────────────────────────────────────
ipcMain.handle('chat:get-sessions', () =>
  db.prepare('SELECT id, preview, role, created_at as createdAt FROM chat_sessions ORDER BY created_at DESC').all()
);

ipcMain.handle('chat:create-session', (_, s: { id: string; preview: string; role?: string; createdAt: number }) => {
  db.prepare(
    'INSERT OR IGNORE INTO chat_sessions (id, preview, role, created_at) VALUES (?, ?, ?, ?)'
  ).run(s.id, s.preview, s.role ?? 'Assistant', s.createdAt);
  return true;
});

ipcMain.handle('chat:update-preview', (_, chatId: string, preview: string) => {
  db.prepare('UPDATE chat_sessions SET preview = ? WHERE id = ?').run(preview, chatId);
  return true;
});

ipcMain.handle('chat:delete-session', (_, chatId: string) => {
  // CASCADE deletes messages and memory
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(chatId);
  return true;
});

// ─── IPC: Chat Messages ──────────────────────────────────────────────────────
ipcMain.handle('chat:get-messages', (_, chatId: string) =>
  db.prepare(
    'SELECT id, role, content, timestamp FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(chatId)
);

ipcMain.handle('chat:save-message', (_, chatId: string, msg: { id: string; role: string; content: string; timestamp: number }) => {
  // Ensure session row exists (defensive)
  db.prepare(
    'INSERT OR IGNORE INTO chat_sessions (id, preview, role, created_at) VALUES (?, ?, ?, ?)'
  ).run(chatId, 'Nueva conversación', 'Assistant', Date.now());

  db.prepare(
    'INSERT OR IGNORE INTO chat_messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).run(msg.id, chatId, msg.role, msg.content, msg.timestamp);
  return true;
});

// ─── IPC: AI Memory ──────────────────────────────────────────────────────────
ipcMain.handle('memory:get', (_, sessionId?: string) => {
  if (sessionId) {
    return db.prepare('SELECT key, value FROM ai_memory WHERE session_id = ? ORDER BY id ASC').all(sessionId);
  }
  return db.prepare('SELECT key, value FROM ai_memory WHERE session_id IS NULL ORDER BY id ASC').all();
});

ipcMain.handle('memory:set', (_, key: string, value: string, sessionId?: string) => {
  db.prepare('INSERT INTO ai_memory (session_id, key, value) VALUES (?, ?, ?)').run(sessionId ?? null, key, value);
  return true;
});

ipcMain.handle('memory:clear', (_, sessionId?: string) => {
  if (sessionId) {
    db.prepare('DELETE FROM ai_memory WHERE session_id = ?').run(sessionId);
  } else {
    db.prepare('DELETE FROM ai_memory WHERE session_id IS NULL').run();
  }
  return true;
});

// ─── IPC: Automations ─────────────────────────────────────────────────────────
ipcMain.handle('automations:list', () =>
  db.prepare('SELECT * FROM automations ORDER BY created_at ASC').all()
);

ipcMain.handle('automations:log-run', (_, automationId: string, status: 'ok' | 'error', result?: string) => {
  db.prepare('INSERT INTO automation_runs (automation_id, status, result) VALUES (?, ?, ?)').run(automationId, status, result ?? null);
  db.prepare('UPDATE automations SET last_run = ? WHERE id = ?').run(Date.now(), automationId);
  return true;
});

// ─── IPC: Shell & Updates ────────────────────────────────────────────────────
ipcMain.handle('shell:open', (_, url) => shell.openExternal(url));
ipcMain.handle('update:check', () => { if (app.isPackaged) autoUpdater.checkForUpdates(); });
ipcMain.handle('update:install', () => autoUpdater.quitAndInstall(false, true));

// ─── IPC: Registration ───────────────────────────────────────────────────────
ipcMain.handle('registration:check', () => serviceManager.isRegistered());
ipcMain.handle('registration:register', (_, data) => serviceManager.registerClient(data));

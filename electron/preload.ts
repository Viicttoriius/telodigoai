import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Config store ────────────────────────────────────────────────────────
  getStoreValue: (key: string) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),

  // ── Services ────────────────────────────────────────────────────────────
  startTunnel: (token?: string) => ipcRenderer.invoke('service:start-tunnel', token),
  stopTunnel: () => ipcRenderer.invoke('service:stop-tunnel'),
  getStatus: () => ipcRenderer.invoke('service:get-status'),
  getHardware: () => ipcRenderer.invoke('service:get-hardware'),
  sendSupportEmail: () => ipcRenderer.invoke('service:send-support-email'),

  // ── Ollama ──────────────────────────────────────────────────────────────
  pullOllamaModel: (model: string) => ipcRenderer.invoke('ollama:pull-model', model),
  listOllamaModels: () => ipcRenderer.invoke('ollama:list-models'),
  onOllamaPullProgress: (cb: (data: any) => void) => {
    const sub = (_: any, v: any) => cb(v);
    ipcRenderer.on('ollama-pull-progress', sub);
    return () => ipcRenderer.removeListener('ollama-pull-progress', sub);
  },

  // ── Chat sessions (SQLite) ───────────────────────────────────────────────
  getChatSessions: () => ipcRenderer.invoke('chat:get-sessions'),
  createChatSession: (session: any) => ipcRenderer.invoke('chat:create-session', session),
  updateChatSessionPreview: (chatId: string, preview: string) => ipcRenderer.invoke('chat:update-preview', chatId, preview),
  deleteChatSession: (chatId: string) => ipcRenderer.invoke('chat:delete-session', chatId),
  getChatMessages: (chatId: string) => ipcRenderer.invoke('chat:get-messages', chatId),
  saveChatMessage: (chatId: string, msg: any) => ipcRenderer.invoke('chat:save-message', chatId, msg),

  // ── Status events ───────────────────────────────────────────────────────
  onStatusUpdate: (cb: (status: any) => void) => {
    const sub = (_: any, v: any) => cb(v);
    ipcRenderer.on('status-update', sub);
    return () => ipcRenderer.removeListener('status-update', sub);
  },

  // ── Update events ───────────────────────────────────────────────────────
  onUpdateStatus: (cb: (status: any) => void) => {
    const sub = (_: any, v: any) => cb(v);
    ipcRenderer.on('update-status', sub);
    return () => ipcRenderer.removeListener('update-status', sub);
  },
  onUpdateProgress: (cb: (progress: any) => void) => {
    const sub = (_: any, v: any) => cb(v);
    ipcRenderer.on('update-progress', sub);
    return () => ipcRenderer.removeListener('update-progress', sub);
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // ── Shell ───────────────────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),

  // ── Registration ─────────────────────────────────────────────────────────
  checkRegistration: () => ipcRenderer.invoke('registration:check'),
  registerClient: (data: any) => ipcRenderer.invoke('registration:register', data),
});

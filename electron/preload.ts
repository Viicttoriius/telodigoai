import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Config
  getStoreValue: (key: string) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),

  // Actions
  startTunnel: (token?: string) => ipcRenderer.invoke('service:start-tunnel', token),
  stopTunnel: () => ipcRenderer.invoke('service:stop-tunnel'),

  // Status
  getStatus: () => ipcRenderer.invoke('service:get-status'),
  getHardware: () => ipcRenderer.invoke('service:get-hardware'),

  // Support email
  sendSupportEmail: () => ipcRenderer.invoke('service:send-support-email'),

  // Events
  onStatusUpdate: (callback: (status: any) => void) => {
    const subscription = (_: any, value: any) => callback(value);
    ipcRenderer.on('status-update', subscription);
    return () => ipcRenderer.removeListener('status-update', subscription);
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),

  // Auto Update
  onUpdateStatus: (callback: (status: any) => void) => {
    const subscription = (_: any, value: any) => callback(value);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.removeListener('update-status', subscription);
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    const subscription = (_: any, value: any) => callback(value);
    ipcRenderer.on('update-progress', subscription);
    return () => ipcRenderer.removeListener('update-progress', subscription);
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Registration
  checkRegistration: () => ipcRenderer.invoke('registration:check'),
  registerClient: (data: any) => ipcRenderer.invoke('registration:register', data),

  // Ollama Model Management (Dev Panel)
  pullOllamaModel: (model: string) => ipcRenderer.invoke('ollama:pull-model', model),
  onOllamaPullProgress: (callback: (data: { model: string; status: string; percent: number; detail: string }) => void) => {
    const subscription = (_: any, value: any) => callback(value);
    ipcRenderer.on('ollama-pull-progress', subscription);
    return () => ipcRenderer.removeListener('ollama-pull-progress', subscription);
  },
});

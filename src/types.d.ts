export interface IElectronAPI {
  getStoreValue: (key: string) => Promise<any>;
  setStoreValue: (key: string, value: any) => Promise<void>;
  startTunnel: (token: string) => Promise<boolean>;
  stopTunnel: () => Promise<void>;
  getStatus: () => Promise<{ n8n: boolean; tunnel: boolean; ollama: boolean }>;
  getHardware: () => Promise<{ totalRamGB: number; hasNvidia: boolean; vram: number; recommendedModel: string }>;
  onStatusUpdate: (callback: (status: any) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  onUpdateStatus: (callback: (status: { status: string; error?: string }) => void) => () => void;
  onUpdateProgress: (callback: (progress: any) => void) => () => void;
  checkForUpdates: () => Promise<void>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}

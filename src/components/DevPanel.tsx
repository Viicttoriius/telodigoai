import React, { useState, useEffect } from 'react';
import { X, Save, Terminal, Download, CheckCircle2, AlertCircle, Loader2, Cpu, RefreshCw } from 'lucide-react';
import { cn } from './ui';

// ─── Types ───────────────────────────────────────────────────────────────────
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

interface ModelDownload {
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress: number;
  detail: string;
}

const CATALOG = [
  { id: 'tinyllama', label: 'TinyLlama 1.1B', desc: 'Muy ligero (~600 MB)', ram: '2 GB RAM' },
  { id: 'llama3', label: 'Llama 3 8B', desc: 'Potente (~4.7 GB)', ram: '8 GB RAM' },
  { id: 'mistral', label: 'Mistral 7B', desc: 'Equilibrio calidad/velocidad (~4.1 GB)', ram: '8 GB RAM' },
  { id: 'phi3', label: 'Phi-3 Mini', desc: 'Microsoft, eficiente (~2.3 GB)', ram: '4 GB RAM' },
  { id: 'gemma:2b', label: 'Gemma 2B', desc: 'Google, muy rápido (~1.5 GB)', ram: '4 GB RAM' },
  { id: 'codellama', label: 'Code Llama 7B', desc: 'Especializado en código (~3.8 GB)', ram: '8 GB RAM' },
];

function fmtSize(bytes: number) {
  if (!bytes) return '?';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// ─── DevPanel ────────────────────────────────────────────────────────────────
export function DevPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Record<string, ModelDownload>>({});
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [activeTab, setActiveTab] = useState<'tunnel' | 'models'>('models');

  const log = (msg: string) => setLogs(prev => [...prev.slice(-99), msg]);

  const fetchInstalledModels = async () => {
    setLoadingModels(true);
    try {
      const models: OllamaModel[] = await (window as any).api.listOllamaModels();
      setInstalledModels(models);
      log(`[Ollama] ${models.length} modelo(s) detectado(s)`);
    } catch {
      log('[Ollama] Error al obtener modelos instalados');
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    (window as any).api.getStoreValue('tunnel_token').then((val: string) => {
      if (val) setToken(val);
    });

    fetchInstalledModels();

    // Subscribe to pull progress
    const unsubscribe = (window as any).api.onOllamaPullProgress?.(
      (data: { model: string; status: string; percent: number; detail: string }) => {
        setDownloads(prev => ({
          ...prev,
          [data.model]: {
            status: data.status === 'done' ? 'done' : data.status === 'error' ? 'error' : 'downloading',
            progress: data.percent,
            detail: data.detail,
          }
        }));
        log(`[Ollama] ${data.model}: ${data.detail} (${Math.round(data.percent)}%)`);
        if (data.status === 'done') fetchInstalledModels();
      }
    );
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveTunnel = async () => {
    await (window as any).api.setStoreValue('tunnel_token', token);
    await (window as any).api.startTunnel(token);
    log('Token guardado y túnel reiniciando...');
  };

  const handlePull = async (modelId: string) => {
    if (downloads[modelId]?.status === 'downloading') return;
    setDownloads(prev => ({ ...prev, [modelId]: { status: 'downloading', progress: 0, detail: 'Iniciando...' } }));
    log(`[Dev] Iniciando descarga: ${modelId}`);
    await (window as any).api.pullOllamaModel(modelId);
  };

  const isInstalled = (modelId: string) =>
    installedModels.some(m => m.name.startsWith(modelId.replace(':latest', '')));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 w-[700px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-2 text-amber-400">
            <Terminal className="w-5 h-5" />
            <h2 className="font-mono font-bold">Developer Console</h2>
            <span className="text-xs text-slate-600 font-mono ml-1">Ctrl+Shift+D</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950">
          {[
            { key: 'models', label: 'Modelos IA (Ollama)', icon: Cpu },
            { key: 'tunnel', label: 'Cloudflare Tunnel', icon: Terminal },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── MODELS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              {/* Installed summary */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {installedModels.length > 0
                    ? `${installedModels.length} modelo(s) instalado(s) en Ollama`
                    : 'No se detectaron modelos instalados. ¿Ollama está corriendo?'}
                </p>
                <button
                  onClick={fetchInstalledModels}
                  disabled={loadingModels}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingModels && 'animate-spin')} />
                  Actualizar
                </button>
              </div>

              {/* Installed small badges */}
              {installedModels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {installedModels.map(m => (
                    <span key={m.name} className="inline-flex items-center gap-1 bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      {m.name}
                      <span className="text-emerald-600 ml-1">{fmtSize(m.size)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Catalog */}
              <div className="space-y-2.5">
                {CATALOG.map((model) => {
                  const dl = downloads[model.id];
                  const installed = isInstalled(model.id);
                  const isDownloading = dl?.status === 'downloading';
                  const isDone = dl?.status === 'done' || installed;
                  const isError = dl?.status === 'error';

                  return (
                    <div
                      key={model.id}
                      className={cn(
                        'rounded-lg border p-4 transition-all',
                        isDone ? 'border-emerald-700/50 bg-emerald-900/10' :
                          isError ? 'border-red-700/50 bg-red-900/10' :
                            isDownloading ? 'border-amber-700/50 bg-amber-900/10' :
                              'border-slate-800 bg-slate-950 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            {isDownloading && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />}
                            {isError && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            <span className="font-semibold text-sm text-slate-200">{model.label}</span>
                            <span className="text-xs text-slate-600 font-mono">{model.id}</span>
                            <span className="ml-auto text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">{model.ram}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 ml-5">{model.desc}</p>

                          {isDownloading && (
                            <div className="mt-3 ml-5 space-y-1">
                              <div className="flex justify-between text-xs text-slate-400">
                                <span className="truncate">{dl.detail}</span>
                                <span className="ml-2 shrink-0 font-mono">{Math.round(dl.progress)}%</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${dl.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {isDone && !isDownloading && (
                            <p className="mt-1.5 ml-5 text-xs text-emerald-500">✓ Modelo disponible</p>
                          )}
                          {isError && (
                            <p className="mt-1.5 ml-5 text-xs text-red-400">✗ Error. Verifica que Ollama esté corriendo.</p>
                          )}
                        </div>

                        <button
                          onClick={() => handlePull(model.id)}
                          disabled={isDownloading || isDone}
                          className={cn(
                            'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            isDone ? 'bg-emerald-900/30 text-emerald-500 cursor-default' :
                              isDownloading ? 'bg-amber-900/30 text-amber-500 cursor-wait' :
                                isError ? 'bg-red-900/30 text-red-400 hover:bg-red-700 hover:text-white' :
                                  'bg-slate-800 text-slate-300 hover:bg-pink-600 hover:text-white'
                          )}
                        >
                          {isDone ? <><CheckCircle2 className="w-3 h-3" /> Instalado</> :
                            isDownloading ? <><Loader2 className="w-3 h-3 animate-spin" /> Descargando</> :
                              isError ? <><Download className="w-3 h-3" /> Reintentar</> :
                                <><Download className="w-3 h-3" /> Descargar</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TUNNEL TAB ──────────────────────────────────────────────── */}
          {activeTab === 'tunnel' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Cloudflare Tunnel Token</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono focus:border-amber-500 outline-none"
                    placeholder="eyJh..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <button
                    onClick={handleSaveTunnel}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Guardar
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  El token se guarda localmente y reinicia el túnel de inmediato.
                </p>
              </div>
            </div>
          )}

          {/* ── System Logs (always visible) ─────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">System Logs</label>
            <div className="bg-black p-3 rounded font-mono text-xs text-green-400 h-32 overflow-y-auto border border-slate-800 space-y-0.5">
              <p>[System] Dev mode active</p>
              {logs.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

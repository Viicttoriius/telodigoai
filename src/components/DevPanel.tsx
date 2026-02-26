import React, { useState, useEffect } from 'react';
import { X, Save, Terminal, Download, CheckCircle2, AlertCircle, Loader2, Cpu } from 'lucide-react';
import { cn } from './ui';

interface ModelDownload {
  model: string;
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress: number; // 0-100
  detail: string;
}

const AVAILABLE_MODELS = [
  { id: 'tinyllama', label: 'TinyLlama 1.1B', desc: 'Muy ligero, ideal para PCs con poca RAM (~600MB)', ram: '2GB+ RAM' },
  { id: 'llama3', label: 'Llama 3 8B', desc: 'Modelo potente, requiere buena RAM (~4.7GB)', ram: '8GB+ RAM' },
  { id: 'mistral', label: 'Mistral 7B', desc: 'Excelente equilibrio velocidad/calidad (~4.1GB)', ram: '8GB+ RAM' },
  { id: 'phi3', label: 'Phi-3 Mini', desc: 'Pequeño pero capaz, de Microsoft (~2.3GB)', ram: '4GB+ RAM' },
  { id: 'gemma:2b', label: 'Gemma 2B', desc: 'Modelo de Google, muy eficiente (~1.5GB)', ram: '4GB+ RAM' },
  { id: 'codellama', label: 'Code Llama 7B', desc: 'Especializado en código (~3.8GB)', ram: '8GB+ RAM' },
];

export function DevPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Record<string, ModelDownload>>({});
  const [activeTab, setActiveTab] = useState<'tunnel' | 'models'>('tunnel');

  useEffect(() => {
    window.api.getStoreValue('tunnel_token').then(val => {
      if (val) setToken(val);
    });

    // Subscribe to ollama pull progress events
    const unsubscribe = (window as any).api.onOllamaPullProgress?.((data: { model: string; status: string; percent: number; detail: string }) => {
      setDownloads(prev => ({
        ...prev,
        [data.model]: {
          model: data.model,
          status: data.status === 'done' ? 'done' : data.status === 'error' ? 'error' : 'downloading',
          progress: data.percent,
          detail: data.detail,
        }
      }));
      setLogs(prev => [...prev.slice(-99), `[Ollama] ${data.model}: ${data.detail} (${Math.round(data.percent)}%)`]);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleSave = async () => {
    await window.api.setStoreValue('tunnel_token', token);
    await window.api.startTunnel(token);
    setLogs(prev => [...prev, 'Token guardado y túnel reiniciando...']);
  };

  const handlePullModel = async (modelId: string) => {
    if (downloads[modelId]?.status === 'downloading') return;
    setDownloads(prev => ({
      ...prev,
      [modelId]: { model: modelId, status: 'downloading', progress: 0, detail: 'Iniciando descarga...' }
    }));
    setLogs(prev => [...prev, `[Dev] Iniciando descarga de modelo: ${modelId}`]);
    try {
      await (window as any).api.pullOllamaModel(modelId);
    } catch (e) {
      setDownloads(prev => ({
        ...prev,
        [modelId]: { model: modelId, status: 'error', progress: 0, detail: 'Error al descargar' }
      }));
      setLogs(prev => [...prev, `[Error] Falló la descarga de ${modelId}`]);
    }
  };

  const getModelIcon = (modelId: string) => {
    const dl = downloads[modelId];
    if (!dl) return null;
    if (dl.status === 'downloading') return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
    if (dl.status === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (dl.status === 'error') return <AlertCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 w-[680px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-2 text-amber-500">
            <Terminal className="w-5 h-5" />
            <h2 className="font-mono font-bold">Developer Console</h2>
            <span className="text-xs text-slate-600 font-mono ml-2">Ctrl+Shift+D</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('tunnel')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'tunnel'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-900'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            Cloudflare Tunnel
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'models'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-900'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Cpu className="w-4 h-4" />
            Modelos de IA (Ollama)
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* TAB: TUNNEL */}
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
                    onClick={handleSave}
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

          {/* TAB: MODELOS */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Descarga modelos de IA locales a través de Ollama. El progreso se muestra en tiempo real.
              </p>
              <div className="space-y-3">
                {AVAILABLE_MODELS.map((model) => {
                  const dl = downloads[model.id];
                  const isDownloading = dl?.status === 'downloading';
                  const isDone = dl?.status === 'done';
                  const isError = dl?.status === 'error';
                  return (
                    <div
                      key={model.id}
                      className={cn(
                        'rounded-lg border p-4 transition-all',
                        isDone
                          ? 'border-emerald-700 bg-emerald-900/10'
                          : isError
                            ? 'border-red-700 bg-red-900/10'
                            : isDownloading
                              ? 'border-amber-700 bg-amber-900/10'
                              : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getModelIcon(model.id)}
                            <span className="font-mono font-semibold text-sm text-slate-200">{model.label}</span>
                            <span className="text-xs text-slate-600 font-mono">{model.id}</span>
                            <span className="ml-auto text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">{model.ram}</span>
                          </div>
                          <p className="text-xs text-slate-500">{model.desc}</p>

                          {/* Barra de progreso */}
                          {isDownloading && (
                            <div className="mt-3 space-y-1">
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
                          {isDone && (
                            <p className="mt-2 text-xs text-emerald-400">✓ Modelo descargado y listo para usar</p>
                          )}
                          {isError && (
                            <p className="mt-2 text-xs text-red-400">✗ Error al descargar. Revisa que Ollama esté corriendo.</p>
                          )}
                        </div>

                        <button
                          onClick={() => handlePullModel(model.id)}
                          disabled={isDownloading || isDone}
                          className={cn(
                            'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            isDone
                              ? 'bg-emerald-900/30 text-emerald-500 cursor-default'
                              : isDownloading
                                ? 'bg-amber-900/30 text-amber-500 cursor-wait'
                                : isError
                                  ? 'bg-red-900/30 text-red-400 hover:bg-red-700 hover:text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white'
                          )}
                        >
                          {isDone ? (
                            <><CheckCircle2 className="w-3 h-3" /> Instalado</>
                          ) : isDownloading ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Descargando</>
                          ) : isError ? (
                            <><Download className="w-3 h-3" /> Reintentar</>
                          ) : (
                            <><Download className="w-3 h-3" /> Descargar</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logs (siempre visibles abajo) */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">System Logs</label>
            <div className="bg-black p-4 rounded font-mono text-xs text-green-400 h-36 overflow-y-auto border border-slate-800 space-y-0.5">
              <p>[System] Dev mode active</p>
              {logs.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

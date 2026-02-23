import React, { useState, useEffect } from 'react';
import { X, Save, Terminal } from 'lucide-react';

export function DevPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    window.api.getStoreValue('tunnel_token').then(val => {
      if (val) setToken(val);
    });
  }, []);

  const handleSave = async () => {
    await window.api.setStoreValue('tunnel_token', token);
    await window.api.startTunnel(token);
    setLogs(prev => [...prev, 'Token saved & Tunnel restarting...']);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 w-[600px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-2 text-amber-500">
            <Terminal className="w-5 h-5" />
            <h2 className="font-mono font-bold">Developer Console</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
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
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Changes will restart the tunnel process immediately.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">System Logs</label>
            <div className="bg-black p-4 rounded font-mono text-xs text-green-400 h-40 overflow-y-auto border border-slate-800">
              <p>[System] Dev mode active</p>
              {logs.map((l, i) => <p key={i}>[Dev] {l}</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

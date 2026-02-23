import React, { useEffect, useState } from 'react';
import { Activity, Server, ShieldCheck, Cpu, Download, AlertCircle, Globe, Copy, Check, Loader2, Send } from 'lucide-react';
import { cn } from './ui';

interface ServiceStatus {
  n8n: boolean;
  tunnel: boolean;
  ollama: boolean;
  publicUrl?: string | null;
}

export function Dashboard() {
  const [status, setStatus] = useState<ServiceStatus>({ n8n: false, tunnel: false, ollama: false, publicUrl: null });
  const [hardware, setHardware] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const sendSupportEmail = async () => {
    if (!status.publicUrl || sendingEmail) return;
    
    setSendingEmail(true);
    try {
      await (window as any).ipcRenderer.invoke('service:send-support-email');
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (e) {
      console.error('Failed to send support email', e);
    } finally {
      setSendingEmail(false);
    }
  };

  const copyUrl = () => {
    if (status.publicUrl) {
      navigator.clipboard.writeText(status.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    // Initial fetch
    window.api.getStatus().then(setStatus);
    window.api.getHardware().then(setHardware);

    // Subscribe to updates
    const unsubscribeStatus = window.api.onStatusUpdate((newStatus) => {
      setStatus(newStatus);
    });

    const unsubscribeUpdate = window.api.onUpdateStatus((statusObj) => {
      setUpdateStatus(statusObj.status);
    });

    const unsubscribeProgress = window.api.onUpdateProgress((progressObj) => {
      setDownloadProgress(Math.round(progressObj.percent));
    });

    return () => {
      unsubscribeStatus();
      unsubscribeUpdate();
      unsubscribeProgress();
    };
  }, []);

  const StatusIndicator = ({ active, label }: { active: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div className={cn("w-2 h-2 rounded-full animate-pulse", active ? "bg-emerald-500" : "bg-red-500")} />
      <span className={active ? "text-emerald-400" : "text-red-400"}>{label}</span>
    </div>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-slate-950 border-t border-slate-800 flex items-center px-4 justify-between text-xs select-none">
      <div className="flex items-center gap-6">
        <StatusIndicator active={status.n8n} label="CORE (n8n)" />
        <StatusIndicator active={status.tunnel} label="TUNNEL" />
        <StatusIndicator active={status.ollama} label="AI MODEL" />
        
        {status.publicUrl && (
          <>
            <div 
              className="flex items-center gap-2 px-2 py-0.5 rounded bg-blue-900/30 border border-blue-800 cursor-pointer hover:bg-blue-900/50 transition-colors group"
              onClick={copyUrl}
              title="Click to copy remote access URL"
            >
              <Globe className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 font-mono max-w-[200px] truncate">{status.publicUrl}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>

            <button
              onClick={sendSupportEmail}
              disabled={sendingEmail || emailSent}
              className={cn(
                "flex items-center gap-2 px-2 py-0.5 rounded border transition-colors",
                emailSent 
                  ? "bg-emerald-900/30 border-emerald-800 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
              )}
              title="Enviar URL a soporte para nueva automatización"
            >
              {sendingEmail ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : emailSent ? (
                <Check className="w-3 h-3" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>{emailSent ? 'Enviado' : 'Solicitar Automatización'}</span>
            </button>
          </>
        )}

        {updateStatus === 'available' && (
          <div className="flex items-center gap-2 text-amber-400 animate-pulse">
            <Download className="w-3 h-3" />
            <span>Update Available</span>
          </div>
        )}
        {downloadProgress > 0 && downloadProgress < 100 && (
          <div className="flex items-center gap-2 text-blue-400">
            <Download className="w-3 h-3" />
            <span>Downloading {downloadProgress}%</span>
          </div>
        )}
        {updateStatus === 'ready' && (
          <div className="flex items-center gap-2 text-emerald-400">
            <AlertCircle className="w-3 h-3" />
            <span>Restart to Update</span>
          </div>
        )}
      </div>
      
      {hardware && (
        <div className="flex items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            <span>{Math.round(hardware.totalRamGB)}GB RAM</span>
          </div>
          {hardware.hasNvidia && (
            <div className="flex items-center gap-1 text-emerald-600">
              <Activity className="w-3 h-3" />
              <span>CUDA Active ({hardware.vram}MB)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { Dashboard } from './components/Dashboard';
import { DevPanel } from './components/DevPanel';
import { RegistrationScreen } from './components/RegistrationScreen';
import { MessageSquare, Plus, Trash2, Loader2, Play, Zap } from 'lucide-react';
import { cn } from './components/ui';

interface ChatSession {
  id: string;
  preview: string;
  createdAt: number;
}

interface Automation {
  id: string;
  name: string;
  description?: string;
}

function App() {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);

  const [automations] = useState<Automation[]>([
    { id: '1', name: 'Reporte Diario', description: 'Generar resumen del día' },
    { id: '2', name: 'Sincronizar Correos', description: 'Descargar nuevos emails' },
    { id: '3', name: 'Alerta de Stock', description: 'Verificar inventario bajo' },
  ]);

  // Load chat history from local DB
  const loadHistory = async () => {
    try {
      const sessions: ChatSession[] = await (window as any).api.getChatSessions?.() ?? [];
      setChatHistory(sessions.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevPanel(prev => !prev);
      }
    };

    // @ts-ignore
    window.api.checkRegistration().then((registered: boolean) => {
      setIsRegistered(registered);
    });

    loadHistory();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Create a new chat session
  const handleNewChat = async () => {
    const id = `chat_${Date.now()}`;
    const session: ChatSession = { id, preview: 'Nueva conversación', createdAt: Date.now() };
    try {
      await (window as any).api.createChatSession?.(session);
    } catch (e) {
      console.error('Error creating session:', e);
    }
    setChatHistory(prev => [session, ...prev]);
    setActiveChatId(id);
  };

  // Called by Chat when the first message is sent
  const handleFirstMessage = async (chatId: string, preview: string) => {
    try {
      await (window as any).api.updateChatSessionPreview?.(chatId, preview);
    } catch (e) {
      console.error('Error updating preview:', e);
    }
    setChatHistory(prev =>
      prev.map(s => s.id === chatId ? { ...s, preview } : s)
    );
  };

  // Delete a chat session
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      await (window as any).api.deleteChatSession?.(chatId);
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
    setChatHistory(prev => prev.filter(s => s.id !== chatId));
    if (activeChatId === chatId) setActiveChatId('');
  };

  const handleRunAutomation = async (automation: Automation) => {
    try {
      await fetch(`http://localhost:5678/webhook/${automation.id}`, { method: 'POST' });
    } catch {
      alert(`Error al iniciar: ${automation.name}`);
    }
  };

  // ── Loading screen ──────────────────────────────────────────────────────
  if (isRegistered === null) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!isRegistered) {
    return <RegistrationScreen onRegistered={() => setIsRegistered(true)} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">

        {/* New chat button */}
        <div className="p-4 pt-10">
          <button
            onClick={handleNewChat}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white rounded-lg p-3 flex items-center gap-2 transition-colors shadow-lg shadow-pink-900/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Nuevo Chat</span>
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Historial
          </div>
          {chatHistory.length === 0 && (
            <p className="text-xs text-slate-600 px-2 py-2 italic">Sin conversaciones aún</p>
          )}
          {chatHistory.map(session => (
            <div
              key={session.id}
              onClick={() => setActiveChatId(session.id)}
              className={cn(
                'group w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors',
                activeChatId === session.id
                  ? 'bg-pink-600/20 border border-pink-600/30 text-white'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
              )}
            >
              <span className="truncate flex-1">{session.preview}</span>
              <button
                onClick={(e) => handleDeleteChat(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                title="Eliminar conversación"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Automations */}
        <div className="border-t border-slate-800 pt-2 pb-2 px-2 space-y-1">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3" /> Automatizaciones
          </div>
          {automations.map(automation => (
            <div
              key={automation.id}
              className="group w-full text-left p-2.5 rounded-lg text-sm flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors"
            >
              <span className="truncate text-slate-400 group-hover:text-white transition-colors text-xs" title={automation.description}>
                {automation.name}
              </span>
              <button
                onClick={() => handleRunAutomation(automation)}
                className="p-1 rounded bg-slate-700 hover:bg-emerald-600 text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                title="Ejecutar"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main  ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {activeChatId ? (
            <Chat
              key={activeChatId}
              chatId={activeChatId}
              onFirstMessage={handleFirstMessage}
            />
          ) : (
            /* Empty state */
            <div className="flex flex-col h-full items-center justify-center text-slate-600 gap-4">
              <MessageSquare className="w-12 h-12" />
              <p className="text-sm">Pulsa <strong className="text-slate-400">Nuevo Chat</strong> para comenzar</p>
            </div>
          )}
        </div>
        <Dashboard />
      </div>

      {/* Dev Panel */}
      {showDevPanel && <DevPanel onClose={() => setShowDevPanel(false)} />}
    </div>
  );
}

export default App;

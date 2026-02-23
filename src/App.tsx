import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { Dashboard } from './components/Dashboard';
import { DevPanel } from './components/DevPanel';
import { MessageSquare, Plus, Settings } from 'lucide-react';
import { cn } from './components/ui';

function App() {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [activeChat, setActiveChat] = useState('new');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 pt-10"> {/* Padding top for window controls */}
          <button 
            onClick={() => setActiveChat('new')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-3 flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Nuevo Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Historial</div>
          {/* Mock History */}
          {[1, 2, 3].map(i => (
            <button
              key={i}
              className={cn(
                "w-full text-left p-3 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors truncate",
                activeChat === `chat-${i}` && "bg-slate-800 text-white"
              )}
              onClick={() => setActiveChat(`chat-${i}`)}
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span className="truncate">Análisis de Datos Financieros {i}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <button 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-full"
            onClick={() => setShowDevPanel(true)}
          >
            <Settings className="w-4 h-4" />
            <span>Configuración</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-hidden relative pb-8"> {/* pb-8 for dashboard */}
          <Chat key={activeChat} />
        </div>
        
        {/* Dashboard Footer */}
        <Dashboard />
      </div>

      {/* Dev Panel Overlay */}
      {showDevPanel && (
        <DevPanel onClose={() => setShowDevPanel(false)} />
      )}
    </div>
  );
}

export default App;

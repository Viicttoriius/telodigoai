import React, { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { Dashboard } from './components/Dashboard';
import { DevPanel } from './components/DevPanel';
import { RegistrationScreen } from './components/RegistrationScreen';
import { MessageSquare, Plus, Settings, Loader2, Play, Zap } from 'lucide-react';
import { cn } from './components/ui';
import axios from 'axios';

interface Automation {
  id: string;
  name: string;
  description?: string;
  webhookId?: string; // If using a specific n8n webhook ID
}

function App() {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [activeChat, setActiveChat] = useState('new');
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  
  // Mock automations - In a real app, these would come from config/storage
  const [automations, setAutomations] = useState<Automation[]>([
    { id: '1', name: 'Reporte Diario', description: 'Generar resumen del día' },
    { id: '2', name: 'Sincronizar Correos', description: 'Descargar nuevos emails' },
    { id: '3', name: 'Alerta de Stock', description: 'Verificar inventario bajo' }
  ]);

  const handleRunAutomation = async (automation: Automation) => {
    console.log(`Running automation: ${automation.name}`);
    // Visual feedback could be added here (toast, spinner, etc.)
    
    try {
      // Example call to local n8n webhook
      // const response = await axios.post(`http://localhost:5678/webhook/${automation.webhookId || automation.id}`, {});
      // console.log('Automation triggered:', response.data);
      alert(`Automatización iniciada: ${automation.name}`);
    } catch (error) {
      console.error('Error triggering automation:', error);
      alert(`Error al iniciar: ${automation.name}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevPanel(prev => !prev);
      }
    };

    // Check registration
    // @ts-ignore
    window.api.checkRegistration().then((registered) => {
      setIsRegistered(registered);
    });

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isRegistered === null) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isRegistered) {
    return <RegistrationScreen onRegistered={() => setIsRegistered(true)} />;
  }

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
          {/* History items will go here */}
        </div>
        
        {/* Automations Section */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 border-t border-slate-800 pt-2">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Automatizaciones
          </div>
          {automations.map(automation => (
            <div
              key={automation.id}
              className="group w-full text-left p-3 rounded-lg text-sm flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="truncate text-slate-300 group-hover:text-white transition-colors" title={automation.description}>
                  {automation.name}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunAutomation(automation);
                }}
                className="p-1.5 rounded-md bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Ejecutar automatización"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>
          ))}
        </div>

        {/* Dev Mode Trigger (Hidden, use Ctrl+Shift+D) */}
        {/* <div className="p-4 border-t border-slate-800">
          <button 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-full"
            onClick={() => setShowDevPanel(true)}
          >
            <Settings className="w-4 h-4" />
            <span>Configuración</span>
          </button>
        </div> */}
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

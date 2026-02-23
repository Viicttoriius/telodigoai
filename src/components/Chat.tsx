import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Bot, User, Code, Terminal } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './ui';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemRole, setSystemRole] = useState('Assistant');
  const [isRoleSelected, setIsRoleSelected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleRoleSelect = (role: string) => {
    setSystemRole(role);
    setIsRoleSelected(true);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Try to connect to local Ollama instance (Standard Port 11434)
      // This bypasses n8n completely for simple chat
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: 'llama3', // Default model
        messages: [
          { role: 'system', content: `You are a helpful assistant acting as a ${systemRole}. Respond in Spanish.` },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMsg.content }
        ],
        stream: false
      });
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message.content,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback if Ollama is not reachable (e.g., CORS or not running)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error: No se pudo conectar con el modelo local (Ollama). Asegúrate de que el servicio esté corriendo en el puerto 11434. Si es la primera vez, puede que el modelo se esté descargando en segundo plano.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isRoleSelected) {
    return (
      <div className="flex flex-col h-full bg-slate-900 text-slate-100 items-center justify-center p-8">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <Bot className="w-16 h-16 text-blue-500 mx-auto" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              LocalMind AI
            </h1>
            <p className="text-slate-400 text-lg">Selecciona un rol para comenzar la conversación</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'Assistant', label: 'Asistente General', icon: Bot, desc: 'Ayuda con tareas generales y preguntas variadas.' },
              { id: 'Developer', label: 'Desarrollador Experto', icon: Code, desc: 'Especialista en código, arquitectura y debugging.' },
              { id: 'Analyst', label: 'Analista de Datos', icon: Terminal, desc: 'Experto en análisis, estadísticas y patrones.' },
              { id: 'Accountant', label: 'Contador', icon: User, desc: 'Asistencia en finanzas, impuestos y contabilidad.' },
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className="flex items-start gap-4 p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-slate-900 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                  <role.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-200 group-hover:text-blue-400 transition-colors">
                    {role.label}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {role.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          <div className="flex flex-col">
            <h1 className="font-bold text-lg leading-none">LocalMind AI</h1>
            <span className="text-xs text-slate-400">Rol: {systemRole}</span>
          </div>
        </div>
        {/* Role selector removed from header */}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl p-4",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
              )}
            >
              <Markdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const {children, className, node, ...rest} = props
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      <div className="bg-slate-950 rounded p-2 my-2 overflow-x-auto">
                        <code {...rest} className={className}>
                          {children}
                        </code>
                      </div>
                    ) : (
                      <code {...rest} className="bg-slate-700/50 px-1 rounded">
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {msg.content}
              </Markdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none p-4 border border-slate-700">
              <span className="animate-pulse">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/50">
        <div className="flex gap-2 max-w-4xl mx-auto bg-slate-800 p-2 rounded-xl border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
          <button 
            className="p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={(e) => {
              // Handle file selection (convert to base64, etc.)
              console.log(e.target.files);
            }}
          />
          
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 text-sm"
            placeholder="Escribe un mensaje..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          
          <button 
            className={cn(
              "p-2 rounded-lg transition-all",
              input.trim() 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Assuming n8n webhook is running locally
      // In a real app, this URL should be configurable or discovered
      const response = await axios.post('http://localhost:5678/webhook/chat', {
        chatInput: input,
        systemRole: systemRole,
        // Add file processing here if needed
      });
      
      // Handle n8n response structure
      // Assuming n8n returns { output: "text" }
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.output || response.data.text || JSON.stringify(response.data),
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error: Could not connect to LocalMind Core (n8n). Ensure the webhook is active.',
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

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          <h1 className="font-bold text-lg">LocalMind AI</h1>
        </div>
        <select 
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          value={systemRole}
          onChange={(e) => setSystemRole(e.target.value)}
        >
          <option value="Assistant">Asistente General</option>
          <option value="Developer">Desarrollador Experto</option>
          <option value="Analyst">Analista de Datos</option>
          <option value="Accountant">Contador</option>
        </select>
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

import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, User, Code, Terminal, Briefcase } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './ui';
import axios from 'axios';

// ─── Logo SVG de Telodigo AI ────────────────────────────────────────────────
const TeledigoLogo = ({ size = 64, className = '' }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 810 809.999993"
    preserveAspectRatio="xMidYMid meet"
    className={className}
  >
    <defs>
      <clipPath id="cp1"><path d="M 81 258.8125 L 259 258.8125 L 259 548.617188 L 81 548.617188 Z" clipRule="nonzero" /></clipPath>
      <clipPath id="cp2"><path d="M 81 341.445312 L 113.347656 341.445312 L 113.347656 258.8125 L 199.199219 258.8125 L 199.199219 341.445312 L 242.023438 341.445312 L 242.023438 412 L 199.199219 412 L 199.199219 451.527344 C 199.035156 457.640625 199.972656 463.753906 201.988281 469.527344 C 203.917969 474.4375 208.902344 477.4375 214.140625 476.84375 C 217.660156 476.886719 221.117188 476.011719 224.171875 474.277344 L 229.589844 470.535156 L 258.492188 531.875 C 254.695312 534.011719 250.730469 535.855469 246.636719 537.367188 C 238.503906 540.484375 230.136719 542.929688 221.605469 544.683594 C 210.625 547.101562 199.40625 548.257812 188.160156 548.125 C 168.707031 549.015625 149.609375 542.769531 134.445312 530.554688 C 120.394531 518.550781 113.363281 500.035156 113.363281 475.003906 L 113.363281 412 L 81 412 Z" clipRule="nonzero" /></clipPath>
      <clipPath id="cp3"><path d="M 277.375 263.613281 L 364.476562 263.613281 L 364.476562 547.523438 L 277.375 547.523438 Z" clipRule="nonzero" /></clipPath>
      <clipPath id="cp4"><path d="M 380.109375 260 L 630 260 L 630 550 L 380.109375 550 Z" clipRule="nonzero" /></clipPath>
      <clipPath id="cp5"><path d="M 503.945312 482.445312 C 511.070312 482.609375 518.101562 480.828125 524.289062 477.328125 C 530.136719 473.988281 534.941406 469.109375 538.191406 463.203125 C 544.824219 450.886719 544.824219 436.0625 538.191406 423.746094 C 534.914062 417.828125 530.121094 412.902344 524.289062 409.472656 C 518.117188 405.882812 511.082031 404.058594 503.945312 404.207031 C 489.96875 403.984375 477.03125 411.507812 470.277344 423.746094 C 463.542969 436.035156 463.542969 450.902344 470.277344 463.203125 C 473.527344 469.078125 478.304688 473.960938 484.109375 477.328125 C 490.132812 480.800781 496.988281 482.566406 503.945312 482.445312 M 476.273438 549.855469 C 458.097656 550.40625 440.1875 545.285156 425.039062 535.210938 C 410.761719 525.402344 399.367188 511.960938 392.023438 496.277344 C 384.21875 479.804688 380.226562 461.761719 380.390625 443.511719 C 380.226562 425.289062 384.203125 407.277344 392.023438 390.820312 C 399.382812 375.109375 410.761719 361.621094 425.039062 351.738281 C 440.171875 341.648438 458.082031 336.53125 476.273438 337.09375 C 487.285156 336.914062 498.234375 338.695312 508.621094 342.359375 C 516.988281 345.152344 524.839844 349.335938 531.828125 354.734375 C 536.738281 358.414062 540.625 363.28125 543.179688 368.863281 L 543.179688 260.097656 L 629.757812 260.097656 L 629.757812 544.011719 L 543.90625 544.011719 L 543.90625 513.84375 C 539.722656 520.714844 534.277344 526.753906 527.878906 531.636719 C 520.699219 537.304688 512.671875 541.828125 504.09375 545.035156 C 495.191406 548.285156 485.769531 549.929688 476.289062 549.871094" clipRule="nonzero" /></clipPath>
      <clipPath id="cp6"><path d="M 640 466 L 721.640625 466 L 721.640625 547.800781 L 640 547.800781 Z" clipRule="nonzero" /></clipPath>
      <clipPath id="cp7"><path d="M 681.039062 547.4375 C 658.753906 547.394531 640.648438 529.394531 640.488281 507.109375 C 640.382812 496.335938 644.671875 485.980469 652.34375 478.410156 C 665.175781 465.160156 685.429688 462.429688 701.308594 471.824219 C 707.289062 475.472656 712.300781 480.488281 715.9375 486.453125 C 725.375 502.257812 722.75 522.480469 709.574219 535.34375 C 702.0625 543.136719 691.691406 547.496094 680.875 547.421875 Z" clipRule="nonzero" /></clipPath>
    </defs>
    <g clipPath="url(#cp1)"><g clipPath="url(#cp2)"><path fill="#e63199" d="M 81 259.625 L 258.488281 259.625 L 258.488281 548.738281 L 81 548.738281 Z" fillOpacity="1" fillRule="nonzero" /></g></g>
    <g clipPath="url(#cp3)"><path fill="#e63199" d="M 277.375 263.613281 L 364.472656 263.613281 L 364.472656 547.96875 L 277.375 547.96875 Z" fillOpacity="1" fillRule="nonzero" /></g>
    <g clipPath="url(#cp4)"><g clipPath="url(#cp5)"><path fill="#e63199" d="M 380.109375 260 L 629.757812 260 L 629.757812 549.871094 L 380.109375 549.871094 Z" fillOpacity="1" fillRule="nonzero" /></g></g>
    <g clipPath="url(#cp6)"><g clipPath="url(#cp7)"><path fill="#e63199" d="M 640 466 L 721.640625 466 L 721.640625 547.421875 L 640 547.421875 Z" fillOpacity="1" fillRule="nonzero" /></g></g>
  </svg>
);

// ─── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatProps {
  chatId: string;
  onFirstMessage?: (chatId: string, preview: string) => void;
}

const ROLES = [
  { id: 'Assistant', label: 'Asistente General', icon: User, desc: 'Ayuda con tareas generales y preguntas variadas.' },
  { id: 'Developer', label: 'Desarrollador Experto', icon: Code, desc: 'Especialista en código, arquitectura y debugging.' },
  { id: 'Analyst', label: 'Analista de Datos', icon: Terminal, desc: 'Experto en análisis, estadísticas y patrones.' },
  { id: 'Accountant', label: 'Contador', icon: Briefcase, desc: 'Asistencia en finanzas, impuestos y contabilidad.' },
];

// ─── Chat Component ──────────────────────────────────────────────────────────
export function Chat({ chatId, onFirstMessage }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemRole, setSystemRole] = useState('Assistant');
  const [isRoleSelected, setIsRoleSelected] = useState(false);
  const [firstMsgSaved, setFirstMsgSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load existing messages if chatId already has history
  useEffect(() => {
    if (chatId && chatId !== 'new') {
      (window as any).api.getChatMessages?.(chatId).then((msgs: Message[]) => {
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setIsRoleSelected(true);
        }
      }).catch(() => { });
    }
  }, [chatId]);

  const saveMessage = async (msg: Message) => {
    try {
      await (window as any).api.saveChatMessage?.(chatId, msg);
    } catch (e) {
      console.error('Error saving message:', e);
    }
  };

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
    await saveMessage(userMsg);

    // Notify parent of first message (for history sidebar)
    if (!firstMsgSaved && onFirstMessage) {
      onFirstMessage(chatId, input.slice(0, 60));
      setFirstMsgSaved(true);
    }

    try {
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: 'llama3',
        messages: [
          { role: 'system', content: `Eres un asistente útil actuando como ${systemRole}. Responde siempre en español.` },
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
      await saveMessage(botMsg);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ No se pudo conectar con el modelo local (Ollama). Asegúrate de que el servicio esté corriendo en el puerto 11434. Puedes descargar un modelo desde el **Panel de Desarrollador** (`Ctrl+Shift+D`).',
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

  // ── Welcome / Role selection screen ──────────────────────────────────────
  if (!isRoleSelected) {
    return (
      <div className="flex flex-col h-full bg-slate-900 text-slate-100 items-center justify-center p-8">
        <div className="max-w-3xl w-full space-y-10">

          {/* Branding: logo centrado, nombre debajo */}
          <div className="flex flex-col items-center gap-3">
            <TeledigoLogo size={80} />
            <div className="text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-pink-600 bg-clip-text text-transparent leading-tight">
                Telodigo AI
              </h1>
              <p className="text-slate-500 text-sm mt-1">Selecciona un rol para comenzar la conversación</p>
            </div>
          </div>

          {/* Role grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className="flex items-start gap-4 p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-pink-500/50 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-slate-900 group-hover:bg-pink-500/10 group-hover:text-pink-400 transition-colors">
                  <role.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-200 group-hover:text-pink-400 transition-colors">
                    {role.label}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{role.desc}</p>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // ── Active chat ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <TeledigoLogo size={30} />
          <div className="flex flex-col">
            <h1 className="font-bold text-base leading-none">Telodigo AI</h1>
            <span className="text-xs text-slate-400">Rol: {systemRole}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] rounded-2xl p-4',
              msg.role === 'user'
                ? 'bg-pink-600 text-white rounded-br-none'
                : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
            )}>
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { children, className, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <div className="bg-slate-950 rounded p-2 my-2 overflow-x-auto">
                        <code className={className}>{children}</code>
                      </div>
                    ) : (
                      <code {...rest} className="bg-slate-700/50 px-1 rounded">{children}</code>
                    );
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
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 pb-10 border-t border-slate-700 bg-slate-900/50">
        <div className="flex gap-2 max-w-4xl mx-auto bg-slate-800 p-2 rounded-xl border border-slate-700 focus-within:ring-2 focus-within:ring-pink-500/50 transition-all">
          <button
            className="p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => console.log(e.target.files)} />
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 text-sm outline-none"
            placeholder="Escribe un mensaje..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className={cn('p-2 rounded-lg transition-all', input.trim() ? 'bg-pink-600 text-white hover:bg-pink-700' : 'bg-slate-700 text-slate-500 cursor-not-allowed')}
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

"use client";

import { useState, useRef, useEffect } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { 
  Send, 
  FileText, 
  Sparkles, 
  Plus, 
  Globe, 
  CodeXml, 
  Maximize2, 
  Settings as SettingsIcon, 
  Mic
} from "lucide-react";

import { API_URL as API } from "../config";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: any[];
}

const PRESETS = [
  "Analyze the data trends from last month",
  "Generate a SQL query for user analytics",
  "Summarize key insights from the dashboard",
  "Create a report on model performance"
];

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("grad");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(textToSend?: string) {
    const finalQuery = (textToSend || input).trim();
    if (!finalQuery || streaming) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: finalQuery }]);
    setStreaming(true);

    const token = localStorage.getItem("access_token");
    
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: finalQuery, mode }),
      });

      if (!res.body) throw new Error("No readable stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: "assistant", content: "", citations: [] }]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const message = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          
          if (message.startsWith("data: ")) {
            try {
              const data = JSON.parse(message.substring(6));
              
              if (data.type === "context") {
                setMessages(prev => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      citations: data.citations
                    };
                  }
                  return newArr;
                });
              } else if (data.type === "delta") {
                setMessages(prev => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      content: newArr[lastIdx].content + data.text
                    };
                  }
                  return newArr;
                });
              } else if (data.type === "error") {
                setMessages(prev => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      content: `⚠️ Error: ${data.message}`
                    };
                  }
                  return newArr;
                });
                setStreaming(false);
              } else if (data.type === "done") {
                setStreaming(false);
              }
            } catch (parseError) {
              console.error("Failed to parse SSE message:", message, parseError);
            }
          }
          
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      console.error(err);
      setStreaming(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-120px)] relative justify-between overflow-hidden">
        {/* Page Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">AI Chatbot</h1>
            <p className="text-sm sm:text-base text-white/50 mt-1">Ask anything about your data and analytics</p>
          </div>

          <div className="flex gap-2">
            <button className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border border-white/20 text-slate-300 hover:bg-white/10 hover:border-white/40 h-8 rounded-xl gap-1.5 px-3 cursor-pointer">
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
            <button className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border border-white/20 text-slate-300 hover:bg-white/10 hover:border-white/40 h-8 rounded-xl gap-1.5 px-3 cursor-pointer">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Options</span>
            </button>
          </div>
        </div>

        {/* Central Chat Stream / Orb Container */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative flex flex-col items-center">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto space-y-6">
              {/* OkyAi Template 3D Orb Animation Component */}
              <div className="container-vao">
                <div className="orb">
                  <div className="ball">
                    <div className="container-lines"></div>
                    <div className="container-rings"></div>
                  </div>
                  <svg style={{ pointerEvents: "none", position: "absolute" }}>
                    <filter id="gooey">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6"></feGaussianBlur>
                      <feColorMatrix values="1 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10"></feColorMatrix>
                    </filter>
                  </svg>
                </div>
              </div>
              
              <div className="text-center space-y-1 z-10">
                <h2 className="text-xl font-bold text-white tracking-wide">How can I assist your research today?</h2>
                <p className="text-xs text-white/50">Ask a question or select a preset prompt below.</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-6 py-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-3xl p-5 shadow-xl ${
                    msg.role === "user" 
                      ? "bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white rounded-tr-sm" 
                      : "bg-slate-900/80 border border-white/15 text-slate-200 backdrop-blur-xl rounded-tl-sm"
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</div>
                    
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#d946ef]" />
                          Referenced Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cit, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1 rounded-full text-xs text-white/80">
                              <span className="text-[#d946ef] font-extrabold">[{idx+1}]</span>
                              <span className="truncate max-w-[220px]">{cit.section_type} (p. {cit.page_number || '?'})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Floating Search Bar & Preset Pills */}
        <div className="w-full max-w-4xl mx-auto space-y-4 pt-4 shrink-0">
          <div className="rounded-3xl border transition-all duration-300 border-white/20 bg-slate-900/70 backdrop-blur-xl hover:border-[#a855f7]/50 shadow-[0_8px_30px_rgba(168,85,247,0.25)] p-3">
            <div className="flex flex-col px-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask anything..."
                className="w-full bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-base resize-none"
                rows={1}
                style={{ maxHeight: "150px" }}
              />

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 mt-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    type="button" 
                    title="Upload File"
                    className="flex h-8 w-8 text-white/50 cursor-pointer items-center justify-center rounded-full transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg" />

                  <div className="relative h-6 w-[1.5px] mx-1 bg-gradient-to-t from-transparent via-[#a855f7] to-transparent opacity-70" />

                  <button 
                    type="button" 
                    title="Web Search"
                    className="rounded-full transition-all flex items-center gap-1.5 px-2.5 py-1 border h-8 bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                  </button>

                  <div className="relative h-6 w-[1.5px] mx-1 bg-gradient-to-t from-transparent via-[#a855f7] to-transparent opacity-70" />

                  <button 
                    type="button" 
                    title="AI Reasoning"
                    className="rounded-full transition-all flex items-center gap-1.5 px-2.5 py-1 border h-8 bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <div className="relative h-6 w-[1.5px] mx-1 bg-gradient-to-t from-transparent via-[#a855f7] to-transparent opacity-70" />

                  <button 
                    type="button" 
                    title="Code Mode"
                    className="rounded-full transition-all flex items-center gap-1.5 px-2.5 py-1 border h-8 bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <CodeXml className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    title="Voice Input"
                    className="size-9 rounded-full transition-all duration-200 bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center cursor-pointer"
                  >
                    <Mic className="h-4 w-4" />
                  </button>

                  <button 
                    onClick={() => handleSend()}
                    disabled={streaming || !input.trim()}
                    className="size-9 rounded-full transition-all duration-200 bg-gradient-to-r from-[#a855f7] to-[#d946ef] hover:from-[#9333ea] hover:to-[#c026d3] text-white flex items-center justify-center disabled:opacity-40 shadow-lg cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Presets Chips */}
          <div className="space-y-2">
            <p className="text-xs text-white/50 text-center">✨ Try asking:</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto px-4">
              {PRESETS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="text-xs rounded-full px-3.5 py-1.5 bg-slate-900/60 border border-white/15 text-slate-300 hover:bg-slate-800 hover:border-[#a855f7]/50 hover:text-white transition-all shadow-md cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

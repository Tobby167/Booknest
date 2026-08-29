"use client";

import { useState } from "react";
import { BotMessageSquare, User, MessageSquare } from "lucide-react";

type Conversation = {
  id: string;
  platform: string;
  client_name: string | null;
  external_chat_id: string;
  state: any;
  last_message_at: string;
  business?: { name: string; slug: string };
};

type Message = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

const PLATFORM_TABS = ["all", "whatsapp", "telegram", "copilot"] as const;
type PlatformTab = (typeof PLATFORM_TABS)[number];

function PlatformBadge({ platform }: { platform: string }) {
  const styles: Record<string, string> = {
    whatsapp: "bg-emerald-100 text-emerald-700",
    telegram: "bg-sky-100 text-sky-700",
    copilot: "bg-purple-100 text-purple-700",
  };
  const cls = styles[platform] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${cls}`}>
      {platform}
    </span>
  );
}

export function AILogViewer({ conversations }: { conversations: Conversation[] }) {
  const [activeTab, setActiveTab] = useState<PlatformTab>("all");
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const filtered =
    activeTab === "all"
      ? conversations
      : conversations.filter((c) => c.platform === activeTab);

  const counts = {
    all: conversations.length,
    whatsapp: conversations.filter((c) => c.platform === "whatsapp").length,
    telegram: conversations.filter((c) => c.platform === "telegram").length,
    copilot: conversations.filter((c) => c.platform === "copilot").length,
  };

  async function loadMessages(convo: Conversation) {
    setSelectedConvo(convo);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-logs/messages?convoId=${convo.id}`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const tabStyles: Record<PlatformTab, string> = {
    all: "data-[active=true]:border-slate-700 data-[active=true]:text-slate-700",
    whatsapp: "data-[active=true]:border-emerald-600 data-[active=true]:text-emerald-600",
    telegram: "data-[active=true]:border-sky-600 data-[active=true]:text-sky-600",
    copilot: "data-[active=true]:border-purple-600 data-[active=true]:text-purple-600",
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-1 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-[650px] overflow-hidden">
        <div className="border-b px-4 pt-4">
          <div className="flex gap-1 overflow-x-auto">
            {PLATFORM_TABS.map((tab) => (
              <button
                key={tab}
                data-active={activeTab === tab}
                onClick={() => { setActiveTab(tab); setSelectedConvo(null); setMessages([]); }}
                className={`shrink-0 border-b-2 border-transparent pb-2 px-3 text-xs font-black uppercase tracking-wide text-ink/40 transition hover:text-ink ${tabStyles[tab]}`}
              >
                {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-ink/50">
                  {counts[tab]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto space-y-2 flex-1 p-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => loadMessages(c)}
              className={`w-full text-left rounded-lg p-3 transition ${selectedConvo?.id === c.id ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-transparent hover:bg-slate-100"}`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-bold text-sm text-ink truncate">{c.business?.name ?? "Unknown"}</p>
                <PlatformBadge platform={c.platform} />
              </div>
              <p className="text-xs text-ink/70 mt-1 truncate">{c.client_name || c.external_chat_id}</p>
              <p className="text-[10px] text-ink/40 mt-1" suppressHydrationWarning>{new Date(c.last_message_at).toLocaleString()}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <MessageSquare className="h-8 w-8 text-ink/20 mb-2" />
              <p className="text-sm font-bold text-ink/40">No conversations on {activeTab === "all" ? "any platform" : activeTab} yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-[650px] overflow-hidden">
        {selectedConvo ? (
          <>
            <div className="border-b p-4 bg-slate-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-ink truncate">{selectedConvo.business?.name}</h3>
                  <PlatformBadge platform={selectedConvo.platform} />
                </div>
                <p className="text-xs text-ink/60 mt-0.5 truncate">
                  Chatting with {selectedConvo.client_name || selectedConvo.external_chat_id}
                </p>
              </div>
              {selectedConvo.state?.step && (
                <p className="text-xs text-ink/60 font-mono bg-slate-200 px-2 py-0.5 rounded shrink-0">
                  State: {selectedConvo.state.step}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {loading ? (
                <div className="flex justify-center items-center h-full text-ink/40 font-bold text-sm">Intercepting messages...</div>
              ) : (
                messages.map((m) => {
                  const isSystem = m.sender === "system";
                  return (
                    <div key={m.id} className={`flex ${isSystem ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${isSystem ? "bg-purple-600 text-white rounded-br-none" : "bg-white border border-slate-200 text-ink rounded-bl-none"}`}>
                        <p className="text-xs font-bold opacity-60 mb-1 flex items-center gap-1">
                          {isSystem ? <><BotMessageSquare className="h-3 w-3" /> AI Assistant</> : <><User className="h-3 w-3" /> {selectedConvo.platform === "copilot" ? "Business Owner" : "Customer"}</>}
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        <p className="text-[10px] opacity-40 mt-1 text-right" suppressHydrationWarning>{new Date(m.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {messages.length === 0 && !loading && (
                <p className="text-center text-sm font-bold text-ink/40 mt-10">No messages in this conversation yet.</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-ink/30 space-y-3">
            <BotMessageSquare className="h-10 w-10" />
            <p className="font-bold text-sm">Select a conversation to inspect the AI</p>
          </div>
        )}
      </div>
    </div>
  );
}
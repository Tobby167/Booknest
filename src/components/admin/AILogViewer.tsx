"use client";

import { useState } from "react";
import { BotMessageSquare, User } from "lucide-react";

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

export function AILogViewer({ conversations }: { conversations: Conversation[] }) {
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-[600px] overflow-hidden">
        <h3 className="font-black text-ink border-b pb-3 mb-3">Live Conversations</h3>
        <div className="overflow-y-auto space-y-2 flex-1 pr-2 custom-scrollbar">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => loadMessages(c)}
              className={`w-full text-left rounded-lg p-3 transition ${selectedConvo?.id === c.id ? 'bg-purple-50 border border-purple-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}
            >
              <div className="flex justify-between items-start">
                <p className="font-bold text-sm text-ink truncate">{c.business?.name}</p>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{c.platform}</span>
              </div>
              <p className="text-xs text-ink/70 mt-1">{c.client_name || c.external_chat_id}</p>
              <p className="text-[10px] text-ink/40 mt-1">{new Date(c.last_message_at).toLocaleString()}</p>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-sm font-bold text-ink/40 text-center py-10">No AI conversations found.</p>
          )}
        </div>
      </div>

      <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-[600px] overflow-hidden">
        {selectedConvo ? (
          <>
            <div className="border-b p-4 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-ink">{selectedConvo.business?.name} <span className="text-ink/40 font-bold ml-2">Chatting with {selectedConvo.client_name || selectedConvo.external_chat_id}</span></h3>
                <p className="text-xs text-ink/60 mt-0.5 font-mono bg-slate-200 px-1 rounded inline-block">State: {selectedConvo.state?.step || 'idle'}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {loading ? (
                <div className="flex justify-center items-center h-full text-ink/40 font-bold text-sm">Intercepting messages...</div>
              ) : (
                messages.map(m => {
                  const isSystem = m.sender === 'system';
                  return (
                    <div key={m.id} className={`flex ${isSystem ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${isSystem ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-ink rounded-bl-none'}`}>
                        <p className="text-xs font-bold opacity-60 mb-1 flex items-center gap-1">
                          {isSystem ? <><BotMessageSquare className="h-3 w-3" /> AI Assistant</> : <><User className="h-3 w-3" /> Customer</>}
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
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
            <p className="font-bold text-sm">Select a conversation to spy on the AI</p>
          </div>
        )}
      </div>
    </div>
  );
}

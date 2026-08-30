"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Bot, Sparkles, X, Send, Square, Calendar, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

type BookingAgentWidgetProps = {
  businessSlug: string;
  businessName: string;
  currency?: string;
};

export function BookingAgentWidget({ businessSlug, businessName, currency = "USD" }: BookingAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    stop,
  } = useChat({
    api: "/api/ai/booking-agent",
    body: {
      businessSlug,
    },
    onError: (err) => {
      console.error("[BookingAgent Widget Error]", err);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const starterPrompts = [
    "What services do you offer and how much are they?",
    "Do you have anything available tomorrow afternoon?",
    "I want to book an appointment for this weekend",
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-4 py-3 text-sm font-black text-white shadow-xl shadow-purple-500/25 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40 active:scale-95"
            aria-label="Book with AI Agent"
          >
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
            </div>
            <span>Book with AI</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
          </button>
        )}
      </div>

      {/* Chat Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-4 top-20 z-50 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:top-auto sm:h-[580px] sm:w-[400px] overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-purple-900 via-slate-900 to-purple-950 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/30 text-purple-200">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight">{businessName} AI</h3>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-200/75">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Autonomous Booking Agent
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Close AI booking chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 text-sm"
          >
            {/* Initial Welcome if empty */}
            {messages.length === 0 && (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl rounded-tl-sm bg-white p-3.5 text-slate-800 shadow-sm border border-slate-100">
                  <p className="font-bold">👋 Hi there! I&apos;m your AI booking assistant for {businessName}.</p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    You can ask me about our services, check live calendar availability, or tell me what time you&apos;d like to book!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">Quick Prompts</p>
                  {starterPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => append({ role: "user", content: prompt })}
                      className="w-full text-left rounded-xl border border-purple-100 bg-purple-50/60 p-2.5 text-xs font-bold text-purple-900 hover:bg-purple-100 transition flex items-center justify-between group"
                    >
                      <span>{prompt}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render conversation messages */}
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isUser
                        ? "rounded-tr-sm bg-purple-600 text-white font-medium shadow-sm"
                        : "rounded-tl-sm bg-white text-slate-800 border border-slate-100 shadow-sm"
                    }`}
                  >
                    {/* Message content */}
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Tool invocations display */}
                    {m.toolInvocations?.map((toolInvocation) => {
                      const { toolName, toolCallId, state } = toolInvocation;
                      const isComplete = state === "result";

                      let label = "Processing...";
                      if (toolName === "get_services") label = "Checking service catalog...";
                      if (toolName === "check_available_slots") label = "Checking live availability...";
                      if (toolName === "create_appointment") label = "Reserving appointment slot...";

                      return (
                        <div
                          key={toolCallId}
                          className="mt-2 flex items-center gap-1.5 rounded-lg border border-purple-100 bg-purple-50/50 px-2.5 py-1.5 text-[11px] font-bold text-purple-800"
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 shrink-0" />
                          )}
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Loading typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white border border-slate-100 p-3 shadow-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-bounce"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-2.5 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type a message (e.g. Book haircut Friday at 2pm)..."
              className="flex-1 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
              disabled={isLoading}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                aria-label="Stop response"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition shadow-md shadow-purple-500/20"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}

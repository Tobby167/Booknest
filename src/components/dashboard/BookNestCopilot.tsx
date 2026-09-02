"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Bot, Mic, X, Send, Square, Loader2 } from "lucide-react";

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function CopilotMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words">
      {content.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" aria-hidden="true" />;

        const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return <p key={index} className="pt-1 font-semibold text-white">{formatInline(heading[1])}</p>;
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2 pl-1">
              <span className="text-indigo-300" aria-hidden="true">•</span>
              <span>{formatInline(bullet[1])}</span>
            </div>
          );
        }

        const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <div key={index} className="flex gap-2 pl-1">
              <span className="font-semibold text-indigo-300">{numbered[1]}.</span>
              <span>{formatInline(numbered[2])}</span>
            </div>
          );
        }

        return <p key={index}>{formatInline(trimmed)}</p>;
      })}
    </div>
  );
}

export function BookNestCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    error,
  } = useChat({
    api: "/api/ai/copilot",
    onError: (err) => {
      console.error("BookNest Copilot Error:", err);
    },
  });


  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true); // tracks whether we should auto-scroll

  // Detect if user scrolled up manually — pause auto-scroll
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If within 80px of bottom → resume auto-scroll, else pause it
    autoScrollRef.current = distanceFromBottom < 80;
  };

  // Follow the stream as it types — runs on every messages update
  useEffect(() => {
    if (!autoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Always scroll when loading starts (new message sent)
  useEffect(() => {
    if (isLoading) {
      autoScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isLoading]);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleAudioSubmit(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error", err);
      alert("Could not access microphone.");
    }
  };

  const handleAudioSubmit = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append("audio", audioBlob);

    try {
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.text) {
        // Automatically send the transcribed text as a message
        append({
          role: "user",
          content: data.text,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[380px] h-[550px] mb-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="font-semibold text-white">BookNest Copilot</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <Bot className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400 text-sm">Hi! I am your AI Business Assistant. Ask me anything about your business!</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={"max-w-[85%] rounded-2xl px-4 py-2 text-sm " +
                  (m.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-200 border border-gray-700")
                }>
                  <CopilotMessage content={m.content} />
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-400 border border-gray-700 rounded-2xl px-4 py-2 text-sm flex items-center space-x-2">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse delay-75">●</span>
                  <span className="animate-pulse delay-150">●</span>
                </div>
              </div>
            )}
            {isTranscribing && (
              <div className="flex justify-end">
                <div className="bg-indigo-600/50 text-indigo-200 rounded-2xl px-4 py-2 text-sm flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transcribing...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center my-2">
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl px-3 py-1.5 text-xs">
                  Something went wrong. Please try again.
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-gray-800/50 border-t border-gray-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim() || isLoading) return;
                handleSubmit(e);
              }}
              className="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-full pl-4 pr-1 py-1"
            >
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Type or speak..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              />
              <button
                type="button"
                onClick={toggleRecording}
                className={"p-2 rounded-full transition-colors " + (isRecording ? "bg-red-500/20 text-red-500 animate-pulse" : "hover:bg-gray-800 text-gray-400")}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
          </span>
        </button>
      )}
    </div>
  );
}

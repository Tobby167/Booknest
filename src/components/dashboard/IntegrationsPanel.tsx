"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Plug,
  Send,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wifi,
  WifiOff,
  X,
  RefreshCw
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WhatsAppStatus = {
  platform_available: boolean;
  enabled: boolean;
  link: string | null;
  qr_url: string | null;
  display_phone: string | null;
};

type TelegramStatus = {
  id: string;
  bot_username: string;
  is_active: boolean;
  created_at: string;
} | null;

type Conversation = {
  id: string;
  platform: "whatsapp" | "telegram";
  external_chat_id: string;
  client_name: string | null;
  state: { step: string };
  last_message_at: string;
};

type Message = {
  id: string;
  sender: "customer" | "system";
  body: string;
  created_at: string;
};

type ActiveTab = "channels" | "conversations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlatformBadge({ platform }: { platform: "whatsapp" | "telegram" }) {
  if (platform === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-400">
      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
      Telegram
    </span>
  );
}

// ─── WhatsApp Card (Platform Shared Number) ───────────────────────────────────

function WhatsAppCard({
  status,
  onToggle
}: {
  status: WhatsAppStatus;
  onToggle: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleToggle() {
    setToggling(true);
    await onToggle();
    setToggling(false);
  }

  function handleCopy() {
    if (!status.link) return;
    navigator.clipboard.writeText(status.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const WaIcon = (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );

  if (!status.platform_available) {
    return (
      <div className="rounded-2xl border border-slate-700 from-slate-900 to-slate-950 bg-gradient-to-br p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 opacity-40">
            {WaIcon}
          </div>
          <div>
            <h3 className="font-bold text-white">WhatsApp</h3>
            <p className="text-xs text-slate-500">Not configured on this server</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          The platform WhatsApp number is not yet set up. Add the{" "}
          <code className="rounded bg-slate-800 px-1 text-slate-300">PLATFORM_WA_*</code> environment
          variables to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-6 transition ${
        status.enabled
          ? "border-green-600/40 from-green-950/30 to-slate-900"
          : "border-slate-700 from-slate-900 to-slate-950"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600">
            {WaIcon}
          </div>
          <div>
            <h3 className="font-bold text-white">WhatsApp</h3>
            <p className="text-xs text-slate-400">via BookNest shared number</p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            status.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"
          }`}
        >
          {status.enabled ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {status.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {/* Enabled state — show link + QR */}
      {status.enabled && status.link && (
        <div className="mt-5 space-y-4">
          {/* Booking Link */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Your customer booking link
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
              <p className="flex-1 truncate font-mono text-xs text-green-400">{status.link}</p>
              <button
                id="wa-copy-link-btn"
                onClick={handleCopy}
                title="Copy link"
                className="flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Share this link on your website, Instagram bio, or anywhere customers book from.
            </p>
          </div>

          {/* QR Code */}
          {status.qr_url && (
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-slate-700 bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={status.qr_url}
                  alt="WhatsApp booking QR code"
                  width={100}
                  height={100}
                  className="block"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300">QR Code</p>
                <p className="mt-1 text-xs text-slate-500">
                  Customers scan this to open WhatsApp pre-connected to your business. Print it for
                  your studio!
                </p>
                <a
                  id="wa-download-qr-btn"
                  href={status.qr_url}
                  download="booking-qr.png"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  <Download className="h-3 w-3" />
                  Download QR
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disabled state — short pitch */}
      {!status.enabled && (
        <p className="mt-4 text-xs text-slate-500">
          Enable WhatsApp so customers can book appointments by messaging your business directly —
          no setup required on your end.
        </p>
      )}

      {/* Toggle button */}
      <div className="mt-5">
        <button
          id="wa-toggle-btn"
          onClick={handleToggle}
          disabled={toggling}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
            status.enabled
              ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
              : "bg-green-600 text-white hover:bg-green-500"
          }`}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : status.enabled ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          {status.enabled ? "Disable WhatsApp" : "Enable WhatsApp"}
        </button>
      </div>
    </div>
  );
}

// ─── Connect Telegram Modal ────────────────────────────────────────────────────

function ConnectTelegramModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "telegram", bot_token: botToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect.");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Connect Telegram Bot</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <p className="text-xs text-slate-400">
            1. Message <strong className="text-white">@BotFather</strong> on Telegram.<br />
            2. Create a new bot with <code className="text-sky-400">/newbot</code>.<br />
            3. Copy the API token and paste it below.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Bot Token</label>
            <input
              type="password"
              placeholder="1234567890:ABCdef..."
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50 transition">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect Bot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Telegram Channel Card ─────────────────────────────────────────────────────

function TelegramCard({
  tg,
  testResult,
  onConnect,
  onDisconnect,
  onTest
}: {
  tg: TelegramStatus;
  testResult: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await onDisconnect();
    setDisconnecting(false);
  }

  async function handleTest() {
    setTesting(true);
    await onTest();
    setTesting(false);
  }

  const TgIcon = (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 transition ${tg ? "border-slate-600 from-slate-800/80 to-slate-900/80" : "border-slate-700 from-slate-900 to-slate-950"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500">
            {TgIcon}
          </div>
          <div>
            <h3 className="font-bold text-white">Telegram</h3>
            <p className="text-xs text-slate-400">{tg ? `@${tg.bot_username}` : "Not connected"}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tg ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
          {tg ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {tg ? "Connected" : "Disconnected"}
        </span>
      </div>

      {testResult && (
        <div className={`mt-4 rounded-lg px-3 py-2 text-xs ${testResult.startsWith("✅") ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {testResult}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {tg ? (
          <>
            <button
              id="tg-test-btn"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition"
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
              Test Connection
            </button>
            <button
              id="tg-disconnect-btn"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Disconnect
            </button>
          </>
        ) : (
          <button
            id="tg-connect-btn"
            onClick={onConnect}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition"
          >
            <Plug className="h-3 w-3" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Conversations Panel ───────────────────────────────────────────────────────

function ConversationsPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/dashboard/integrations/conversations");
    const data = await res.json();
    if (res.ok) setConversations(data.conversations ?? []);
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    const res = await fetch(`/api/dashboard/integrations/conversations?id=${id}`);
    const data = await res.json();
    if (res.ok) setMessages(data.messages ?? []);
    setLoadingMsgs(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (selected) fetchMessages(selected); }, [selected, fetchMessages]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const text = reply.trim();
    setReply("");
    await fetch("/api/dashboard/integrations/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selected, message: text })
    });
    await fetchMessages(selected);
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 py-16 text-center">
        <MessageCircle className="h-10 w-10 text-slate-600" />
        <p className="font-semibold text-slate-400">No conversations yet</p>
        <p className="text-xs text-slate-500">Customers who message your WhatsApp or Telegram bot will appear here.</p>
      </div>
    );
  }

  const activeConv = conversations.find(c => c.id === selected);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className="grid lg:grid-cols-[280px_1fr]" style={{ minHeight: "520px" }}>
        {/* Conversation list */}
        <div className="border-b border-slate-700 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Chats</span>
            <button onClick={fetchConversations} className="rounded p-1 text-slate-500 hover:text-white transition">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-slate-800 px-4 py-3 text-left transition hover:bg-slate-800 ${selected === conv.id ? "bg-slate-800" : ""}`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
                  {(conv.client_name ?? conv.external_chat_id).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{conv.client_name ?? conv.external_chat_id}</p>
                    <span className="flex-shrink-0 text-xs text-slate-500">{timeAgo(conv.last_message_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <PlatformBadge platform={conv.platform} />
                    <span className="truncate text-xs text-slate-500">{conv.state?.step ?? "idle"}</span>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Message thread */}
        {selected && activeConv ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                {(activeConv.client_name ?? activeConv.external_chat_id).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{activeConv.client_name ?? activeConv.external_chat_id}</p>
                <PlatformBadge platform={activeConv.platform} />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: "380px" }}>
              {loadingMsgs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-purple-400" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">No messages yet.</p>
              ) : messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === "system" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === "system" ? "rounded-br-sm bg-purple-600 text-white" : "rounded-bl-sm bg-slate-800 text-slate-100"}`}>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className={`mt-1 text-xs ${msg.sender === "system" ? "text-purple-200" : "text-slate-500"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <form onSubmit={sendReply} className="flex gap-2 border-t border-slate-700 px-4 py-3">
              <input
                type="text"
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center p-8">
            <MessageCircle className="h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-500">Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("channels");
  const [wa, setWa] = useState<WhatsAppStatus>({ platform_available: false, enabled: false, link: null, qr_url: null, display_phone: null });
  const [tg, setTg] = useState<TelegramStatus>(null);
  const [loading, setLoading] = useState(true);
  const [showTgModal, setShowTgModal] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/integrations");
      const data = await res.json();
      if (res.ok) {
        setWa(data.whatsapp ?? { platform_available: false, enabled: false, link: null, qr_url: null, display_phone: null });
        setTg(data.telegram);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  async function toggleWhatsApp() {
    const nextEnabled = !wa.enabled;
    await fetch("/api/dashboard/integrations", {
      method: nextEnabled ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "whatsapp", enabled: nextEnabled })
    });
    fetchStatuses();
  }

  async function disconnectTelegram() {
    await fetch("/api/dashboard/integrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "telegram" })
    });
    fetchStatuses();
  }

  async function testTelegramConnection() {
    const res = await fetch("/api/dashboard/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "telegram" })
    });
    const data = await res.json();
    setTgTestResult(res.ok ? `✅ Connected — @${data.username}` : `❌ ${data.error}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500">Connect WhatsApp and Telegram to receive and manage bookings via chat.</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["channels", "conversations"] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-bold capitalize transition ${activeTab === tab ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-800"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "channels" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-500" />
            <p className="text-xs text-purple-700">
              <strong>WhatsApp</strong> uses BookNest's shared number — just enable it and share your link.
              No credentials needed. <strong>Telegram</strong> works by pasting your own bot token from @BotFather.
            </p>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <WhatsAppCard status={wa} onToggle={toggleWhatsApp} />
              <TelegramCard
                tg={tg}
                testResult={tgTestResult}
                onConnect={() => setShowTgModal(true)}
                onDisconnect={disconnectTelegram}
                onTest={testTelegramConnection}
              />
            </div>
          )}

          {/* Booking flow explainer */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">How the Conversational Booking Engine works</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "1", title: "Customer taps your link", desc: "They tap your unique booking link or scan your QR code. WhatsApp opens pre-connected to your business." },
                { step: "2", title: "Service & Date Selection", desc: "Bot lists your services. Customer picks one and a date." },
                { step: "3", title: "Time Slot Picker", desc: "Bot shows real-time available slots from your calendar." },
                { step: "4", title: "Booking Confirmed", desc: "Customer confirms and the appointment is created instantly." }
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">{step}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "conversations" && <ConversationsPanel />}

      {showTgModal && (
        <ConnectTelegramModal
          onClose={() => setShowTgModal(false)}
          onSuccess={() => { setShowTgModal(false); fetchStatuses(); }}
        />
      )}
    </div>
  );
}

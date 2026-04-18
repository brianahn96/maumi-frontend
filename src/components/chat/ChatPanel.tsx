import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { TypingIndicator } from "./TypingIndicator";
import { toast } from "sonner";
import { Sparkles, Menu } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createConversation,
  insertMessage,
  listMessages,
  renameConversation,
} from "@/lib/chat-db";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Give me a warm-up writing prompt",
  "Explain quantum entanglement simply",
  "Plan a cozy weekend in Lisbon",
  "Help me name my coffee shop",
];

type Props = {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onConversationsChanged: () => void;
  onOpenSidebar?: () => void;
};

export function ChatPanel({
  conversationId,
  onConversationCreated,
  onConversationsChanged,
  onOpenSidebar,
}: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Conversations created locally in this panel — skip remote history reload for them
  const locallyCreatedRef = useRef<Set<string>>(new Set());
  const loadedIdRef = useRef<string | null>(null);

  // Load history when conversation changes
  useEffect(() => {
    let cancelled = false;
    if (!conversationId) {
      setMessages([]);
      loadedIdRef.current = null;
      return;
    }
    // Don't reload if we already have this conversation loaded (e.g. just created it locally)
    if (loadedIdRef.current === conversationId) return;
    if (locallyCreatedRef.current.has(conversationId)) {
      loadedIdRef.current = conversationId;
      return;
    }
    setLoadingHistory(true);
    listMessages(conversationId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
        loadedIdRef.current = conversationId;
      })
      .catch((e) => {
        console.error(e);
        toast.error("Could not load chat history");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const send = async (text?: string) => {
    if (!user) return;
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    // Ensure we have a conversation
    let convId = conversationId;
    let isFresh = false;
    if (!convId) {
      try {
        const conv = await createConversation(user.id);
        convId = conv.id;
        isFresh = true;
        onConversationCreated(conv.id);
      } catch (e) {
        console.error(e);
        toast.error("Could not start a new chat");
        return;
      }
    }

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsStreaming(true);

    // Persist user message (fire-and-forget; errors logged)
    insertMessage({
      conversationId: convId!,
      userId: user.id,
      role: "user",
      content,
    }).catch((e) => console.error("persist user msg failed", e));

    // If fresh, auto-title from first message
    if (isFresh) {
      const title = content.length > 50 ? content.slice(0, 50).trim() + "…" : content;
      renameConversation(convId!, title)
        .then(() => onConversationsChanged())
        .catch((e) => console.error("rename failed", e));
    }

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantSoFar = "";
    let createdAssistant = false;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        if (!createdAssistant) {
          createdAssistant = true;
          return [...prev, { role: "assistant", content: assistantSoFar }];
        }
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
        );
      });
    };

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        let msg = "Something went wrong.";
        try {
          const data = await resp.json();
          msg = data.error ?? msg;
        } catch {}
        if (resp.status === 429) msg = "Too many requests. Please wait a moment.";
        if (resp.status === 402) msg = "AI credits exhausted. Add funds to continue.";
        toast.error(msg);
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Persist assistant message
      if (assistantSoFar) {
        insertMessage({
          conversationId: convId!,
          userId: user.id,
          role: "assistant",
          content: assistantSoFar,
        })
          .then(() => onConversationsChanged())
          .catch((e) => console.error("persist assistant failed", e));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error("Connection error. Please try again.");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const isEmpty = messages.length === 0 && !loadingHistory;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-3 sm:px-6">
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-base font-bold text-primary-foreground shadow-md md:hidden">
            ☀
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight sm:text-lg">Sunny</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Your friendly AI companion
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-3 sm:px-6">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-width:thin]"
        >
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-3xl shadow-lg">
                <Sparkles className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Hi, I'm Sunny ☀
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
                  Ask me anything, brainstorm an idea, or just say hello. I'm here to help.
                </p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="bubble-assistant rounded-2xl px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}
              {isStreaming &&
                (messages[messages.length - 1]?.role === "user" ||
                  !messages[messages.length - 1]?.content) && <TypingIndicator />}
            </>
          )}
        </div>

        {/* Composer */}
        <div className="pb-4 pt-2">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => send()}
            onStop={stop}
            isStreaming={isStreaming}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Sunny can make mistakes. Double-check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

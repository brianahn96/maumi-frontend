import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { TypingIndicator } from "./TypingIndicator";
import { toast } from "sonner";
import { Sparkles, Menu } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  createConversation,
  listMessages,
  renameConversation,
  streamChat,
} from "@/lib/chat-db";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTION_KEYS: TKey[] = [
  "suggestion.1",
  "suggestion.2",
  "suggestion.3",
  "suggestion.4",
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
  const { t } = useI18n();
  const [messages, _setMessages] = useState<Msg[]>([]);
  const setMessages: typeof _setMessages = (updater) => {
    _setMessages((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Msg[]) => Msg[])(prev) : updater;
      console.log("[ChatPanel] setMessages:", prev.length, "->", next.length, new Error().stack?.split("\n").slice(1, 4).join(" | "));
      return next;
    });
  };
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
    console.log("[ChatPanel] history effect, convId=", conversationId, "loadedId=", loadedIdRef.current, "locallyCreated=", conversationId ? locallyCreatedRef.current.has(conversationId) : false);
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
        console.log("[ChatPanel] history loaded for", conversationId, "rows=", rows.length);
        setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
        loadedIdRef.current = conversationId;
      })
      .catch((e) => {
        console.error(e);
        toast.error(t("chat.couldNotLoad"));
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

    // Clear input IMMEDIATELY (before any await) so the textarea empties.
    setInput("");

    // Ensure we have a conversation
    let convId = conversationId;
    let isFresh = false;
    if (!convId) {
      try {
        const conv = await createConversation(user.id);
        convId = conv.id;
        isFresh = true;
        locallyCreatedRef.current.add(conv.id);
        loadedIdRef.current = conv.id;
        onConversationCreated(conv.id);
      } catch (e) {
        console.error(e);
        toast.error(t("chat.couldNotStart"));
        return;
      }
    }

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    console.log("[ChatPanel] send: setting messages, count=", next.length, "isFresh=", isFresh, "convId=", convId);
    setMessages(next);
    setIsStreaming(true);

    // Backend persists the user message automatically when we hit /stream.

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

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role !== "assistant") {
          return [...prev, { role: "assistant", content: assistantSoFar }];
        }
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
        );
      });
    };

    try {
      for await (const chunk of streamChat({
        conversationId: convId!,
        message: content,
        signal: controller.signal,
      })) {
        upsert(chunk);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error((e as Error).message || t("chat.connectionError"));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const isEmpty = messages.length === 0 && !loadingHistory;
  console.log("[ChatPanel] render: messages=", messages.map(m => `${m.role}(${m.content.length})`).join(","), "isStreaming=", isStreaming);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-3 sm:px-6">
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
            aria-label={t("sidebar.openMenu")}
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
              {t("app.tagline")}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-3 lg:max-w-5xl xl:max-w-6xl sm:px-6">
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
                  {t("chat.greeting")}
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
                  {t("chat.greetingSub")}
                </p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTION_KEYS.map((k) => {
                  const label = t(k);
                  return (
                    <button
                      key={k}
                      onClick={() => send(label)}
                      className="bubble-assistant rounded-2xl px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {label}
                    </button>
                  );
                })}
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
            onSend={send}
            onStop={stop}
            isStreaming={isStreaming}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {t("chat.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

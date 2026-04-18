import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { TypingIndicator } from "./TypingIndicator";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Give me a warm-up writing prompt",
  "Explain quantum entanglement simply",
  "Plan a cozy weekend in Lisbon",
  "Help me name my coffee shop",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsStreaming(true);

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

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col px-3 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-lg font-bold text-primary-foreground shadow-md">
            ☀
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Sunny</h1>
            <p className="text-xs text-muted-foreground">Your friendly AI companion</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            New chat
          </button>
        )}
      </header>

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
  );
}

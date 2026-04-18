import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export function ChatBubble({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "fade-in-up flex w-full items-end gap-2 sm:gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow)] text-sm font-bold text-primary-foreground shadow-md">
          ☀
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] sm:text-[15px]",
          isUser ? "bubble-user rounded-br-md" : "bubble-assistant rounded-bl-md",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground prose-headings:my-2 first:prose-p:mt-0 last:prose-p:mb-0">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          You
        </div>
      )}
    </div>
  );
}

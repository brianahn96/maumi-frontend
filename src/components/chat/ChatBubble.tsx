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
          <div className="markdown-body space-y-2 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-[13px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold">
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

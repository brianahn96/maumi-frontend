import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
          <div
            className={cn(
              "markdown-body space-y-3",
              "[&_p]:leading-relaxed [&_p:not(:last-child)]:mb-2",
              "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80",
              "[&_strong]:font-semibold [&_em]:italic",
              "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2",
              "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2",
              "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
              "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
              "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
              "[&_li]:leading-relaxed [&_li>p]:my-0",
              "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
              "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono",
              "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-[13px]",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
              "[&_hr]:my-3 [&_hr]:border-border",
              "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_table]:my-2",
              "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
              "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
              "[&_del]:line-through [&_del]:opacity-70",
              "[&_input[type='checkbox']]:mr-1.5 [&_input[type='checkbox']]:align-middle",
              "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || "…"}
            </ReactMarkdown>
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

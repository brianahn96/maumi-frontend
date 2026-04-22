import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming: boolean;
};

export function ChatComposer({ value, onChange, onSend, onStop, isStreaming }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const clearTextarea = () => {
    const el = ref.current;
    if (!el) return;
    el.value = "";
    el.style.height = "auto";
  };

  const submitText = (raw: string) => {
    const nextValue = raw.trim();
    if (!nextValue || isStreaming) return;
    clearTextarea();
    onChange("");
    onSend(nextValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || isComposingRef.current) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitText(e.currentTarget.value);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isComposingRef.current) return;
    submitText(ref.current?.value ?? value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bubble-assistant flex items-end gap-2 rounded-3xl p-2 pl-4"
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          onChange(e.currentTarget.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message Sunny…"
        rows={1}
        className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {isStreaming ? (
        <Button
          type="button"
          onClick={onStop}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
          aria-label="Stop"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!value.trim()}
          className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}

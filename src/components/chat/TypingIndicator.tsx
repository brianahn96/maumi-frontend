export function TypingIndicator() {
  return (
    <div className="fade-in-up flex items-end gap-2 sm:gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow)] text-sm font-bold text-primary-foreground shadow-md">
        ☀
      </div>
      <div className="bubble-assistant flex items-center gap-1.5 rounded-3xl rounded-bl-md px-5 py-4">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

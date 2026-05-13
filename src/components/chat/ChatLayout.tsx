import { useEffect, useState } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatPanel } from "./ChatPanel";
import { listConversations } from "@/lib/chat-db";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ChatLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  // Pick most recent conversation on first load
  useEffect(() => {
    listConversations()
      .then((rows) => {
        if (rows.length > 0) setActiveId(rows[0].id);
      })
      .catch((e) => console.error(e));
  }, []);

  const handleCreated = (id: string) => {
    setActiveId(id || null);
    setRefreshSignal((s) => s + 1);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden w-72 shrink-0 border-r border-border/60 md:block">
        <ConversationSidebar
          activeId={activeId}
          onSelect={setActiveId}
          onCreated={handleCreated}
          refreshSignal={refreshSignal}
        />
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-foreground/30 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-border/60 bg-sidebar shadow-xl transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label={t("sidebar.closeMenu")}
          >
            <X className="h-4 w-4" />
          </button>
          <ConversationSidebar
            activeId={activeId}
            onSelect={setActiveId}
            onCreated={handleCreated}
            refreshSignal={refreshSignal}
            onClose={() => setMobileOpen(false)}
          />
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatPanel
          conversationId={activeId}
          onConversationCreated={handleCreated}
          onConversationsChanged={() => setRefreshSignal((s) => s + 1)}
          onOpenSidebar={() => setMobileOpen(true)}
        />
      </main>
    </div>
  );
}

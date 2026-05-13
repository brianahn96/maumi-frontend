import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  type Conversation,
} from "@/lib/chat-db";
import { Plus, Trash2, MessageSquare, LogOut, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Props = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
  refreshSignal?: number;
  onClose?: () => void;
};

export function ConversationSidebar({
  activeId,
  onSelect,
  onCreated,
  refreshSignal,
  onClose,
}: Props) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const refresh = async () => {
    try {
      const data = await listConversations();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refreshSignal]);

  const handleNew = async () => {
    if (!user) return;
    try {
      const c = await createConversation(user.id);
      setItems((prev) => [c, ...prev]);
      onCreated(c.id);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error(t("sidebar.couldNotCreate"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        const next = items.find((c) => c.id !== id);
        if (next) onSelect(next.id);
        else onCreated(""); // signal: nothing left
      }
    } catch (e) {
      console.error(e);
      toast.error(t("sidebar.couldNotDelete"));
    }
  };

  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const title = editingTitle.trim() || t("sidebar.newChatTitle");
    try {
      await renameConversation(editingId, title);
      setItems((prev) => prev.map((c) => (c.id === editingId ? { ...c, title } : c)));
    } catch (e) {
      console.error(e);
      toast.error(t("sidebar.couldNotRename"));
    } finally {
      setEditingId(null);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-base font-bold text-primary-foreground shadow-md">
          ☀
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-tight">Sunny</p>
          <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="px-3">
        <Button
          onClick={handleNew}
          className="h-10 w-full justify-start gap-2 rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("sidebar.newChat")}
        </Button>
      </div>

      <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {loading ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">{t("sidebar.loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t("sidebar.empty")}
          </div>
        ) : (
          items.map((c) => {
            const isActive = c.id === activeId;
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-2 py-1.5 transition",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-md bg-background px-2 py-1 text-sm outline-none ring-2 ring-primary/30"
                    />
                    <button
                      onClick={commitRename}
                      className="rounded-md p-1 hover:bg-background"
                      aria-label={t("sidebar.save")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md p-1 hover:bg-background"
                      aria-label={t("sidebar.cancel")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onSelect(c.id);
                        onClose?.();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 truncate text-left text-sm"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{c.title}</span>
                    </button>
                    <button
                      onClick={() => startRename(c)}
                      className="rounded-md p-1 opacity-0 hover:bg-background group-hover:opacity-100"
                      aria-label={t("sidebar.rename")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-md p-1 opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
                      aria-label={t("sidebar.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2 border-t border-border/60 p-3">
        <LanguageSwitcher className="w-full justify-center" />
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("sidebar.signOut")}
        </button>
      </div>
    </aside>
  );
}

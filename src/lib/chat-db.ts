// TEMPORARY localStorage-backed chat storage, scoped per user.
// Swap this module to call FastAPI conversation/message endpoints when ready —
// the public API (listConversations/createConversation/etc.) stays the same.

export type Conversation = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Store = {
  conversations: Conversation[];
  messages: Record<string, DbMessage[]>; // by conversation_id
};

const EMPTY: Store = { conversations: [], messages: {} };

let currentUserKey: string | null = null;

export function setChatStorageUser(userKey: string | null) {
  currentUserKey = userKey;
}

function storageKey(): string | null {
  if (!currentUserKey) return null;
  return `sunny:chat:${currentUserKey}`;
}

function read(): Store {
  const key = storageKey();
  if (!key || typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { conversations: [], messages: {} };
    return JSON.parse(raw) as Store;
  } catch {
    return { conversations: [], messages: {} };
  }
}

function write(store: Store) {
  const key = storageKey();
  if (!key || typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(store));
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listConversations(): Promise<Conversation[]> {
  const { conversations } = read();
  return [...conversations].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createConversation(
  _userId: string,
  title = "New chat",
): Promise<Conversation> {
  const store = read();
  const now = new Date().toISOString();
  const conv: Conversation = { id: uid(), title, created_at: now, updated_at: now };
  store.conversations = [conv, ...store.conversations];
  store.messages[conv.id] = [];
  write(store);
  return conv;
}

export async function renameConversation(id: string, title: string) {
  const store = read();
  store.conversations = store.conversations.map((c) =>
    c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c,
  );
  write(store);
}

export async function deleteConversation(id: string) {
  const store = read();
  store.conversations = store.conversations.filter((c) => c.id !== id);
  delete store.messages[id];
  write(store);
}

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  const { messages } = read();
  return messages[conversationId] ?? [];
}

export async function insertMessage(params: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<DbMessage> {
  const store = read();
  const msg: DbMessage = {
    id: uid(),
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    created_at: new Date().toISOString(),
  };
  const existing = store.messages[params.conversationId] ?? [];
  store.messages[params.conversationId] = [...existing, msg];
  // Touch conversation updated_at
  store.conversations = store.conversations.map((c) =>
    c.id === params.conversationId ? { ...c, updated_at: msg.created_at } : c,
  );
  write(store);
  return msg;
}

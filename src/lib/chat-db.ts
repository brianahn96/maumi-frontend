// Chat storage:
// - Conversations (sessions) are stored on the FastAPI backend at /api/v1/sessions
// - Messages are stored on the FastAPI backend at /api/v1/chat/{session_id}/messages
//   (the backend persists user + assistant messages automatically when streaming)

import { apiFetch, API_BASE_URL, getAccessToken } from "@/lib/api-client";

const SESSIONS_PATH = "/api/v1/sessions";
const CHAT_PATH = "/api/v1/chat";

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

// ---------- Per-user storage hook (kept for backwards compat; no-op now) ----------

export function setChatStorageUser(_userKey: string | null) {
  // Messages now live on the backend; nothing to do here.
}

// ---------- API helpers ----------

async function readError(resp: Response): Promise<string> {
  try {
    const data = (await resp.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && (data.detail[0] as { msg?: string })?.msg) {
      return String((data.detail[0] as { msg?: string }).msg);
    }
    return resp.statusText || "Request failed";
  } catch {
    return resp.statusText || "Request failed";
  }
}

type ApiSession = {
  id: string | number;
  user_id?: string | number;
  title?: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeSession(s: ApiSession): Conversation {
  return {
    id: String(s.id),
    title: s.title?.trim() ? s.title : "New chat",
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

// ---------- Conversations API ----------

export async function listConversations(): Promise<Conversation[]> {
  const resp = await apiFetch(SESSIONS_PATH, { method: "GET" });
  if (!resp.ok) throw new Error(await readError(resp));
  const data = (await resp.json()) as ApiSession[] | { sessions?: ApiSession[] };
  const list = Array.isArray(data) ? data : (data.sessions ?? []);
  return list
    .map(normalizeSession)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createConversation(
  _userId: string,
  title = "New chat",
): Promise<Conversation> {
  const resp = await apiFetch(SESSIONS_PATH, {
    method: "POST",
    body: { title },
  });
  if (!resp.ok) throw new Error(await readError(resp));
  const data = (await resp.json()) as ApiSession;
  return normalizeSession(data);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const resp = await apiFetch(`${SESSIONS_PATH}/${id}`, {
    method: "PATCH",
    body: { title },
  });
  if (!resp.ok) throw new Error(await readError(resp));
}

export async function deleteConversation(id: string): Promise<void> {
  const resp = await apiFetch(`${SESSIONS_PATH}/${id}`, { method: "DELETE" });
  if (!resp.ok && resp.status !== 404) throw new Error(await readError(resp));
  // Drop local messages for this conversation too
  const store = readMessages();
  if (store[id]) {
    delete store[id];
    writeMessages(store);
  }
}

// ---------- Messages (still local for now) ----------

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  const store = readMessages();
  return store[conversationId] ?? [];
}

export async function insertMessage(params: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<DbMessage> {
  const store = readMessages();
  const msg: DbMessage = {
    id: uid(),
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    created_at: new Date().toISOString(),
  };
  const existing = store[params.conversationId] ?? [];
  store[params.conversationId] = [...existing, msg];
  writeMessages(store);
  return msg;
}

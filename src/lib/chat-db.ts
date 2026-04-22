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
}

// ---------- Messages API ----------

type ApiMessage = {
  id: string | number;
  role: string;
  content: string;
  created_at: string;
  session_id?: string | number;
  conversation_id?: string | number;
};

function normalizeMessage(m: ApiMessage, fallbackConvId: string): DbMessage {
  const role = m.role === "assistant" ? "assistant" : "user";
  const convId = m.session_id ?? m.conversation_id ?? fallbackConvId;
  return {
    id: String(m.id),
    conversation_id: String(convId),
    role,
    content: m.content,
    created_at: m.created_at,
  };
}

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  const resp = await apiFetch(`${CHAT_PATH}/${conversationId}/messages`, { method: "GET" });
  if (!resp.ok) throw new Error(await readError(resp));
  const data = (await resp.json()) as ApiMessage[] | { messages?: ApiMessage[] };
  const list = Array.isArray(data) ? data : (data.messages ?? []);
  return list
    .map((m) => normalizeMessage(m, conversationId))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

/**
 * Stream an assistant reply from the FastAPI backend.
 * The backend persists both the user message and the assistant reply.
 *
 * Yields incremental text chunks as they arrive (parsed from OpenAI-style SSE
 * `data: {...}` lines).
 */
export async function* streamChat(params: {
  conversationId: string;
  message: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${API_BASE_URL}${CHAT_PATH}/${params.conversationId}/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: params.message }),
    credentials: "include",
    signal: params.signal,
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 429) throw new Error("Too many requests. Please wait a moment.");
    if (resp.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(await readError(resp));
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;
      try {
        const parsed = JSON.parse(json);
        const c =
          parsed.choices?.[0]?.delta?.content ??
          parsed.delta?.content ??
          parsed.content ??
          "";
        if (c) yield c as string;
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

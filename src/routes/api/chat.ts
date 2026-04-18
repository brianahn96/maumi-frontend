import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages: ChatMessage[] };

          if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: "messages must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a friendly, helpful AI assistant. Keep responses warm, clear, and concise. Use markdown when helpful.",
                },
                ...messages,
              ],
              stream: true,
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(
                JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (response.status === 402) {
              return new Response(
                JSON.stringify({
                  error: "AI credits exhausted. Add funds in your Lovable workspace.",
                }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const text = await response.text();
            console.error("AI gateway error", response.status, text);
            return new Response(JSON.stringify({ error: "AI gateway error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat route error", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

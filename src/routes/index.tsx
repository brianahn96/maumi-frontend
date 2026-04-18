import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <ChatPanel />
      <Toaster position="top-center" />
    </>
  );
}

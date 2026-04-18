import { createFileRoute } from "@tanstack/react-router";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        </div>
      </div>
    );
  }
  return user ? <ChatLayout /> : <AuthForm />;
}

function Index() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster position="top-center" />
    </AuthProvider>
  );
}

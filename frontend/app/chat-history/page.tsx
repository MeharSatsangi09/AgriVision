import ChatHistoryView from "@/components/chathistory/ChatHistoryView";
import AuthGate from "@/components/auth/AuthGate";

// Needs the same phone login as /alerts and /my-reports; shows only the logged-in user's own follow-up chats.
export default function ChatHistoryPage() {
  return (
    <AuthGate titleKey="auth.chatHistoryTitle">
      <ChatHistoryView />
    </AuthGate>
  );
}

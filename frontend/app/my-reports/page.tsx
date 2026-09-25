import MyReportsView from "@/components/my-reports/MyReportsView";
import AuthGate from "@/components/auth/AuthGate";

// Needs the same phone login as /alerts; shows only the logged-in user's own reports.
export default function MyReportsPage() {
  return (
    <AuthGate titleKey="auth.myReportsTitle">
      <MyReportsView />
    </AuthGate>
  );
}

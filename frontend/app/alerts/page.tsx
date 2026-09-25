import AlertsView from "@/components/alerts/AlertsView";
import AuthGate from "@/components/auth/AuthGate";

// Alerts is the one page that needs a login (phone OTP); /map and its outbreak circles stay open.
export default function AlertsPage() {
  return (
    <AuthGate titleKey="auth.alertsTitle">
      <AlertsView />
    </AuthGate>
  );
}

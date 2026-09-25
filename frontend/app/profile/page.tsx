import ProfileView from "@/components/profile/ProfileView";
import AuthGate from "@/components/auth/AuthGate";

// Private profile page: needs the phone login, shows only the logged-in user's own details.
export default function ProfilePage() {
  return (
    <AuthGate titleKey="auth.profileTitle">
      <ProfileView />
    </AuthGate>
  );
}

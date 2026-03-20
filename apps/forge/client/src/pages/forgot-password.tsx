import { AuthResetPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();

  // Forge auth hook does not yet expose resetPassword.
  // Once migrated to @cavaridge/auth/client SupabaseAuthProvider, swap in useAuth().resetPassword.
  const handleResetPassword = async (_email: string) => {
    throw new Error("Password reset is not yet configured for this app.");
  };

  return (
    <AuthResetPassword
      onResetPassword={handleResetPassword}
      appName="Forge"
      onBackToSignIn={() => setLocation("/login")}
    />
  );
}

import { AuthRecoveryHandler } from "@cavaridge/auth/client";
import { AuthNewPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();

  // Forge auth hook does not yet expose updatePassword.
  // Once migrated to @cavaridge/auth/client SupabaseAuthProvider, swap in useAuth().updatePassword.
  const handleUpdatePassword = async (_newPassword: string) => {
    throw new Error("Password update is not yet configured for this app.");
  };

  return (
    <AuthRecoveryHandler>
      <AuthNewPassword
        onUpdatePassword={handleUpdatePassword}
        appName="Forge"
        onBackToSignIn={() => setLocation("/login")}
      />
    </AuthRecoveryHandler>
  );
}

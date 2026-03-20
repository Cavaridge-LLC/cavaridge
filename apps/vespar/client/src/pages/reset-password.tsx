import { useAuth, AuthRecoveryHandler } from "@cavaridge/auth/client";
import { AuthNewPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthRecoveryHandler>
      <AuthNewPassword
        onUpdatePassword={updatePassword}
        appName="Vespar"
        onBackToSignIn={() => setLocation("/login")}
      />
    </AuthRecoveryHandler>
  );
}

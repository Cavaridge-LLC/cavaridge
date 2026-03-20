import { useAuth } from "@/hooks/use-auth";
import { AuthRecoveryHandler } from "@cavaridge/auth/client";
import { AuthNewPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthRecoveryHandler>
      <AuthNewPassword
        onUpdatePassword={updatePassword}
        appName="Ceres"
        onBackToSignIn={() => setLocation("/login")}
      />
    </AuthRecoveryHandler>
  );
}

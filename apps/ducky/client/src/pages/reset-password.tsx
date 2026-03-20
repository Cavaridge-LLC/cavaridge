import { useAuth } from "@cavaridge/auth/client";
import { AuthNewPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthNewPassword
      onUpdatePassword={updatePassword}
      appName="Ducky"
      onBackToSignIn={() => setLocation("/login")}
    />
  );
}

import { useAuth } from "@cavaridge/auth/client";
import { AuthResetPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthResetPassword
      onResetPassword={resetPassword}
      appName="Meridian"
      onBackToSignIn={() => setLocation("/login")}
    />
  );
}

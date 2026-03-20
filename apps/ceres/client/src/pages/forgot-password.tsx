import { useAuth } from "@/hooks/use-auth";
import { AuthResetPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthResetPassword
      onResetPassword={resetPassword}
      appName="Ceres"
      onBackToSignIn={() => setLocation("/login")}
    />
  );
}

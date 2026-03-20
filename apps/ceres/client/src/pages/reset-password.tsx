import { useAuth } from "@/hooks/use-auth";
import { AuthNewPassword } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthNewPassword
      onUpdatePassword={updatePassword}
      appName="Ceres"
      onBackToSignIn={() => setLocation("/login")}
    />
  );
}

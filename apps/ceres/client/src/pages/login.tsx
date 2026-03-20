import { useAuth } from "@/hooks/use-auth";
import { AuthLogin } from "@cavaridge/ui/auth";
import { SUPPORTED_PROVIDERS } from "@cavaridge/auth/providers";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { signIn, signInWithProvider } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthLogin
      onSignIn={signIn}
      onSignInWithProvider={signInWithProvider}
      providers={SUPPORTED_PROVIDERS}
      appName="Ceres"
      appTagline="Medicare 60-Day Frequency Calculator"
      onForgotPassword={() => setLocation("/forgot-password")}
      onSignUpClick={() => setLocation("/register")}
    />
  );
}

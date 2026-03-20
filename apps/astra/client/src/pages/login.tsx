import { useAuth } from "@/hooks/use-auth";
import { useAuth as useSharedAuth } from "@cavaridge/auth/client";
import { AuthLogin } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { login, signInWithGoogle, signInWithMicrosoft } = useAuth();
  const { supportedProviders } = useSharedAuth();
  const [, setLocation] = useLocation();

  const handleSignInWithProvider = (providerId: string) => {
    if (providerId === "google") return signInWithGoogle();
    if (providerId === "azure") return signInWithMicrosoft();
  };

  return (
    <AuthLogin
      onSignIn={login}
      onSignInWithProvider={handleSignInWithProvider}
      providers={supportedProviders}
      appName="Astra"
      appTagline="M365 License Optimization"
      onForgotPassword={() => setLocation("/forgot-password")}
      onSignUpClick={() => setLocation("/register")}
    />
  );
}

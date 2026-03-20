import { useAuth } from "@cavaridge/auth/client";
import { AuthLogin } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { signIn, signInWithProvider, supportedProviders } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthLogin
      onSignIn={signIn}
      onSignInWithProvider={signInWithProvider}
      providers={supportedProviders}
      appName="Ducky"
      appTagline="The AI-Native Answer Engine"
      onForgotPassword={() => setLocation("/forgot-password")}
      onSignUpClick={() => setLocation("/register")}
    />
  );
}

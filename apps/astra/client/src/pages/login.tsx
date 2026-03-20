import { useAuth } from "@cavaridge/auth/client";
import { AuthLogin } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { signIn, signInWithProvider, supportedProviders, resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthLogin
      onSignIn={signIn}
      onSignInWithProvider={signInWithProvider}
      providers={supportedProviders}
      appName="Astra"
      appTagline="M365 License Optimization"
      onForgotPassword={() => setLocation("/forgot-password")}
      onSignUpClick={() => setLocation("/register")}
    />
  );
}

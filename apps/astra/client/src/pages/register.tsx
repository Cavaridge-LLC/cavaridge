import { useAuth } from "@cavaridge/auth/client";
import { AuthRegister } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function RegisterPage() {
  const { signUp, signInWithProvider, supportedProviders } = useAuth();
  const [, setLocation] = useLocation();

  const handleRegister = async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
  };

  return (
    <AuthRegister
      onRegister={handleRegister}
      onSignInWithProvider={signInWithProvider}
      providers={supportedProviders}
      appName="Astra"
      onSignInClick={() => setLocation("/login")}
    />
  );
}

import { useAuth } from "@/hooks/use-auth";
import { AuthRegister } from "@cavaridge/ui/auth";
import { SUPPORTED_PROVIDERS } from "@cavaridge/auth/providers";
import { useLocation } from "wouter";

export default function RegisterPage() {
  const { signUp, signInWithProvider } = useAuth();
  const [, setLocation] = useLocation();

  const handleRegister = async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
  };

  return (
    <AuthRegister
      onRegister={handleRegister}
      onSignInWithProvider={signInWithProvider}
      providers={SUPPORTED_PROVIDERS}
      appName="Ceres"
      onSignInClick={() => setLocation("/login")}
    />
  );
}

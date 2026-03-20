import { useAuth } from "@/hooks/use-auth";
import { AuthRegister } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [, setLocation] = useLocation();

  const handleRegister = async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
  };

  return (
    <AuthRegister
      onRegister={handleRegister}
      onSignInWithProvider={() => Promise.resolve()}
      providers={[]}
      appName="Forge"
      onSignInClick={() => setLocation("/login")}
    />
  );
}

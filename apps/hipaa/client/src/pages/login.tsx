import { useAuth } from "@/hooks/use-auth";
import { AuthLogin } from "@cavaridge/ui/auth";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AuthLogin
      onSignIn={signIn}
      onSignInWithProvider={() => Promise.resolve()}
      providers={[]}
      appName="HIPAA"
      appTagline="Risk Assessment Toolkit"
      onSignUpClick={() => setLocation("/register")}
    />
  );
}

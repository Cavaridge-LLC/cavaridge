// @cavaridge/ui — Shared component library
//
// Base components:
//   import { Button, Input, Card, Label } from "@cavaridge/ui";
//
// Auth components:
//   import { AuthLogin, AuthRegister, AuthResetPassword, AuthNewPassword } from "@cavaridge/ui/auth";
//
// Utilities:
//   import { cn } from "@cavaridge/ui/lib/utils";

// Base components
export { Button, buttonVariants, type ButtonProps } from "./components/button.js";
export { Input } from "./components/input.js";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card.js";
export { Label } from "./components/label.js";

// Utilities
export { cn } from "./lib/utils.js";

// Auth components (also available via "@cavaridge/ui/auth")
export * from "./auth/index.js";

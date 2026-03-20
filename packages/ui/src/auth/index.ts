// @cavaridge/ui/auth — Shared auth UI components
//
// Usage in app page wrappers:
//   import { AuthLogin, AuthRegister, AuthResetPassword, AuthNewPassword } from "@cavaridge/ui/auth";

export { AuthLogin, type AuthLoginProps } from "./AuthLogin.js";
export { AuthRegister, type AuthRegisterProps } from "./AuthRegister.js";
export { AuthResetPassword, type AuthResetPasswordProps } from "./AuthResetPassword.js";
export { AuthNewPassword, type AuthNewPasswordProps } from "./AuthNewPassword.js";
export { OAuthButton } from "./oauth-button.js";
export { GoogleIcon, MicrosoftIcon, AppleIcon, PROVIDER_ICONS } from "./oauth-icons.js";
export { PasswordStrength, isPasswordStrong } from "./password-strength.js";

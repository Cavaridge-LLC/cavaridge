// REMOVED — local auth replaced by @cavaridge/auth shared middleware.
// See server/auth.ts for the shared auth wrapper.
//
// Platform Admin guard is now:
//   loadUser() → requireAuth → requirePlatformRole
// All wired in server/index.ts.

export {};

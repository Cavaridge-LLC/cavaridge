// Stub declaration for @replit/object-storage — legacy Replit dependency.
// This module is only used in sterilize-production.ts behind an env check.
declare module "@replit/object-storage" {
  export class Client {
    list(): Promise<{ ok: boolean; value?: Array<{ name: string }> }>;
    delete(name: string): Promise<{ ok: boolean }>;
  }
}

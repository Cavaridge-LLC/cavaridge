// Module declarations for packages without TypeScript definitions
declare module "pg" {
  export class Pool {
    constructor(config?: Record<string, unknown>);
    connect(): Promise<PoolClient>;
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  }
  export interface PoolClient {
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
    release(): void;
  }
  export default { Pool };
}

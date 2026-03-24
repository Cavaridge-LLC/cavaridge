declare module "pg" {
  export class Pool {
    constructor(config?: Record<string, unknown>);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  }
  export interface PoolClient {
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
    release(): void;
  }
  export default { Pool };
}

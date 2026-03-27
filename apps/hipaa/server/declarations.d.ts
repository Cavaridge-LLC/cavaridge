// Module declarations for packages without TypeScript definitions
declare module "pdfkit" {
  import { Readable } from "stream";

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
    info?: Record<string, string>;
    layout?: "portrait" | "landscape";
    autoFirstPage?: boolean;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    page: {
      width: number;
      height: number;
      margins: { top: number; bottom: number; left: number; right: number };
    };
    x: number;
    y: number;
    font(name: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    lineWidth(width: number): this;
    text(text: string, x?: number, y?: number, options?: Record<string, unknown>): this;
    rect(x: number, y: number, w: number, h: number): this;
    roundedRect(x: number, y: number, w: number, h: number, r: number): this;
    circle(x: number, y: number, r: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    fill(color?: string): this;
    stroke(color?: string): this;
    fillAndStroke(fill: string, stroke: string): this;
    moveDown(lines?: number): this;
    addPage(options?: PDFDocumentOptions): this;
    end(): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export default PDFDocument;
}

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

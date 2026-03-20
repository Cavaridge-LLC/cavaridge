/**
 * Global error handler for AEGIS API.
 */
import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[aegis] Error:', err.message);

  if (err.message.includes('not found')) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err.message.includes('Not authorized') || err.message.includes('forbidden')) {
    res.status(403).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}

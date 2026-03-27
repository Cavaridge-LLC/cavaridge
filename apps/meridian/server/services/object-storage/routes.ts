/**
 * Object Storage Routes — Supabase Storage
 *
 * Provides upload and download endpoints backed by Supabase Storage.
 * All routes are tenant-scoped via the authenticated user's tenant context.
 */
import type { Express, Request, Response } from 'express';
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage';

export function registerObjectStorageRoutes(app: Express): void {
  const storage = new ObjectStorageService();

  /**
   * Request a signed upload URL for direct client-side upload.
   *
   * POST /api/uploads/request-url
   * Body: { name: string, size?: number, contentType?: string }
   * Requires: authenticated user with tenantId in req.user
   */
  app.post('/api/uploads/request-url', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Authentication required' });

      const { name, size, contentType } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing required field: name' });

      const { uploadUrl, objectPath } = await storage.getUploadUrl(tenantId, name);

      res.json({
        uploadUrl,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  });

  /**
   * Get a signed download URL for a private object.
   *
   * GET /api/uploads/download-url?path=/objects/...
   * Requires: authenticated user with matching tenantId
   */
  app.get('/api/uploads/download-url', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Authentication required' });

      const objectPath = req.query.path as string;
      if (!objectPath) return res.status(400).json({ error: 'Missing path parameter' });

      // Enforce tenant isolation
      const canAccess = await storage.canAccessObject(objectPath, tenantId);
      if (!canAccess) return res.status(403).json({ error: 'Access denied' });

      const downloadUrl = await storage.getDownloadUrl(objectPath);
      res.json({ downloadUrl });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: 'Object not found' });
      }
      console.error('Error generating download URL:', error);
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  });

  /**
   * Serve an object directly (streaming download).
   *
   * GET /objects/*
   * For public objects: no auth needed.
   * For private objects: requires authenticated user with matching tenantId.
   */
  app.get('/objects/{*objectPath}', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const objectPath = req.path;

      // Check tenant access for private objects
      if (tenantId) {
        const canAccess = await storage.canAccessObject(objectPath, tenantId);
        if (!canAccess) return res.status(403).json({ error: 'Access denied' });
      }

      await storage.downloadObject(objectPath, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: 'Object not found' });
      }
      console.error('Error serving object:', error);
      res.status(500).json({ error: 'Failed to serve object' });
    }
  });

  /**
   * Delete an object.
   *
   * DELETE /api/uploads?path=/objects/...
   * Requires: authenticated user with matching tenantId
   */
  app.delete('/api/uploads', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Authentication required' });

      const objectPath = req.query.path as string;
      if (!objectPath) return res.status(400).json({ error: 'Missing path parameter' });

      const canAccess = await storage.canAccessObject(objectPath, tenantId);
      if (!canAccess) return res.status(403).json({ error: 'Access denied' });

      const deleted = await storage.deleteObject(objectPath);
      res.json({ deleted });
    } catch (error) {
      console.error('Error deleting object:', error);
      res.status(500).json({ error: 'Failed to delete object' });
    }
  });

  /**
   * List objects in tenant storage.
   *
   * GET /api/uploads/list?prefix=reports&limit=50
   * Requires: authenticated user with tenantId
   */
  app.get('/api/uploads/list', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Authentication required' });

      const prefix = (req.query.prefix as string) || '';
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const objects = await storage.listObjects(tenantId, prefix, limit, offset);
      res.json({ objects, total: objects.length });
    } catch (error) {
      console.error('Error listing objects:', error);
      res.status(500).json({ error: 'Failed to list objects' });
    }
  });
}

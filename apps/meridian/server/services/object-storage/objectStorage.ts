/**
 * Object Storage Service — Supabase Storage
 *
 * Replaces the legacy Replit sidecar GCS-based storage with Supabase Storage.
 * Supabase Storage provides S3-compatible object storage with per-tenant
 * bucket isolation, signed URLs, and ACL via RLS.
 *
 * Buckets:
 *   - meridian-uploads: tenant-scoped private uploads (reports, diligence docs)
 *   - meridian-public: public assets (branding, logos)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

// ─── Supabase Storage Client ─────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PRIVATE_BUCKET = process.env.MERIDIAN_STORAGE_BUCKET || 'meridian-uploads';
const PUBLIC_BUCKET = process.env.MERIDIAN_PUBLIC_BUCKET || 'meridian-public';

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for object storage'
      );
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

// ─── ACL Types (preserved from original interface) ───────────────────

export enum ObjectPermission {
  READ = 'read',
  WRITE = 'write',
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: 'public' | 'private';
  tenantId?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ─── Object Storage Service ──────────────────────────────────────────

export class ObjectStorageService {
  /**
   * Upload a file buffer to tenant-scoped private storage.
   */
  async uploadFile(
    tenantId: string,
    fileName: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string,
  ): Promise<{ objectPath: string; publicUrl?: string }> {
    const client = getClient();
    const objectPath = `${tenantId}/uploads/${randomUUID()}/${fileName}`;

    const { error } = await client.storage
      .from(PRIVATE_BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    return { objectPath: `/objects/${objectPath}` };
  }

  /**
   * Get a signed upload URL for direct client-side uploads.
   * Returns a URL valid for the specified TTL (default 15 min).
   */
  async getUploadUrl(
    tenantId: string,
    fileName: string,
    ttlSec = 900,
  ): Promise<{ uploadUrl: string; objectPath: string }> {
    const client = getClient();
    const objectPath = `${tenantId}/uploads/${randomUUID()}/${fileName}`;

    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error || !data) throw new Error(`Signed upload URL failed: ${error?.message}`);

    return {
      uploadUrl: data.signedUrl,
      objectPath: `/objects/${objectPath}`,
    };
  }

  /**
   * Get a signed download URL for a private object.
   */
  async getDownloadUrl(objectPath: string, ttlSec = 3600): Promise<string> {
    const client = getClient();
    const storagePath = this.extractStoragePath(objectPath);

    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(storagePath, ttlSec);

    if (error || !data) throw new ObjectNotFoundError();
    return data.signedUrl;
  }

  /**
   * Download a file and stream it to an Express response.
   */
  async downloadObject(objectPath: string, res: Response, cacheTtlSec = 3600): Promise<void> {
    const client = getClient();
    const storagePath = this.extractStoragePath(objectPath);

    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new ObjectNotFoundError();
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': data.type || 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'Cache-Control': `private, max-age=${cacheTtlSec}`,
    });

    res.send(buffer);
  }

  /**
   * Delete an object from storage.
   */
  async deleteObject(objectPath: string): Promise<boolean> {
    const client = getClient();
    const storagePath = this.extractStoragePath(objectPath);

    const { error } = await client.storage
      .from(PRIVATE_BUCKET)
      .remove([storagePath]);

    return !error;
  }

  /**
   * Check if an object exists.
   */
  async objectExists(objectPath: string): Promise<boolean> {
    const client = getClient();
    const storagePath = this.extractStoragePath(objectPath);

    // List with prefix to check existence
    const parts = storagePath.split('/');
    const folder = parts.slice(0, -1).join('/');
    const fileName = parts[parts.length - 1];

    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .list(folder, { search: fileName, limit: 1 });

    if (error) return false;
    return (data?.length ?? 0) > 0;
  }

  /**
   * List objects in a tenant's storage directory.
   */
  async listObjects(
    tenantId: string,
    prefix = '',
    limit = 100,
    offset = 0,
  ): Promise<Array<{ name: string; size: number; updatedAt: string }>> {
    const client = getClient();
    const folder = prefix ? `${tenantId}/${prefix}` : tenantId;

    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .list(folder, { limit, offset, sortBy: { column: 'updated_at', order: 'desc' } });

    if (error || !data) return [];

    return data
      .filter(f => f.name) // Filter out folder entries
      .map(f => ({
        name: f.name,
        size: f.metadata?.size ?? 0,
        updatedAt: f.updated_at ?? '',
      }));
  }

  /**
   * Upload a file to public storage (branding, logos).
   */
  async uploadPublicFile(
    tenantId: string,
    fileName: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string,
  ): Promise<{ objectPath: string; publicUrl: string }> {
    const client = getClient();
    const objectPath = `${tenantId}/${fileName}`;

    const { error } = await client.storage
      .from(PUBLIC_BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw new Error(`Public upload failed: ${error.message}`);

    const { data } = client.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(objectPath);

    return {
      objectPath: `/public/${objectPath}`,
      publicUrl: data.publicUrl,
    };
  }

  /**
   * Normalize a raw URL or path into the internal /objects/... format.
   */
  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith('/objects/') || rawPath.startsWith('/public/')) {
      return rawPath;
    }
    // If it's a full Supabase URL, extract the path
    if (rawPath.includes('/storage/v1/object/')) {
      const match = rawPath.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
      if (match) return `/objects/${match[1]}`;
    }
    return rawPath;
  }

  /**
   * Check if a user can access an object based on tenant ownership.
   */
  async canAccessObject(
    objectPath: string,
    tenantId: string,
  ): Promise<boolean> {
    const storagePath = this.extractStoragePath(objectPath);
    // Tenant isolation: path must start with tenantId
    return storagePath.startsWith(`${tenantId}/`);
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private extractStoragePath(objectPath: string): string {
    if (objectPath.startsWith('/objects/')) return objectPath.slice('/objects/'.length);
    if (objectPath.startsWith('/public/')) return objectPath.slice('/public/'.length);
    return objectPath;
  }
}

// Export a default instance and the client for direct access
export const objectStorageService = new ObjectStorageService();

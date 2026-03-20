#!/usr/bin/env tsx
// seed-platform-admin.ts — One-time CLI script to bootstrap the Platform Admin
//
// Creates:
//   1. Root "Cavaridge, LLC" tenant (type: platform, parent_id: null)
//   2. Platform Admin user profile linked to PLATFORM_ADMIN_EMAIL env var
//
// Idempotent — safe to run multiple times. Never logs credentials.
//
// Usage:
//   PLATFORM_ADMIN_EMAIL=ben@cavaridge.com pnpm run seed:platform-admin
//   (or set PLATFORM_ADMIN_EMAIL in Doppler)

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { tenants, profiles } from "@cavaridge/auth/schema";

const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!PLATFORM_ADMIN_EMAIL) {
  console.error("ERROR: PLATFORM_ADMIN_EMAIL env var is required");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL env var is required");
  process.exit(1);
}

async function seed() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  try {
    // 1. Check if platform tenant already exists
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.type, "platform"));

    let platformTenant;

    if (existingTenant) {
      console.log(`Platform tenant already exists: "${existingTenant.name}" (${existingTenant.id})`);
      platformTenant = existingTenant;
    } else {
      // Create root platform tenant
      [platformTenant] = await db
        .insert(tenants)
        .values({
          name: "Cavaridge, LLC",
          slug: "cavaridge",
          type: "platform",
          parentId: null,
          planTier: "enterprise",
          maxUsers: 999,
          isActive: true,
          config: {},
        })
        .returning();

      console.log(`Created platform tenant: "${platformTenant.name}" (${platformTenant.id})`);
    }

    // 2. Check if platform admin profile exists (by email)
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, PLATFORM_ADMIN_EMAIL!));

    if (existingProfile) {
      // Ensure they have the correct role and tenant
      if (existingProfile.role !== "platform_owner" || existingProfile.organizationId !== platformTenant.id) {
        await db
          .update(profiles)
          .set({
            role: "platform_owner",
            organizationId: platformTenant.id,
            isPlatformUser: true,
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, existingProfile.id));

        console.log(`Updated existing user to platform_owner: ${PLATFORM_ADMIN_EMAIL}`);
      } else {
        console.log(`Platform admin already configured: ${PLATFORM_ADMIN_EMAIL}`);
      }
    } else {
      console.log(`NOTE: No profile found for ${PLATFORM_ADMIN_EMAIL}`);
      console.log("The platform admin profile will be created automatically when they first sign in.");
      console.log("After sign-in, run this script again to assign the platform_owner role.");
    }

    // Set tenant owner
    if (platformTenant) {
      const ownerId = existingProfile?.id;
      if (ownerId && platformTenant.ownerUserId !== ownerId) {
        await db
          .update(tenants)
          .set({ ownerUserId: ownerId })
          .where(eq(tenants.id, platformTenant.id));
        console.log(`Set platform tenant owner to ${PLATFORM_ADMIN_EMAIL}`);
      }
    }

    console.log("\nPlatform admin bootstrap complete.");
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

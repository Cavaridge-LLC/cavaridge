#!/usr/bin/env tsx
// seed-platform.ts — Bootstrap platform and MSP tenants with admin users
//
// Creates:
//   1. Root "Cavaridge, LLC" tenant (type: platform, parent_id: null)
//   2. "Dedicated IT" MSP tenant (type: msp, parent_id: platform tenant)
//   3. Platform Admin user (bposner@cavaridge.com)
//   4. MSP Admin user (admin@dedicatedit.com)
//
// Idempotent — safe to run multiple times. Never logs credentials.
//
// Required env vars:
//   SUPABASE_URL — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/seed-platform.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PLATFORM_ADMIN_EMAIL = "bposner@cavaridge.com";
const MSP_ADMIN_EMAIL = "admin@dedicatedit.com";

async function seed() {
  console.log("=== Cavaridge Platform Seed ===\n");

  // 1. Create/find Platform tenant
  let platformTenantId: string;
  const { data: existingPlatform } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("type", "platform")
    .single();

  if (existingPlatform) {
    platformTenantId = existingPlatform.id;
    console.log(`[skip] Platform tenant exists: "${existingPlatform.name}" (${platformTenantId})`);
  } else {
    const { data: newPlatform, error } = await supabase
      .from("tenants")
      .insert({
        name: "Cavaridge, LLC",
        slug: "cavaridge",
        type: "platform",
        parent_id: null,
        plan_tier: "enterprise",
        max_users: 999,
        is_active: true,
        config: {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create platform tenant:", error.message);
      process.exit(1);
    }
    platformTenantId = newPlatform!.id;
    console.log(`[created] Platform tenant: "Cavaridge, LLC" (${platformTenantId})`);
  }

  // 2. Create/find MSP tenant (Dedicated IT)
  let mspTenantId: string;
  const { data: existingMsp } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", "dedicated-it")
    .single();

  if (existingMsp) {
    mspTenantId = existingMsp.id;
    console.log(`[skip] MSP tenant exists: "${existingMsp.name}" (${mspTenantId})`);
  } else {
    const { data: newMsp, error } = await supabase
      .from("tenants")
      .insert({
        name: "Dedicated IT",
        slug: "dedicated-it",
        type: "msp",
        parent_id: platformTenantId,
        plan_tier: "professional",
        max_users: 100,
        is_active: true,
        config: {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create MSP tenant:", error.message);
      process.exit(1);
    }
    mspTenantId = newMsp!.id;
    console.log(`[created] MSP tenant: "Dedicated IT" (${mspTenantId})`);
  }

  // 3. Create Platform Admin user via Supabase Auth
  const { data: existingPlatformAdmin } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", PLATFORM_ADMIN_EMAIL)
    .single();

  if (existingPlatformAdmin) {
    console.log(`[skip] Platform Admin profile exists: ${PLATFORM_ADMIN_EMAIL}`);

    // Ensure correct role and tenant assignment
    await supabase
      .from("profiles")
      .update({
        role: "platform_admin",
        tenant_id: platformTenantId,
        organization_id: platformTenantId,
      })
      .eq("id", existingPlatformAdmin.id);

    // Ensure tenant membership exists
    await supabase
      .from("tenant_memberships")
      .upsert(
        {
          user_id: existingPlatformAdmin.id,
          tenant_id: platformTenantId,
          role: "platform_admin",
          is_active: true,
        },
        { onConflict: "user_id,tenant_id" }
      );

    console.log(`[updated] Platform Admin role confirmed for ${PLATFORM_ADMIN_EMAIL}`);
  } else {
    // Create auth user — profile will be created by trigger or manually
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: PLATFORM_ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: "Benjamin Posner", role: "platform_admin" },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        console.log(`[skip] Auth user already exists: ${PLATFORM_ADMIN_EMAIL}`);
        console.log("  Profile will be linked on first sign-in.");
      } else {
        console.error("Failed to create platform admin auth user:", authError.message);
      }
    } else {
      console.log(`[created] Platform Admin auth user: ${PLATFORM_ADMIN_EMAIL} (${authUser.user.id})`);

      // Create profile
      await supabase.from("profiles").upsert({
        id: authUser.user.id,
        email: PLATFORM_ADMIN_EMAIL,
        full_name: "Benjamin Posner",
        role: "platform_admin",
        tenant_id: platformTenantId,
        organization_id: platformTenantId,
        is_platform_user: true,
      });

      // Create tenant membership
      await supabase.from("tenant_memberships").upsert(
        {
          user_id: authUser.user.id,
          tenant_id: platformTenantId,
          role: "platform_admin",
          is_active: true,
        },
        { onConflict: "user_id,tenant_id" }
      );

      console.log(`[created] Platform Admin profile + membership`);
    }
  }

  // 4. Create MSP Admin user
  const { data: existingMspAdmin } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", MSP_ADMIN_EMAIL)
    .single();

  if (existingMspAdmin) {
    console.log(`[skip] MSP Admin profile exists: ${MSP_ADMIN_EMAIL}`);

    await supabase
      .from("profiles")
      .update({
        role: "msp_admin",
        tenant_id: mspTenantId,
        organization_id: mspTenantId,
      })
      .eq("id", existingMspAdmin.id);

    await supabase
      .from("tenant_memberships")
      .upsert(
        {
          user_id: existingMspAdmin.id,
          tenant_id: mspTenantId,
          role: "msp_admin",
          is_active: true,
        },
        { onConflict: "user_id,tenant_id" }
      );

    console.log(`[updated] MSP Admin role confirmed for ${MSP_ADMIN_EMAIL}`);
  } else {
    const { data: mspAuthUser, error: mspAuthError } = await supabase.auth.admin.createUser({
      email: MSP_ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: "DIT Admin", role: "msp_admin" },
    });

    if (mspAuthError) {
      if (mspAuthError.message.includes("already been registered")) {
        console.log(`[skip] Auth user already exists: ${MSP_ADMIN_EMAIL}`);
      } else {
        console.error("Failed to create MSP admin auth user:", mspAuthError.message);
      }
    } else {
      console.log(`[created] MSP Admin auth user: ${MSP_ADMIN_EMAIL} (${mspAuthUser.user.id})`);

      await supabase.from("profiles").upsert({
        id: mspAuthUser.user.id,
        email: MSP_ADMIN_EMAIL,
        full_name: "DIT Admin",
        role: "msp_admin",
        tenant_id: mspTenantId,
        organization_id: mspTenantId,
        is_platform_user: false,
      });

      await supabase.from("tenant_memberships").upsert(
        {
          user_id: mspAuthUser.user.id,
          tenant_id: mspTenantId,
          role: "msp_admin",
          is_active: true,
        },
        { onConflict: "user_id,tenant_id" }
      );

      console.log(`[created] MSP Admin profile + membership`);
    }
  }

  // Summary
  console.log("\n=== Seed Complete ===");
  console.log(`Platform tenant: ${platformTenantId}`);
  console.log(`MSP tenant:      ${mspTenantId}`);
  console.log(`Platform Admin:  ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`MSP Admin:       ${MSP_ADMIN_EMAIL}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

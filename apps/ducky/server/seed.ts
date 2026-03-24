import { db } from "./db";
import { tenants, profiles as users } from "@cavaridge/auth/schema";
import { sql } from "drizzle-orm";
import { createSupabaseAdminClient } from "@cavaridge/auth/server";

export async function seedDatabase() {
  const existingTenants = await db.select().from(tenants).limit(1);
  if (existingTenants.length > 0) {
    return;
  }

  console.log("[seed] Seeding initial data...");

  const [tenant] = await db.insert(tenants).values({
    name: "Cavaridge Demo",
    slug: "cavaridge-demo",
    type: "platform",
    planTier: "enterprise",
    maxUsers: 50,
    isActive: true,
  }).returning();

  // Create admin user in Supabase auth
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: "admin@cavaridge.com",
    password: "admin123",
    email_confirm: true,
    user_metadata: { display_name: "Platform Admin" },
  });

  if (authError || !authData.user) {
    console.error("[seed] Failed to create auth user:", authError?.message);
    return;
  }

  const [admin] = await db.insert(users).values({
    id: authData.user.id,
    email: "admin@cavaridge.com",
    displayName: "Platform Admin",
    role: "platform_admin",
    tenantId: tenant.id,
    status: "active",
    isPlatformUser: true,
  }).returning();

  await db.execute(sql`UPDATE tenants SET owner_user_id = ${admin.id} WHERE id = ${tenant.id}`);

  console.log("[seed] Demo tenant and admin user created");
}

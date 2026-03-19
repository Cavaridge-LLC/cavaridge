import { db } from "./db";
import { organizations, profiles as users } from "@cavaridge/auth/schema";
import { sql } from "drizzle-orm";
import { createSupabaseAdminClient } from "@cavaridge/auth/server";

export async function seedDatabase() {
  const existingOrgs = await db.select().from(organizations).limit(1);
  if (existingOrgs.length > 0) {
    return;
  }

  console.log("[seed] Seeding initial data...");

  const [org] = await db.insert(organizations).values({
    name: "Cavaridge Demo",
    slug: "cavaridge-demo",
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
    role: "platform_owner",
    organizationId: org.id,
    status: "active",
    isPlatformUser: true,
  }).returning();

  await db.execute(sql`UPDATE organizations SET owner_user_id = ${admin.id} WHERE id = ${org.id}`);

  console.log("[seed] Demo org and admin user created");
}

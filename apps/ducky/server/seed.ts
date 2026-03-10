import { db } from "./db";
import { organizations, users } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  const existingOrgs = await db.select().from(organizations).limit(1);
  if (existingOrgs.length > 0) {
    return;
  }

  console.log("[seed] Seeding initial data...");

  const passwordHash = await bcrypt.hash("admin123", 10);

  const [org] = await db.insert(organizations).values({
    name: "Cavaridge Demo",
    slug: "cavaridge-demo",
    planTier: "enterprise",
    maxUsers: 50,
    isActive: true,
  }).returning();

  const [admin] = await db.insert(users).values({
    email: "admin@cavaridge.com",
    name: "Platform Admin",
    role: "platform_owner",
    organizationId: org.id,
    passwordHash,
    status: "active",
    isPlatformUser: true,
  }).returning();

  await db.execute(sql`UPDATE organizations SET owner_user_id = ${admin.id} WHERE id = ${org.id}`);

  console.log("[seed] Demo org and admin user created");
}

import { db } from "./db";
import { tenants, conversations, messages, sowVersions, roles, userRoles, userTenants, users } from "@shared/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { tenantConfig } from "./tenantConfig";

const ROLE_PERMISSIONS = {
  "Platform Owner": { read: true, create: true, edit: true, delete: true, admin: true, crossTenant: true },
  "Platform Admin": { read: true, create: true, edit: true, delete: true, admin: true, crossTenant: true },
  "Tenant Admin": { read: true, create: true, edit: true, delete: true, admin: true, crossTenant: false },
  "User": { read: true, create: true, edit: true, delete: false, admin: false, crossTenant: false },
  "Viewer": { read: true, create: false, edit: false, delete: false, admin: false, crossTenant: false },
};

async function seed() {
  console.log("Starting seed...");

  const existingTenants = await db.select().from(tenants);
  if (existingTenants.length === 0) {
    await db.insert(tenants).values({
      name: "Default",
      slug: "default",
      configJson: {},
    });
    console.log("Created 'Default' tenant.");

    await db.insert(tenants).values({
      name: "Dedicated IT",
      slug: "dedicated-it",
      configJson: {
        vendorName: tenantConfig.vendorName,
        vendorAbbreviation: tenantConfig.vendorAbbreviation,
        parentCompany: tenantConfig.parentCompany,
        appName: tenantConfig.appName,
        confidentialFooter: tenantConfig.confidentialFooter,
        vendorSignatureLabel: tenantConfig.vendorSignatureLabel,
        rateCard: tenantConfig.rateCard,
        mandatoryPmTasks: tenantConfig.mandatoryPmTasks,
        scopeTypeAddOns: tenantConfig.scopeTypeAddOns,
      },
    });
    console.log("Created 'Dedicated IT' tenant.");
  } else {
    console.log(`Found ${existingTenants.length} existing tenants, skipping tenant creation.`);
  }

  const ditTenant = await db.select().from(tenants).where(eq(tenants.slug, "dedicated-it"));
  if (!ditTenant.length) {
    throw new Error("Could not find 'dedicated-it' tenant after seeding.");
  }
  const ditId = ditTenant[0].id;
  console.log(`Dedicated IT tenant ID: ${ditId}`);

  await db.update(conversations)
    .set({ tenantId: ditId })
    .where(isNull(conversations.tenantId));
  console.log(`Backfilled conversations with tenantId.`);

  await db.update(messages)
    .set({ tenantId: ditId })
    .where(isNull(messages.tenantId));
  console.log(`Backfilled messages with tenantId.`);

  await db.update(sowVersions)
    .set({ tenantId: ditId })
    .where(isNull(sowVersions.tenantId));
  console.log(`Backfilled sow_versions with tenantId.`);

  const existingRoles = await db.select().from(roles);
  if (existingRoles.length === 0) {
    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      await db.insert(roles).values({ name, permissions });
    }
    console.log("Seeded 5 roles: Platform Owner, Platform Admin, Tenant Admin, User, Viewer.");
  } else {
    console.log(`Found ${existingRoles.length} existing roles, skipping role creation.`);
  }

  const allUsers = await db.select().from(users);
  const allRoles = await db.select().from(roles);
  const platformOwnerRole = allRoles.find(r => r.name === "Platform Owner");

  if (platformOwnerRole && allUsers.length > 0) {
    for (const user of allUsers) {
      await db.insert(userTenants).values({ userId: user.id, tenantId: ditId }).onConflictDoNothing();

      await db.insert(userRoles).values({
        userId: user.id,
        roleId: platformOwnerRole.id,
        tenantId: ditId,
      }).onConflictDoNothing();
    }
    console.log(`Mapped ${allUsers.length} existing user(s) to 'Dedicated IT' tenant as Platform Owner.`);
  }

  const nullConvs = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(isNull(conversations.tenantId));
  const nullMsgs = await db.select({ count: sql<number>`count(*)` }).from(messages).where(isNull(messages.tenantId));
  const nullSows = await db.select({ count: sql<number>`count(*)` }).from(sowVersions).where(isNull(sowVersions.tenantId));

  console.log(`Verification - NULL tenantId counts: conversations=${nullConvs[0].count}, messages=${nullMsgs[0].count}, sow_versions=${nullSows[0].count}`);

  if (Number(nullConvs[0].count) > 0 || Number(nullMsgs[0].count) > 0 || Number(nullSows[0].count) > 0) {
    throw new Error("Backfill failed — some rows still have NULL tenantId!");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});

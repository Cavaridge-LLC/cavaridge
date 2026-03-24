import { db } from "./db";
import { tenants, profiles, tenantMemberships } from "@cavaridge/auth/schema";
import { conversations, messages, sowVersions } from "@shared/models/chat";
import { eq, isNull, sql } from "drizzle-orm";
import { tenantConfig } from "./tenantConfig";

async function seed() {
  console.log("Starting seed...");

  const existingTenants = await db.select().from(tenants);
  if (existingTenants.length === 0) {
    // Create a platform tenant first
    await db.insert(tenants).values({
      name: "Cavaridge",
      slug: "cavaridge",
      type: "platform",
      config: {},
    });
    console.log("Created 'Cavaridge' platform tenant.");

    // Create an MSP tenant with config
    await db.insert(tenants).values({
      name: "Demo MSP",
      slug: "demo-msp",
      type: "msp",
      config: {
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
    console.log("Created 'Demo MSP' tenant.");
  } else {
    console.log(`Found ${existingTenants.length} existing tenants, skipping tenant creation.`);
  }

  // Find the first MSP tenant for backfill
  const mspTenants = await db.select().from(tenants).where(eq(tenants.type, "msp"));
  if (!mspTenants.length) {
    console.log("No MSP tenant found, skipping backfill.");
    process.exit(0);
  }
  const mspId = mspTenants[0].id;
  console.log(`MSP tenant ID for backfill: ${mspId}`);

  // Backfill any rows missing tenantId
  await db.update(conversations)
    .set({ tenantId: mspId })
    .where(isNull(conversations.tenantId));
  console.log(`Backfilled conversations with tenantId.`);

  await db.update(messages)
    .set({ tenantId: mspId })
    .where(isNull(messages.tenantId));
  console.log(`Backfilled messages with tenantId.`);

  await db.update(sowVersions)
    .set({ tenantId: mspId })
    .where(isNull(sowVersions.tenantId));
  console.log(`Backfilled sow_versions with tenantId.`);

  // Map existing users to the MSP tenant via tenantMemberships
  const allUsers = await db.select().from(profiles);
  if (allUsers.length > 0) {
    for (const user of allUsers) {
      await db.insert(tenantMemberships).values({
        userId: user.id,
        tenantId: mspId,
        role: "msp_admin",
      }).onConflictDoNothing();
    }
    console.log(`Mapped ${allUsers.length} existing user(s) to MSP tenant as MSP Admin.`);
  }

  // Verification
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

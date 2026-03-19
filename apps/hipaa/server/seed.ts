import { db } from "./db";
import { complianceFrameworks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { HIPAA_SECURITY_CONTROLS } from "./data/hipaa-security-controls";

export async function seedDatabase() {
  try {
    // Check if HIPAA Security Rule framework already exists
    const [existing] = await db
      .select()
      .from(complianceFrameworks)
      .where(eq(complianceFrameworks.frameworkId, "hipaa_security_rule"));

    if (existing) {
      console.log("[seed] HIPAA Security Rule framework already seeded, skipping.");
      return;
    }

    await db.insert(complianceFrameworks).values({
      frameworkId: "hipaa_security_rule",
      name: "HIPAA Security Rule",
      version: "45 CFR 164.302-318",
      description:
        "Health Insurance Portability and Accountability Act — Security Standards for the Protection of Electronic Protected Health Information",
      controls: HIPAA_SECURITY_CONTROLS as any,
    });

    console.log("[seed] HIPAA Security Rule framework seeded successfully.");
  } catch (err) {
    console.error("[seed] Error seeding database:", err);
  }
}

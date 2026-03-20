/**
 * Microsoft Graph — License Assignment Connector
 *
 * Fetches SKU subscriptions, assigned counts, and per-service utilization.
 */

import type { GraphClient } from "./graph-client.js";
import type { LicenseSummary, ServiceUtilization } from "../../shared/types.js";

interface GraphSubscribedSku {
  id: string;
  skuId: string;
  skuPartNumber: string;
  prepaidUnits: {
    enabled: number;
    suspended: number;
    warning: number;
  };
  consumedUnits: number;
  servicePlans: Array<{
    servicePlanId: string;
    servicePlanName: string;
    provisioningStatus: string;
    appliesTo: string;
  }>;
}

// Well-known M365 SKU display names
const SKU_DISPLAY_NAMES: Record<string, string> = {
  O365_BUSINESS_ESSENTIALS: "Microsoft 365 Business Basic",
  O365_BUSINESS_PREMIUM: "Microsoft 365 Business Standard",
  SPB: "Microsoft 365 Business Premium",
  SPE_E3: "Microsoft 365 E3",
  SPE_E5: "Microsoft 365 E5",
  EXCHANGESTANDARD: "Exchange Online (Plan 1)",
  EXCHANGEENTERPRISE: "Exchange Online (Plan 2)",
  EMS: "Enterprise Mobility + Security E3",
  EMSPREMIUM: "Enterprise Mobility + Security E5",
  POWER_BI_STANDARD: "Power BI (free)",
  POWER_BI_PRO: "Power BI Pro",
  PROJECTPREMIUM: "Project Plan 5",
  VISIOCLIENT: "Visio Plan 2",
  ATP_ENTERPRISE: "Microsoft Defender for Office 365 (Plan 1)",
  THREAT_INTELLIGENCE: "Microsoft Defender for Office 365 (Plan 2)",
  WIN_DEF_ATP: "Microsoft Defender for Endpoint",
  AAD_PREMIUM: "Microsoft Entra ID P1",
  AAD_PREMIUM_P2: "Microsoft Entra ID P2",
  INTUNE_A: "Microsoft Intune Plan 1",
};

export async function fetchLicenses(
  client: GraphClient,
  tenantId: string,
): Promise<LicenseSummary[]> {
  const skus = await client.getAll<GraphSubscribedSku>("/subscribedSkus");

  return skus
    .filter((sku) => sku.prepaidUnits.enabled > 0 || sku.consumedUnits > 0)
    .map((sku): LicenseSummary => {
      const total = sku.prepaidUnits.enabled;
      const assigned = sku.consumedUnits;
      const available = Math.max(0, total - assigned);
      const utilizationPct = total > 0 ? Math.round((assigned / total) * 100) : 0;

      return {
        skuName: SKU_DISPLAY_NAMES[sku.skuPartNumber] || sku.skuPartNumber,
        skuId: sku.skuId,
        totalQuantity: total,
        assignedCount: assigned,
        availableCount: available,
        utilizationPct,
      };
    });
}

export async function fetchServiceUtilization(
  client: GraphClient,
  period: "D7" | "D30" | "D90" | "D180" = "D30",
): Promise<Record<string, ServiceUtilization[]>> {
  const services: Record<string, ServiceUtilization[]> = {};

  const reportEndpoints: Array<{ service: string; path: string }> = [
    { service: "Exchange", path: `/reports/getEmailActivityUserDetail(period='${period}')` },
    { service: "SharePoint", path: `/reports/getSharePointActivityUserDetail(period='${period}')` },
    { service: "OneDrive", path: `/reports/getOneDriveActivityUserDetail(period='${period}')` },
    { service: "Teams", path: `/reports/getTeamsUserActivityUserDetail(period='${period}')` },
  ];

  for (const endpoint of reportEndpoints) {
    try {
      const data = await client.get<string>(endpoint.path, {
        $format: "application/json",
      });
      // Usage reports return CSV by default; we request JSON
      // Parse into ServiceUtilization entries grouped by user
      if (typeof data === "object" && data !== null) {
        const records = (data as { value?: Array<Record<string, unknown>> }).value || [];
        services[endpoint.service] = records.map((record): ServiceUtilization => ({
          serviceName: endpoint.service,
          isProvisioned: true,
          lastActivityDate: record["lastActivityDate"]
            ? new Date(record["lastActivityDate"] as string)
            : undefined,
          activityMetrics: extractActivityMetrics(record, endpoint.service),
        }));
      }
    } catch {
      // Usage reports may not be accessible — degrade gracefully
    }
  }

  return services;
}

function extractActivityMetrics(
  record: Record<string, unknown>,
  service: string,
): Record<string, number> {
  const metrics: Record<string, number> = {};
  const numericFields = Object.entries(record).filter(
    ([key, value]) => typeof value === "number" && !key.startsWith("@"),
  );
  for (const [key, value] of numericFields) {
    metrics[`${service}_${key}`] = value as number;
  }
  return metrics;
}

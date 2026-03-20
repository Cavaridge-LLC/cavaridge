/**
 * @cavaridge/agent-test — PersonaGenerator
 *
 * Auto-creates test profiles mapped to UTM tenant tiers and RBAC roles.
 * Generates a full suite of personas covering every role × tenant-type
 * combination needed for thorough agent simulation testing.
 */

import type {
  TestPersona,
  RbacRole,
  TenantType,
  PersonaGeneratorConfig,
} from "./types.js";

const DEFAULT_PLATFORM_TENANT = "tenant_cavaridge_platform";
const DEFAULT_MSP_TENANT = "tenant_dit_msp";
const DEFAULT_CLIENT_TENANT = "tenant_compass_client";
const DEFAULT_SITE_TENANT = "tenant_tampa_asc_site";
const DEFAULT_USER_PREFIX = "test_user";

/**
 * Mapping of RBAC roles to their valid UTM tenant types and hierarchy position.
 * Platform Admin → platform. MSP Admin/Tech → msp.
 * Client Admin/Viewer → client. Prospect → prospect.
 */
const ROLE_TENANT_MAP: Record<RbacRole, { tenantType: TenantType; needsParent: boolean }> = {
  platform_admin: { tenantType: "platform", needsParent: false },
  msp_admin: { tenantType: "msp", needsParent: false },
  msp_tech: { tenantType: "msp", needsParent: false },
  client_admin: { tenantType: "client", needsParent: true },
  client_viewer: { tenantType: "client", needsParent: true },
  prospect: { tenantType: "prospect", needsParent: true },
};

const ALL_ROLES: RbacRole[] = [
  "platform_admin",
  "msp_admin",
  "msp_tech",
  "client_admin",
  "client_viewer",
  "prospect",
];

const ROLE_DISPLAY_NAMES: Record<RbacRole, string> = {
  platform_admin: "Platform Admin (Cavaridge)",
  msp_admin: "MSP Admin (Dedicated IT)",
  msp_tech: "MSP Technician",
  client_admin: "Client Admin (Compass SP)",
  client_viewer: "Client Viewer (Compass SP)",
  prospect: "Prospect (Freemium)",
};

export class PersonaGenerator {
  private readonly config: Required<PersonaGeneratorConfig>;

  constructor(config: PersonaGeneratorConfig = {}) {
    this.config = {
      platformTenantId: config.platformTenantId ?? DEFAULT_PLATFORM_TENANT,
      mspTenantId: config.mspTenantId ?? DEFAULT_MSP_TENANT,
      clientTenantId: config.clientTenantId ?? DEFAULT_CLIENT_TENANT,
      siteTenantId: config.siteTenantId ?? DEFAULT_SITE_TENANT,
      userIdPrefix: config.userIdPrefix ?? DEFAULT_USER_PREFIX,
    };
  }

  /** Generate a single persona for the given RBAC role. */
  forRole(role: RbacRole): TestPersona {
    const mapping = ROLE_TENANT_MAP[role];
    const tenantId = this.tenantIdForType(mapping.tenantType);
    return {
      role,
      tenantId,
      tenantType: mapping.tenantType,
      userId: `${this.config.userIdPrefix}_${role}`,
      displayName: ROLE_DISPLAY_NAMES[role],
      parentTenantId: mapping.needsParent ? this.config.mspTenantId : undefined,
    };
  }

  /** Generate personas for all 6 standard RBAC roles. */
  allRoles(): TestPersona[] {
    return ALL_ROLES.map(role => this.forRole(role));
  }

  /**
   * Generate a cross-tenant attacker persona — an MSP Tech from a *different*
   * MSP attempting to access resources of the target tenant. Used for
   * tenant isolation tests.
   */
  crossTenantAttacker(targetTenantId: string): TestPersona {
    return {
      role: "msp_tech",
      tenantId: "tenant_evil_msp",
      tenantType: "msp",
      userId: `${this.config.userIdPrefix}_cross_tenant_attacker`,
      displayName: "Cross-Tenant Attacker (Evil MSP Tech)",
      parentTenantId: undefined,
    };
  }

  /**
   * Generate an escalation persona — a Client Viewer attempting an action
   * that requires Client Admin or higher. Used for RBAC bypass tests.
   */
  escalationAttempt(): TestPersona {
    return {
      role: "client_viewer",
      tenantId: this.config.clientTenantId,
      tenantType: "client",
      userId: `${this.config.userIdPrefix}_escalation_attempt`,
      displayName: "Privilege Escalation Attempt (Client Viewer → Admin)",
      parentTenantId: this.config.mspTenantId,
    };
  }

  /**
   * Generate a site-level persona beneath a client tenant.
   * Useful for testing downward-only role inheritance.
   */
  siteUser(): TestPersona {
    return {
      role: "client_viewer",
      tenantId: this.config.siteTenantId,
      tenantType: "site",
      userId: `${this.config.userIdPrefix}_site_viewer`,
      displayName: "Site Viewer (Tampa ASC)",
      parentTenantId: this.config.clientTenantId,
    };
  }

  private tenantIdForType(type: TenantType): string {
    switch (type) {
      case "platform":
        return this.config.platformTenantId;
      case "msp":
        return this.config.mspTenantId;
      case "client":
        return this.config.clientTenantId;
      case "site":
        return this.config.siteTenantId;
      case "prospect":
        return `${this.config.clientTenantId}_prospect`;
    }
  }
}

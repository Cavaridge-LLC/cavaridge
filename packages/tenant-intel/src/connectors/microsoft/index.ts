/**
 * Microsoft Graph Connector — Phase 1
 *
 * Aggregates all Microsoft Graph sub-connectors into a single
 * ingestion entry point for M365 tenant data.
 */

export { GraphClient } from "./graph-client.js";
export { fetchUsers } from "./users.js";
export { fetchLicenses, fetchServiceUtilization } from "./licensing.js";
export { fetchSecurityPosture, fetchConditionalAccessPolicies } from "./security.js";
export { fetchDevices } from "./devices.js";

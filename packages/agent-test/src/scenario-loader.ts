/**
 * @cavaridge/agent-test — ScenarioLoader
 *
 * Reads YAML scenario battery definitions from the filesystem and
 * converts them into typed TestScenario arrays for execution.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import yaml from "js-yaml";
import type { TestScenario, TestAssertion, TestPersona, ScenarioCategory } from "./types.js";

/** Raw YAML shape before validation. */
interface RawScenario {
  id?: string;
  name?: string;
  description?: string;
  agentId?: string;
  category?: string;
  persona?: Partial<TestPersona>;
  input?: Record<string, unknown>;
  assertions?: Array<Partial<TestAssertion>>;
  expectedOutcome?: string;
  tags?: string[];
  timeoutMs?: number;
}

interface RawBattery {
  battery?: string;
  agentId?: string;
  scenarios?: RawScenario[];
}

const VALID_CATEGORIES: Set<string> = new Set([
  "security",
  "functional",
  "rbac",
  "phi_boundary",
  "tenant_isolation",
]);

const VALID_OUTCOMES: Set<string> = new Set(["pass", "degrade", "fail"]);

export class ScenarioLoader {
  /**
   * Load scenarios from a single YAML file.
   * Supports both single-scenario files and battery files with a `scenarios` array.
   */
  loadFile(filePath: string): TestScenario[] {
    const content = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(content) as RawBattery | RawScenario;

    if (!parsed || typeof parsed !== "object") {
      throw new Error(`Invalid YAML in ${filePath}: expected an object`);
    }

    // Battery format: { battery: "name", agentId: "...", scenarios: [...] }
    if ("scenarios" in parsed && Array.isArray(parsed.scenarios)) {
      const batteryAgentId = (parsed as RawBattery).agentId;
      return parsed.scenarios.map((raw, idx) =>
        this.validateScenario({ ...raw, agentId: raw.agentId ?? batteryAgentId }, filePath, idx),
      );
    }

    // Single scenario format
    return [this.validateScenario(parsed as RawScenario, filePath, 0)];
  }

  /**
   * Recursively load all .yaml / .yml files from a directory.
   * Returns a flat array of all scenarios found.
   */
  loadDirectory(dirPath: string): TestScenario[] {
    const scenarios: TestScenario[] = [];
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scenarios.push(...this.loadDirectory(fullPath));
      } else {
        const ext = extname(entry).toLowerCase();
        if (ext === ".yaml" || ext === ".yml") {
          scenarios.push(...this.loadFile(fullPath));
        }
      }
    }

    return scenarios;
  }

  /**
   * Load scenarios filtered by category.
   */
  loadByCategory(dirPath: string, category: ScenarioCategory): TestScenario[] {
    return this.loadDirectory(dirPath).filter(s => s.category === category);
  }

  /**
   * Load scenarios filtered by agent ID.
   */
  loadByAgent(dirPath: string, agentId: string): TestScenario[] {
    return this.loadDirectory(dirPath).filter(s => s.agentId === agentId);
  }

  /**
   * Load scenarios filtered by tag.
   */
  loadByTag(dirPath: string, tag: string): TestScenario[] {
    return this.loadDirectory(dirPath).filter(s => s.tags?.includes(tag));
  }

  private validateScenario(raw: RawScenario, filePath: string, index: number): TestScenario {
    const ctx = `${filePath}[${index}]`;

    if (!raw.id) throw new Error(`${ctx}: missing required field "id"`);
    if (!raw.name) throw new Error(`${ctx}: missing required field "name"`);
    if (!raw.agentId) throw new Error(`${ctx}: missing required field "agentId"`);
    if (!raw.category || !VALID_CATEGORIES.has(raw.category)) {
      throw new Error(`${ctx}: invalid category "${raw.category}". Valid: ${[...VALID_CATEGORIES].join(", ")}`);
    }
    if (!raw.expectedOutcome || !VALID_OUTCOMES.has(raw.expectedOutcome)) {
      throw new Error(`${ctx}: invalid expectedOutcome "${raw.expectedOutcome}". Valid: pass, degrade, fail`);
    }
    if (!raw.persona?.role || !raw.persona?.tenantId || !raw.persona?.tenantType || !raw.persona?.userId) {
      throw new Error(`${ctx}: persona must include role, tenantId, tenantType, userId`);
    }
    if (!Array.isArray(raw.assertions) || raw.assertions.length === 0) {
      throw new Error(`${ctx}: at least one assertion is required`);
    }

    const assertions: TestAssertion[] = raw.assertions.map((a, aIdx) => {
      if (!a.type) throw new Error(`${ctx}.assertions[${aIdx}]: missing "type"`);
      if (!a.description) throw new Error(`${ctx}.assertions[${aIdx}]: missing "description"`);
      return {
        type: a.type,
        field: a.field,
        value: a.value ?? "",
        description: a.description,
      } as TestAssertion;
    });

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? raw.name,
      agentId: raw.agentId,
      category: raw.category as ScenarioCategory,
      persona: raw.persona as TestPersona,
      input: raw.input ?? {},
      assertions,
      expectedOutcome: raw.expectedOutcome as "pass" | "degrade" | "fail",
      tags: raw.tags,
      timeoutMs: raw.timeoutMs,
    };
  }
}

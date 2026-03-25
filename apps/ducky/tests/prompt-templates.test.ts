/**
 * Unit tests for prompt template interpolation and variable extraction.
 */

import { describe, it, expect } from "vitest";
import { interpolateTemplate, extractVariables } from "../server/prompt-templates";

describe("interpolateTemplate", () => {
  it("replaces single variable", () => {
    const result = interpolateTemplate("Hello {{name}}", { name: "Ducky" });
    expect(result).toBe("Hello Ducky");
  });

  it("replaces multiple variables", () => {
    const result = interpolateTemplate(
      "{{greeting}} {{name}}, welcome to {{app}}",
      { greeting: "Hi", name: "User", app: "Meridian" },
    );
    expect(result).toBe("Hi User, welcome to Meridian");
  });

  it("leaves unmatched variables as-is", () => {
    const result = interpolateTemplate("Hello {{name}}, your id is {{id}}", { name: "Ducky" });
    expect(result).toBe("Hello Ducky, your id is {{id}}");
  });

  it("handles empty variables object", () => {
    const result = interpolateTemplate("Hello {{name}}", {});
    expect(result).toBe("Hello {{name}}");
  });

  it("handles template with no variables", () => {
    const result = interpolateTemplate("No variables here", { name: "test" });
    expect(result).toBe("No variables here");
  });

  it("handles repeated variable usage", () => {
    const result = interpolateTemplate("{{name}} said hello. {{name}} waved.", { name: "Ducky" });
    expect(result).toBe("Ducky said hello. Ducky waved.");
  });

  it("handles multiline templates", () => {
    const template = `You are an AI assistant.
Tenant: {{tenant_id}}
App: {{app_code}}
Task: {{task_type}}`;
    const result = interpolateTemplate(template, {
      tenant_id: "t-123",
      app_code: "CVG-HIPAA",
      task_type: "compliance_check",
    });
    expect(result).toContain("Tenant: t-123");
    expect(result).toContain("App: CVG-HIPAA");
    expect(result).toContain("Task: compliance_check");
  });
});

describe("extractVariables", () => {
  it("extracts single variable", () => {
    const vars = extractVariables("Hello {{name}}");
    expect(vars).toEqual(["name"]);
  });

  it("extracts multiple unique variables", () => {
    const vars = extractVariables("{{greeting}} {{name}}, welcome to {{app}}");
    expect(vars).toContain("greeting");
    expect(vars).toContain("name");
    expect(vars).toContain("app");
    expect(vars).toHaveLength(3);
  });

  it("deduplicates repeated variables", () => {
    const vars = extractVariables("{{name}} said hello. {{name}} waved.");
    expect(vars).toEqual(["name"]);
  });

  it("returns empty array for no variables", () => {
    const vars = extractVariables("No variables here");
    expect(vars).toEqual([]);
  });

  it("handles complex template with nested braces", () => {
    const vars = extractVariables("Config: {setting: {{value}}}");
    expect(vars).toEqual(["value"]);
  });

  it("only matches word characters", () => {
    const vars = extractVariables("{{valid_name}} but not {{}} or {{ spaces }}");
    expect(vars).toEqual(["valid_name"]);
  });
});

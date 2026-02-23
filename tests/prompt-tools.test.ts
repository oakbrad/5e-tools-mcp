import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { registerPrompts } from "../src/tools/prompt-tools.js";

// ── Mock McpServer ──────────────────────────────────────────────────

interface RegisteredPrompt {
  name: string;
  config: { title?: string; description?: string; argsSchema?: any };
  handler: (args: any) => { messages: { role: string; content: { type: string; text: string } }[] };
}

function mockServer() {
  const prompts: RegisteredPrompt[] = [];
  return {
    prompts,
    registerPrompt(name: string, config: any, handler: any) {
      prompts.push({ name, config, handler });
    },
  };
}

// ── Test fixtures ───────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────

describe("registerPrompts", () => {
  it("registers prompts from markdown files", () => {
    fs.writeFileSync(path.join(tmpDir, "00-system.md"), "# System Prompt\n\nYou are helpful.");
    fs.writeFileSync(path.join(tmpDir, "10-search.md"), "# Search & Lookup\n\nSearch for things.");

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    expect(server.prompts).toHaveLength(2);
    expect(server.prompts[0].name).toBe("system");
    expect(server.prompts[1].name).toBe("search");
  });

  it("strips numeric prefix from filename for prompt name", () => {
    fs.writeFileSync(path.join(tmpDir, "50-resolve-tag.md"), "# Resolve Tag\n\nResolve it.");

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    expect(server.prompts[0].name).toBe("resolve-tag");
  });

  it("uses first heading as description", () => {
    fs.writeFileSync(path.join(tmpDir, "00-test.md"), "# My Prompt Title\n\nBody text.");

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    expect(server.prompts[0].config.description).toBe("My Prompt Title");
  });

  it("returns prompt content as user message", () => {
    const content = "# Test Prompt\n\nDo the thing.";
    fs.writeFileSync(path.join(tmpDir, "00-test.md"), content);

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    const result = server.prompts[0].handler({});
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.text).toBe(content);
  });

  it("detects template variables and creates argsSchema", () => {
    fs.writeFileSync(
      path.join(tmpDir, "10-search.md"),
      "# Search\n\nSearch for {{query}} in {{kinds_json}}.",
    );

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    expect(server.prompts[0].config.argsSchema).toBeDefined();
    // Schema should accept query and kinds_json
    const shape = server.prompts[0].config.argsSchema.shape;
    expect(shape.query).toBeDefined();
    expect(shape.kinds_json).toBeDefined();
  });

  it("substitutes template variables in prompt content", () => {
    fs.writeFileSync(
      path.join(tmpDir, "10-search.md"),
      "# Search\n\nSearch for {{query}} with limit {{limit}}.",
    );

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    const result = server.prompts[0].handler({ query: "fireball", limit: "5" });
    expect(result.messages[0].content.text).toContain("Search for fireball with limit 5.");
  });

  it("preserves unsubstituted variables when args not provided", () => {
    fs.writeFileSync(
      path.join(tmpDir, "10-search.md"),
      "# Search\n\nSearch for {{query}} with limit {{limit}}.",
    );

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    const result = server.prompts[0].handler({ query: "fireball" });
    expect(result.messages[0].content.text).toContain("Search for fireball");
    expect(result.messages[0].content.text).toContain("{{limit}}");
  });

  it("ignores non-markdown files", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "not a prompt");
    fs.writeFileSync(path.join(tmpDir, "00-test.md"), "# Test\n\nPrompt.");

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    expect(server.prompts).toHaveLength(1);
  });

  it("handles missing prompts directory gracefully", () => {
    const server = mockServer();
    registerPrompts(server as any, "/nonexistent/path");

    expect(server.prompts).toHaveLength(0);
  });

  it("deduplicates template variables", () => {
    fs.writeFileSync(
      path.join(tmpDir, "10-test.md"),
      "# Test\n\nUse {{query}} and then {{query}} again.",
    );

    const server = mockServer();
    registerPrompts(server as any, tmpDir);

    const shape = server.prompts[0].config.argsSchema.shape;
    expect(Object.keys(shape)).toHaveLength(1);
    expect(shape.query).toBeDefined();
  });
});

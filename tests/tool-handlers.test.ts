// tests/tool-handlers.test.ts
// End-to-end integration tests for registered MCP tool handlers.
// Uses a mock McpServer to capture handlers, then calls them with
// a real (small) in-memory index to verify full response shapes.

import { describe, it, expect, beforeAll } from "vitest";
import type { AppIndex, ToolContext, ToolResponse } from "../src/types.js";
import type { RollableTable } from "../src/tables.js";
import type { RecordLite, StoredEntity } from "../src/search.js";
import { toSlug } from "../src/utils.js";
import { entityUri, rulesetFromSource, addSourceMeta } from "../src/helpers.js";
import { registerSearchTools } from "../src/tools/search-tools.js";
import { registerEntityTools } from "../src/tools/entity-tools.js";
import { registerDmTools } from "../src/tools/dm-tools.js";

// ── Mock MCP Server ─────────────────────────────────────────────────

type ToolHandler = (args: any) => Promise<ToolResponse>;

/** Captures tool registrations so we can call handlers directly */
function createMockServer() {
  const handlers = new Map<string, ToolHandler>();
  return {
    server: {
      registerTool(name: string, _config: any, handler: ToolHandler) {
        handlers.set(name, handler);
      },
    } as any,
    handlers,
  };
}

// ── Test Fixtures ───────────────────────────────────────────────────

function buildTestIndex(): { idx: AppIndex; tableStore: Map<string, RollableTable> } {
  const idx: AppIndex = {
    byKind: new Map(),
    byUri: new Map(),
    sourcesMeta: new Map(),
    fluffByKey: new Map(),
  };
  const tableStore = new Map<string, RollableTable>();

  // Add some spells
  const spells: RecordLite[] = [];
  for (const [name, source, level, school] of [
    ["Fireball", "PHB", 3, "V"],
    ["Shield", "PHB", 1, "A"],
    ["Shield", "XPHB", 1, "A"],
    ["Magic Missile", "PHB", 1, "V"],
    ["Wish", "PHB", 9, "C"],
  ] as const) {
    const uri = entityUri("spell", source, name);
    const ruleset = rulesetFromSource(source);
    const rec: RecordLite = {
      uri,
      name,
      slug: toSlug(name),
      source,
      ruleset,
      facets: { level, school, classes: ["wizard"] },
      kind: "spell",
    };
    spells.push(rec);
    const entity: StoredEntity = {
      _uri: uri,
      _source: source,
      _ruleset: ruleset,
      _kind: "spell",
      name,
      source,
      level,
      school,
      entries: [`${name} is a level ${level} spell.`],
    };
    idx.byUri.set(uri, entity);
    addSourceMeta(idx, source, undefined, "spell");
  }
  idx.byKind.set("spell", spells);

  // Add some monsters
  const monsters: RecordLite[] = [];
  for (const [name, source, cr, type] of [
    ["Goblin", "MM", "1/4", "humanoid"],
    ["Dragon Turtle", "MM", "17", "dragon"],
    ["Zombie", "MM", "1/4", "undead"],
  ] as const) {
    const uri = entityUri("monster", source, name);
    const ruleset = rulesetFromSource(source);
    const rec: RecordLite = {
      uri,
      name,
      slug: toSlug(name),
      source,
      ruleset,
      facets: { cr, type },
      kind: "monster",
    };
    monsters.push(rec);
    const entity: StoredEntity = {
      _uri: uri,
      _source: source,
      _ruleset: ruleset,
      _kind: "monster",
      name,
      source,
      cr,
      type,
      entries: [`The ${name} is a ${type}.`],
    };
    idx.byUri.set(uri, entity);
    addSourceMeta(idx, source, undefined, "monster");
  }
  idx.byKind.set("monster", monsters);

  // Add a rule
  const ruleUri = entityUri("rule", "DMG", "Flanking");
  const ruleRec: RecordLite = {
    uri: ruleUri,
    name: "Flanking",
    slug: "flanking",
    source: "DMG",
    ruleset: "2014",
    facets: {},
    kind: "rule",
  };
  idx.byKind.set("rule", [ruleRec]);
  idx.byUri.set(ruleUri, {
    _uri: ruleUri,
    _source: "DMG",
    _ruleset: "2014",
    _kind: "rule",
    name: "Flanking",
    source: "DMG",
    entries: ["Optional rule for flanking."],
  } as StoredEntity);

  // Add fluff for Goblin
  idx.fluffByKey.set("monster/MM/goblin", {
    name: "Goblin",
    source: "MM",
    entries: ["Goblins are small, sneaky creatures."],
    images: [{ href: "goblin.png" }],
  });

  return { idx, tableStore };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("tool handler integration — search_entities", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerSearchTools(ctx);
    handlers = mock.handlers;
  });

  it("registers search_entities handler", () => {
    expect(handlers.has("search_entities")).toBe(true);
  });

  it("returns results for a valid query", async () => {
    const handler = handlers.get("search_entities")!;
    const result = await handler({ query: "Fireball", limit: 5 });
    expect(result.isError).toBeUndefined();
    expect(result.content.length).toBeGreaterThan(0);
    const textContent = result.content.find((c: any) => c.type === "text");
    expect(textContent?.text).toContain("Found");
  });

  it("filters by kind", async () => {
    const handler = handlers.get("search_entities")!;
    const result = await handler({ query: "Goblin", kinds: ["spell"], limit: 5 });
    // Goblin is a monster, not a spell — should return 0 or low results
    const resources = result.content.filter((c: any) => c.type === "resource");
    for (const r of resources) {
      expect(r.resource.text).not.toContain("monster");
    }
  });

  it("filters by source", async () => {
    const handler = handlers.get("search_entities")!;
    const result = await handler({ query: "Shield", sources: ["XPHB"], limit: 5 });
    const resources = result.content.filter((c: any) => c.type === "resource");
    for (const r of resources) {
      expect(r.resource.text).toContain("XPHB");
    }
  });

  it("returns empty results for nonsense query", async () => {
    const handler = handlers.get("search_entities")!;
    const result = await handler({ query: "xyzzyplugh99999", limit: 5 });
    expect(result.isError).toBeUndefined();
    const textContent = result.content.find((c: any) => c.type === "text");
    expect(textContent?.text).toContain("Found");
  });
});

describe("tool handler integration — get_entity", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerEntityTools(ctx);
    handlers = mock.handlers;
  });

  it("registers get_entity handler", () => {
    expect(handlers.has("get_entity")).toBe(true);
  });

  it("fetches entity by URI (json format)", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({
      uri: "fiveet://entity/spell/PHB/fireball",
      format: "json",
      includeFluff: false,
    });
    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text;
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe("Fireball");
    expect(parsed._kind).toBe("spell");
  });

  it("fetches entity by key (kind + name)", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({
      key: { kind: "monster", name: "Goblin" },
      format: "json",
      includeFluff: false,
    });
    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text;
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe("Goblin");
  });

  it("renders markdown format", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({
      key: { kind: "monster", name: "Goblin" },
      format: "markdown",
      includeFluff: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("# Goblin");
  });

  it("includes fluff when requested", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({
      key: { kind: "monster", name: "Goblin", source: "MM" },
      format: "markdown",
      includeFluff: true,
    });
    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text;
    expect(text).toContain("## Lore");
    expect(text).toContain("sneaky creatures");
    expect(text).toContain("image(s) available");
  });

  it("returns isError for unknown entity", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({
      key: { kind: "spell", name: "Nonexistent Spell" },
      format: "json",
      includeFluff: false,
    });
    expect(result.isError).toBe(true);
  });

  it("returns isError when neither uri nor key provided", async () => {
    const handler = handlers.get("get_entity")!;
    const result = await handler({ format: "json", includeFluff: false });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("No entity specified");
  });
});

describe("tool handler integration — get_rules_section", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerEntityTools(ctx);
    handlers = mock.handlers;
  });

  it("finds rule by slug", async () => {
    const handler = handlers.get("get_rules_section")!;
    const result = await handler({ slugOrTitle: "flanking" });
    expect(result.isError).toBeUndefined();
    const texts = result.content.filter((c: any) => c.type === "text");
    expect(texts.some((t: any) => t.text.includes("Flanking"))).toBe(true);
  });

  it("returns isError for garbage input", async () => {
    const handler = handlers.get("get_rules_section")!;
    const result = await handler({ slugOrTitle: "xyzzyplugh12345" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Rule not found");
  });
});

describe("tool handler integration — resolve_tag", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerEntityTools(ctx);
    handlers = mock.handlers;
  });

  it("resolves a valid spell tag", async () => {
    const handler = handlers.get("resolve_tag")!;
    const result = await handler({ tag: "{@spell Fireball|PHB}" });
    expect(result.isError).toBeUndefined();
    const resource = result.content.find((c: any) => c.type === "resource");
    expect(resource).toBeDefined();
    expect(resource.resource.text).toContain("Fireball");
  });

  it("returns isError for malformed tag", async () => {
    const handler = handlers.get("resolve_tag")!;
    const result = await handler({ tag: "not a tag" });
    expect(result.isError).toBe(true);
  });

  it("returns isError for unsupported tag kind", async () => {
    const handler = handlers.get("resolve_tag")!;
    const result = await handler({ tag: "{@unknownkind Foo}" });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Unsupported tag kind");
  });
});

describe("tool handler integration — generate_treasure", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerDmTools(ctx);
    handlers = mock.handlers;
  });

  it("registers generate_treasure handler", () => {
    expect(handlers.has("generate_treasure")).toBe(true);
  });

  it("generates individual treasure by CR", async () => {
    const handler = handlers.get("generate_treasure")!;
    const result = await handler({ challenge_rating: 5 });
    expect(result.isError).toBeUndefined();
    const text = result.content.map((c: any) => c.text).join("\n");
    expect(text).toContain("Treasure");
  });

  it("generates hoard treasure by tier", async () => {
    const handler = handlers.get("generate_treasure")!;
    const result = await handler({ hoard_tier: "tier1" });
    expect(result.isError).toBeUndefined();
    const text = result.content.map((c: any) => c.text).join("\n");
    expect(text).toContain("Hoard");
  });

  it("returns isError when neither CR nor tier provided", async () => {
    const handler = handlers.get("generate_treasure")!;
    const result = await handler({});
    expect(result.isError).toBe(true);
  });
});

describe("tool handler integration — list_sources", () => {
  let handlers: Map<string, ToolHandler>;

  beforeAll(() => {
    const { idx, tableStore } = buildTestIndex();
    const mock = createMockServer();
    const ctx: ToolContext = { server: mock.server, idx, tableStore };
    registerEntityTools(ctx);
    handlers = mock.handlers;
  });

  it("lists all sources", async () => {
    const handler = handlers.get("list_sources")!;
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]?.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    // PHB and MM should be in there
    const abbrs = parsed.map((s: any) => s.abbreviation);
    expect(abbrs).toContain("PHB");
    expect(abbrs).toContain("MM");
  });

  it("filters by ruleset", async () => {
    const handler = handlers.get("list_sources")!;
    const result = await handler({ ruleset: "2024" });
    const parsed = JSON.parse(result.content[0]?.text);
    for (const s of parsed) {
      expect(s.ruleset).toBe("2024");
    }
  });

  it("filters by kind", async () => {
    const handler = handlers.get("list_sources")!;
    const result = await handler({ kind: "monster" });
    const parsed = JSON.parse(result.content[0]?.text);
    for (const s of parsed) {
      expect(s.kinds).toContain("monster");
    }
  });
});

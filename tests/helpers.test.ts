import { describe, it, expect, beforeEach } from "vitest";
import {
  rulesetFromSource,
  entityUri,
  addSourceMeta,
  kindToKey,
  makeResourceLink,
  findEntity,
} from "../src/helpers.js";
import type { AppIndex } from "../src/types.js";
import type { RecordLite, Kind } from "../src/search.js";

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a minimal empty AppIndex for testing */
function emptyIndex(): AppIndex {
  return {
    byKind: new Map(),
    byUri: new Map(),
    sourcesMeta: new Map(),
    fluffByKey: new Map(),
  };
}

/** Shorthand to create a RecordLite for testing */
function rec(overrides: Partial<RecordLite> & { name: string; kind: Kind }): RecordLite {
  const name = overrides.name;
  return {
    uri:
      overrides.uri ??
      `fiveet://entity/${overrides.kind}/PHB/${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    source: overrides.source ?? "PHB",
    ruleset: overrides.ruleset ?? "2014",
    facets: overrides.facets ?? {},
    kind: overrides.kind,
    ...(overrides.aliases ? { aliases: overrides.aliases } : {}),
  };
}

// ── rulesetFromSource ───────────────────────────────────────────────

describe("rulesetFromSource", () => {
  it("returns '2024' for sources starting with 'x' (lowercase)", () => {
    expect(rulesetFromSource("xphb")).toBe("2024");
  });

  it("returns '2024' for sources starting with 'X' (uppercase)", () => {
    expect(rulesetFromSource("XPHB")).toBe("2024");
    expect(rulesetFromSource("XMM")).toBe("2024");
    expect(rulesetFromSource("XDMG")).toBe("2024");
  });

  it("returns '2014' for standard sources", () => {
    expect(rulesetFromSource("PHB")).toBe("2014");
    expect(rulesetFromSource("DMG")).toBe("2014");
    expect(rulesetFromSource("MM")).toBe("2014");
  });

  it("returns '2014' for homebrew sources", () => {
    expect(rulesetFromSource("DungeonChurch")).toBe("2014");
    expect(rulesetFromSource("HB_Custom")).toBe("2014");
  });

  it("returns '2014' for empty string", () => {
    expect(rulesetFromSource("")).toBe("2014");
  });
});

// ── entityUri ───────────────────────────────────────────────────────

describe("entityUri", () => {
  it("builds a fiveet:// URI from kind, source, and name", () => {
    expect(entityUri("monster", "MM", "Goblin")).toBe("fiveet://entity/monster/MM/goblin");
  });

  it("slugifies multi-word names", () => {
    expect(entityUri("spell", "PHB", "Magic Missile")).toBe(
      "fiveet://entity/spell/PHB/magic-missile",
    );
  });

  it("handles names with special characters", () => {
    // toSlug lowercases and replaces non-alphanum with hyphens
    const uri = entityUri("item", "DMG", "Potion of Healing (Greater)");
    expect(uri).toContain("fiveet://entity/item/DMG/");
    expect(uri).not.toContain(" ");
  });

  it("preserves source abbreviation casing", () => {
    expect(entityUri("monster", "XMM", "Dragon")).toBe("fiveet://entity/monster/XMM/dragon");
  });
});

// ── addSourceMeta ───────────────────────────────────────────────────

describe("addSourceMeta", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();
  });

  it("creates a new source entry", () => {
    addSourceMeta(idx, "PHB", "Player's Handbook", "spell");
    const entry = idx.sourcesMeta.get("PHB");
    expect(entry).toBeDefined();
    expect(entry!.abbreviation).toBe("PHB");
    expect(entry!.full).toBe("Player's Handbook");
    expect(entry!.ruleset).toBe("2014");
    expect(entry!.kinds.has("spell")).toBe(true);
  });

  it("merges kinds into existing source entry", () => {
    addSourceMeta(idx, "PHB", "Player's Handbook", "spell");
    addSourceMeta(idx, "PHB", undefined, "monster");
    const entry = idx.sourcesMeta.get("PHB")!;
    expect(entry.kinds.has("spell")).toBe(true);
    expect(entry.kinds.has("monster")).toBe(true);
  });

  it("fills in full name if originally missing", () => {
    addSourceMeta(idx, "DMG", undefined, "item");
    expect(idx.sourcesMeta.get("DMG")!.full).toBeUndefined();

    addSourceMeta(idx, "DMG", "Dungeon Master's Guide", "rule");
    expect(idx.sourcesMeta.get("DMG")!.full).toBe("Dungeon Master's Guide");
  });

  it("does not overwrite existing full name", () => {
    addSourceMeta(idx, "PHB", "Player's Handbook", "spell");
    addSourceMeta(idx, "PHB", "Some Other Name", "monster");
    // First full name wins
    expect(idx.sourcesMeta.get("PHB")!.full).toBe("Player's Handbook");
  });

  it("detects 2024 ruleset for x-prefixed sources", () => {
    addSourceMeta(idx, "XPHB", "Player's Handbook (2024)", "spell");
    expect(idx.sourcesMeta.get("XPHB")!.ruleset).toBe("2024");
  });

  it("creates entry without kind when kind is undefined", () => {
    addSourceMeta(idx, "PHB", "Player's Handbook");
    const entry = idx.sourcesMeta.get("PHB")!;
    expect(entry.kinds.size).toBe(0);
  });
});

// ── kindToKey ───────────────────────────────────────────────────────

describe("kindToKey", () => {
  it("maps all 24 entity kinds to JSON keys", () => {
    const kinds: Kind[] = [
      "monster",
      "spell",
      "item",
      "feat",
      "background",
      "race",
      "class",
      "subclass",
      "condition",
      "rule",
      "adventure",
      "book",
      "table",
      "deity",
      "vehicle",
      "trap",
      "optionalfeature",
      "psionic",
      "language",
      "object",
      "reward",
      "recipe",
      "deck",
      "facility",
    ];
    for (const k of kinds) {
      expect(kindToKey[k]).toBeDefined();
      expect(typeof kindToKey[k]).toBe("string");
    }
  });

  it("maps monster to 'monster'", () => {
    expect(kindToKey.monster).toBe("monster");
  });

  it("maps class and subclass to their respective keys", () => {
    expect(kindToKey.class).toBe("class");
    expect(kindToKey.subclass).toBe("subclass");
  });

  it("maps rule to 'variantrule' (not 'rule')", () => {
    expect(kindToKey.rule).toBe("variantrule");
  });

  it("maps new kinds to their correct JSON keys", () => {
    expect(kindToKey.deity).toBe("deity");
    expect(kindToKey.vehicle).toBe("vehicle");
    expect(kindToKey.trap).toBe("trap");
    expect(kindToKey.optionalfeature).toBe("optionalfeature");
    expect(kindToKey.psionic).toBe("psionic");
    expect(kindToKey.language).toBe("language");
    expect(kindToKey.object).toBe("object");
    expect(kindToKey.reward).toBe("reward");
    expect(kindToKey.recipe).toBe("recipe");
    expect(kindToKey.deck).toBe("deck");
    expect(kindToKey.facility).toBe("facility");
  });
});

// ── makeResourceLink ────────────────────────────────────────────────

describe("makeResourceLink", () => {
  it("returns an MCP resource link object", () => {
    const r = rec({ name: "Fireball", kind: "spell", source: "PHB", ruleset: "2014" });
    const link = makeResourceLink(r);

    expect(link.type).toBe("resource");
    expect(link.resource.uri).toBe(r.uri);
    expect(link.resource.mimeType).toBe("text/plain");
  });

  it("includes kind, source, and ruleset in the display text", () => {
    const r = rec({ name: "Goblin", kind: "monster", source: "MM", ruleset: "2014" });
    const link = makeResourceLink(r);

    expect(link.resource.text).toContain("Goblin");
    expect(link.resource.text).toContain("monster");
    expect(link.resource.text).toContain("MM");
    expect(link.resource.text).toContain("2014");
  });

  it("formats text as 'Name — kind • source • ruleset'", () => {
    const r = rec({ name: "Shield", kind: "spell", source: "XPHB", ruleset: "2024" });
    const link = makeResourceLink(r);
    expect(link.resource.text).toBe("Shield — spell • XPHB • 2024");
  });
});

// ── findEntity ──────────────────────────────────────────────────────

describe("findEntity", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();

    const monsters: RecordLite[] = [
      rec({ name: "Goblin", kind: "monster", source: "MM", ruleset: "2014" }),
      rec({
        name: "Goblin",
        kind: "monster",
        source: "XMM",
        ruleset: "2024",
        uri: "fiveet://entity/monster/XMM/goblin",
      }),
      rec({ name: "Dragon Turtle", kind: "monster", source: "MM", ruleset: "2014" }),
      rec({ name: "Zombie", kind: "monster", source: "MM", ruleset: "2014" }),
    ];
    idx.byKind.set("monster", monsters);
  });

  it("finds exact match by name and source", () => {
    const result = findEntity(idx, "monster", "Goblin", "MM");
    expect(result).toBeDefined();
    expect(result!.source).toBe("MM");
  });

  it("prefers 2024 ruleset by default when no source specified", () => {
    const result = findEntity(idx, "monster", "Goblin");
    expect(result).toBeDefined();
    expect(result!.ruleset).toBe("2024");
  });

  it("prefers specified ruleset when prefer param is set", () => {
    const result = findEntity(idx, "monster", "Goblin", undefined, "2014");
    expect(result).toBeDefined();
    expect(result!.ruleset).toBe("2014");
  });

  it("falls back to any ruleset when preferred not available", () => {
    // Zombie only exists in 2014
    const result = findEntity(idx, "monster", "Zombie", undefined, "2024");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Zombie");
    expect(result!.ruleset).toBe("2014");
  });

  it("returns undefined for empty kind list", () => {
    const result = findEntity(idx, "spell", "Fireball");
    expect(result).toBeUndefined();
  });

  it("falls back to fuzzy match when no exact match", () => {
    const result = findEntity(idx, "monster", "dragon turtl"); // close but not exact
    expect(result).toBeDefined();
    expect(result!.name).toBe("Dragon Turtle");
  });

  it("is case-insensitive for name matching", () => {
    const result = findEntity(idx, "monster", "GOBLIN", "MM");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Goblin");
  });

  // ── Bug B regression: fuzzy fallback must reject garbage input ──
  it("returns undefined for completely unrelated search terms", () => {
    const result = findEntity(idx, "monster", "xyzzyplugh12345");
    expect(result).toBeUndefined();
  });

  it("still finds close fuzzy matches above the threshold", () => {
    // "Gobln" is close to "Goblin" — should still match
    const result = findEntity(idx, "monster", "Gobln");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Goblin");
  });

  it("returns undefined when kind exists but list is empty", () => {
    idx.byKind.set("vehicle", []);
    const result = findEntity(idx, "vehicle", "Cart");
    expect(result).toBeUndefined();
  });

  it("finds entity by alias", () => {
    idx.byKind.set("item", [
      rec({
        name: "Apparatus of Kwalish",
        kind: "item",
        source: "DMG",
        aliases: ["Apparatus of the Crab"],
      }),
    ]);
    // Search by alias — fuzzyScore gives aliases 80 points for exact match
    const result = findEntity(idx, "item", "Apparatus of the Crab");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Apparatus of Kwalish");
  });

  it("prefers exact name match over alias match", () => {
    idx.byKind.set("item", [
      rec({ name: "Sword of Answers", kind: "item", source: "DMG", aliases: ["Holy Avenger"] }),
      rec({ name: "Holy Avenger", kind: "item", source: "DMG" }),
    ]);
    const result = findEntity(idx, "item", "Holy Avenger");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Holy Avenger");
  });

  it("handles name with leading/trailing whitespace via exact match", () => {
    // Lowercase comparison trims naturally for exact match
    const result = findEntity(idx, "monster", "  Goblin  ", "MM");
    // Won't match exact due to whitespace, but fuzzy should catch it
    expect(result).toBeDefined();
    expect(result!.name).toBe("Goblin");
  });

  it("finds by partial name in fuzzy mode", () => {
    const result = findEntity(idx, "monster", "Dragon");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Dragon Turtle");
  });

  it("returns exact source match even when better fuzzy exists elsewhere", () => {
    // If we ask for source=MM and there's an exact name match,
    // it should be returned even if another source has higher fuzzy
    idx.byKind.set("spell", [
      rec({ name: "Shield", kind: "spell", source: "PHB", ruleset: "2014" }),
      rec({
        name: "Shield",
        kind: "spell",
        source: "XPHB",
        ruleset: "2024",
        uri: "fiveet://entity/spell/XPHB/shield",
      }),
    ]);
    const result = findEntity(idx, "spell", "Shield", "PHB");
    expect(result).toBeDefined();
    expect(result!.source).toBe("PHB");
  });

  // ── Homebrew preference ──────────────────────────────────────────

  it("prefers homebrew over official when exact names match and no source specified", () => {
    idx.byKind.set("monster", [
      rec({ name: "Goblin", kind: "monster", source: "MM", ruleset: "2014" }),
      {
        ...rec({
          name: "Goblin",
          kind: "monster",
          source: "HB_Custom",
          ruleset: "2014",
          uri: "fiveet://entity/monster/HB_Custom/goblin",
        }),
        homebrew: true,
      },
    ]);
    const result = findEntity(idx, "monster", "Goblin");
    expect(result).toBeDefined();
    expect(result!.source).toBe("HB_Custom");
  });

  it("prefers homebrew over 2024 ruleset when both match exactly", () => {
    idx.byKind.set("spell", [
      rec({
        name: "Shield",
        kind: "spell",
        source: "XPHB",
        ruleset: "2024",
        uri: "fiveet://entity/spell/XPHB/shield",
      }),
      {
        ...rec({
          name: "Shield",
          kind: "spell",
          source: "HB_Custom",
          ruleset: "2014",
          uri: "fiveet://entity/spell/HB_Custom/shield",
        }),
        homebrew: true,
      },
    ]);
    // Default prefer=2024, but homebrew should still win
    const result = findEntity(idx, "spell", "Shield");
    expect(result).toBeDefined();
    expect(result!.source).toBe("HB_Custom");
  });

  it("still respects explicit source filter over homebrew preference", () => {
    idx.byKind.set("monster", [
      rec({ name: "Goblin", kind: "monster", source: "MM", ruleset: "2014" }),
      {
        ...rec({
          name: "Goblin",
          kind: "monster",
          source: "HB_Custom",
          ruleset: "2014",
          uri: "fiveet://entity/monster/HB_Custom/goblin",
        }),
        homebrew: true,
      },
    ]);
    // Explicit source=MM should override homebrew preference
    const result = findEntity(idx, "monster", "Goblin", "MM");
    expect(result).toBeDefined();
    expect(result!.source).toBe("MM");
  });

  it("falls back to official when no homebrew exists", () => {
    idx.byKind.set("monster", [
      rec({ name: "Zombie", kind: "monster", source: "MM", ruleset: "2014" }),
    ]);
    const result = findEntity(idx, "monster", "Zombie");
    expect(result).toBeDefined();
    expect(result!.source).toBe("MM");
  });
});

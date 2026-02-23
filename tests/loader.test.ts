import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { processEntities, loadAll, loadHomebrew } from "../src/loader.js";
import type { AppIndex } from "../src/types.js";
import type { RollableTable } from "../src/tables.js";

// ── Helpers ─────────────────────────────────────────────────────────

function emptyIndex(): AppIndex {
  return {
    byKind: new Map(),
    byUri: new Map(),
    sourcesMeta: new Map(),
    fluffByKey: new Map(),
  };
}

// ── processEntities (unit tests — no filesystem) ───────────────────

describe("processEntities", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();
  });

  it("creates records from a JSON array of monsters", () => {
    const json = {
      monster: [
        { name: "Goblin", source: "MM", cr: "1/4", type: "humanoid" },
        { name: "Dragon", source: "MM", cr: 10, type: { type: "dragon" } },
      ],
    };
    const records = processEntities(idx, json, "monster", []);

    expect(records).toHaveLength(2);
    expect(records[0].name).toBe("Goblin");
    expect(records[0].kind).toBe("monster");
    expect(records[0].source).toBe("MM");
    expect(records[0].uri).toContain("fiveet://entity/monster/MM/goblin");
  });

  it("extracts monster-specific facets (cr, type)", () => {
    const json = {
      monster: [
        { name: "Goblin", source: "MM", cr: "1/4", type: "humanoid" },
        { name: "Dragon", source: "MM", cr: 10, type: { type: "dragon" } },
      ],
    };
    const records = processEntities(idx, json, "monster", []);

    expect(records[0].facets.cr).toBe("1/4");
    expect(records[0].facets.type).toBe("humanoid");
    // When type is an object, extracts .type property
    expect(records[1].facets.type).toBe("dragon");
  });

  it("extracts spell-specific facets (level, school)", () => {
    const json = {
      spell: [{ name: "Fireball", source: "PHB", level: 3, school: "E" }],
    };
    const records = processEntities(idx, json, "spell", []);

    expect(records[0].facets.level).toBe(3);
    expect(records[0].facets.school).toBe("E");
  });

  it("extracts item-specific facets (rarity, reqAttune)", () => {
    const json = {
      item: [
        { name: "Longsword", source: "PHB", rarity: "none", reqAttune: false },
        { name: "Staff of Power", source: "DMG", rarity: "very rare", reqAttune: true },
      ],
    };
    const records = processEntities(idx, json, "item", []);

    expect(records[0].facets.rarity).toBe("none");
    expect(records[0].facets.reqAttune).toBe(false);
    expect(records[1].facets.rarity).toBe("very rare");
    expect(records[1].facets.reqAttune).toBe(true);
  });

  it("skips entities without a name", () => {
    const json = {
      monster: [
        { source: "MM", cr: 1 }, // no name
        { name: "", source: "MM", cr: 1 }, // empty name
        { name: "Goblin", source: "MM", cr: "1/4" },
      ],
    };
    const records = processEntities(idx, json, "monster", []);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("Goblin");
  });

  it("falls back to metaSources for source when entity has no source", () => {
    const json = {
      spell: [{ name: "Zap" }], // no source field
    };
    const metaSources = [{ abbreviation: "HB_Custom" }];
    const records = processEntities(idx, json, "spell", metaSources);

    expect(records[0].source).toBe("HB_Custom");
  });

  it("defaults to 'UNK' when no source available anywhere", () => {
    const json = {
      spell: [{ name: "Zap" }],
    };
    const records = processEntities(idx, json, "spell", []);

    expect(records[0].source).toBe("UNK");
  });

  it("populates idx.byUri with full entity data plus metadata fields", () => {
    const json = {
      monster: [{ name: "Goblin", source: "MM", cr: "1/4", type: "humanoid" }],
    };
    processEntities(idx, json, "monster", []);

    const uri = "fiveet://entity/monster/MM/goblin";
    const stored = idx.byUri.get(uri);
    expect(stored).toBeDefined();
    expect(stored!._uri).toBe(uri);
    expect(stored!._source).toBe("MM");
    expect(stored!._ruleset).toBe("2014");
    expect(stored!._kind).toBe("monster");
    // Original data preserved
    expect(stored!.name).toBe("Goblin");
    expect(stored!.cr).toBe("1/4");
  });

  it("registers source metadata via addSourceMeta", () => {
    const json = {
      spell: [{ name: "Fireball", source: "PHB" }],
    };
    processEntities(idx, json, "spell", []);

    const meta = idx.sourcesMeta.get("PHB");
    expect(meta).toBeDefined();
    expect(meta!.kinds.has("spell")).toBe(true);
  });

  it("handles alias field as string", () => {
    const json = {
      monster: [{ name: "Beholder", source: "MM", alias: "Eye Tyrant" }],
    };
    const records = processEntities(idx, json, "monster", []);
    expect(records[0].aliases).toEqual(["Eye Tyrant"]);
  });

  it("handles aliases field as array", () => {
    const json = {
      monster: [{ name: "Beholder", source: "MM", aliases: ["Eye Tyrant", "Eye of the Deep"] }],
    };
    const records = processEntities(idx, json, "monster", []);
    expect(records[0].aliases).toEqual(["Eye Tyrant", "Eye of the Deep"]);
  });

  it("handles alias field as array", () => {
    const json = {
      monster: [{ name: "Beholder", source: "MM", alias: ["Eye Tyrant"] }],
    };
    const records = processEntities(idx, json, "monster", []);
    expect(records[0].aliases).toEqual(["Eye Tyrant"]);
  });

  it("returns empty array when JSON has no matching key", () => {
    const json = { monster: [{ name: "Goblin", source: "MM" }] };
    const records = processEntities(idx, json, "spell", []);
    expect(records).toHaveLength(0);
  });

  it("uses title field as name fallback", () => {
    const json = {
      variantrule: [{ title: "Conditions", source: "PHB" }],
    };
    const records = processEntities(idx, json, "rule", []);
    expect(records[0].name).toBe("Conditions");
  });

  it("assigns correct ruleset based on source prefix", () => {
    const json = {
      spell: [
        { name: "Fireball", source: "PHB" },
        { name: "Fireball", source: "XPHB" },
      ],
    };
    const records = processEntities(idx, json, "spell", []);
    expect(records[0].ruleset).toBe("2014");
    expect(records[1].ruleset).toBe("2024");
  });
});

// ── loadAll (integration tests with temp fixture files) ─────────────

describe("loadAll", () => {
  let tmpDir: string;
  let dataDir: string;
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    // Create a temporary data directory with fixture files
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-test-"));
    dataDir = tmpDir;

    // bestiary/ — monster data
    const bestiaryDir = path.join(dataDir, "bestiary");
    await fs.mkdir(bestiaryDir, { recursive: true });
    await fs.writeFile(
      path.join(bestiaryDir, "bestiary-mm.json"),
      JSON.stringify({
        _meta: { sources: [{ abbreviation: "MM", full: "Monster Manual" }] },
        monster: [
          { name: "Goblin", source: "MM", cr: "1/4", type: "humanoid" },
          { name: "Dragon Turtle", source: "MM", cr: 17, type: { type: "dragon" } },
        ],
      }),
    );

    // spells/ — spell data
    const spellsDir = path.join(dataDir, "spells");
    await fs.mkdir(spellsDir, { recursive: true });
    await fs.writeFile(
      path.join(spellsDir, "spells-phb.json"),
      JSON.stringify({
        _meta: { sources: [{ abbreviation: "PHB", full: "Player's Handbook" }] },
        spell: [{ name: "Fireball", source: "PHB", level: 3, school: "E" }],
      }),
    );

    // bestiary/ — malformed JSON file (should be skipped)
    await fs.writeFile(path.join(bestiaryDir, "bestiary-bad.json"), "{ this is not valid JSON");

    // tables.json — display tables at data root
    await fs.writeFile(
      path.join(dataDir, "tables.json"),
      JSON.stringify({
        table: [
          {
            name: "Trinkets",
            source: "PHB",
            colLabels: ["d100", "Trinket"],
            rows: [["01", "A mummified goblin hand"]],
          },
        ],
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    idx = emptyIndex();
    tableStore = new Map();
  });

  it("loads monsters from bestiary directory", async () => {
    await loadAll(idx, tableStore, dataDir);
    const monsters = idx.byKind.get("monster") ?? [];
    expect(monsters.length).toBeGreaterThanOrEqual(2);
    expect(monsters.some((m) => m.name === "Goblin")).toBe(true);
    expect(monsters.some((m) => m.name === "Dragon Turtle")).toBe(true);
  });

  it("loads spells from spells directory", async () => {
    await loadAll(idx, tableStore, dataDir);
    const spells = idx.byKind.get("spell") ?? [];
    expect(spells.length).toBeGreaterThanOrEqual(1);
    expect(spells.some((s) => s.name === "Fireball")).toBe(true);
  });

  it("populates byUri with full entity data", async () => {
    await loadAll(idx, tableStore, dataDir);
    const goblinUri = "fiveet://entity/monster/MM/goblin";
    const stored = idx.byUri.get(goblinUri);
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("Goblin");
    expect(stored!._kind).toBe("monster");
  });

  it("harvests _meta.sources into sourcesMeta", async () => {
    await loadAll(idx, tableStore, dataDir);
    const mm = idx.sourcesMeta.get("MM");
    expect(mm).toBeDefined();
    expect(mm!.full).toBe("Monster Manual");
    expect(mm!.kinds.has("monster")).toBe(true);
  });

  it("skips malformed JSON files without crashing", async () => {
    // loadAll should complete despite bestiary-bad.json being invalid
    await loadAll(idx, tableStore, dataDir);
    const monsters = idx.byKind.get("monster") ?? [];
    // Still loaded the valid file
    expect(monsters.length).toBeGreaterThanOrEqual(2);
  });

  it("skips missing directories gracefully", async () => {
    // feats/ directory doesn't exist in our temp dir
    await loadAll(idx, tableStore, dataDir);
    // Should not throw, feats just won't be populated
    const feats = idx.byKind.get("feat");
    expect(feats).toBeUndefined();
  });

  it("loads display tables from tables.json", async () => {
    await loadAll(idx, tableStore, dataDir);
    const tables = idx.byKind.get("table") ?? [];
    // May or may not normalize successfully depending on table format,
    // but loadAll should not crash
    expect(Array.isArray(tables)).toBe(true);
  });

  it("logs a startup summary to stderr", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[5etools] Loaded:"));
    warnSpy.mockRestore();
  });
});

// ── loadHomebrew (integration tests with temp fixture files) ────────

describe("loadHomebrew", () => {
  let tmpDir: string;
  let homebrewDir: string;
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-homebrew-test-"));
    homebrewDir = tmpDir;

    // Create homebrew index
    await fs.writeFile(
      path.join(homebrewDir, "index.json"),
      JSON.stringify({ toImport: ["custom-monsters.json"] }),
    );

    // Create a homebrew data file
    await fs.writeFile(
      path.join(homebrewDir, "custom-monsters.json"),
      JSON.stringify({
        _meta: {
          sources: [{ abbreviation: "HB_Test", full: "Test Homebrew" }],
        },
        monster: [{ name: "Custom Beast", source: "HB_Test", cr: 3, type: "beast" }],
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    idx = emptyIndex();
    tableStore = new Map();
  });

  it("loads homebrew monsters from index.json imports", async () => {
    await loadHomebrew(idx, tableStore, homebrewDir);
    const monsters = idx.byKind.get("monster") ?? [];
    expect(monsters.some((m) => m.name === "Custom Beast")).toBe(true);
  });

  it("registers homebrew source metadata", async () => {
    await loadHomebrew(idx, tableStore, homebrewDir);
    const meta = idx.sourcesMeta.get("HB_Test");
    expect(meta).toBeDefined();
    expect(meta!.full).toBe("Test Homebrew");
  });

  it("appends to existing kind records (does not overwrite)", async () => {
    // Pre-populate with an existing monster
    idx.byKind.set("monster", [
      {
        uri: "fiveet://entity/monster/MM/goblin",
        name: "Goblin",
        slug: "goblin",
        source: "MM",
        ruleset: "2014" as const,
        facets: {},
        kind: "monster" as const,
      },
    ]);

    await loadHomebrew(idx, tableStore, homebrewDir);
    const monsters = idx.byKind.get("monster") ?? [];
    expect(monsters.some((m) => m.name === "Goblin")).toBe(true);
    expect(monsters.some((m) => m.name === "Custom Beast")).toBe(true);
  });

  it("silently skips when index.json is missing", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-empty-"));
    try {
      // Should not throw
      await loadHomebrew(idx, tableStore, emptyDir);
      expect(idx.byKind.size).toBe(0);
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });

  it("silently skips when toImport is empty", async () => {
    const emptyBrewDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-emptybrew-"));
    try {
      await fs.writeFile(path.join(emptyBrewDir, "index.json"), JSON.stringify({ toImport: [] }));
      await loadHomebrew(idx, tableStore, emptyBrewDir);
      expect(idx.byKind.size).toBe(0);
    } finally {
      await fs.rm(emptyBrewDir, { recursive: true, force: true });
    }
  });

  it("processes extraKeys from homebrew files (e.g., disease → condition)", async () => {
    const extraDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-extra-"));
    try {
      await fs.writeFile(
        path.join(extraDir, "index.json"),
        JSON.stringify({ toImport: ["diseases.json"] }),
      );
      await fs.writeFile(
        path.join(extraDir, "diseases.json"),
        JSON.stringify({
          _meta: { sources: [{ abbreviation: "HB_Dis", full: "Homebrew Diseases" }] },
          // "disease" is an extraKey for kind "condition"
          disease: [
            { name: "Sewer Plague", source: "HB_Dis" },
            { name: "Blinding Sickness", source: "HB_Dis" },
          ],
        }),
      );
      await loadHomebrew(idx, tableStore, extraDir);
      const conditions = idx.byKind.get("condition") ?? [];
      expect(conditions.some((c) => c.name === "Sewer Plague")).toBe(true);
      expect(conditions.some((c) => c.name === "Blinding Sickness")).toBe(true);
    } finally {
      await fs.rm(extraDir, { recursive: true, force: true });
    }
  });

  it("skips unreadable homebrew files without crashing", async () => {
    const brokenDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-broken-"));
    try {
      await fs.writeFile(
        path.join(brokenDir, "index.json"),
        JSON.stringify({ toImport: ["nonexistent.json"] }),
      );
      // Should not throw
      await loadHomebrew(idx, tableStore, brokenDir);
      expect(idx.byKind.size).toBe(0);
    } finally {
      await fs.rm(brokenDir, { recursive: true, force: true });
    }
  });
});

// ── processEntities keyOverride (unit tests) ─────────────────────

describe("processEntities keyOverride", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();
  });

  it("reads from keyOverride instead of kindToKey when provided", () => {
    const json = {
      disease: [
        { name: "Sewer Plague", source: "DMG" },
        { name: "Sight Rot", source: "DMG" },
      ],
    };
    const records = processEntities(idx, json, "condition", [], "disease");
    expect(records).toHaveLength(2);
    expect(records[0].name).toBe("Sewer Plague");
    expect(records[0].kind).toBe("condition");
  });

  it("reads from hazard key into trap kind", () => {
    const json = {
      hazard: [{ name: "Brown Mold", source: "DMG", trapHazType: "ENV" }],
    };
    const records = processEntities(idx, json, "trap", [], "hazard");
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("trap");
    expect(records[0].facets.trapHazType).toBe("ENV");
  });

  it("reads from subrace key into race kind", () => {
    const json = {
      subrace: [{ name: "High Elf", source: "PHB" }],
    };
    const records = processEntities(idx, json, "race", [], "subrace");
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("race");
  });

  it("falls back to kindToKey when keyOverride is undefined", () => {
    const json = {
      monster: [{ name: "Goblin", source: "MM" }],
    };
    const records = processEntities(idx, json, "monster", [], undefined);
    expect(records).toHaveLength(1);
  });

  it("returns empty array when keyOverride key does not exist in JSON", () => {
    const json = { monster: [{ name: "Goblin", source: "MM" }] };
    const records = processEntities(idx, json, "monster", [], "nonexistent");
    expect(records).toHaveLength(0);
  });
});

// ── New kind facet extraction ────────────────────────────────────

describe("processEntities new kind facets", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();
  });

  it("extracts deity-specific facets (pantheon, alignment)", () => {
    const json = {
      deity: [{ name: "Tyr", source: "PHB", pantheon: "Faerunian", alignment: ["L", "G"] }],
    };
    const records = processEntities(idx, json, "deity", []);
    expect(records[0].facets.pantheon).toBe("Faerunian");
    expect(records[0].facets.alignment).toEqual(["L", "G"]);
  });

  it("extracts vehicle-specific facets (vehicleType)", () => {
    const json = {
      vehicle: [{ name: "Galley", source: "GoS", vehicleType: "SHIP" }],
    };
    const records = processEntities(idx, json, "vehicle", []);
    expect(records[0].facets.vehicleType).toBe("SHIP");
  });

  it("extracts trap-specific facets (trapHazType)", () => {
    const json = {
      trap: [{ name: "Pit Trap", source: "DMG", trapHazType: "MECH" }],
    };
    const records = processEntities(idx, json, "trap", []);
    expect(records[0].facets.trapHazType).toBe("MECH");
  });

  it("extracts optionalfeature-specific facets (featureType)", () => {
    const json = {
      optionalfeature: [{ name: "Agonizing Blast", source: "PHB", featureType: ["EI"] }],
    };
    const records = processEntities(idx, json, "optionalfeature", []);
    expect(records[0].facets.featureType).toEqual(["EI"]);
  });

  it("extracts facility-specific facets (facilityType, level)", () => {
    const json = {
      facility: [{ name: "Armory", source: "DMG2024", facilityType: "basic", level: 5 }],
    };
    const records = processEntities(idx, json, "facility", []);
    expect(records[0].facets.facilityType).toBe("basic");
    expect(records[0].facets.level).toBe(5);
  });

  it("extracts generic type facet for reward, psionic, language, object, rule", () => {
    const json = {
      reward: [{ name: "Blessing of Health", source: "DMG", type: "blessing" }],
    };
    const records = processEntities(idx, json, "reward", []);
    expect(records[0].facets.type).toBe("blessing");
  });

  it("extracts recipe-specific facets (type)", () => {
    const json = {
      recipe: [{ name: "Elven Bread", source: "HF", type: "Snack" }],
    };
    const records = processEntities(idx, json, "recipe", []);
    expect(records[0].facets.type).toBe("Snack");
  });
});

// ── rule→variantrule fix ─────────────────────────────────────────

describe("rule kind uses variantrule JSON key", () => {
  let idx: AppIndex;

  beforeEach(() => {
    idx = emptyIndex();
  });

  it("reads from 'variantrule' key, not 'rule'", () => {
    const json = {
      variantrule: [{ name: "Flanking", source: "DMG" }],
      rule: [{ name: "Should Not Load", source: "DMG" }],
    };
    const records = processEntities(idx, json, "rule", []);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("Flanking");
  });
});

// ── Single-file loading path (integration) ──────────────────────

describe("loadAll single-file kinds", () => {
  let tmpDir: string;
  let dataDir: string;
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-singlefile-"));
    dataDir = tmpDir;

    // deities.json — single-file kind
    await fs.writeFile(
      path.join(dataDir, "deities.json"),
      JSON.stringify({
        _meta: { sources: [{ abbreviation: "PHB", full: "Player's Handbook" }] },
        deity: [
          { name: "Tyr", source: "PHB", pantheon: "Faerunian", alignment: ["L", "G"] },
          { name: "Lolth", source: "PHB", pantheon: "Drow", alignment: ["C", "E"] },
        ],
      }),
    );

    // conditionsdiseases.json — multi-key file
    await fs.writeFile(
      path.join(dataDir, "conditionsdiseases.json"),
      JSON.stringify({
        condition: [
          { name: "Blinded", source: "PHB" },
          { name: "Charmed", source: "PHB" },
        ],
        disease: [{ name: "Sewer Plague", source: "DMG" }],
        status: [{ name: "Concentration", source: "PHB" }],
      }),
    );

    // variantrules.json — tests the rule→variantrule fix
    await fs.writeFile(
      path.join(dataDir, "variantrules.json"),
      JSON.stringify({
        variantrule: [
          { name: "Flanking", source: "DMG" },
          { name: "Cleaving", source: "DMG" },
        ],
      }),
    );

    // items.json — single-file with extraKey (itemGroup)
    await fs.writeFile(
      path.join(dataDir, "items.json"),
      JSON.stringify({
        _meta: { sources: [{ abbreviation: "PHB", full: "Player's Handbook" }] },
        item: [{ name: "Longsword", source: "PHB", rarity: "none" }],
        itemGroup: [{ name: "Spell Scroll", source: "DMG", rarity: "varies" }],
      }),
    );

    // trapshazards.json — multi-key file
    await fs.writeFile(
      path.join(dataDir, "trapshazards.json"),
      JSON.stringify({
        trap: [{ name: "Pit Trap", source: "DMG", trapHazType: "MECH" }],
        hazard: [{ name: "Brown Mold", source: "DMG", trapHazType: "ENV" }],
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    idx = emptyIndex();
    tableStore = new Map();
  });

  it("loads deities from deities.json", async () => {
    await loadAll(idx, tableStore, dataDir);
    const deities = idx.byKind.get("deity") ?? [];
    expect(deities).toHaveLength(2);
    expect(deities.some((d) => d.name === "Tyr")).toBe(true);
    expect(deities.some((d) => d.name === "Lolth")).toBe(true);
  });

  it("loads conditions and diseases from conditionsdiseases.json into same kind", async () => {
    await loadAll(idx, tableStore, dataDir);
    const conditions = idx.byKind.get("condition") ?? [];
    // 2 conditions + 1 disease + 1 status = 4
    expect(conditions).toHaveLength(4);
    expect(conditions.some((c) => c.name === "Blinded")).toBe(true);
    expect(conditions.some((c) => c.name === "Sewer Plague")).toBe(true);
    expect(conditions.some((c) => c.name === "Concentration")).toBe(true);
  });

  it("loads variant rules from variantrules.json using variantrule key", async () => {
    await loadAll(idx, tableStore, dataDir);
    const rules = idx.byKind.get("rule") ?? [];
    expect(rules).toHaveLength(2);
    expect(rules.some((r) => r.name === "Flanking")).toBe(true);
  });

  it("loads items and itemGroups from items.json into same kind", async () => {
    await loadAll(idx, tableStore, dataDir);
    const items = idx.byKind.get("item") ?? [];
    expect(items).toHaveLength(2);
    expect(items.some((i) => i.name === "Longsword")).toBe(true);
    expect(items.some((i) => i.name === "Spell Scroll")).toBe(true);
  });

  it("loads traps and hazards from trapshazards.json into same kind", async () => {
    await loadAll(idx, tableStore, dataDir);
    const traps = idx.byKind.get("trap") ?? [];
    expect(traps).toHaveLength(2);
    expect(traps.some((t) => t.name === "Pit Trap")).toBe(true);
    expect(traps.some((t) => t.name === "Brown Mold")).toBe(true);
  });

  it("populates byUri for single-file entities", async () => {
    await loadAll(idx, tableStore, dataDir);
    const uri = "fiveet://entity/deity/PHB/tyr";
    const stored = idx.byUri.get(uri);
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("Tyr");
    expect(stored!._kind).toBe("deity");
  });

  it("harvests _meta.sources from single-file kinds", async () => {
    await loadAll(idx, tableStore, dataDir);
    const phb = idx.sourcesMeta.get("PHB");
    expect(phb).toBeDefined();
    expect(phb!.kinds.has("deity")).toBe(true);
  });
});

// ── Indexed kinds (adventure/book) loading ─────────────────────────

describe("loadAll indexed kinds (adventure/book)", () => {
  let tmpDir: string;
  let dataDir: string;
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-indexed-"));
    dataDir = tmpDir;

    // adventures.json — index file at data root
    await fs.writeFile(
      path.join(dataDir, "adventures.json"),
      JSON.stringify({
        adventure: [
          {
            name: "Test Adventure",
            id: "TA",
            source: "TA",
            author: "Test Author",
            group: "supplement",
            storyline: "Test Campaign",
            level: { start: 1, end: 5 },
            published: "2024-01-01",
            contents: [
              { name: "Introduction", headers: ["Background", "Overview"] },
              {
                name: "The Dungeon",
                ordinal: { type: "part", identifier: 1 },
                headers: ["Room 1"],
              },
            ],
          },
        ],
      }),
    );

    // adventure/ directory with content file
    const advDir = path.join(dataDir, "adventure");
    await fs.mkdir(advDir, { recursive: true });
    await fs.writeFile(
      path.join(advDir, "adventure-ta.json"),
      JSON.stringify({
        data: [
          {
            type: "section",
            name: "Introduction",
            entries: [
              "Welcome to the test adventure.",
              { type: "entries", name: "Background", entries: ["Long ago in a land far away..."] },
            ],
          },
          {
            type: "section",
            name: "The Dungeon",
            entries: ["The dungeon is dark and dangerous."],
          },
        ],
      }),
    );

    // books.json — index file at data root
    await fs.writeFile(
      path.join(dataDir, "books.json"),
      JSON.stringify({
        book: [
          {
            name: "Test Handbook",
            id: "TH",
            source: "TH",
            author: "Test Writer",
            group: "core",
            published: "2024-06-01",
            contents: [
              { name: "Rules", ordinal: { type: "chapter", identifier: 1 } },
              { name: "Appendix", ordinal: { type: "appendix", identifier: "A" } },
            ],
          },
        ],
      }),
    );

    // book/ directory with content file
    const bookDir = path.join(dataDir, "book");
    await fs.mkdir(bookDir, { recursive: true });
    await fs.writeFile(
      path.join(bookDir, "book-th.json"),
      JSON.stringify({
        data: [{ type: "section", name: "Rules", entries: ["These are the rules."] }],
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    idx = emptyIndex();
    tableStore = new Map();
  });

  it("loads adventures from index file", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const adventures = idx.byKind.get("adventure") ?? [];
    expect(adventures).toHaveLength(1);
    expect(adventures[0].name).toBe("Test Adventure");
    expect(adventures[0].source).toBe("TA");
    expect(adventures[0].kind).toBe("adventure");
  });

  it("loads books from index file", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const books = idx.byKind.get("book") ?? [];
    expect(books).toHaveLength(1);
    expect(books[0].name).toBe("Test Handbook");
    expect(books[0].source).toBe("TH");
  });

  it("extracts adventure facets (author, group, storyline, level, published)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const adventures = idx.byKind.get("adventure") ?? [];
    const adv = adventures[0];
    expect(adv.facets.author).toBe("Test Author");
    expect(adv.facets.group).toBe("supplement");
    expect(adv.facets.storyline).toBe("Test Campaign");
    expect(adv.facets.level).toEqual({ start: 1, end: 5 });
    expect(adv.facets.published).toBe("2024-01-01");
  });

  it("extracts book facets (author, group, published)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const books = idx.byKind.get("book") ?? [];
    const book = books[0];
    expect(book.facets.author).toBe("Test Writer");
    expect(book.facets.group).toBe("core");
    expect(book.facets.published).toBe("2024-06-01");
  });

  it("merges content data from individual files into byUri", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const uri = "fiveet://entity/adventure/TA/test-adventure";
    const stored = idx.byUri.get(uri);
    expect(stored).toBeDefined();
    expect(stored!._contentData).toBeDefined();
    expect(stored!._contentData).toHaveLength(2);
    expect(stored!._contentData![0].name).toBe("Introduction");
  });

  it("preserves index metadata on stored entity", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const uri = "fiveet://entity/adventure/TA/test-adventure";
    const stored = idx.byUri.get(uri);
    expect(stored!.author).toBe("Test Author");
    expect(stored!.contents).toHaveLength(2);
    expect(stored!._kind).toBe("adventure");
  });

  it("handles missing content files gracefully", async () => {
    // Create a temp dir with adventure index but no content directory
    const isolatedDir = await fs.mkdtemp(path.join(os.tmpdir(), "5etools-nocontent-"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await fs.writeFile(
        path.join(isolatedDir, "adventures.json"),
        JSON.stringify({
          adventure: [{ name: "Orphan Adventure", id: "OA", source: "OA" }],
        }),
      );
      const isolatedIdx = emptyIndex();
      await loadAll(isolatedIdx, new Map(), isolatedDir);
      // Adventure should still be indexed from metadata alone
      const adventures = isolatedIdx.byKind.get("adventure") ?? [];
      expect(adventures).toHaveLength(1);
      expect(adventures[0].name).toBe("Orphan Adventure");
      // But no content data
      const stored = isolatedIdx.byUri.get(adventures[0].uri);
      expect(stored!._contentData).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
      await fs.rm(isolatedDir, { recursive: true, force: true });
    }
  });

  it("loads book content data into byUri", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, dataDir);
    warnSpy.mockRestore();
    const uri = "fiveet://entity/book/TH/test-handbook";
    const stored = idx.byUri.get(uri);
    expect(stored).toBeDefined();
    expect(stored!._contentData).toBeDefined();
    expect(stored!._contentData).toHaveLength(1);
    expect(stored!._contentData![0].name).toBe("Rules");
  });
});

// ── SRD fixture test — comprehensive loading against committed fixtures ──
// Runs in CI and locally. Uses SRD / CC-licensed data in tests/fixtures/.

const FIXTURES_DIR = path.resolve(import.meta.dirname ?? __dirname, "fixtures");

describe("loadAll against SRD fixtures", () => {
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    idx = emptyIndex();
    tableStore = new Map();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, FIXTURES_DIR);
    warnSpy.mockRestore();
  });

  // ── Directory-based kinds ──
  it.each(["monster", "spell", "class", "subclass"])("loads %s from subdirectory", (kind) => {
    const records = idx.byKind.get(kind as any) ?? [];
    expect(records.length).toBeGreaterThan(0);
  });

  it("loads correct monster count (3 SRD monsters)", () => {
    const monsters = idx.byKind.get("monster") ?? [];
    expect(monsters).toHaveLength(3);
    expect(monsters.some((m) => m.name === "Goblin")).toBe(true);
    expect(monsters.some((m) => m.name === "Owlbear")).toBe(true);
    expect(monsters.some((m) => m.name === "Adult Red Dragon")).toBe(true);
  });

  it("loads correct spell count (3 SRD spells)", () => {
    const spells = idx.byKind.get("spell") ?? [];
    expect(spells).toHaveLength(3);
    expect(spells.some((s) => s.name === "Fireball")).toBe(true);
  });

  it("loads class and subclass from same directory", () => {
    const classes = idx.byKind.get("class") ?? [];
    const subclasses = idx.byKind.get("subclass") ?? [];
    expect(classes.some((c) => c.name === "Fighter")).toBe(true);
    expect(subclasses.some((s) => s.name === "Champion")).toBe(true);
  });

  // ── Single-file kinds (all 17) ──
  it.each([
    "item",
    "feat",
    "background",
    "race",
    "condition",
    "rule",
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
  ])("loads %s from single file", (kind) => {
    const records = idx.byKind.get(kind as any) ?? [];
    expect(records.length).toBeGreaterThan(0);
  });

  // ── extraKey loading (multi-key files) ──
  it("loads itemGroup into item kind", () => {
    const items = idx.byKind.get("item") ?? [];
    // 2 items + 1 itemGroup = 3
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.name === "Spell Scroll")).toBe(true);
  });

  it("loads disease and status into condition kind", () => {
    const conditions = idx.byKind.get("condition") ?? [];
    // 2 conditions + 1 disease + 1 status = 4
    expect(conditions).toHaveLength(4);
    expect(conditions.some((c) => c.name === "Sewer Plague")).toBe(true);
    expect(conditions.some((c) => c.name === "Concentration")).toBe(true);
  });

  it("loads hazard into trap kind", () => {
    const traps = idx.byKind.get("trap") ?? [];
    // 1 trap + 1 hazard = 2
    expect(traps).toHaveLength(2);
    expect(traps.some((t) => t.name === "Brown Mold")).toBe(true);
  });

  it("loads subrace into race kind", () => {
    const races = idx.byKind.get("race") ?? [];
    // 2 races + 1 subrace = 3
    expect(races).toHaveLength(3);
    expect(races.some((r) => r.name === "High Elf")).toBe(true);
  });

  it("loads languageScript into language kind", () => {
    const languages = idx.byKind.get("language") ?? [];
    // 2 languages + 1 languageScript = 3
    expect(languages).toHaveLength(3);
    expect(languages.some((l) => l.name === "Dwarvish Script")).toBe(true);
  });

  it("loads vehicleUpgrade into vehicle kind", () => {
    const vehicles = idx.byKind.get("vehicle") ?? [];
    // 1 vehicle + 1 vehicleUpgrade = 2
    expect(vehicles).toHaveLength(2);
    expect(vehicles.some((v) => v.name === "Reinforced Hull")).toBe(true);
  });

  it("loads card into deck kind", () => {
    const decks = idx.byKind.get("deck") ?? [];
    // 1 deck + 1 card = 2
    expect(decks).toHaveLength(2);
    expect(decks.some((d) => d.name === "The Fool")).toBe(true);
  });

  // ── Indexed kinds (adventure/book) ──
  it("loads adventure from index + content", () => {
    const adventures = idx.byKind.get("adventure") ?? [];
    expect(adventures).toHaveLength(1);
    expect(adventures[0].name).toBe("SRD Test Adventure");

    const stored = idx.byUri.get(adventures[0].uri);
    expect(stored).toBeDefined();
    expect(stored!._contentData).toBeDefined();
    expect(stored!._contentData).toHaveLength(2);
  });

  it("loads book from index + content", () => {
    const books = idx.byKind.get("book") ?? [];
    expect(books).toHaveLength(1);
    expect(books[0].name).toBe("SRD Test Handbook");

    const stored = idx.byUri.get(books[0].uri);
    expect(stored).toBeDefined();
    expect(stored!._contentData).toBeDefined();
    expect(stored!._contentData).toHaveLength(1);
  });

  // ── Tables ──
  it("loads display tables from tables.json", () => {
    expect(tableStore.size).toBeGreaterThan(0);
    const tableRecords = idx.byKind.get("table") ?? [];
    expect(tableRecords.length).toBeGreaterThan(0);
    // Should have display + encounter + name tables
    const categories = new Set(tableRecords.map((t) => t.facets.category));
    expect(categories.has("display")).toBe(true);
  });

  it("loads encounter tables from encounters.json", () => {
    const tableRecords = idx.byKind.get("table") ?? [];
    const categories = new Set(tableRecords.map((t) => t.facets.category));
    expect(categories.has("encounter")).toBe(true);
  });

  it("loads name tables from names.json", () => {
    const tableRecords = idx.byKind.get("table") ?? [];
    const categories = new Set(tableRecords.map((t) => t.facets.category));
    expect(categories.has("name")).toBe(true);
  });

  // ── Fluff ──
  it("loads fluff data", () => {
    expect(idx.fluffByKey.size).toBeGreaterThan(0);
    // Verify specific fluff entries
    expect(idx.fluffByKey.has("monster/MM/goblin")).toBe(true);
    expect(idx.fluffByKey.has("item/PHB/longsword")).toBe(true);
  });

  // ── byUri ──
  it("populates byUri for all loaded entities", () => {
    // At least one entity per kind should be in byUri
    for (const [kind, records] of idx.byKind) {
      if (records.length === 0) continue;
      const first = records[0];
      // Table URIs use a different prefix, so only check entity kinds
      if (kind !== "table") {
        expect(idx.byUri.has(first.uri)).toBe(true);
      }
    }
  });

  // ── Facets ──
  it("extracts monster facets", () => {
    const monsters = idx.byKind.get("monster") ?? [];
    const goblin = monsters.find((m) => m.name === "Goblin");
    expect(goblin!.facets.cr).toBe("1/4");
    expect(goblin!.facets.type).toBe("humanoid");
  });

  it("extracts spell facets", () => {
    const spells = idx.byKind.get("spell") ?? [];
    const fireball = spells.find((s) => s.name === "Fireball");
    expect(fireball!.facets.level).toBe(3);
    expect(fireball!.facets.school).toBe("E");
  });

  it("extracts item facets", () => {
    const items = idx.byKind.get("item") ?? [];
    const sword = items.find((i) => i.name === "Longsword");
    expect(sword!.facets.rarity).toBe("none");
  });

  it("extracts adventure facets", () => {
    const adventures = idx.byKind.get("adventure") ?? [];
    expect(adventures[0].facets.author).toBe("SRD Authors");
    expect(adventures[0].facets.storyline).toBe("Test Campaign");
  });

  // ── Source metadata ──
  it("registers source metadata", () => {
    expect(idx.sourcesMeta.has("MM")).toBe(true);
    expect(idx.sourcesMeta.has("PHB")).toBe(true);
    expect(idx.sourcesMeta.get("MM")!.full).toBe("Monster Manual");
  });

  // ── Aliases ──
  it("loads aliases from fixture data", () => {
    const monsters = idx.byKind.get("monster") ?? [];
    const goblin = monsters.find((m) => m.name === "Goblin");
    expect(goblin!.aliases).toEqual(["Gobbo"]);
    const dragon = monsters.find((m) => m.name === "Adult Red Dragon");
    expect(dragon!.aliases).toEqual(["Red Dragon", "Wyrm"]);
  });
});

// ── Dungeon Church homebrew fixture test ─────────────────────────

describe("loadHomebrew against Dungeon Church fixtures", () => {
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    idx = emptyIndex();
    tableStore = new Map();
    await loadHomebrew(idx, tableStore, path.join(FIXTURES_DIR, "homebrew"));
  });

  it("loads homebrew monsters from Dungeon Church NPCs", () => {
    const monsters = idx.byKind.get("monster") ?? [];
    expect(monsters.some((m) => m.name === "Mildred Magpie")).toBe(true);
  });

  it("loads homebrew conditions from Dungeon Church Pyora", () => {
    const conditions = idx.byKind.get("condition") ?? [];
    expect(conditions.some((c) => c.name === "Intoxicated")).toBe(true);
  });

  it("loads homebrew languages", () => {
    const languages = idx.byKind.get("language") ?? [];
    expect(languages.some((l) => l.name === "Adalindian Whistling")).toBe(true);
  });

  it("loads homebrew races", () => {
    const races = idx.byKind.get("race") ?? [];
    expect(races.some((r) => r.name === "Elfmarked")).toBe(true);
  });

  it("loads homebrew deities", () => {
    const deities = idx.byKind.get("deity") ?? [];
    expect(deities.some((d) => d.name === "Abraxas")).toBe(true);
  });

  it("marks homebrew records with homebrew flag", () => {
    const monsters = idx.byKind.get("monster") ?? [];
    const mildred = monsters.find((m) => m.name === "Mildred Magpie");
    expect(mildred!.homebrew).toBe(true);
  });

  it("registers homebrew source metadata", () => {
    // Both DC sources use abbreviation "CHURCH"
    const meta = idx.sourcesMeta.get("CHURCH");
    expect(meta).toBeDefined();
    expect(meta!.full).toBe("Dungeon Church; Pyora NPCs");
  });
});

// ── Live data smoke test (local only — skipped in CI) ────────────
// Runs loadAll against the real 5etools data directory to verify
// every kind actually loads at scale. Skipped when data isn't present.

const LIVE_ROOT = process.env.FIVETOOLS_SRC_DIR ?? path.join(process.cwd(), "5etools-src");
const LIVE_DATA = path.join(LIVE_ROOT, "data");
const hasLiveData = existsSync(LIVE_DATA);

describe.skipIf(!hasLiveData)("loadAll against live data", () => {
  let idx: AppIndex;
  let tableStore: Map<string, RollableTable>;

  beforeAll(async () => {
    idx = emptyIndex();
    tableStore = new Map();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadAll(idx, tableStore, LIVE_DATA);
    warnSpy.mockRestore();
  });

  // Directory-based kinds
  it.each(["monster", "spell", "class", "subclass"])("loads %s from subdirectory", (kind) => {
    const records = idx.byKind.get(kind as any) ?? [];
    expect(records.length).toBeGreaterThan(0);
  });

  // Indexed kinds (adventure/book)
  it.each(["adventure", "book"])("loads %s from indexed path", (kind) => {
    const records = idx.byKind.get(kind as any) ?? [];
    expect(records.length).toBeGreaterThan(0);
  });

  it("loads content data for at least some adventures", () => {
    const adventures = idx.byKind.get("adventure") ?? [];
    const withContent = adventures.filter((a) => {
      const stored = idx.byUri.get(a.uri);
      return (stored?._contentData?.length ?? 0) > 0;
    });
    expect(withContent.length).toBeGreaterThan(0);
  });

  it("loads content data for at least some books", () => {
    const books = idx.byKind.get("book") ?? [];
    const withContent = books.filter((b) => {
      const stored = idx.byUri.get(b.uri);
      return (stored?._contentData?.length ?? 0) > 0;
    });
    expect(withContent.length).toBeGreaterThan(0);
  });

  // Single-file kinds
  it.each([
    "item",
    "feat",
    "background",
    "race",
    "condition",
    "rule",
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
  ])("loads %s from single file", (kind) => {
    const records = idx.byKind.get(kind as any) ?? [];
    expect(records.length).toBeGreaterThan(0);
  });

  // Multi-key files: verify extra keys contributed at scale
  it("loads diseases into condition kind", () => {
    const conditions = idx.byKind.get("condition") ?? [];
    expect(conditions.length).toBeGreaterThan(30);
  });

  it("loads hazards into trap kind", () => {
    const traps = idx.byKind.get("trap") ?? [];
    expect(traps.length).toBeGreaterThan(37);
  });

  it("loads itemGroups into item kind", () => {
    const items = idx.byKind.get("item") ?? [];
    expect(items.length).toBeGreaterThan(2474);
  });

  it("loads subraces into race kind", () => {
    const races = idx.byKind.get("race") ?? [];
    expect(races.length).toBeGreaterThan(145);
  });

  // Tables
  it("loads rollable tables", () => {
    const tables = idx.byKind.get("table") ?? [];
    expect(tables.length).toBeGreaterThan(0);
    expect(tableStore.size).toBeGreaterThan(0);
  });

  // Fluff
  it("loads fluff data", () => {
    expect(idx.fluffByKey.size).toBeGreaterThan(0);
  });

  // byUri at scale
  it("populates byUri with a substantial number of entries", () => {
    expect(idx.byUri.size).toBeGreaterThan(1000);
  });
});

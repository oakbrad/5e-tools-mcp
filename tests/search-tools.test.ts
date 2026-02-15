import { describe, it, expect, beforeAll } from "vitest";
import {
  searchSpells,
  searchMonsters,
  searchItems,
  type SearchIndex,
  type RecordLite,
  type Ruleset
} from "../src/search.js";

/**
 * Comprehensive tests for domain-specific search tools:
 * - search_spells
 * - search_monsters
 * - search_items
 */

// Helper to create a test index
function createTestIndex(): SearchIndex {
  const idx: SearchIndex = {
    byKind: new Map(),
    byUri: new Map()
  };

  // Mock spell data
  const spells: RecordLite[] = [
    {
      uri: "fiveet://entity/spell/PHB/fireball",
      name: "Fireball",
      slug: "fireball",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 3, school: "E" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/PHB/magic-missile",
      name: "Magic Missile",
      slug: "magic-missile",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 1, school: "E" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/PHB/cure-wounds",
      name: "Cure Wounds",
      slug: "cure-wounds",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 1, school: "V" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/PHB/shield",
      name: "Shield",
      slug: "shield",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 1, school: "A" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/PHB/wish",
      name: "Wish",
      slug: "wish",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 9, school: "C" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/PHB/light",
      name: "Light",
      slug: "light",
      source: "PHB",
      ruleset: "2014",
      facets: { level: 0, school: "E" },
      kind: "spell"
    },
    {
      uri: "fiveet://entity/spell/XPHB/eldritch-blast",
      name: "Eldritch Blast",
      slug: "eldritch-blast",
      source: "XPHB",
      ruleset: "2024",
      facets: { level: 0, school: "E" },
      kind: "spell"
    }
  ];

  // Add spell entities with class info
  idx.byUri.set("fiveet://entity/spell/PHB/fireball", {
    name: "Fireball",
    level: 3,
    school: "E",
    classes: {
      fromClassList: [
        { name: "Sorcerer", source: "PHB" },
        { name: "Wizard", source: "PHB" }
      ]
    }
  });
  idx.byUri.set("fiveet://entity/spell/PHB/magic-missile", {
    name: "Magic Missile",
    level: 1,
    school: "E",
    classes: {
      fromClassList: [{ name: "Wizard", source: "PHB" }]
    }
  });
  idx.byUri.set("fiveet://entity/spell/PHB/cure-wounds", {
    name: "Cure Wounds",
    level: 1,
    school: "V",
    classes: {
      fromClassList: [
        { name: "Cleric", source: "PHB" },
        { name: "Bard", source: "PHB" }
      ]
    }
  });
  idx.byUri.set("fiveet://entity/spell/PHB/shield", {
    name: "Shield",
    level: 1,
    school: "A",
    classes: {
      fromClassList: [
        { name: "Wizard", source: "PHB" },
        { name: "Sorcerer", source: "PHB" }
      ]
    }
  });
  idx.byUri.set("fiveet://entity/spell/PHB/wish", {
    name: "Wish",
    level: 9,
    school: "C",
    classes: {
      fromClassList: [{ name: "Wizard", source: "PHB" }]
    }
  });
  idx.byUri.set("fiveet://entity/spell/PHB/light", {
    name: "Light",
    level: 0,
    school: "E",
    classes: {
      fromClassList: [
        { name: "Cleric", source: "PHB" },
        { name: "Wizard", source: "PHB" }
      ]
    }
  });
  idx.byUri.set("fiveet://entity/spell/XPHB/eldritch-blast", {
    name: "Eldritch Blast",
    level: 0,
    school: "E",
    classes: {
      fromClassList: [{ name: "Warlock", source: "XPHB" }]
    }
  });

  idx.byKind.set("spell", spells);

  // Mock monster data
  const monsters: RecordLite[] = [
    {
      uri: "fiveet://entity/monster/MM/ancient-red-dragon",
      name: "Ancient Red Dragon",
      slug: "ancient-red-dragon",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "24", type: "dragon" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/goblin",
      name: "Goblin",
      slug: "goblin",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "0.25", type: "humanoid" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/skeleton",
      name: "Skeleton",
      slug: "skeleton",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "0.25", type: "undead" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/vampire",
      name: "Vampire",
      slug: "vampire",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "13", type: "undead" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/tarrasque",
      name: "Tarrasque",
      slug: "tarrasque",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "30", type: "monstrosity" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/commoner",
      name: "Commoner",
      slug: "commoner",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "0", type: "humanoid" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/sprite",
      name: "Sprite",
      slug: "sprite",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "0.125", type: "fey" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/MM/giant-spider",
      name: "Giant Spider",
      slug: "giant-spider",
      source: "MM",
      ruleset: "2014",
      facets: { cr: "1", type: "beast" },
      kind: "monster"
    },
    {
      uri: "fiveet://entity/monster/XMM/young-red-dragon",
      name: "Young Red Dragon",
      slug: "young-red-dragon",
      source: "XMM",
      ruleset: "2024",
      facets: { cr: "10", type: "dragon" },
      kind: "monster"
    }
  ];

  idx.byKind.set("monster", monsters);

  // Mock item data
  const items: RecordLite[] = [
    {
      uri: "fiveet://entity/item/DMG/longsword",
      name: "Longsword",
      slug: "longsword",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "none", reqAttune: false },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/+1-longsword",
      name: "+1 Longsword",
      slug: "+1-longsword",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "uncommon", reqAttune: false },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/bag-of-holding",
      name: "Bag of Holding",
      slug: "bag-of-holding",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "uncommon", reqAttune: false },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/cloak-of-protection",
      name: "Cloak of Protection",
      slug: "cloak-of-protection",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "uncommon", reqAttune: true },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/flame-tongue",
      name: "Flame Tongue",
      slug: "flame-tongue",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "rare", reqAttune: true },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/ring-of-wishes",
      name: "Ring of Wishes",
      slug: "ring-of-wishes",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "legendary", reqAttune: true },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/holy-avenger",
      name: "Holy Avenger",
      slug: "holy-avenger",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "legendary", reqAttune: true },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/deck-of-many-things",
      name: "Deck of Many Things",
      slug: "deck-of-many-things",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "artifact", reqAttune: false },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/DMG/healing-potion",
      name: "Healing Potion",
      slug: "healing-potion",
      source: "DMG",
      ruleset: "2014",
      facets: { rarity: "common", reqAttune: false },
      kind: "item"
    },
    {
      uri: "fiveet://entity/item/XDMG/staff-of-power",
      name: "Staff of Power",
      slug: "staff-of-power",
      source: "XDMG",
      ruleset: "2024",
      facets: { rarity: "very rare", reqAttune: true },
      kind: "item"
    }
  ];

  // Add item entities with type info
  idx.byUri.set("fiveet://entity/item/DMG/longsword", { type: "weapon" });
  idx.byUri.set("fiveet://entity/item/DMG/+1-longsword", { type: "weapon" });
  idx.byUri.set("fiveet://entity/item/DMG/bag-of-holding", { type: "wondrous item" });
  idx.byUri.set("fiveet://entity/item/DMG/cloak-of-protection", { type: "wondrous item" });
  idx.byUri.set("fiveet://entity/item/DMG/flame-tongue", { type: "weapon" });
  idx.byUri.set("fiveet://entity/item/DMG/ring-of-wishes", { type: "ring" });
  idx.byUri.set("fiveet://entity/item/DMG/holy-avenger", { type: "weapon" });
  idx.byUri.set("fiveet://entity/item/DMG/deck-of-many-things", { type: "wondrous item" });
  idx.byUri.set("fiveet://entity/item/DMG/healing-potion", { type: "potion" });
  idx.byUri.set("fiveet://entity/item/XDMG/staff-of-power", { type: "staff" });

  idx.byKind.set("item", items);

  return idx;
}

describe("search_spells", () => {
  let idx: SearchIndex;

  beforeAll(() => {
    idx = createTestIndex();
  });

  it("filters spells by level 0 (cantrips)", () => {
    const results = searchSpells(idx, { level: 0 });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Eldritch Blast", "Light"]);
  });

  it("filters spells by level 1", () => {
    const results = searchSpells(idx, { level: 1 });
    expect(results.length).toBe(3);
    expect(results.map(r => r.name).sort()).toEqual(["Cure Wounds", "Magic Missile", "Shield"]);
  });

  it("filters spells by level 3", () => {
    const results = searchSpells(idx, { level: 3 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Fireball");
  });

  it("filters spells by level 9", () => {
    const results = searchSpells(idx, { level: 9 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Wish");
  });

  it("filters spells by school E (Evocation)", () => {
    const results = searchSpells(idx, { school: "E" });
    expect(results.length).toBe(4);
    expect(results.map(r => r.name).sort()).toEqual([
      "Eldritch Blast",
      "Fireball",
      "Light",
      "Magic Missile"
    ]);
  });

  it("filters spells by school V (Evocation)", () => {
    const results = searchSpells(idx, { school: "V" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Cure Wounds");
  });

  it("filters spells by school A (Abjuration)", () => {
    const results = searchSpells(idx, { school: "A" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Shield");
  });

  it("filters spells by school C (Conjuration)", () => {
    const results = searchSpells(idx, { school: "C" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Wish");
  });

  it("filters spells by classes array - Wizard", () => {
    const results = searchSpells(idx, { classes: ["Wizard"] });
    expect(results.length).toBe(5);
    expect(results.map(r => r.name).sort()).toEqual([
      "Fireball",
      "Light",
      "Magic Missile",
      "Shield",
      "Wish"
    ]);
  });

  it("filters spells by classes array - Cleric", () => {
    const results = searchSpells(idx, { classes: ["Cleric"] });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Cure Wounds", "Light"]);
  });

  it("filters spells by classes array - Sorcerer", () => {
    const results = searchSpells(idx, { classes: ["Sorcerer"] });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Fireball", "Shield"]);
  });

  it("filters spells by source PHB", () => {
    const results = searchSpells(idx, { source: "PHB" });
    expect(results.length).toBe(6);
    expect(results.find(r => r.name === "Eldritch Blast")).toBeUndefined();
  });

  it("filters spells by source XPHB (2024 ruleset)", () => {
    const results = searchSpells(idx, { source: "XPHB" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Eldritch Blast");
  });

  it("filters spells by ruleset 2014", () => {
    const results = searchSpells(idx, { ruleset: "2014" });
    expect(results.length).toBe(6);
    expect(results.find(r => r.name === "Eldritch Blast")).toBeUndefined();
  });

  it("filters spells by ruleset 2024", () => {
    const results = searchSpells(idx, { ruleset: "2024" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Eldritch Blast");
  });

  it("supports fuzzy name matching with filters", () => {
    const results = searchSpells(idx, { name: "fire", level: 3 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Fireball");
  });

  it("combines multiple filters - level 1, school E", () => {
    const results = searchSpells(idx, { level: 1, school: "E" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Magic Missile");
  });

  it("combines multiple filters - level 1, classes Wizard", () => {
    const results = searchSpells(idx, { level: 1, classes: ["Wizard"] });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Magic Missile", "Shield"]);
  });

  it("returns empty results when no matches", () => {
    const results = searchSpells(idx, { level: 8, school: "D" });
    expect(results.length).toBe(0);
  });

  it("respects limit parameter", () => {
    const results = searchSpells(idx, { limit: 2 });
    expect(results.length).toBe(2);
  });
});

describe("search_monsters", () => {
  let idx: SearchIndex;

  beforeAll(() => {
    idx = createTestIndex();
  });

  it("filters by CR exact value - CR 0", () => {
    const results = searchMonsters(idx, { cr_min: 0, cr_max: 0 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Commoner");
  });

  it("filters by CR exact value - CR 1", () => {
    const results = searchMonsters(idx, { cr_min: 1, cr_max: 1 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Giant Spider");
  });

  it("filters by fractional CR 0.125", () => {
    const results = searchMonsters(idx, { cr_min: 0.125, cr_max: 0.125 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Sprite");
  });

  it("filters by fractional CR 0.25", () => {
    const results = searchMonsters(idx, { cr_min: 0.25, cr_max: 0.25 });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Goblin", "Skeleton"]);
  });

  it("filters by fractional CR 0.5", () => {
    const results = searchMonsters(idx, { cr_min: 0.5, cr_max: 0.5 });
    expect(results.length).toBe(0);
  });

  it("filters by CR range - cr_min only", () => {
    const results = searchMonsters(idx, { cr_min: 10 });
    expect(results.length).toBe(4);
    expect(results.map(r => r.name).sort()).toEqual([
      "Ancient Red Dragon",
      "Tarrasque",
      "Vampire",
      "Young Red Dragon"
    ]);
  });

  it("filters by CR range - cr_max only", () => {
    const results = searchMonsters(idx, { cr_max: 1 });
    expect(results.length).toBe(5);
    expect(results.map(r => r.name).sort()).toEqual([
      "Commoner",
      "Giant Spider",
      "Goblin",
      "Skeleton",
      "Sprite"
    ]);
  });

  it("filters by CR range - both cr_min and cr_max", () => {
    const results = searchMonsters(idx, { cr_min: 10, cr_max: 20 });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Vampire", "Young Red Dragon"]);
  });

  it("filters by CR range edge case - fractional boundaries", () => {
    const results = searchMonsters(idx, { cr_min: 0.1, cr_max: 0.3 });
    expect(results.length).toBe(3);
    expect(results.map(r => r.name).sort()).toEqual(["Goblin", "Skeleton", "Sprite"]);
  });

  it("filters by type - dragon", () => {
    const results = searchMonsters(idx, { type: "dragon" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Ancient Red Dragon", "Young Red Dragon"]);
  });

  it("filters by type - undead", () => {
    const results = searchMonsters(idx, { type: "undead" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Skeleton", "Vampire"]);
  });

  it("filters by type - humanoid", () => {
    const results = searchMonsters(idx, { type: "humanoid" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Commoner", "Goblin"]);
  });

  it("filters by type - beast", () => {
    const results = searchMonsters(idx, { type: "beast" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Giant Spider");
  });

  it("filters by source MM", () => {
    const results = searchMonsters(idx, { source: "MM" });
    expect(results.length).toBe(8);
    expect(results.find(r => r.name === "Young Red Dragon")).toBeUndefined();
  });

  it("filters by source XMM (2024 ruleset)", () => {
    const results = searchMonsters(idx, { source: "XMM" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Young Red Dragon");
  });

  it("filters by ruleset 2014", () => {
    const results = searchMonsters(idx, { ruleset: "2014" });
    expect(results.length).toBe(8);
    expect(results.find(r => r.name === "Young Red Dragon")).toBeUndefined();
  });

  it("filters by ruleset 2024", () => {
    const results = searchMonsters(idx, { ruleset: "2024" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Young Red Dragon");
  });

  it("supports fuzzy name matching", () => {
    const results = searchMonsters(idx, { name: "dragon" });
    // Fuzzy matching returns sorted results up to limit (default 10)
    // The dragons should be first due to high scores
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Dragon");
    expect(results[1].name).toContain("Dragon");
    // Limit to 2 to get just the dragons
    const limited = searchMonsters(idx, { name: "dragon", limit: 2 });
    expect(limited.length).toBe(2);
    expect(limited.map(r => r.name).sort()).toEqual(["Ancient Red Dragon", "Young Red Dragon"]);
  });

  it("combines multiple filters - CR range and type", () => {
    const results = searchMonsters(idx, { cr_min: 10, type: "dragon" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Ancient Red Dragon", "Young Red Dragon"]);
  });

  it("combines multiple filters - CR max and type", () => {
    const results = searchMonsters(idx, { cr_max: 1, type: "humanoid" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Commoner", "Goblin"]);
  });

  it("returns empty results when no matches", () => {
    const results = searchMonsters(idx, { cr_min: 100 });
    expect(results.length).toBe(0);
  });

  it("handles high CR monsters correctly", () => {
    const results = searchMonsters(idx, { cr_min: 20 });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Ancient Red Dragon", "Tarrasque"]);
  });
});

describe("search_items", () => {
  let idx: SearchIndex;

  beforeAll(() => {
    idx = createTestIndex();
  });

  it("filters by rarity - none", () => {
    const results = searchItems(idx, { rarity: "none" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Longsword");
  });

  it("filters by rarity - common", () => {
    const results = searchItems(idx, { rarity: "common" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Healing Potion");
  });

  it("filters by rarity - uncommon", () => {
    const results = searchItems(idx, { rarity: "uncommon" });
    expect(results.length).toBe(3);
    expect(results.map(r => r.name).sort()).toEqual([
      "+1 Longsword",
      "Bag of Holding",
      "Cloak of Protection"
    ]);
  });

  it("filters by rarity - rare", () => {
    const results = searchItems(idx, { rarity: "rare" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Flame Tongue");
  });

  it("filters by rarity - very rare", () => {
    const results = searchItems(idx, { rarity: "very rare" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Staff of Power");
  });

  it("filters by rarity - legendary", () => {
    const results = searchItems(idx, { rarity: "legendary" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Holy Avenger", "Ring of Wishes"]);
  });

  it("filters by rarity - artifact", () => {
    const results = searchItems(idx, { rarity: "artifact" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Deck of Many Things");
  });

  it("filters by attunement - true", () => {
    const results = searchItems(idx, { attunement: true });
    expect(results.length).toBe(5);
    expect(results.map(r => r.name).sort()).toEqual([
      "Cloak of Protection",
      "Flame Tongue",
      "Holy Avenger",
      "Ring of Wishes",
      "Staff of Power"
    ]);
  });

  it("filters by attunement - false", () => {
    const results = searchItems(idx, { attunement: false });
    expect(results.length).toBe(5);
    expect(results.map(r => r.name).sort()).toEqual([
      "+1 Longsword",
      "Bag of Holding",
      "Deck of Many Things",
      "Healing Potion",
      "Longsword"
    ]);
  });

  it("filters by type - weapon", () => {
    const results = searchItems(idx, { type: "weapon" });
    expect(results.length).toBe(4);
    expect(results.map(r => r.name).sort()).toEqual([
      "+1 Longsword",
      "Flame Tongue",
      "Holy Avenger",
      "Longsword"
    ]);
  });

  it("filters by type - wondrous item", () => {
    const results = searchItems(idx, { type: "wondrous item" });
    expect(results.length).toBe(3);
    expect(results.map(r => r.name).sort()).toEqual([
      "Bag of Holding",
      "Cloak of Protection",
      "Deck of Many Things"
    ]);
  });

  it("filters by type - ring", () => {
    const results = searchItems(idx, { type: "ring" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Ring of Wishes");
  });

  it("filters by type - potion", () => {
    const results = searchItems(idx, { type: "potion" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Healing Potion");
  });

  it("filters by type - staff", () => {
    const results = searchItems(idx, { type: "staff" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Staff of Power");
  });

  it("filters by source DMG", () => {
    const results = searchItems(idx, { source: "DMG" });
    expect(results.length).toBe(9);
    expect(results.find(r => r.name === "Staff of Power")).toBeUndefined();
  });

  it("filters by source XDMG (2024 ruleset)", () => {
    const results = searchItems(idx, { source: "XDMG" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Staff of Power");
  });

  it("filters by ruleset 2014", () => {
    const results = searchItems(idx, { ruleset: "2014" });
    expect(results.length).toBe(9);
    expect(results.find(r => r.name === "Staff of Power")).toBeUndefined();
  });

  it("filters by ruleset 2024", () => {
    const results = searchItems(idx, { ruleset: "2024" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Staff of Power");
  });

  it("supports fuzzy name matching", () => {
    const results = searchItems(idx, { name: "sword" });
    // Fuzzy matching returns sorted results up to limit (default 10)
    // Items with "sword" in the name should be first due to high scores
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("sword");
    // Limit to 2 to get just the swords
    const limited = searchItems(idx, { name: "sword", limit: 2 });
    expect(limited.length).toBe(2);
    expect(limited.map(r => r.name).sort()).toEqual(["+1 Longsword", "Longsword"]);
  });

  it("combines multiple filters - rarity and attunement", () => {
    const results = searchItems(idx, { rarity: "legendary", attunement: true });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Holy Avenger", "Ring of Wishes"]);
  });

  it("combines multiple filters - rarity and type", () => {
    const results = searchItems(idx, { rarity: "uncommon", type: "weapon" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("+1 Longsword");
  });

  it("combines multiple filters - attunement and type", () => {
    const results = searchItems(idx, { attunement: true, type: "weapon" });
    expect(results.length).toBe(2);
    expect(results.map(r => r.name).sort()).toEqual(["Flame Tongue", "Holy Avenger"]);
  });

  it("returns empty results when no matches", () => {
    const results = searchItems(idx, { rarity: "artifact", type: "weapon" });
    expect(results.length).toBe(0);
  });

  it("respects limit parameter", () => {
    const results = searchItems(idx, { limit: 3 });
    expect(results.length).toBe(3);
  });
});

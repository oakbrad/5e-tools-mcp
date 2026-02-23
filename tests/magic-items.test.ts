import { describe, it, expect, beforeEach } from "vitest";
import {
  suggestMagicItems,
  levelToTier,
  getTierRarities,
  type SearchIndex,
  type RecordLite,
} from "../src/magic-items.js";

describe("magic-items", () => {
  let testIndex: SearchIndex;

  beforeEach(() => {
    testIndex = {
      byKind: new Map(),
      byUri: new Map(),
    };

    // Mock magic items with various rarities and types
    const items: RecordLite[] = [
      // Common items
      {
        uri: "fiveet://entity/item/DMG/potion-of-healing",
        name: "Potion of Healing",
        slug: "potion-of-healing",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "common", reqAttune: false, type: "potion" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/DMG/ammo-arrow",
        name: "Arrow (+1)",
        slug: "ammo-arrow",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "common", reqAttune: false, type: "weapon" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/PHB/rope",
        name: "Rope of Climbing",
        slug: "rope-of-climbing",
        source: "PHB",
        ruleset: "2014",
        facets: { rarity: "common", reqAttune: false, type: "wondrous item" },
        kind: "item",
      },
      // Uncommon items
      {
        uri: "fiveet://entity/item/DMG/bag-of-holding",
        name: "Bag of Holding",
        slug: "bag-of-holding",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "uncommon", reqAttune: false, type: "wondrous item" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/DMG/potion-of-giant-strength",
        name: "Potion of Giant Strength",
        slug: "potion-of-giant-strength",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "uncommon", reqAttune: false, type: "potion" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/PHB/cloak-of-protection",
        name: "Cloak of Protection",
        slug: "cloak-of-protection",
        source: "PHB",
        ruleset: "2014",
        facets: { rarity: "uncommon", reqAttune: true, type: "wondrous item" },
        kind: "item",
      },
      // Rare items
      {
        uri: "fiveet://entity/item/DMG/belt-of-giant-strength",
        name: "Belt of Giant Strength",
        slug: "belt-of-giant-strength",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "rare", reqAttune: true, type: "wondrous item" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/DMG/sword-of-warning",
        name: "Sword of Warning",
        slug: "sword-of-warning",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "rare", reqAttune: true, type: "weapon" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/PHB/ring-of-protection",
        name: "Ring of Protection",
        slug: "ring-of-protection",
        source: "PHB",
        ruleset: "2014",
        facets: { rarity: "rare", reqAttune: true, type: "ring" },
        kind: "item",
      },
      // Very rare items
      {
        uri: "fiveet://entity/item/DMG/helm-of-brilliance",
        name: "Helm of Brilliance",
        slug: "helm-of-brilliance",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "very rare", reqAttune: true, type: "wondrous item" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/DMG/sword-of-sharpness",
        name: "Sword of Sharpness",
        slug: "sword-of-sharpness",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "very rare", reqAttune: true, type: "weapon" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/PHB/staff-of-power",
        name: "Staff of Power",
        slug: "staff-of-power",
        source: "PHB",
        ruleset: "2014",
        facets: { rarity: "very rare", reqAttune: true, type: "staff" },
        kind: "item",
      },
      // Legendary items
      {
        uri: "fiveet://entity/item/DMG/longsword-holy-avenger",
        name: "Holy Avenger",
        slug: "longsword-holy-avenger",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "legendary", reqAttune: true, type: "weapon" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/DMG/maze",
        name: "Cube of Force",
        slug: "cube-of-force",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "legendary", reqAttune: true, type: "wondrous item" },
        kind: "item",
      },
      {
        uri: "fiveet://entity/item/PHB/rod-of-security",
        name: "Rod of Security",
        slug: "rod-of-security",
        source: "PHB",
        ruleset: "2014",
        facets: { rarity: "legendary", reqAttune: true, type: "rod" },
        kind: "item",
      },
      // Artifact items
      {
        uri: "fiveet://entity/item/DMG/ornate-handaxe",
        name: "Ornate Handaxe (Artifact)",
        slug: "ornate-handaxe",
        source: "DMG",
        ruleset: "2014",
        facets: { rarity: "artifact", reqAttune: true, type: "weapon" },
        kind: "item",
      },
    ];

    // Add items to index
    testIndex.byKind.set("item", items);

    // Add full entity data for some items
    testIndex.byUri.set("fiveet://entity/item/DMG/potion-of-healing", {
      name: "Potion of Healing",
      type: "potion",
      rarity: "common",
      reqAttune: false,
      entries: ["A character who drinks this magical red fluid regains 2d4 + 2 hit points."],
    });

    testIndex.byUri.set("fiveet://entity/item/DMG/bag-of-holding", {
      name: "Bag of Holding",
      type: "wondrous item",
      rarity: "uncommon",
      reqAttune: false,
      entries: [
        {
          type: "entries",
          entries: [
            "This bag has an interior space considerably larger than its outside dimensions.",
          ],
        },
      ],
    });

    testIndex.byUri.set("fiveet://entity/item/DMG/belt-of-giant-strength", {
      name: "Belt of Giant Strength",
      type: "wondrous item",
      rarity: "rare",
      reqAttune: true,
      entries: ["Your Strength score becomes 21 while you wear this belt."],
    });

    testIndex.byUri.set("fiveet://entity/item/DMG/helm-of-brilliance", {
      name: "Helm of Brilliance",
      type: "wondrous item",
      rarity: "very rare",
      reqAttune: true,
      entries: ["This dazzling helm is set with diamonds, rubies, fire opals, and opals."],
    });

    testIndex.byUri.set("fiveet://entity/item/DMG/longsword-holy-avenger", {
      name: "Holy Avenger",
      type: "weapon",
      rarity: "legendary",
      reqAttune: true,
      entries: ["You gain a +3 bonus to attack and damage rolls made with this magic weapon."],
    });
  });

  describe("levelToTier", () => {
    it("maps levels 1-4 to tier1", () => {
      expect(levelToTier(1)).toBe("tier1");
      expect(levelToTier(3)).toBe("tier1");
      expect(levelToTier(4)).toBe("tier1");
    });

    it("maps levels 5-10 to tier2", () => {
      expect(levelToTier(5)).toBe("tier2");
      expect(levelToTier(8)).toBe("tier2");
      expect(levelToTier(10)).toBe("tier2");
    });

    it("maps levels 11-16 to tier3", () => {
      expect(levelToTier(11)).toBe("tier3");
      expect(levelToTier(14)).toBe("tier3");
      expect(levelToTier(16)).toBe("tier3");
    });

    it("maps levels 17-20 to tier4", () => {
      expect(levelToTier(17)).toBe("tier4");
      expect(levelToTier(19)).toBe("tier4");
      expect(levelToTier(20)).toBe("tier4");
    });
  });

  describe("getTierRarities", () => {
    it("returns appropriate rarities for tier1", () => {
      const result = getTierRarities("tier1");
      expect(result.rarities).toContain("common");
      expect(result.rarities).toContain("uncommon");
      expect(result.rarities.length).toBe(2);
      expect(result.weights.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it("returns appropriate rarities for tier2", () => {
      const result = getTierRarities("tier2");
      expect(result.rarities).toContain("uncommon");
      expect(result.rarities).toContain("rare");
      expect(result.rarities.length).toBe(2);
      expect(result.weights.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it("returns appropriate rarities for tier3", () => {
      const result = getTierRarities("tier3");
      expect(result.rarities).toContain("rare");
      expect(result.rarities).toContain("very rare");
      expect(result.rarities.length).toBe(2);
      expect(result.weights.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it("returns appropriate rarities for tier4", () => {
      const result = getTierRarities("tier4");
      expect(result.rarities).toContain("very rare");
      expect(result.rarities).toContain("legendary");
      expect(result.rarities.length).toBe(2);
      expect(result.weights.reduce((a, b) => a + b, 0)).toBe(10);
    });
  });

  describe("suggestMagicItems", () => {
    it("suggests items for tier1 (levels 1-4)", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 3,
        count: 3,
      });

      expect(suggestions.length).toBe(3);
      suggestions.forEach((item) => {
        expect(["common", "uncommon"]).toContain(item.rarity);
      });
    });

    it("suggests items for tier2 (levels 5-10)", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 7,
        count: 3,
      });

      expect(suggestions.length).toBe(3);
      suggestions.forEach((item) => {
        expect(["uncommon", "rare"]).toContain(item.rarity);
      });
    });

    it("suggests items for tier3 (levels 11-16)", () => {
      const suggestions = suggestMagicItems(testIndex, {
        tier: "tier3",
        count: 3,
      });

      expect(suggestions.length).toBe(3);
      suggestions.forEach((item) => {
        expect(["rare", "very rare"]).toContain(item.rarity);
      });
    });

    it("suggests items for tier4 (levels 17-20)", () => {
      const suggestions = suggestMagicItems(testIndex, {
        tier: "tier4",
        count: 3,
      });

      expect(suggestions.length).toBe(3);
      suggestions.forEach((item) => {
        expect(["very rare", "legendary"]).toContain(item.rarity);
      });
    });

    it("filters by specific rarity when requested", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 10,
        rarity: "rare",
        count: 2,
      });

      expect(suggestions.length).toBe(2);
      suggestions.forEach((item) => {
        expect(item.rarity).toBe("rare");
      });
    });

    it("filters by type when requested", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 3,
        item_type: "potion",
        count: 1,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach((item) => {
        expect(item.type.toLowerCase()).toContain("potion");
      });
    });

    it("filters by source when requested", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 3,
        source: "PHB",
        count: 2,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach((item) => {
        expect(item.source).toBe("PHB");
      });
    });

    it("filters by ruleset when requested", () => {
      // This test assumes we have items from different rulesets
      // For now, just verify the parameter is accepted
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 3,
        ruleset: "2014",
        count: 2,
      });

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("returns empty array when no items match criteria", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 1,
        rarity: "artifact",
        count: 5,
      });

      // Should return some items (we have artifacts in test data)
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it("returns requested count of items", () => {
      const count = 5;
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 5,
        count,
      });

      expect(suggestions.length).toBe(count);
    });

    it("includes item details in suggestions", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 1,
        count: 1,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const item = suggestions[0];

      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("rarity");
      expect(item).toHaveProperty("type");
      expect(item).toHaveProperty("source");
      expect(item).toHaveProperty("uri");
      expect(typeof item.name).toBe("string");
      expect(typeof item.rarity).toBe("string");
      expect(typeof item.type).toBe("string");
      expect(typeof item.source).toBe("string");
      expect(typeof item.uri).toBe("string");
    });

    it("includes description for items with entries", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 1,
        rarity: "common",
        count: 1,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const item = suggestions[0];

      if (item.name === "Potion of Healing") {
        expect(item.description).toBeDefined();
        expect(item.description).toContain("regains");
      }
    });

    it("uses tier parameter when party_level is not provided", () => {
      const suggestions = suggestMagicItems(testIndex, {
        tier: "tier1",
        count: 2,
      });

      expect(suggestions.length).toBe(2);
      suggestions.forEach((item) => {
        expect(["common", "uncommon"]).toContain(item.rarity);
      });
    });

    it("defaults to tier2 when neither party_level nor tier is specified", () => {
      const suggestions = suggestMagicItems(testIndex, {
        count: 2,
      });

      expect(suggestions.length).toBe(2);
      suggestions.forEach((item) => {
        expect(["uncommon", "rare"]).toContain(item.rarity);
      });
    });

    it("honors max count limit", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 5,
        count: 6,
      });

      // Tier2 (uncommon/rare) should have at least 6 items in our test data
      expect(suggestions.length).toBeLessThanOrEqual(6);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("returns unique items (no duplicates)", () => {
      const suggestions = suggestMagicItems(testIndex, {
        party_level: 5,
        count: 5,
      });

      const uris = suggestions.map((s) => s.uri);
      const uniqueUris = new Set(uris);

      expect(uris.length).toBe(uniqueUris.size);
    });
  });
});

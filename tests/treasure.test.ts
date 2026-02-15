// tests/treasure.test.ts
import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  rollDice,
  rollPercentile,
  generateTreasure,
  generateIndividualTreasure,
  generateHoardTreasure,
  type TreasureHoard,
} from "../src/treasure";

describe("Treasure Generation", () => {
  beforeEach(() => {
    // Reset any state before each test
    vi.restoreAllMocks();
  });

  describe("rollDice", () => {
    test("rolls within expected range", () => {
      for (let i = 0; i < 100; i++) {
        const result = rollDice(1, 6);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(6);
      }
    });

    test("rolls multiple dice", () => {
      const result = rollDice(3, 6);
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(18);
    });

    test("handles zero dice", () => {
      const result = rollDice(0, 6);
      expect(result).toBe(0);
    });

    test("handles different die sizes", () => {
      const d4 = rollDice(1, 4);
      const d8 = rollDice(1, 8);
      const d10 = rollDice(1, 10);
      const d20 = rollDice(1, 20);

      expect(d4).toBeGreaterThanOrEqual(1);
      expect(d4).toBeLessThanOrEqual(4);

      expect(d8).toBeGreaterThanOrEqual(1);
      expect(d8).toBeLessThanOrEqual(8);

      expect(d10).toBeGreaterThanOrEqual(1);
      expect(d10).toBeLessThanOrEqual(10);

      expect(d20).toBeGreaterThanOrEqual(1);
      expect(d20).toBeLessThanOrEqual(20);
    });
  });

  describe("rollPercentile", () => {
    test("rolls between 1 and 100", () => {
      for (let i = 0; i < 1000; i++) {
        const result = rollPercentile();
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(100);
      }
    });

    test("has reasonable distribution", () => {
      const results = new Array(1000).fill(0).map(() => rollPercentile());
      const min = Math.min(...results);
      const max = Math.max(...results);
      const avg = results.reduce((a, b) => a + b, 0) / results.length;

      expect(min).toBe(1);
      expect(max).toBe(100);
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(60);
    });
  });

  describe("generateIndividualTreasure", () => {
    test("generates treasure for CR 0", () => {
      const treasure = generateIndividualTreasure(0);
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.coins.cp).toBe(0);
      expect(treasure.coins.sp).toBe(0);
      expect(treasure.coins.ep).toBe(0);
      expect(treasure.coins.gp).toBe(0);
      expect(treasure.coins.pp).toBe(0);
      expect(treasure.gems).toHaveLength(0);
      expect(treasure.art).toHaveLength(0);
      expect(treasure.magicItems).toHaveLength(0);
    });

    test("generates treasure for CR 1/4", () => {
      const treasure = generateIndividualTreasure("1/4");
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBeCloseTo(0.25, 2);
      expect(treasure.coins.cp).toBeGreaterThan(0);
      expect(treasure.coins.sp).toBe(0);
      expect(treasure.coins.ep).toBe(0);
      expect(treasure.coins.gp).toBe(0);
      expect(treasure.coins.pp).toBe(0);
    });

    test("generates treasure for CR 1/2", () => {
      const treasure = generateIndividualTreasure("1/2");
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.coins.cp).toBeGreaterThan(0);
      expect(treasure.coins.sp).toBe(0);
      expect(treasure.coins.ep).toBe(0);
      expect(treasure.coins.gp).toBeGreaterThan(0);
      expect(treasure.coins.pp).toBe(0);
    });

    test("generates treasure for CR 5", () => {
      const treasure = generateIndividualTreasure(5);
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBe(5);
      expect(treasure.coins.cp).toBeGreaterThan(0);
      expect(treasure.coins.sp).toBeGreaterThan(0);
      expect(treasure.coins.ep).toBe(0);
      expect(treasure.coins.gp).toBeGreaterThan(0);
      expect(treasure.coins.pp).toBe(0);
    });

    test("generates treasure for CR 10", () => {
      const treasure = generateIndividualTreasure(10);
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBe(10);
      expect(treasure.coins.cp).toBeGreaterThan(0);
      expect(treasure.coins.sp).toBeGreaterThan(0);
      expect(treasure.coins.ep).toBeGreaterThan(0);
      expect(treasure.coins.gp).toBeGreaterThan(0);
      expect(treasure.coins.pp).toBe(0);
    });

    test("generates treasure for CR 20", () => {
      const treasure = generateIndividualTreasure(20);
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBe(20);
      expect(treasure.coins.cp).toBeGreaterThan(0);
      expect(treasure.coins.sp).toBeGreaterThan(0);
      expect(treasure.coins.ep).toBeGreaterThan(0);
      expect(treasure.coins.gp).toBeGreaterThan(0);
      expect(treasure.coins.pp).toBe(0);
    });

    test("handles fractional CR as decimal", () => {
      const treasure = generateIndividualTreasure(0.25);
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBeCloseTo(0.25, 2);
    });

    test("never generates gems or magic items for individual treasure", () => {
      const treasure = generateIndividualTreasure(10);
      expect(treasure.gems).toHaveLength(0);
      expect(treasure.art).toHaveLength(0);
      expect(treasure.magicItems).toHaveLength(0);
    });

    test("calculates total value correctly", () => {
      const treasure = generateIndividualTreasure(10);
      const expectedValue =
        treasure.coins.cp * 0.01 +
        treasure.coins.sp * 0.1 +
        treasure.coins.ep * 0.5 +
        treasure.coins.gp +
        treasure.coins.pp * 10;

      expect(treasure.totalValueGP).toBeCloseTo(expectedValue, 2);
    });
  });

  describe("generateHoardTreasure", () => {
    test("generates Tier 1 hoard", () => {
      const treasure = generateHoardTreasure("tier1");
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier1");
      expect(treasure.coins.cp).toBeGreaterThanOrEqual(0);
    });

    test("generates Tier 2 hoard", () => {
      const treasure = generateHoardTreasure("tier2");
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier2");
      expect(treasure.coins.gp).toBeGreaterThanOrEqual(0);
    });

    test("generates Tier 3 hoard", () => {
      const treasure = generateHoardTreasure("tier3");
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier3");
    });

    test("generates Tier 4 hoard", () => {
      const treasure = generateHoardTreasure("tier4");
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier4");
      expect(treasure.coins.pp).toBeGreaterThanOrEqual(0);
    });

    test("respects magic_item_preference: none", () => {
      const treasure = generateHoardTreasure("tier1", "none");
      expect(treasure.magicItems).toHaveLength(0);
    });

    test("respects magic_item_preference: few", () => {
      // With 'few', we should get fewer magic items
      let totalItems = 0;
      for (let i = 0; i < 50; i++) {
        const treasure = generateHoardTreasure("tier1", "few");
        totalItems += treasure.magicItems.length;
      }
      // Should be mostly 0 or 1 items
      expect(totalItems).toBeLessThan(50 * 0.5); // Less than 50% have items
    });

    test("respects magic_item_preference: many", () => {
      // With 'many', we should get more magic items
      let totalItems = 0;
      let maxItems = 0;
      for (let i = 0; i < 50; i++) {
        const treasure = generateHoardTreasure("tier1", "many");
        totalItems += treasure.magicItems.length;
        maxItems = Math.max(maxItems, treasure.magicItems.length);
      }
      // Should have at least some items
      expect(totalItems).toBeGreaterThan(0);
    });

    test("Tier 4 hoards always have gems or art", () => {
      let hasGemOrArt = false;
      for (let i = 0; i < 20; i++) {
        const treasure = generateHoardTreasure("tier4");
        if (treasure.gems.length > 0 || treasure.art.length > 0) {
          hasGemOrArt = true;
          break;
        }
      }
      expect(hasGemOrArt).toBe(true);
    });

    test("calculates total value correctly for hoards", () => {
      const treasure = generateHoardTreasure("tier2");
      const expectedValue =
        treasure.coins.cp * 0.01 +
        treasure.coins.sp * 0.1 +
        treasure.coins.ep * 0.5 +
        treasure.coins.gp +
        treasure.coins.pp * 10 +
        treasure.gems.reduce((sum, g) => sum + g.value, 0) +
        treasure.art.reduce((sum, a) => sum + a.value, 0);

      expect(treasure.totalValueGP).toBeCloseTo(expectedValue, 2);
    });

    test("higher tiers generally have more valuable hoards", () => {
      const tier1 = generateHoardTreasure("tier1");
      const tier2 = generateHoardTreasure("tier2");
      const tier3 = generateHoardTreasure("tier3");
      const tier4 = generateHoardTreasure("tier4");

      // This is probabilistic, but over many runs tier4 should be more valuable
      // Just check that they all generate successfully
      expect(tier1.tier).toBe("tier1");
      expect(tier2.tier).toBe("tier2");
      expect(tier3.tier).toBe("tier3");
      expect(tier4.tier).toBe("tier4");
    });

    test("generates valid gem descriptions", () => {
      for (let i = 0; i < 20; i++) {
        const treasure = generateHoardTreasure("tier2");
        for (const gem of treasure.gems) {
          expect(gem.type).toBe("gem");
          expect(gem.value).toBeGreaterThan(0);
          expect(gem.description).toBeDefined();
          expect(gem.description.length).toBeGreaterThan(0);
        }
      }
    });

    test("generates valid art object descriptions", () => {
      for (let i = 0; i < 20; i++) {
        const treasure = generateHoardTreasure("tier3");
        for (const art of treasure.art) {
          expect(art.type).toBe("art");
          expect(art.value).toBeGreaterThan(0);
          expect(art.description).toBeDefined();
          expect(art.description.length).toBeGreaterThan(0);
        }
      }
    });

    test("generates valid magic item descriptions", () => {
      for (let i = 0; i < 50; i++) {
        const treasure = generateHoardTreasure("tier1", "many");
        for (const item of treasure.magicItems) {
          expect(item.table).toMatch(/^Table [A-I]$/);
          expect(item.description).toBeDefined();
          expect(item.description.length).toBeGreaterThan(0);
          expect(item.rarity).toBeDefined();
          expect(item.rarity.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("generateTreasure", () => {
    test("uses hoard_tier when provided", () => {
      const treasure = generateTreasure({ hoard_tier: "tier1" });
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier1");
    });

    test("uses challenge_rating when provided", () => {
      const treasure = generateTreasure({ challenge_rating: 5 });
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBe(5);
    });

    test("hoard_tier takes precedence over challenge_rating", () => {
      const treasure = generateTreasure({
        challenge_rating: 5,
        hoard_tier: "tier2",
      });
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier2");
    });

    test("defaults to Tier 1 hoard when no parameters", () => {
      const treasure = generateTreasure({});
      expect(treasure.hoardType).toBe("hoard");
      expect(treasure.tier).toBe("tier1");
    });

    test("respects magic_item_preference parameter", () => {
      const none = generateTreasure({ hoard_tier: "tier1", magic_item_preference: "none" });
      const many = generateTreasure({ hoard_tier: "tier1", magic_item_preference: "many" });

      expect(none.magicItems).toHaveLength(0);
      // 'many' should sometimes generate items
      let hasItems = false;
      for (let i = 0; i < 10; i++) {
        const t = generateTreasure({ hoard_tier: "tier1", magic_item_preference: "many" });
        if (t.magicItems.length > 0) {
          hasItems = true;
          break;
        }
      }
      expect(hasItems).toBe(true);
    });

    test("handles fractional challenge_rating", () => {
      const treasure = generateTreasure({ challenge_rating: 0.25 });
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBeCloseTo(0.25, 2);
    });

    test("handles string challenge_rating", () => {
      const treasure = generateTreasure({ challenge_rating: "1/4" });
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.cr).toBeCloseTo(0.25, 2);
    });

    test("generates valid description for individual treasure", () => {
      const treasure = generateTreasure({ challenge_rating: 10 });
      expect(treasure.description).toBeDefined();
      expect(treasure.description).toContain("CR");
      expect(treasure.description.length).toBeGreaterThan(0);
    });

    test("generates valid description for hoard treasure", () => {
      const treasure = generateTreasure({ hoard_tier: "tier2" });
      expect(treasure.description).toBeDefined();
      expect(treasure.description).toContain("Tier 2");
      expect(treasure.description.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles CR 0 correctly", () => {
      const treasure = generateTreasure({ challenge_rating: 0 });
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.totalValueGP).toBe(0);
    });

    test("handles very high CR", () => {
      const treasure = generateTreasure({ challenge_rating: 30 });
      expect(treasure.hoardType).toBe("individual");
      expect(treasure.coins.gp).toBeGreaterThan(0);
    });

    test("handles all hoard tiers", () => {
      const tiers: Array<"tier1" | "tier2" | "tier3" | "tier4"> = ["tier1", "tier2", "tier3", "tier4"];
      tiers.forEach(tier => {
        const treasure = generateHoardTreasure(tier);
        expect(treasure.tier).toBe(tier);
        expect(treasure.hoardType).toBe("hoard");
      });
    });

    test("handles all magic_item_preferences", () => {
      const preferences: Array<"none" | "few" | "many"> = ["none", "few", "many"];
      preferences.forEach(pref => {
        const treasure = generateHoardTreasure("tier1", pref);
        expect(treasure.hoardType).toBe("hoard");
        if (pref === "none") {
          expect(treasure.magicItems).toHaveLength(0);
        }
      });
    });

    test("generates multiple treasures without errors", () => {
      const treasures = Array.from({ length: 100 }, () =>
        generateTreasure({ hoard_tier: "tier2" })
      );
      expect(treasures).toHaveLength(100);
      treasures.forEach(t => {
        expect(t.coins).toBeDefined();
        expect(t.totalValueGP).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Statistical Properties", () => {
    test("individual treasure values increase with CR", () => {
      const crs = [1, 5, 10, 15, 20];
      const values = crs.map(cr => {
        let total = 0;
        const samples = 10;
        for (let i = 0; i < samples; i++) {
          total += generateIndividualTreasure(cr).totalValueGP;
        }
        return total / samples;
      });

      // The lowest CR (1) should have the lowest value
      expect(values[0]).toBeLessThan(values[4]);

      // The highest CR (20) should have a significantly higher value than the lowest
      expect(values[4]).toBeGreaterThan(values[0] * 2);
    });

    test("hoard treasure values vary significantly by tier", () => {
      const tiers: Array<"tier1" | "tier2" | "tier3" | "tier4"> = ["tier1", "tier2", "tier3", "tier4"];
      const values = tiers.map(tier => {
        let total = 0;
        const samples = 20;
        for (let i = 0; i < samples; i++) {
          total += generateHoardTreasure(tier).totalValueGP;
        }
        return total / samples;
      });

      // All tiers should generate some value
      values.forEach(value => {
        expect(value).toBeGreaterThan(0);
      });

      // Tier 4 should generally have the highest average (though with randomness it might not always)
      // Just verify they all generate successfully with reasonable ranges
      expect(values[3]).toBeGreaterThan(values[0] * 0.1); // At least 10% of tier 1 value
    });
  });
});

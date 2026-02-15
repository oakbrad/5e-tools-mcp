// tests/encounter-builder.test.ts
import { describe, test, expect } from "vitest";
import {
  calculatePartyThresholds,
  evaluateEncounter,
  suggestEncounters,
  normalizeCR,
  getXPForCR,
  getEncounterMultiplier,
  getDifficulty,
  type MonsterEntry,
} from "../src/encounter";

describe("Encounter Builder", () => {
  describe("normalizeCR", () => {
    test("handles fractional strings", () => {
      expect(normalizeCR("1/8")).toBe("1/8");
      expect(normalizeCR("1/4")).toBe("1/4");
      expect(normalizeCR("1/2")).toBe("1/2");
    });

    test("converts decimal to fractional strings", () => {
      expect(normalizeCR(0.125)).toBe("1/8");
      expect(normalizeCR(0.25)).toBe("1/4");
      expect(normalizeCR(0.5)).toBe("1/2");
    });

    test("handles integer CRs", () => {
      expect(normalizeCR(1)).toBe("1");
      expect(normalizeCR(5)).toBe("5");
      expect(normalizeCR(20)).toBe("20");
      expect(normalizeCR("3")).toBe("3");
    });
  });

  describe("getXPForCR", () => {
    test("returns correct XP for fractional CRs", () => {
      expect(getXPForCR("1/8")).toBe(25);
      expect(getXPForCR("1/4")).toBe(50);
      expect(getXPForCR("1/2")).toBe(100);
      expect(getXPForCR(0.125)).toBe(25);
      expect(getXPForCR(0.25)).toBe(50);
      expect(getXPForCR(0.5)).toBe(100);
    });

    test("returns correct XP for integer CRs", () => {
      expect(getXPForCR(0)).toBe(0);
      expect(getXPForCR(1)).toBe(200);
      expect(getXPForCR(5)).toBe(1800);
      expect(getXPForCR(10)).toBe(5900);
      expect(getXPForCR(20)).toBe(25000);
    });

    test("returns 0 for unknown CRs", () => {
      expect(getXPForCR(999)).toBe(0);
    });
  });

  describe("getEncounterMultiplier", () => {
    test("returns correct multiplier for standard party (4 PCs)", () => {
      expect(getEncounterMultiplier(1, 4)).toBe(1);
      expect(getEncounterMultiplier(2, 4)).toBe(1.5);
      expect(getEncounterMultiplier(3, 4)).toBe(2);
      expect(getEncounterMultiplier(6, 4)).toBe(2);
      expect(getEncounterMultiplier(7, 4)).toBe(2.5);
      expect(getEncounterMultiplier(10, 4)).toBe(2.5);
      expect(getEncounterMultiplier(11, 4)).toBe(3);
      expect(getEncounterMultiplier(15, 4)).toBe(4);
      expect(getEncounterMultiplier(20, 4)).toBe(4);
    });

    test("increases multiplier for small parties (< 3 PCs)", () => {
      // Small party uses next highest multiplier
      expect(getEncounterMultiplier(1, 2)).toBe(1.5); // normally 1, increased to 1.5
      expect(getEncounterMultiplier(2, 2)).toBe(2);   // normally 1.5, increased to 2
      expect(getEncounterMultiplier(3, 2)).toBe(2.5); // normally 2, increased to 2.5
    });

    test("decreases multiplier for large parties (6+ PCs)", () => {
      // Large party uses next lowest multiplier
      expect(getEncounterMultiplier(2, 6)).toBe(1);   // normally 1.5, decreased to 1
      expect(getEncounterMultiplier(3, 6)).toBe(1.5); // normally 2, decreased to 1.5
      expect(getEncounterMultiplier(7, 6)).toBe(2);   // normally 2.5, decreased to 2
    });
  });

  describe("calculatePartyThresholds", () => {
    test("calculates thresholds for single character", () => {
      const result = calculatePartyThresholds([3]);
      expect(result).toEqual({
        partySize: 1,
        easy: 75,
        medium: 150,
        hard: 225,
        deadly: 400,
        dailyBudget: 1200,
      });
    });

    test("calculates thresholds for example party from DMG", () => {
      // Three 3rd-level + one 2nd-level (from reference doc example)
      const result = calculatePartyThresholds([3, 3, 3, 2]);
      expect(result).toEqual({
        partySize: 4,
        easy: 275,   // 75 + 75 + 75 + 50
        medium: 550, // 150 + 150 + 150 + 100
        hard: 825,   // 225 + 225 + 225 + 150
        deadly: 1400, // 400 + 400 + 400 + 200
        dailyBudget: 4200, // 1200 + 1200 + 1200 + 600
      });
    });

    test("calculates thresholds for high-level party", () => {
      const result = calculatePartyThresholds([15, 16, 17, 18]);
      expect(result.partySize).toBe(4);
      expect(result.easy).toBe(7100); // 1400 + 1600 + 2000 + 2100
      expect(result.medium).toBe(14100); // 2800 + 3200 + 3900 + 4200
      expect(result.hard).toBe(21300); // 4300 + 4800 + 5900 + 6300
      expect(result.deadly).toBe(31900); // 6400 + 7200 + 8800 + 9500
    });

    test("throws error for invalid level", () => {
      expect(() => calculatePartyThresholds([0])).toThrow("Invalid character level");
      expect(() => calculatePartyThresholds([21])).toThrow("Invalid character level");
    });
  });

  describe("getDifficulty", () => {
    const thresholds = {
      partySize: 4,
      easy: 100,
      medium: 200,
      hard: 300,
      deadly: 400,
      dailyBudget: 1000,
    };

    test("classifies Trivial encounters", () => {
      expect(getDifficulty(50, thresholds)).toBe("Trivial");
      expect(getDifficulty(99, thresholds)).toBe("Trivial");
    });

    test("classifies Easy encounters", () => {
      expect(getDifficulty(100, thresholds)).toBe("Easy");
      expect(getDifficulty(150, thresholds)).toBe("Easy");
      expect(getDifficulty(199, thresholds)).toBe("Easy");
    });

    test("classifies Medium encounters", () => {
      expect(getDifficulty(200, thresholds)).toBe("Medium");
      expect(getDifficulty(250, thresholds)).toBe("Medium");
      expect(getDifficulty(299, thresholds)).toBe("Medium");
    });

    test("classifies Hard encounters", () => {
      expect(getDifficulty(300, thresholds)).toBe("Hard");
      expect(getDifficulty(350, thresholds)).toBe("Hard");
      expect(getDifficulty(399, thresholds)).toBe("Hard");
    });

    test("classifies Deadly encounters", () => {
      expect(getDifficulty(400, thresholds)).toBe("Deadly");
      expect(getDifficulty(500, thresholds)).toBe("Deadly");
      expect(getDifficulty(1000, thresholds)).toBe("Deadly");
    });
  });

  describe("evaluateEncounter", () => {
    test("evaluates DMG example encounter (p.82)", () => {
      // Party of 3x 3rd-level + 1x 2nd-level
      // 4 monsters worth 500 XP total → 500 × 2 = 1,000 adjusted XP → Hard
      const party = [3, 3, 3, 2];
      const monsters: MonsterEntry[] = [
        { cr: 1, count: 4 }, // 4× CR 1 = 4 × 200 = 800 XP base (close to example)
      ];

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(800);
      expect(result.multiplier).toBe(2); // 4 monsters
      expect(result.adjustedXP).toBe(1600);
      expect(result.difficulty).toBe("Deadly"); // 1600 > 1400 deadly threshold
      expect(result.partyThresholds.hard).toBe(825);
      expect(result.partyThresholds.deadly).toBe(1400);
    });

    test("evaluates solo monster encounter", () => {
      const party = [5, 5, 5, 5];
      const monsters: MonsterEntry[] = [{ cr: 5 }]; // 1× CR 5 = 1800 XP

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(1800);
      expect(result.multiplier).toBe(1); // 1 monster, standard party
      expect(result.adjustedXP).toBe(1800);
      expect(result.difficulty).toBe("Easy"); // 1800 is between easy (1000) and medium (2000)
    });

    test("evaluates encounter with fractional CR monsters", () => {
      const party = [1, 1];
      const monsters: MonsterEntry[] = [
        { cr: "1/4", count: 4 }, // 4× 50 = 200 XP base
      ];

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(200);
      expect(result.multiplier).toBe(2.5); // 4 monsters, small party (2 PCs)
      expect(result.adjustedXP).toBe(500);
      expect(result.monsters).toHaveLength(1);
      expect(result.monsters[0]).toEqual({ cr: "1/4", count: 4, xp: 50 });
    });

    test("evaluates encounter with mixed CRs", () => {
      const party = [10, 10, 10, 10];
      const monsters: MonsterEntry[] = [
        { cr: 8, count: 1 },  // 3900 XP
        { cr: 6, count: 2 },  // 2× 2300 = 4600 XP
      ];

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(8500); // 3900 + 4600
      expect(result.multiplier).toBe(2); // 3 monsters
      expect(result.adjustedXP).toBe(17000);
      expect(result.monsters).toHaveLength(2);
    });

    test("handles monsters with default count of 1", () => {
      const party = [3];
      const monsters: MonsterEntry[] = [{ cr: 2 }]; // count defaults to 1

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(450);
      expect(result.monsters[0].count).toBe(1);
    });

    test("adjusts multiplier for large party", () => {
      const party = [5, 5, 5, 5, 5, 5]; // 6 PCs
      const monsters: MonsterEntry[] = [{ cr: 5, count: 3 }]; // 3 monsters

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(5400); // 3 × 1800
      // 3 monsters normally = ×2, but large party (6 PCs) = ×1.5
      expect(result.multiplier).toBe(1.5);
      expect(result.adjustedXP).toBe(8100);
    });
  });

  describe("suggestEncounters", () => {
    test("suggests easy encounters for low-level party", () => {
      const party = [1, 1, 1, 1];
      const suggestions = suggestEncounters(party, "easy");

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.difficulty).toMatch(/^(Trivial|Easy)$/);
        expect(suggestion.adjustedXP).toBeGreaterThanOrEqual(100); // easy threshold
        expect(suggestion.adjustedXP).toBeLessThan(200); // medium threshold
      });
    });

    test("suggests medium encounters for mid-level party", () => {
      const party = [5, 5, 5, 5];
      const suggestions = suggestEncounters(party, "medium");

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.difficulty).toMatch(/^(Easy|Medium)$/);
        // Medium threshold: 2000, Hard threshold: 3000
        expect(suggestion.adjustedXP).toBeGreaterThanOrEqual(2000);
        expect(suggestion.adjustedXP).toBeLessThan(3000);
      });
    });

    test("suggests hard encounters for high-level party", () => {
      const party = [10, 10, 10, 10];
      const suggestions = suggestEncounters(party, "hard");

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.difficulty).toMatch(/^(Medium|Hard)$/);
      });
    });

    test("respects custom monster count", () => {
      const party = [5, 5, 5, 5];
      const suggestions = suggestEncounters(party, "medium", { monsterCount: 2 });

      suggestions.forEach(suggestion => {
        const totalMonsters = suggestion.monsters.reduce((sum, m) => sum + m.count, 0);
        expect(totalMonsters).toBe(2);
      });
    });

    test("respects CR range filters", () => {
      const party = [5, 5, 5, 5];
      const suggestions = suggestEncounters(party, "medium", {
        crMin: 1000, // CR 5 = 1800 XP (minimum)
        crMax: 3000, // CR 7 = 2900 XP (maximum)
      });

      suggestions.forEach(suggestion => {
        suggestion.monsters.forEach(monster => {
          const xp = getXPForCR(monster.cr);
          expect(xp).toBeGreaterThanOrEqual(1000);
          expect(xp).toBeLessThanOrEqual(3000);
        });
      });
    });

    test("generates diverse encounter options", () => {
      const party = [5, 5, 5, 5];
      const suggestions = suggestEncounters(party, "medium", { monsterCount: 3 });

      // Should have both same-CR and mixed-CR suggestions
      const allSameCR = suggestions.every(s => s.monsters.length === 1);
      const allMixedCR = suggestions.every(s => s.monsters.length > 1);

      // At least some variety (not all same-CR and not all mixed-CR)
      expect(allSameCR || allMixedCR).toBe(false);
    });

    test("returns empty array when constraints are impossible", () => {
      const party = [1, 1];
      const suggestions = suggestEncounters(party, "deadly", {
        crMin: 10000, // No low-CR monsters can meet deadly threshold
        crMax: 10000,
      });

      expect(suggestions.length).toBe(0);
    });

    test("defaults to 1 monster per 4 PCs", () => {
      const party = [5, 5, 5, 5, 5, 5, 5, 5]; // 8 PCs
      const suggestions = suggestEncounters(party, "medium");

      // Should default to 2 monsters (8 / 4 = 2)
      const hasCorrectDefault = suggestions.some(s => {
        const total = s.monsters.reduce((sum, m) => sum + m.count, 0);
        return total === 2;
      });

      expect(hasCorrectDefault).toBe(true);
    });

    test("sorts suggestions by proximity to target difficulty", () => {
      const party = [5, 5, 5, 5];
      const suggestions = suggestEncounters(party, "medium");

      // Medium range: 2000-2999 XP
      const targetMid = (2000 + 2999) / 2;

      // Check that suggestions are sorted by distance from target
      for (let i = 1; i < suggestions.length; i++) {
        const prev = Math.abs(suggestions[i - 1].adjustedXP - targetMid);
        const curr = Math.abs(suggestions[i].adjustedXP - targetMid);
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });

  describe("Edge Cases", () => {
    test("handles CR 0 monsters", () => {
      const party = [1];
      const monsters: MonsterEntry[] = [{ cr: 0, count: 5 }];

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(0);
      expect(result.adjustedXP).toBe(0);
      expect(result.difficulty).toBe("Trivial");
    });

    test("handles very high CR monsters", () => {
      const party = [20, 20, 20, 20];
      const monsters: MonsterEntry[] = [{ cr: 30 }];

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(155000);
      expect(result.difficulty).toBe("Deadly");
    });

    test("handles single-character party", () => {
      const party = [5];
      const monsters: MonsterEntry[] = [{ cr: 2 }];

      const result = evaluateEncounter(party, monsters);

      // Single PC = small party, increased multiplier
      expect(result.multiplier).toBe(1.5); // 1 monster, small party
      expect(result.partyThresholds.partySize).toBe(1);
    });

    test("handles large monster horde", () => {
      const party = [10, 10, 10, 10];
      const monsters: MonsterEntry[] = [{ cr: 1, count: 20 }]; // 20 CR 1 monsters

      const result = evaluateEncounter(party, monsters);

      expect(result.totalBaseXP).toBe(4000); // 20 × 200
      expect(result.multiplier).toBe(4); // 15+ monsters
      expect(result.adjustedXP).toBe(16000);
    });
  });
});

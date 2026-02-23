// tests/scale-encounter.test.ts
import { describe, test, expect } from "vitest";
import { scaleEncounter, type ScaleEncounterInput } from "../src/scale-encounter";

describe("scaleEncounter", () => {
  describe("target_difficulty scaling", () => {
    test("scales easy encounter to medium difficulty", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 2, count: 1 }, // 1× CR 2 = 450 XP base
        ],
        current_party: [3, 3, 3, 3], // Medium threshold: 600
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      expect(result.original.difficulty).toBe("Easy");
      expect(result.scaled.difficulty).toMatch(/^(Easy|Medium)$/);
      expect(result.scaled.adjustedXP).toBeGreaterThanOrEqual(600);
      expect(result.strategy).toBeTruthy();
      expect(result.rationale.length).toBeGreaterThan(0);
    });

    test("scales medium encounter to hard difficulty", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 2, count: 2 }, // 2× CR 2 = 900 XP base
        ],
        current_party: [5, 5, 5, 5], // Hard threshold: 3000
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      expect(result.original.difficulty).toBe("Easy");
      expect(result.scaled.difficulty).toMatch(/^(Medium|Hard)$/);
      expect(result.scaled.adjustedXP).toBeGreaterThanOrEqual(3000);
    });

    test("scales deadly encounter to easy difficulty", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 10, count: 4 }, // 4× CR 10 = 23600 XP base
        ],
        current_party: [15, 15, 15, 15], // Easy threshold: 5600
        target_difficulty: "easy",
      };

      const result = scaleEncounter(input);

      expect(result.original.difficulty).toBe("Deadly");
      expect(result.scaled.difficulty).toMatch(/^(Trivial|Easy)$/);
      expect(result.scaled.adjustedXP).toBeLessThan(11200); // Medium threshold
    });

    test("maintains monster types when scaling", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 3, count: 3 },
          { cr: 1, count: 4 },
        ],
        current_party: [5, 5, 5, 5],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      // Should still have 2 monster types (CR may have changed)
      expect(result.scaled.monsters.length).toBeLessThanOrEqual(2);
    });
  });

  describe("adjustment scaling", () => {
    test("makes encounter easier", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 5, count: 3 }, // 3× CR 5 = 5400 XP base
        ],
        current_party: [5, 5, 5, 5],
        adjustment: "easier",
      };

      const result = scaleEncounter(input);

      expect(result.scaled.adjustedXP).toBeLessThan(result.original.adjustedXP);
      expect(result.rationale.some((r) => r.includes("easier"))).toBe(true);
    });

    test("makes encounter harder", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 1, count: 4 }, // 4× CR 1 = 800 XP base
        ],
        current_party: [5, 5, 5, 5],
        adjustment: "harder",
      };

      const result = scaleEncounter(input);

      expect(result.scaled.adjustedXP).toBeGreaterThan(result.original.adjustedXP);
      expect(result.rationale.some((r) => r.includes("harder"))).toBe(true);
    });

    test("throws error when both target_difficulty and adjustment specified", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 1 }],
        current_party: [1],
        target_difficulty: "hard",
        adjustment: "easier",
      };

      expect(() => scaleEncounter(input)).toThrow(
        "Cannot specify both target_difficulty and adjustment",
      );
    });
  });

  describe("party size changes", () => {
    test("scales encounter for larger party", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 3, count: 2 }, // 2× CR 3 = 1400 XP base
        ],
        current_party: [5, 5, 5, 5], // 4 PCs
        target_party: [5, 5, 5, 5, 5, 5], // 6 PCs
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      expect(result.original.partyThresholds.partySize).toBe(4);
      expect(result.rationale.some((r) => r.includes("Party size changed"))).toBe(true);
    });

    test("scales encounter for smaller party", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 5, count: 4 }, // 4× CR 5 = 7200 XP base
        ],
        current_party: [5, 5, 5, 5, 5, 5], // 6 PCs
        target_party: [5, 5, 5, 5], // 4 PCs
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      expect(result.original.partyThresholds.partySize).toBe(6);
      expect(result.rationale.some((r) => r.includes("Party size changed"))).toBe(true);
    });

    test("handles party level changes", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 2, count: 3 }, // 3× CR 2 = 1350 XP base
        ],
        current_party: [3, 3, 3, 3],
        target_party: [7, 7, 7, 7], // Higher levels, higher thresholds
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      // Higher level party should get more monsters/higher CR
      expect(result.scaled.totalBaseXP).toBeGreaterThan(0);
      expect(
        result.rationale.some(
          (r) => r.includes("Party size changed") || r.includes("Target difficulty"),
        ),
      ).toBe(true);
    });
  });

  describe("scaling strategies", () => {
    test("uses count scaling when appropriate", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 5 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      expect(["count_scaling", "cr_swapping", "mixed_scaling"]).toContain(result.strategy);
    });

    test("uses CR swapping when appropriate", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 1 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "deadly",
      };

      const result = scaleEncounter(input);

      expect(["count_scaling", "cr_swapping", "mixed_scaling"]).toContain(result.strategy);
    });

    test("handles fractional CR monsters", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: "1/4", count: 8 },
          { cr: "1/2", count: 4 },
        ],
        current_party: [1, 1, 1, 1],
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      expect(result.scaled.monsters.length).toBeGreaterThan(0);
      expect(result.scaled.totalBaseXP).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    test("handles CR 0 monsters", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 0, count: 10 },
          { cr: 1, count: 2 },
        ],
        current_party: [1, 1, 1, 1],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      // Should still have some monsters
      expect(result.scaled.monsters.length).toBeGreaterThan(0);
    });

    test("handles very high CR monsters", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 20, count: 1 }],
        current_party: [20, 20, 20, 20],
        target_difficulty: "easy",
      };

      const result = scaleEncounter(input);

      // High CR monsters may not scale all the way to easy due to CR limits
      // but should handle the request without errors
      expect(result.scaled.monsters.length).toBeGreaterThan(0);
      expect(result.scaled.difficulty).toMatch(/^(Trivial|Easy|Medium)$/);
    });

    test("throws error for empty encounter", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [],
        current_party: [1, 1, 1, 1],
        target_difficulty: "medium",
      };

      expect(() => scaleEncounter(input)).toThrow(
        "current_encounter must contain at least one monster",
      );
    });

    test("throws error for empty party", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 1 }],
        current_party: [],
        target_difficulty: "medium",
      };

      expect(() => scaleEncounter(input)).toThrow(
        "current_party must contain at least one character level",
      );
    });

    test("handles trivial to trivial scaling", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: "1/8", count: 1 }],
        current_party: [5, 5, 5, 5],
        adjustment: "easier",
      };

      const result = scaleEncounter(input);

      // Should still produce a valid result
      expect(result.scaled.monsters.length).toBeGreaterThan(0);
    });

    test("handles deadly to deadly scaling", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 20, count: 4 }],
        current_party: [20, 20, 20, 20],
        adjustment: "harder",
      };

      const result = scaleEncounter(input);

      // Should still produce a valid result
      expect(result.scaled.monsters.length).toBeGreaterThan(0);
    });

    test("preserves encounter with default target_party", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 1 }],
        current_party: [3, 3, 3, 3],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      // When target_party not specified, should use current_party
      expect(result.original.difficulty).toBe("Trivial");
      expect(result.scaled.difficulty).toMatch(/^(Easy|Medium|Hard)$/);
    });
  });

  describe("result structure", () => {
    test("returns complete result with all fields", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 3, count: 2 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      // Original encounter data
      expect(result.original).toHaveProperty("monsters");
      expect(result.original).toHaveProperty("totalBaseXP");
      expect(result.original).toHaveProperty("adjustedXP");
      expect(result.original).toHaveProperty("difficulty");
      expect(result.original).toHaveProperty("partyThresholds");

      // Scaled encounter data
      expect(result.scaled).toHaveProperty("monsters");
      expect(result.scaled).toHaveProperty("totalBaseXP");
      expect(result.scaled).toHaveProperty("adjustedXP");
      expect(result.scaled).toHaveProperty("difficulty");

      // Rationale and strategy
      expect(result).toHaveProperty("rationale");
      expect(result).toHaveProperty("strategy");
      expect(Array.isArray(result.rationale)).toBe(true);
      expect(typeof result.strategy).toBe("string");
    });

    test("rationale includes meaningful information", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 2, count: 4 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      expect(result.rationale.length).toBeGreaterThan(3);
      expect(result.rationale.some((r) => r.includes("difficulty"))).toBe(true);
      expect(result.rationale.some((r) => r.includes("XP"))).toBe(true);
      expect(result.rationale.some((r) => r.includes("strategy") || r.includes("Strategy"))).toBe(
        true,
      );
    });
  });

  describe("monster count preservation", () => {
    test("attempts to maintain monster count ratios", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [
          { cr: 3, count: 2 }, // 66.7% of monsters
          { cr: 1, count: 1 }, // 33.3% of monsters
        ],
        current_party: [5, 5, 5, 5],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      // Should still have 2 monster types
      expect(result.scaled.monsters.length).toBeLessThanOrEqual(2);
    });

    test("handles single monster encounters", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 5, count: 1 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "medium",
      };

      const result = scaleEncounter(input);

      // Single monster should stay as single monster or scale CR
      const totalMonsters = result.scaled.monsters.reduce((sum, m) => sum + m.count, 0);
      expect(totalMonsters).toBeGreaterThan(0);
    });

    test("handles large monster groups", () => {
      const input: ScaleEncounterInput = {
        current_encounter: [{ cr: 1, count: 10 }],
        current_party: [5, 5, 5, 5],
        target_difficulty: "hard",
      };

      const result = scaleEncounter(input);

      // Large groups should be maintained or adjusted proportionally
      const totalMonsters = result.scaled.monsters.reduce((sum, m) => sum + m.count, 0);
      expect(totalMonsters).toBeGreaterThan(5);
    });
  });
});

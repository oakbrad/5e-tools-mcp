// src/encounter.ts
// Encounter building logic based on DMG 2014 Chapter 13

import { searchMonsters, type SearchIndex } from "./search.js";

/** XP Thresholds by Character Level (DMG p.82) */
const XP_THRESHOLDS: Record<
  number,
  { easy: number; medium: number; hard: number; deadly: number }
> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

/** Daily XP Budget per Character (DMG p.84) */
const DAILY_XP: Record<number, number> = {
  1: 300,
  2: 600,
  3: 1200,
  4: 1700,
  5: 3500,
  6: 4000,
  7: 5000,
  8: 6000,
  9: 7500,
  10: 9000,
  11: 10500,
  12: 11500,
  13: 13500,
  14: 15000,
  15: 18000,
  16: 20000,
  17: 25000,
  18: 27000,
  19: 30000,
  20: 40000,
};

/** CR to XP mapping (DMG p.274-282 + Monster Manual) */
export const CR_TO_XP: Record<string, number> = {
  "0": 0,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

/** Encounter multiplier table (DMG p.82) */
export const ENCOUNTER_MULTIPLIERS: Array<{ min: number; max: number; multiplier: number }> = [
  { min: 1, max: 1, multiplier: 1 },
  { min: 2, max: 2, multiplier: 1.5 },
  { min: 3, max: 6, multiplier: 2 },
  { min: 7, max: 10, multiplier: 2.5 },
  { min: 11, max: 14, multiplier: 3 },
  { min: 15, max: Infinity, multiplier: 4 },
];

export type Difficulty = "Trivial" | "Easy" | "Medium" | "Hard" | "Deadly";

export interface PartyThresholds {
  partySize: number;
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
  dailyBudget: number;
}

export interface MonsterEntry {
  cr: number | string;
  count?: number;
}

export interface EncounterEvaluation {
  totalBaseXP: number;
  adjustedXP: number;
  multiplier: number;
  difficulty: Difficulty;
  monsters: Array<{ cr: string; count: number; xp: number }>;
  partyThresholds: PartyThresholds;
}

export interface EncounterSuggestion {
  monsters: Array<{ cr: string; count: number; name?: string }>;
  totalBaseXP: number;
  adjustedXP: number;
  difficulty: Difficulty;
}

/**
 * Normalize CR to string format (e.g., 0.25 → "1/4")
 */
export function normalizeCR(cr: number | string): string {
  if (typeof cr === "string") {
    // Handle fractional strings like "1/8", "1/4", "1/2"
    if (cr.includes("/")) return cr;
    // Handle decimal strings
    cr = parseFloat(cr);
  }

  // Convert decimal to fraction
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";

  // Integer CR
  return Math.floor(cr).toString();
}

/**
 * Get XP value for a given CR
 */
export function getXPForCR(cr: number | string): number {
  const normalized = normalizeCR(cr);
  return CR_TO_XP[normalized] ?? 0;
}

/**
 * Get encounter multiplier based on monster count and party size
 */
export function getEncounterMultiplier(monsterCount: number, partySize: number): number {
  // Find base multiplier
  const entry = ENCOUNTER_MULTIPLIERS.find((e) => monsterCount >= e.min && monsterCount <= e.max);
  let multiplier = entry?.multiplier ?? 4;

  // Adjust for party size
  if (partySize < 3) {
    // Small party: use next highest multiplier
    const currentIndex = ENCOUNTER_MULTIPLIERS.findIndex((e) => e.multiplier === multiplier);
    if (currentIndex >= 0 && currentIndex < ENCOUNTER_MULTIPLIERS.length - 1) {
      multiplier = ENCOUNTER_MULTIPLIERS[currentIndex + 1].multiplier;
    }
  } else if (partySize >= 6) {
    // Large party: use next lowest multiplier
    const currentIndex = ENCOUNTER_MULTIPLIERS.findIndex((e) => e.multiplier === multiplier);
    if (currentIndex > 0) {
      multiplier = ENCOUNTER_MULTIPLIERS[currentIndex - 1].multiplier;
    }
  }

  return multiplier;
}

/**
 * Calculate XP thresholds for a party
 */
export function calculatePartyThresholds(party: number[]): PartyThresholds {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  let deadly = 0;
  let dailyBudget = 0;

  for (const level of party) {
    const thresholds = XP_THRESHOLDS[level];
    if (!thresholds) {
      throw new Error(`Invalid character level: ${level}. Must be 1-20.`);
    }
    easy += thresholds.easy;
    medium += thresholds.medium;
    hard += thresholds.hard;
    deadly += thresholds.deadly;
    dailyBudget += DAILY_XP[level] ?? 0;
  }

  return {
    partySize: party.length,
    easy,
    medium,
    hard,
    deadly,
    dailyBudget,
  };
}

/**
 * Determine difficulty rating based on adjusted XP and party thresholds
 */
export function getDifficulty(adjustedXP: number, thresholds: PartyThresholds): Difficulty {
  if (adjustedXP < thresholds.easy) return "Trivial";
  if (adjustedXP < thresholds.medium) return "Easy";
  if (adjustedXP < thresholds.hard) return "Medium";
  if (adjustedXP < thresholds.deadly) return "Hard";
  return "Deadly";
}

/**
 * Evaluate an encounter's difficulty
 */
export function evaluateEncounter(party: number[], monsters: MonsterEntry[]): EncounterEvaluation {
  const partyThresholds = calculatePartyThresholds(party);

  // Calculate total base XP and monster count
  let totalBaseXP = 0;
  let totalMonsterCount = 0;
  const monsterSummary: Array<{ cr: string; count: number; xp: number }> = [];

  for (const monster of monsters) {
    const count = monster.count ?? 1;
    const cr = normalizeCR(monster.cr);
    const xp = getXPForCR(cr);
    totalBaseXP += xp * count;
    totalMonsterCount += count;
    monsterSummary.push({ cr, count, xp });
  }

  // Apply encounter multiplier
  const multiplier = getEncounterMultiplier(totalMonsterCount, partyThresholds.partySize);
  const adjustedXP = Math.round(totalBaseXP * multiplier);

  // Determine difficulty
  const difficulty = getDifficulty(adjustedXP, partyThresholds);

  return {
    totalBaseXP,
    adjustedXP,
    multiplier,
    difficulty,
    monsters: monsterSummary,
    partyThresholds,
  };
}

/**
 * Suggest encounter compositions for a given difficulty
 */
export function suggestEncounters(
  party: number[],
  difficulty: "easy" | "medium" | "hard" | "deadly",
  options: {
    monsterCount?: number;
    crMin?: number;
    crMax?: number;
    availableCRs?: string[];
    searchIndex?: SearchIndex;
    ruleset?: "2014" | "2024" | "any";
  } = {},
): EncounterSuggestion[] {
  const partyThresholds = calculatePartyThresholds(party);

  // Determine target XP range
  const difficultyMap: Record<string, { min: number; max: number }> = {
    easy: { min: partyThresholds.easy, max: partyThresholds.medium - 1 },
    medium: { min: partyThresholds.medium, max: partyThresholds.hard - 1 },
    hard: { min: partyThresholds.hard, max: partyThresholds.deadly - 1 },
    deadly: { min: partyThresholds.deadly, max: partyThresholds.deadly * 1.5 },
  };

  const targetRange = difficultyMap[difficulty];

  // Default monster count: 1 per 4 PCs
  const defaultMonsterCount = Math.max(1, Math.ceil(party.length / 4));
  const monsterCount = options.monsterCount ?? defaultMonsterCount;

  // Get available CRs
  const allCRs = Object.keys(CR_TO_XP);
  let availableCRs = options.availableCRs ?? allCRs;

  // Filter by CR range if specified
  if (options.crMin !== undefined || options.crMax !== undefined) {
    availableCRs = availableCRs.filter((cr) => {
      const xp = getXPForCR(cr);
      if (options.crMin !== undefined && xp < options.crMin) return false;
      if (options.crMax !== undefined && xp > options.crMax) return false;
      return true;
    });
  }

  const suggestions: EncounterSuggestion[] = [];
  const multiplier = getEncounterMultiplier(monsterCount, partyThresholds.partySize);

  // Calculate target base XP (before multiplier)
  const targetBaseXPMin = Math.floor(targetRange.min / multiplier);
  const targetBaseXPMax = Math.ceil(targetRange.max / multiplier);

  // Strategy 1: All same CR
  for (const cr of availableCRs) {
    const xpPerMonster = getXPForCR(cr);
    const totalBaseXP = xpPerMonster * monsterCount;

    if (totalBaseXP >= targetBaseXPMin && totalBaseXP <= targetBaseXPMax) {
      const adjustedXP = Math.round(totalBaseXP * multiplier);
      const actualDifficulty = getDifficulty(adjustedXP, partyThresholds);

      suggestions.push({
        monsters: [{ cr, count: monsterCount }],
        totalBaseXP,
        adjustedXP,
        difficulty: actualDifficulty,
      });
    }
  }

  // Strategy 2: Mix of CRs (if monster count > 1)
  if (monsterCount > 1 && availableCRs.length > 1) {
    // Try combinations of 2-3 different CRs
    for (let i = 0; i < availableCRs.length && suggestions.length < 20; i++) {
      for (let j = i; j < availableCRs.length && suggestions.length < 20; j++) {
        const cr1 = availableCRs[i];
        const cr2 = availableCRs[j];
        const xp1 = getXPForCR(cr1);
        const xp2 = getXPForCR(cr2);

        // Try different distributions
        for (let count1 = 1; count1 < monsterCount; count1++) {
          const count2 = monsterCount - count1;
          const totalBaseXP = xp1 * count1 + xp2 * count2;

          if (totalBaseXP >= targetBaseXPMin && totalBaseXP <= targetBaseXPMax) {
            const adjustedXP = Math.round(totalBaseXP * multiplier);
            const actualDifficulty = getDifficulty(adjustedXP, partyThresholds);

            const monsters =
              cr1 === cr2
                ? [{ cr: cr1, count: monsterCount }]
                : [
                    { cr: cr1, count: count1 },
                    { cr: cr2, count: count2 },
                  ].filter((m) => m.count > 0);

            suggestions.push({
              monsters,
              totalBaseXP,
              adjustedXP,
              difficulty: actualDifficulty,
            });
          }
        }
      }
    }
  }

  // Remove duplicates and sort by how close to target difficulty
  const unique = suggestions.filter((s, i, arr) => {
    const key = JSON.stringify(s.monsters.map((m) => ({ cr: m.cr, count: m.count })));
    return (
      i ===
      arr.findIndex(
        (x) => JSON.stringify(x.monsters.map((m) => ({ cr: m.cr, count: m.count }))) === key,
      )
    );
  });

  // Sort by adjusted XP (closest to middle of range first)
  const targetMid = (targetRange.min + targetRange.max) / 2;
  unique.sort((a, b) => Math.abs(a.adjustedXP - targetMid) - Math.abs(b.adjustedXP - targetMid));

  const topSuggestions = unique.slice(0, 10);

  // Populate monster names if search index provided
  if (options.searchIndex) {
    const ruleset = options.ruleset ?? "any";

    for (const suggestion of topSuggestions) {
      for (const monster of suggestion.monsters) {
        // Convert CR string to numeric for search (e.g., "1/4" → 0.25)
        const crNumeric = parseCRToNumber(monster.cr);

        // Search for monsters at this exact CR
        const candidates = searchMonsters(options.searchIndex, {
          cr_min: crNumeric,
          cr_max: crNumeric,
          ruleset,
          limit: 5,
        });

        // Pick a random monster from the top results, or list first 3
        if (candidates.length > 0) {
          if (candidates.length === 1) {
            monster.name = candidates[0].name;
          } else if (candidates.length <= 3) {
            monster.name = candidates.map((c) => c.name).join(" / ");
          } else {
            // Show first 3 options
            monster.name =
              candidates
                .slice(0, 3)
                .map((c) => c.name)
                .join(" / ") + "...";
          }
        }
      }
    }
  }

  return topSuggestions;
}

/**
 * Helper to convert CR string to numeric value
 */
function parseCRToNumber(cr: string): number {
  if (cr === "0") return 0;
  if (cr.includes("/")) {
    const [num, denom] = cr.split("/").map(Number);
    return num / denom;
  }
  return parseFloat(cr);
}

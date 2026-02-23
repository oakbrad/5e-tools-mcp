// src/scale-encounter.ts
// Encounter scaling logic - adjusts encounters to match new difficulty or party composition

import {
  evaluateEncounter,
  calculatePartyThresholds,
  getXPForCR,
  normalizeCR,
  getEncounterMultiplier,
  getDifficulty,
  type MonsterEntry,
  type EncounterEvaluation,
  type Difficulty,
} from "./encounter.js";

export interface ScaleEncounterInput {
  current_encounter: Array<{ cr: number | string; count: number }>;
  current_party: number[];
  target_party?: number[];
  target_difficulty?: "easy" | "medium" | "hard" | "deadly";
  adjustment?: "easier" | "harder";
}

export interface ScaleEncounterResult {
  original: {
    monsters: Array<{ cr: string; count: number; xp: number }>;
    totalBaseXP: number;
    adjustedXP: number;
    difficulty: Difficulty;
    partyThresholds: {
      partySize: number;
      easy: number;
      medium: number;
      hard: number;
      deadly: number;
      dailyBudget: number;
    };
  };
  scaled: {
    monsters: Array<{ cr: string; count: number; xp: number }>;
    totalBaseXP: number;
    adjustedXP: number;
    difficulty: Difficulty;
  };
  rationale: string[];
  strategy: string;
}

/** Available CR values sorted by XP */
const SORTED_CRS = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
];

/**
 * Find the CR index for a given CR value
 */
function getCRIndex(cr: string): number {
  return SORTED_CRS.indexOf(cr);
}

/**
 * Get the next higher CR
 */
function getNextHigherCR(cr: string, steps = 1): string | null {
  const index = getCRIndex(cr);
  if (index === -1 || index + steps >= SORTED_CRS.length) return null;
  return SORTED_CRS[index + steps];
}

/**
 * Get the next lower CR
 */
function getNextLowerCR(cr: string, steps = 1): string | null {
  const index = getCRIndex(cr);
  if (index <= 0 || index - steps < 0) return null;
  return SORTED_CRS[index - steps];
}

/**
 * Calculate target XP based on desired difficulty or adjustment
 */
function calculateTargetXP(
  evaluation: EncounterEvaluation,
  targetParty: number[],
  targetDifficulty?: "easy" | "medium" | "hard" | "deadly",
  adjustment?: "easier" | "harder",
): { targetXP: number; difficulty: Difficulty } {
  const partyThresholds = calculatePartyThresholds(targetParty);
  const currentXP = evaluation.adjustedXP;

  if (targetDifficulty) {
    // Target specific difficulty (use midpoint of difficulty range)
    const difficultyMap = {
      easy: (partyThresholds.easy + partyThresholds.medium - 1) / 2,
      medium: (partyThresholds.medium + partyThresholds.hard - 1) / 2,
      hard: (partyThresholds.hard + partyThresholds.deadly - 1) / 2,
      deadly: partyThresholds.deadly * 1.1, // 10% into deadly range
    };
    return {
      targetXP: Math.round(difficultyMap[targetDifficulty]),
      difficulty: (targetDifficulty.charAt(0).toUpperCase() +
        targetDifficulty.slice(1)) as Difficulty,
    };
  }

  if (adjustment === "easier") {
    // Reduce by approximately one difficulty tier
    const thresholds = [
      partyThresholds.easy,
      partyThresholds.medium,
      partyThresholds.hard,
      partyThresholds.deadly,
    ];
    const newThreshold = thresholds.find((t) => t < currentXP);
    if (newThreshold) {
      // Target midpoint between new threshold and current
      return {
        targetXP: Math.round((currentXP + newThreshold) / 2),
        difficulty: getDifficulty(Math.round((currentXP + newThreshold) / 2), partyThresholds),
      };
    }
    // Already trivial, make it 50% easier
    return {
      targetXP: Math.round(currentXP * 0.5),
      difficulty: "Trivial",
    };
  }

  if (adjustment === "harder") {
    // Increase by approximately one difficulty tier
    const thresholds = [
      partyThresholds.easy,
      partyThresholds.medium,
      partyThresholds.hard,
      partyThresholds.deadly,
    ];
    const newThreshold = [...thresholds].reverse().find((t) => t > currentXP);
    if (newThreshold) {
      // Target midpoint between current and new threshold
      return {
        targetXP: Math.round((currentXP + newThreshold) / 2),
        difficulty: getDifficulty(Math.round((currentXP + newThreshold) / 2), partyThresholds),
      };
    }
    // Already deadly, make it 25% harder
    return {
      targetXP: Math.round(currentXP * 1.25),
      difficulty: "Deadly",
    };
  }

  // Default: maintain current difficulty
  return {
    targetXP: currentXP,
    difficulty: evaluation.difficulty,
  };
}

/**
 * Strategy 1: Scale monster counts proportionally
 */
function scaleByCount(
  monsters: MonsterEntry[],
  targetBaseXP: number,
  currentBaseXP: number,
  _multiplier: number,
  minCountPerMonster: number = 1,
): Array<{ cr: string; count: number; xp: number }> {
  const scaleFactor = targetBaseXP / currentBaseXP;
  const scaledMonsters: Array<{ cr: string; count: number; xp: number }> = [];

  for (const monster of monsters) {
    const cr = normalizeCR(monster.cr);
    const xp = getXPForCR(cr);
    const originalCount = monster.count ?? 1;
    const scaledCount = Math.max(minCountPerMonster, Math.round(originalCount * scaleFactor));
    scaledMonsters.push({ cr, count: scaledCount, xp });
  }

  return scaledMonsters;
}

/**
 * Strategy 2: Swap monsters for higher/lower CR equivalents
 */
function scaleByCR(
  monsters: MonsterEntry[],
  targetBaseXP: number,
  currentBaseXP: number,
  _multiplier: number,
): { monsters: Array<{ cr: string; count: number; xp: number }>; rationale: string[] } {
  const scaleFactor = targetBaseXP / currentBaseXP;
  const scaledMonsters: Array<{ cr: string; count: number; xp: number }> = [];
  const rationale: string[] = [];

  // Determine if we're scaling up or down
  const scalingUp = scaleFactor > 1;
  const steps = Math.round(Math.log2(scaleFactor)); // How many CR steps to move

  for (const monster of monsters) {
    const cr = normalizeCR(monster.cr);
    const _xp = getXPForCR(cr);
    const count = monster.count ?? 1;
    const originalCR = cr;

    let newCR = cr;
    let adjustedCount = count;

    if (scalingUp && steps > 0) {
      // Try to find higher CR
      const higherCR = getNextHigherCR(cr, steps);
      if (higherCR) {
        newCR = higherCR;
        rationale.push(
          `Swapped CR ${originalCR} → CR ${newCR} for ${count} monster${count > 1 ? "s" : ""}`,
        );
      } else if (getNextHigherCR(cr, 1)) {
        // Can't jump full steps, step up one at a time
        newCR = getNextHigherCR(cr, 1)!;
        rationale.push(
          `Partially upgraded CR ${originalCR} → CR ${newCR} for ${count} monster${count > 1 ? "s" : ""}`,
        );
      } else {
        // Already at max CR, increase count instead
        adjustedCount = Math.round(count * 1.5);
        rationale.push(`CR ${cr} already at maximum, increased count to ${adjustedCount}`);
      }
    } else if (!scalingUp && steps > 0) {
      // Try to find lower CR
      const lowerCR = getNextLowerCR(cr, steps);
      if (lowerCR) {
        newCR = lowerCR;
        rationale.push(
          `Downgraded CR ${originalCR} → CR ${newCR} for ${count} monster${count > 1 ? "s" : ""}`,
        );
      } else if (getNextLowerCR(cr, 1)) {
        // Can't jump full steps, step down one at a time
        newCR = getNextLowerCR(cr, 1)!;
        rationale.push(
          `Partially downgraded CR ${originalCR} → CR ${newCR} for ${count} monster${count > 1 ? "s" : ""}`,
        );
      } else {
        // Already at min CR (0), decrease count instead
        adjustedCount = Math.max(1, Math.round(count * 0.67));
        rationale.push(`CR ${cr} already at minimum, decreased count to ${adjustedCount}`);
      }
    }

    scaledMonsters.push({ cr: newCR, count: adjustedCount, xp: getXPForCR(newCR) });
  }

  return { monsters: scaledMonsters, rationale };
}

/**
 * Strategy 3: Mix both count and CR scaling
 */
function scaleByMixed(
  monsters: MonsterEntry[],
  targetBaseXP: number,
  currentBaseXP: number,
  _multiplier: number,
): { monsters: Array<{ cr: string; count: number; xp: number }>; rationale: string[] } {
  const scaleFactor = targetBaseXP / currentBaseXP;
  const scalingUp = scaleFactor > 1;
  const scaledMonsters: Array<{ cr: string; count: number; xp: number }> = [];
  const rationale: string[] = [];

  // Use 50% count scaling + 50% CR scaling
  const countFactor = Math.sqrt(scaleFactor);
  const crSteps = Math.round(Math.log2(Math.sqrt(scaleFactor)));

  for (const monster of monsters) {
    const cr = normalizeCR(monster.cr);
    const _xp = getXPForCR(cr);
    const originalCount = monster.count ?? 1;
    const originalCR = cr;

    // Scale count
    const scaledCount = Math.max(1, Math.round(originalCount * countFactor));

    // Scale CR
    let newCR = cr;
    if (scalingUp && crSteps > 0) {
      const higherCR = getNextHigherCR(cr, crSteps);
      if (higherCR) {
        newCR = higherCR;
        rationale.push(
          `Adjusted CR ${originalCR} → CR ${newCR} and count ${originalCount} → ${scaledCount}`,
        );
      }
    } else if (!scalingUp && crSteps > 0) {
      const lowerCR = getNextLowerCR(cr, crSteps);
      if (lowerCR) {
        newCR = lowerCR;
        rationale.push(
          `Adjusted CR ${originalCR} → CR ${newCR} and count ${originalCount} → ${scaledCount}`,
        );
      }
    } else {
      rationale.push(`Scaled count from ${originalCount} → ${scaledCount} (CR unchanged)`);
    }

    scaledMonsters.push({ cr: newCR, count: scaledCount, xp: getXPForCR(newCR) });
  }

  return { monsters: scaledMonsters, rationale };
}

/**
 * Find the best scaling approach that gets closest to target XP
 */
function findBestScaling(
  monsters: MonsterEntry[],
  targetBaseXP: number,
  currentBaseXP: number,
  multiplier: number,
  targetParty: number[],
): {
  result: Array<{ cr: string; count: number; xp: number }>;
  strategy: string;
  rationale: string[];
} {
  const strategies = [
    {
      name: "count_scaling",
      fn: () => scaleByCount(monsters, targetBaseXP, currentBaseXP, multiplier),
    },
    { name: "cr_swapping", fn: () => scaleByCR(monsters, targetBaseXP, currentBaseXP, multiplier) },
    {
      name: "mixed_scaling",
      fn: () => scaleByMixed(monsters, targetBaseXP, currentBaseXP, multiplier),
    },
  ];

  let bestResult: Array<{ cr: string; count: number; xp: number }> | null = null;
  let bestStrategy = "";
  let bestRationale: string[] = [];
  let bestDistance = Infinity;

  for (const strategy of strategies) {
    const scaled = strategy.fn();
    const monstersWithRationale = Array.isArray(scaled) ? scaled : scaled.monsters;
    const rationale = Array.isArray(scaled) ? [] : scaled.rationale;

    // Calculate resulting XP
    const newTotalMonsters = monstersWithRationale.reduce((sum, m) => sum + m.count, 0);
    const newMultiplier = getEncounterMultiplier(newTotalMonsters, targetParty.length);
    const newBaseXP = monstersWithRationale.reduce((sum, m) => sum + m.xp * m.count, 0);
    const newAdjustedXP = Math.round(newBaseXP * newMultiplier);

    // Distance from target
    const distance = Math.abs(newAdjustedXP - targetBaseXP * multiplier);

    if (distance < bestDistance) {
      bestResult = monstersWithRationale;
      bestStrategy = strategy.name;
      bestRationale = rationale;
      bestDistance = distance;
    }
  }

  return {
    result: bestResult!,
    strategy: bestStrategy,
    rationale: bestRationale,
  };
}

/**
 * Scale an encounter to match a new difficulty or party composition
 */
export function scaleEncounter(input: ScaleEncounterInput): ScaleEncounterResult {
  const {
    current_encounter,
    current_party,
    target_party = current_party,
    target_difficulty,
    adjustment,
  } = input;

  // Validate input
  if (current_encounter.length === 0) {
    throw new Error("current_encounter must contain at least one monster");
  }
  if (current_party.length === 0) {
    throw new Error("current_party must contain at least one character level");
  }
  if (target_difficulty && adjustment) {
    throw new Error("Cannot specify both target_difficulty and adjustment");
  }

  // Evaluate original encounter
  const originalEvaluation = evaluateEncounter(current_party, current_encounter);

  // Calculate target XP
  const { targetXP, difficulty } = calculateTargetXP(
    originalEvaluation,
    target_party,
    target_difficulty,
    adjustment,
  );

  // Calculate target base XP (before multiplier)
  const _targetPartyThresholds = calculatePartyThresholds(target_party);
  const totalMonsters = current_encounter.reduce((sum, m) => sum + (m.count ?? 1), 0);
  const newMultiplier = getEncounterMultiplier(totalMonsters, target_party.length);
  const targetBaseXP = Math.round(targetXP / newMultiplier);

  // Find best scaling approach
  const {
    result: scaledMonsters,
    strategy,
    rationale,
  } = findBestScaling(
    current_encounter,
    targetBaseXP,
    originalEvaluation.totalBaseXP,
    newMultiplier,
    target_party,
  );

  // Evaluate scaled encounter
  const scaledEvaluation = evaluateEncounter(target_party, scaledMonsters);

  // Build comprehensive rationale
  const fullRationale: string[] = [];
  if (target_party.length !== current_party.length) {
    fullRationale.push(
      `Party size changed from ${current_party.length} to ${target_party.length} PCs`,
    );
  }
  if (target_difficulty) {
    fullRationale.push(`Target difficulty: ${target_difficulty.toUpperCase()}`);
  } else if (adjustment) {
    fullRationale.push(`Adjustment: ${adjustment}`);
  }
  fullRationale.push(
    `Original difficulty: ${originalEvaluation.difficulty} (${originalEvaluation.adjustedXP} XP)`,
  );
  fullRationale.push(`Target difficulty: ${difficulty} (${targetXP} XP)`);
  fullRationale.push(
    `Actual scaled difficulty: ${scaledEvaluation.difficulty} (${scaledEvaluation.adjustedXP} XP)`,
  );
  fullRationale.push(`Strategy used: ${strategy.replace("_", " ")}`);
  fullRationale.push(...rationale);

  return {
    original: {
      monsters: originalEvaluation.monsters,
      totalBaseXP: originalEvaluation.totalBaseXP,
      adjustedXP: originalEvaluation.adjustedXP,
      difficulty: originalEvaluation.difficulty,
      partyThresholds: {
        partySize: originalEvaluation.partyThresholds.partySize,
        easy: originalEvaluation.partyThresholds.easy,
        medium: originalEvaluation.partyThresholds.medium,
        hard: originalEvaluation.partyThresholds.hard,
        deadly: originalEvaluation.partyThresholds.deadly,
        dailyBudget: originalEvaluation.partyThresholds.dailyBudget,
      },
    },
    scaled: {
      monsters: scaledEvaluation.monsters,
      totalBaseXP: scaledEvaluation.totalBaseXP,
      adjustedXP: scaledEvaluation.adjustedXP,
      difficulty: scaledEvaluation.difficulty,
    },
    rationale: fullRationale,
    strategy,
  };
}

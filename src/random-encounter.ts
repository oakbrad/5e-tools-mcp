// src/random-encounter.ts
// Random encounter generation based on environment and party level

import { searchMonsters, type SearchIndex, type RecordLite } from "./search.js";
import {
  calculatePartyThresholds,
  evaluateEncounter,
  type MonsterEntry,
  type EncounterEvaluation,
} from "./encounter.js";

export type Environment =
  | "forest"
  | "underdark"
  | "mountain"
  | "desert"
  | "urban"
  | "coast"
  | "arctic"
  | "swamp"
  | "grassland";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

/** Monster type mappings for each environment */
const ENVIRONMENT_MONSTER_TYPES: Record<Environment, string[]> = {
  forest: ["beast", "fey", "plant"],
  underdark: ["aberration", "ooze", "humanoid"],
  mountain: ["giant", "dragon", "humanoid"],
  desert: ["elemental", "monstrosity", "humanoid"],
  urban: ["humanoid", "construct", "undead"],
  coast: ["beast", "monstrosity", "humanoid"],
  arctic: ["beast", "giant", "monstrosity"],
  swamp: ["beast", "plant", "monstrosity"],
  grassland: ["beast", "monstrosity", "humanoid"],
};

/** Flavor text templates for encounters by environment */
const ENVIRONMENT_FLAVOR: Record<Environment, string[]> = {
  forest: [
    "The canopy overhead grows thick, casting dappled shadows across the forest floor.",
    "Ancient trees tower around you, their branches intertwining like gnarled fingers.",
    "A rustle in the undergrowth catches your attention—something is moving.",
    "Mist swirls between the tree trunks, obscuring what lies ahead.",
    "The forest grows unnaturally quiet, save for the sound of approaching footsteps.",
  ],
  underdark: [
    "Bioluminescent fungi cast an eerie glow on the cavern walls.",
    "The oppressive darkness seems to press in on you from all sides.",
    "Stalactites hang like daggers from the ceiling high above.",
    "The sound of dripping echoes through the vast underground chamber.",
    "Something stirs in the darkness just beyond your light source.",
  ],
  mountain: [
    "The wind howls through jagged peaks, carrying snow and debris.",
    "Sheer cliff faces rise precipitously on either side of the narrow path.",
    "Thunder rumbles in the distance, though the sky is clear.",
    "Loose stones threaten to send you tumbling down the mountainside.",
    "A shadow falls across the trail—something has taken notice of you.",
  ],
  desert: [
    "The relentless sun beats down on the endless sea of sand.",
    "Heat shimmers distort the horizon in every direction.",
    "A sudden windstorm whips up a blinding cloud of dust.",
    "The sand stretches endlessly, broken only by occasional rocky outcrops.",
    "Strange shapes move in the distance—or is it just a mirage?",
  ],
  urban: [
    "The city's streets are unusually quiet at this hour.",
    "Shadows lengthen in narrow alleyways between towering buildings.",
    "The bustle of the crowd briefly parts, revealing something unusual.",
    "Shouts and cries ring out from a nearby square.",
    "Furtive figures watch from the rooftops and windows above.",
  ],
  coast: [
    "Salt spray coats your skin as waves crash against rocky shores.",
    "Seagulls circle overhead, their cries mingling with the roar of the ocean.",
    "Thick sea fog rolls in from the water, obscuring visibility.",
    "The tide is coming in rapidly, threatening to cut off your path.",
    "Something disturbs the surface of the water near the shore.",
  ],
  arctic: [
    "The biting cold penetrates even your warmest clothing.",
    "A blizzard approaches, the whiteout conditions making travel treacherous.",
    "The ice beneath your feet creaks ominously.",
    "Snow drifts obscure the landscape, hiding dangers beneath.",
    "A howl echoes across the frozen wasteland—not from the wind.",
  ],
  swamp: [
    "The thick, humid air hangs heavy and oppressive.",
    "Murky waters conceal what lies beneath the surface.",
    "Insects swarm around you, their drone incessant.",
    "Foul-smelling muck threatens to pull you under with every step.",
    "Something large moves through the water, leaving ripples in its wake.",
  ],
  grassland: [
    "The tall grass sways in the gentle breeze like waves on an ocean.",
    "The vast open terrain offers little in the way of cover.",
    "A herd of distant creatures raises clouds of dust as they run.",
    "Storm clouds gather on the horizon, promising rain and perhaps worse.",
    "Something disturbs the grass—movement that doesn't match the wind.",
  ],
};

export interface RandomEncounter {
  environment: Environment;
  difficulty: Difficulty;
  monsters: Array<{
    name: string;
    count: number;
    cr: string;
    xp: number;
  }>;
  totalBaseXP: number;
  adjustedXP: number;
  encounterMultiplier: number;
  difficultyRating: string;
  partyThresholds: {
    partySize: number;
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
  };
  flavorText: string;
}

/**
 * Generate a random encounter for a given environment and party
 */
export function generateRandomEncounter(
  party: number[],
  environment: Environment,
  difficulty: Difficulty,
  searchIndex: SearchIndex,
  options: {
    ruleset?: "2014" | "2024" | "any";
    monsterCount?: number;
  } = {}
): RandomEncounter {
  const { ruleset = "any", monsterCount } = options;

  // Get party thresholds
  const partyThresholds = calculatePartyThresholds(party);

  // Determine target XP range
  const difficultyMap: Record<Difficulty, { min: number; max: number }> = {
    easy: { min: partyThresholds.easy, max: partyThresholds.medium - 1 },
    medium: { min: partyThresholds.medium, max: partyThresholds.hard - 1 },
    hard: { min: partyThresholds.hard, max: partyThresholds.deadly - 1 },
    deadly: { min: partyThresholds.deadly, max: partyThresholds.deadly * 1.5 },
  };

  const targetRange = difficultyMap[difficulty];

  // Get appropriate monster types for this environment
  const allowedTypes = ENVIRONMENT_MONSTER_TYPES[environment];

  // Default monster count: 1 per 4 PCs
  const defaultMonsterCount = Math.max(1, Math.ceil(party.length / 4));
  const targetMonsterCount = monsterCount ?? defaultMonsterCount;

  // Search for monsters using searchMonsters() for each environment-appropriate type
  // Use a high limit to get a good selection of candidates
  const candidates: Array<{ name: string; cr: string; type: string }> = [];
  const seenMonsters = new Set<string>();

  for (const monsterType of allowedTypes) {
    const typeResults = searchMonsters(searchIndex, {
      type: monsterType,
      cr_min: 0.125, // Skip CR 0 monsters (usually harmless)
      ruleset: ruleset === "any" ? undefined : ruleset,
      limit: 100, // Get plenty of candidates per type
    });

    for (const monster of typeResults) {
      // Deduplicate across types
      if (seenMonsters.has(monster.name)) continue;
      seenMonsters.add(monster.name);

      // Extract CR from facets and normalize
      const crValue = monster.facets.cr;
      const crStr = normalizeCR(crValue);

      // Extract creature type from facets
      const creatureType = typeof monster.facets.type === "object"
        ? monster.facets.type.type
        : monster.facets.type;

      candidates.push({
        name: monster.name,
        cr: crStr,
        type: creatureType ?? monsterType,
      });
    }
  }

  // If no monsters found for environment, broaden search to all monster types
  let viableCandidates = candidates;
  if (viableCandidates.length === 0) {
    const fallbackResults = searchMonsters(searchIndex, {
      cr_min: 0.125, // Skip CR 0 monsters
      ruleset: ruleset === "any" ? undefined : ruleset,
      limit: 200, // Get a broad selection
    });

    for (const monster of fallbackResults) {
      const crValue = monster.facets.cr;
      const crStr = normalizeCR(crValue);

      const creatureType = typeof monster.facets.type === "object"
        ? monster.facets.type.type
        : monster.facets.type;

      viableCandidates.push({
        name: monster.name,
        cr: crStr,
        type: creatureType ?? "unknown",
      });
    }
  }

  if (viableCandidates.length === 0) {
    throw new Error(
      `No suitable monsters found for environment: ${environment}`
    );
  }

  // Generate encounter composition
  const encounterComposition = generateEncounterComposition(
    party,
    viableCandidates,
    targetRange,
    targetMonsterCount
  );

  // Build monster array with XP values
  const monsters = encounterComposition.map((comp) => {
    const xp = getXPForCR(comp.cr);
    return {
      name: comp.name,
      count: comp.count,
      cr: comp.cr,
      xp,
    };
  });

  // Calculate total XP
  const totalBaseXP = monsters.reduce((sum, m) => sum + m.xp * m.count, 0);

  // Get encounter multiplier
  const totalMonsterCount = monsters.reduce((sum, m) => sum + m.count, 0);
  const encounterMultiplier = getEncounterMultiplier(
    totalMonsterCount,
    partyThresholds.partySize
  );

  // Calculate adjusted XP
  const adjustedXP = Math.round(totalBaseXP * encounterMultiplier);

  // Determine actual difficulty rating
  const difficultyRating = getDifficultyRating(
    adjustedXP,
    partyThresholds
  );

  // Select flavor text
  const flavorOptions = ENVIRONMENT_FLAVOR[environment];
  const flavorText =
    flavorOptions[Math.floor(Math.random() * flavorOptions.length)];

  return {
    environment,
    difficulty,
    monsters,
    totalBaseXP,
    adjustedXP,
    encounterMultiplier,
    difficultyRating,
    partyThresholds: {
      partySize: partyThresholds.partySize,
      easy: partyThresholds.easy,
      medium: partyThresholds.medium,
      hard: partyThresholds.hard,
      deadly: partyThresholds.deadly,
    },
    flavorText,
  };
}

/**
 * Generate encounter composition that fits within target XP range
 */
function generateEncounterComposition(
  party: number[],
  candidates: Array<{ name: string; cr: string; type: string }>,
  targetRange: { min: number; max: number },
  targetMonsterCount: number
): Array<{ name: string; cr: string; count: number }> {
  const partyThresholds = calculatePartyThresholds(party);
  const multiplier = getEncounterMultiplier(targetMonsterCount, partyThresholds.partySize);

  // Calculate target base XP (before multiplier)
  const targetBaseXPMin = Math.floor(targetRange.min / multiplier);
  const targetBaseXPMax = Math.ceil(targetRange.max / multiplier);

  // Try multiple random attempts to find a valid composition
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const composition: Array<{ name: string; cr: string; count: number }> = [];

    // Randomly select monsters
    for (let i = 0; i < targetMonsterCount; i++) {
      const randomMonster = candidates[Math.floor(Math.random() * candidates.length)];
      const existing = composition.find((m) => m.name === randomMonster.name);

      if (existing) {
        existing.count++;
      } else {
        composition.push({
          name: randomMonster.name,
          cr: randomMonster.cr,
          count: 1,
        });
      }
    }

    // Calculate total base XP
    const totalBaseXP = composition.reduce((sum, m) => {
      return sum + getXPForCR(m.cr) * m.count;
    }, 0);

    // Check if within target range
    if (totalBaseXP >= targetBaseXPMin && totalBaseXP <= targetBaseXPMax) {
      return composition;
    }
  }

  // If we couldn't find an exact match, return the best attempt
  // (last one generated, closest to middle of range)
  const composition: Array<{ name: string; cr: string; count: number }> = [];
  let bestScore = Infinity;
  let bestComposition: Array<{ name: string; cr: string; count: number }> = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptComposition: Array<{ name: string; cr: string; count: number }> = [];

    for (let i = 0; i < targetMonsterCount; i++) {
      const randomMonster = candidates[Math.floor(Math.random() * candidates.length)];
      const existing = attemptComposition.find((m) => m.name === randomMonster.name);

      if (existing) {
        existing.count++;
      } else {
        attemptComposition.push({
          name: randomMonster.name,
          cr: randomMonster.cr,
          count: 1,
        });
      }
    }

    const totalBaseXP = attemptComposition.reduce((sum, m) => {
      return sum + getXPForCR(m.cr) * m.count;
    }, 0);

    const targetMid = (targetBaseXPMin + targetBaseXPMax) / 2;
    const score = Math.abs(totalBaseXP - targetMid);

    if (score < bestScore) {
      bestScore = score;
      bestComposition = attemptComposition;
    }
  }

  return bestComposition;
}

/**
 * Normalize CR to string format
 */
function normalizeCR(cr: number | string): string {
  if (typeof cr === "string") {
    if (cr.includes("/")) return cr;
    cr = parseFloat(cr);
  }

  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";

  return Math.floor(cr).toString();
}

/**
 * Get XP value for a given CR
 */
function getXPForCR(cr: number | string): number {
  const normalized = normalizeCR(cr);

  const CR_TO_XP: Record<string, number> = {
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

  return CR_TO_XP[normalized] ?? 0;
}

/**
 * Get encounter multiplier based on monster count and party size
 */
function getEncounterMultiplier(monsterCount: number, partySize: number): number {
  const ENCOUNTER_MULTIPLIERS: Array<{
    min: number;
    max: number;
    multiplier: number;
  }> = [
    { min: 1, max: 1, multiplier: 1 },
    { min: 2, max: 2, multiplier: 1.5 },
    { min: 3, max: 6, multiplier: 2 },
    { min: 7, max: 10, multiplier: 2.5 },
    { min: 11, max: 14, multiplier: 3 },
    { min: 15, max: Infinity, multiplier: 4 },
  ];

  const entry = ENCOUNTER_MULTIPLIERS.find(
    (e) => monsterCount >= e.min && monsterCount <= e.max
  );
  let multiplier = entry?.multiplier ?? 4;

  // Adjust for party size
  if (partySize < 3) {
    const currentIndex = ENCOUNTER_MULTIPLIERS.findIndex(
      (e) => e.multiplier === multiplier
    );
    if (currentIndex >= 0 && currentIndex < ENCOUNTER_MULTIPLIERS.length - 1) {
      multiplier = ENCOUNTER_MULTIPLIERS[currentIndex + 1].multiplier;
    }
  } else if (partySize >= 6) {
    const currentIndex = ENCOUNTER_MULTIPLIERS.findIndex(
      (e) => e.multiplier === multiplier
    );
    if (currentIndex > 0) {
      multiplier = ENCOUNTER_MULTIPLIERS[currentIndex - 1].multiplier;
    }
  }

  return multiplier;
}

/**
 * Get difficulty rating based on adjusted XP and party thresholds
 */
function getDifficultyRating(
  adjustedXP: number,
  thresholds: {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
  }
): string {
  if (adjustedXP < thresholds.easy) return "Trivial";
  if (adjustedXP < thresholds.medium) return "Easy";
  if (adjustedXP < thresholds.hard) return "Medium";
  if (adjustedXP < thresholds.deadly) return "Hard";
  return "Deadly";
}

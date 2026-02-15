// src/magic-items.ts
// Magic item suggestion logic for DM prep

import { searchItems, type SearchIndex, type RecordLite } from "./search.js";

export type SuggestMagicItemsParams = {
  party_level?: number;
  tier?: "tier1" | "tier2" | "tier3" | "tier4";
  item_type?: string;
  rarity?: "common" | "uncommon" | "rare" | "very rare" | "legendary" | "artifact";
  count?: number;
  ruleset?: "2014" | "2024" | "any";
  source?: string;
};

export type MagicItemSuggestion = {
  name: string;
  rarity: string;
  type: string;
  source: string;
  description?: string;
  uri: string;
};

/**
 * Map party level to tier
 */
export function levelToTier(level: number): "tier1" | "tier2" | "tier3" | "tier4" {
  if (level >= 1 && level <= 4) return "tier1";
  if (level >= 5 && level <= 10) return "tier2";
  if (level >= 11 && level <= 16) return "tier3";
  return "tier4";
}

/**
 * Get rarity distribution for a given tier
 */
export function getTierRarities(tier: "tier1" | "tier2" | "tier3" | "tier4"): {
  rarities: string[];
  weights: number[];
} {
  switch (tier) {
    case "tier1":
      // Tier 1 (levels 1-4): Common and Uncommon, with slight preference for Uncommon
      return {
        rarities: ["common", "uncommon"],
        weights: [3, 7]
      };
    case "tier2":
      // Tier 2 (levels 5-10): Uncommon and Rare, balanced
      return {
        rarities: ["uncommon", "rare"],
        weights: [5, 5]
      };
    case "tier3":
      // Tier 3 (levels 11-16): Rare and Very Rare, slight preference for Very Rare
      return {
        rarities: ["rare", "very rare"],
        weights: [4, 6]
      };
    case "tier4":
      // Tier 4 (levels 17-20): Very Rare and Legendary, with some Legendary
      return {
        rarities: ["very rare", "legendary"],
        weights: [6, 4]
      };
  }
}

/**
 * Weighted random selection from arrays
 */
function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate magic item suggestions for a given party tier/level
 */
export function suggestMagicItems(
  idx: SearchIndex,
  params: SuggestMagicItemsParams
): MagicItemSuggestion[] {
  const {
    party_level,
    tier,
    item_type,
    rarity: requestedRarity,
    count = 5,
    ruleset = "any",
    source
  } = params;

  // Determine tier from party_level or explicit tier parameter
  let targetTier: "tier1" | "tier2" | "tier3" | "tier4";
  if (party_level !== undefined) {
    targetTier = levelToTier(party_level);
  } else if (tier) {
    targetTier = tier;
  } else {
    // Default to tier 2 if neither is specified
    targetTier = "tier2";
  }

  // Get tier-appropriate rarity distribution
  const tierRarities = getTierRarities(targetTier);

  // If a specific rarity is requested, only use that
  const useRarities = requestedRarity ? [requestedRarity] : tierRarities.rarities;

  // Build suggestions
  const suggestions: MagicItemSuggestion[] = [];
  const attempts = count * 10; // Try multiple times to get enough unique items
  const seen = new Set<string>();

  for (let i = 0; i < attempts && suggestions.length < count; i++) {
    // Select rarity based on tier distribution or use requested rarity
    const selectedRarity = requestedRarity
      ? requestedRarity
      : weightedRandom(tierRarities.rarities, tierRarities.weights);

    // Search for items matching criteria
    const candidates = searchItems(idx, {
      rarity: selectedRarity as any,
      type: item_type,
      source,
      ruleset,
      limit: 50
    });

    // Shuffle candidates and pick one we haven't used
    const shuffled = shuffle(candidates);
    for (const candidate of shuffled) {
      const candidateKey = `${candidate.uri}-${selectedRarity}`;
      if (!seen.has(candidateKey)) {
        seen.add(candidateKey);

        // Get full entity data for description
        const entity = idx.byUri.get(candidate.uri);
        const itemType = entity?.type || "unknown";

        // Build description from entries if available
        let description: string | undefined;
        if (entity?.entries || entity?.entry) {
          const entries = entity.entries || entity.entry;
          if (Array.isArray(entries)) {
            // Get first paragraph for brief description
            const firstEntry = entries[0];
            if (typeof firstEntry === "string") {
              description = firstEntry.slice(0, 200);
            } else if (firstEntry?.type === "entries" && Array.isArray(firstEntry.entries)) {
              const textEntry = firstEntry.entries.find((e: any) => typeof e === "string");
              if (textEntry) {
                description = textEntry.slice(0, 200);
              }
            }
          } else if (typeof entries === "string") {
            description = entries.slice(0, 200);
          }
        }

        suggestions.push({
          name: candidate.name,
          rarity: selectedRarity,
          type: itemType,
          source: candidate.source,
          description,
          uri: candidate.uri
        });

        break; // Move to next iteration
      }
    }
  }

  return suggestions;
}

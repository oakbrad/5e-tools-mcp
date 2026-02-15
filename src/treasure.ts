// src/treasure.ts
// Treasure generation based on DMG 2014 Chapter 7

/**
 * Roll dice and return the sum
 */
export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Roll a percentile (d100) and return 1-100
 */
export function rollPercentile(): number {
  return Math.floor(Math.random() * 100) + 1;
}

/**
 * Coin amounts
 */
export interface CoinAmount {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

/**
 * Gem or Art Object
 */
export interface TreasureObject {
  type: "gem" | "art";
  value: number;
  description: string;
}

/**
 * Magic Item
 */
export interface MagicItem {
  table: string;
  description: string;
  rarity: string;
}

/**
 * Complete treasure hoard
 */
export interface TreasureHoard {
  coins: CoinAmount;
  gems: TreasureObject[];
  art: TreasureObject[];
  magicItems: MagicItem[];
  totalValueGP: number;
  description: string;
  hoardType: "individual" | "hoard";
  cr?: number;
  tier?: string;
}

/**
 * Individual Treasure tables by CR (DMG p.136)
 */
const INDIVIDUAL_TREASURE: Record<string, CoinAmount> = {
  "0": { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  "1/8": { cp: rollDice(5, 6), sp: 0, ep: 0, gp: 0, pp: 0 },
  "1/4": { cp: rollDice(5, 6), sp: 0, ep: 0, gp: 0, pp: 0 },
  "1/2": { cp: rollDice(6, 6), sp: 0, ep: 0, gp: rollDice(1, 6), pp: 0 },
  "1": { cp: rollDice(8, 6), sp: 0, ep: 0, gp: rollDice(3, 6), pp: 0 },
  "2": { cp: rollDice(10, 6), sp: rollDice(3, 6), ep: 0, gp: rollDice(2, 6), pp: 0 },
  "3": { cp: rollDice(10, 6), sp: rollDice(3, 6), ep: 0, gp: rollDice(2, 6), pp: 0 },
  "4": { cp: rollDice(15, 6), sp: rollDice(5, 6), ep: 0, gp: rollDice(4, 6), pp: 0 },
  "5": { cp: rollDice(20, 6), sp: rollDice(6, 6), ep: 0, gp: rollDice(8, 6), pp: 0 },
  "6": { cp: rollDice(25, 6), sp: rollDice(6, 6), ep: 0, gp: rollDice(8, 6), pp: 0 },
  "7": { cp: rollDice(30, 6), sp: rollDice(6, 6), ep: 0, gp: rollDice(10, 6), pp: 0 },
  "8": { cp: rollDice(35, 6), sp: rollDice(6, 6), ep: 0, gp: rollDice(12, 6), pp: 0 },
  "9": { cp: rollDice(40, 6), sp: rollDice(6, 6), ep: 0, gp: rollDice(15, 6), pp: 0 },
  "10": { cp: rollDice(40, 6), sp: rollDice(10, 6), ep: rollDice(3, 6), gp: rollDice(18, 6), pp: 0 },
  "11": { cp: rollDice(50, 6), sp: rollDice(10, 6), ep: rollDice(3, 6), gp: rollDice(21, 6), pp: 0 },
  "12": { cp: rollDice(50, 6), sp: rollDice(10, 6), ep: rollDice(3, 6), gp: rollDice(24, 6), pp: 0 },
  "13": { cp: rollDice(60, 6), sp: rollDice(10, 6), ep: rollDice(3, 6), gp: rollDice(27, 6), pp: 0 },
  "14": { cp: rollDice(60, 6), sp: rollDice(10, 6), ep: rollDice(3, 6), gp: rollDice(30, 6), pp: 0 },
  "15": { cp: rollDice(70, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(33, 6), pp: 0 },
  "16": { cp: rollDice(70, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(36, 6), pp: 0 },
  "17": { cp: rollDice(80, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(39, 6), pp: 0 },
  "18": { cp: rollDice(80, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(42, 6), pp: 0 },
  "19": { cp: rollDice(90, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(45, 6), pp: 0 },
  "20": { cp: rollDice(90, 6), sp: rollDice(10, 6), ep: rollDice(4, 6), gp: rollDice(48, 6), pp: 0 },
  "21": { cp: rollDice(100, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(51, 6), pp: 0 },
  "22": { cp: rollDice(100, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(54, 6), pp: 0 },
  "23": { cp: rollDice(100, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(57, 6), pp: 0 },
  "24": { cp: rollDice(100, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(60, 6), pp: 0 },
  "25": { cp: rollDice(110, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(63, 6), pp: 0 },
  "26": { cp: rollDice(110, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(66, 6), pp: 0 },
  "27": { cp: rollDice(120, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(69, 6), pp: 0 },
  "28": { cp: rollDice(120, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(72, 6), pp: 0 },
  "29": { cp: rollDice(130, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(75, 6), pp: 0 },
  "30": { cp: rollDice(130, 6), sp: rollDice(10, 6), ep: rollDice(5, 6), gp: rollDice(78, 6), pp: 0 },
};

/**
 * Hoard Treasure tables by tier (DMG p.137-139)
 */
interface HoardTreasureEntry {
  d100: number;
  coins: () => CoinAmount;
  gems?: () => TreasureObject[];
  art?: () => TreasureObject[];
  magicTable?: string;
}

const HOARD_TIER1: HoardTreasureEntry[] = [
  { d100: 30, coins: () => ({ cp: rollDice(6, 6), sp: 0, ep: 0, gp: rollDice(2, 6), pp: 0 }) },
  { d100: 60, coins: () => ({ cp: rollDice(3, 6), sp: rollDice(8, 6), ep: 0, gp: 0, pp: 0 }) },
  { d100: 70, coins: () => ({ cp: rollDice(2, 6), sp: rollDice(7, 6), ep: 0, gp: rollDice(4, 6), pp: 0 }), gems: () => generateGems(1, 10, 2) },
  { d100: 95, coins: () => ({ cp: rollDice(4, 6), sp: rollDice(5, 6), ep: 0, gp: rollDice(3, 6), pp: 0 }), gems: () => generateGems(1, 8, 3), magicTable: "F" },
  { d100: 100, coins: () => ({ cp: rollDice(2, 6), sp: rollDice(4, 6), ep: rollDice(3, 6), gp: rollDice(5, 6), pp: 0 }), gems: () => generateGems(1, 6, 4), magicTable: "G" },
];

const HOARD_TIER2: HoardTreasureEntry[] = [
  { d100: 30, coins: () => ({ cp: rollDice(4, 6) * 100, sp: rollDice(1, 6) * 100, ep: 0, gp: rollDice(1, 6) * 10, pp: 0 }) },
  { d100: 60, coins: () => ({ cp: rollDice(1, 6) * 100, sp: rollDice(1, 6) * 100, ep: 0, gp: rollDice(1, 6) * 100, pp: 0 }) },
  { d100: 70, coins: () => ({ cp: rollDice(2, 6) * 100, sp: rollDice(2, 6) * 10, ep: 0, gp: rollDice(5, 6) * 10, pp: 0 }), gems: () => generateGems(2, 4, 5) },
  { d100: 95, coins: () => ({ cp: rollDice(2, 6) * 100, sp: rollDice(2, 6) * 100, ep: 0, gp: rollDice(1, 6) * 100, pp: 0 }), gems: () => generateGems(3, 6, 6), magicTable: "G" },
  { d100: 100, coins: () => ({ cp: rollDice(2, 6) * 100, sp: rollDice(2, 6) * 100, ep: 0, gp: rollDice(2, 6) * 100, pp: 0 }), art: () => generateArt(2, 4, 7), magicTable: "H" },
];

const HOARD_TIER3: HoardTreasureEntry[] = [
  { d100: 20, coins: () => ({ cp: rollDice(4, 6) * 100, sp: rollDice(1, 6) * 1000, ep: 0, gp: rollDice(1, 6) * 100, pp: 0 }) },
  { d100: 35, coins: () => ({ cp: rollDice(1, 6) * 100, sp: 0, ep: 0, gp: rollDice(1, 6) * 1000, pp: 0 }) },
  { d100: 75, coins: () => ({ cp: rollDice(1, 6) * 100, sp: 0, ep: rollDice(2, 6) * 100, gp: rollDice(1, 6) * 1000, pp: 0 }), gems: () => generateGems(3, 6, 7) },
  { d100: 95, coins: () => ({ cp: rollDice(2, 6) * 100, sp: rollDice(2, 6) * 1000, ep: 0, gp: rollDice(1, 6) * 1000, pp: 0 }), art: () => generateArt(2, 4, 8), magicTable: "I" },
  { d100: 100, coins: () => ({ cp: rollDice(2, 6) * 100, sp: rollDice(2, 6) * 1000, ep: 0, gp: rollDice(2, 6) * 1000, pp: 0 }), gems: () => generateGems(4, 6, 8), art: () => generateArt(2, 4, 8), magicTable: "I" },
];

const HOARD_TIER4: HoardTreasureEntry[] = [
  { d100: 15, coins: () => ({ cp: rollDice(4, 6) * 1000, sp: rollDice(5, 6) * 100, ep: 0, gp: rollDice(4, 6) * 100, pp: rollDice(1, 6) * 10 }) },
  { d100: 55, coins: () => ({ cp: 0, sp: 0, ep: 0, gp: rollDice(12, 6) * 100, pp: rollDice(8, 6) * 10 }) },
  { d100: 100, coins: () => ({ cp: 0, sp: 0, ep: rollDice(2, 6) * 1000, gp: rollDice(8, 6) * 100, pp: rollDice(4, 6) * 100 }), gems: () => generateGems(5, 8, 9), art: () => generateArt(4, 6, 10), magicTable: "I" },
];

/**
 * Gem descriptions by value tier (DMG p.134)
 */
const GEM_DESCRIPTIONS: Record<number, string[]> = {
  1: ["Agate", "Azurite", "Blue quartz", "Hematite", "Lapis lazuli", "Malachite", "Moonstone", "Onyx", "Quartz", "Tiger eye"],
  2: ["Bloodstone", "Carnelian", "Chalcedony", "Chrysoprase", "Citrine", "Jasper", "Sard", "Sardonyx", "Zircon"],
  3: ["Amber", "Amethyst", "Chrysoberyl", "Coral", "Garnet", "Jade", "Jet", "Pearl", "Spinel", "Tourmaline"],
  4: ["Alexandrite", "Aquamarine", "Garnet", "Pearl", "Peridot", "Sapphire", "Spinel", "Topaz", "Tourmaline", "Zircon"],
  5: ["Emerald", "Opal", "Sapphire", "Ruby", "Topaz"],
  6: ["Diamond", "Emerald", "Opal", "Ruby", "Sapphire"],
  7: ["Diamond", "Emerald", "Opal", "Ruby", "Sapphire"],
  8: ["Diamond", "Emerald", "Opal", "Ruby", "Sapphire"],
  9: ["Diamond", "Emerald", "Opal", "Ruby", "Sapphire"],
  10: ["Diamond", "Emerald", "Opal", "Ruby", "Sapphire"],
};

/**
 * Art object descriptions by value tier (DMG p.134)
 */
const ART_DESCRIPTIONS: Record<number, string[]> = {
  1: ["Silver ewer", "Carved bone ornament", "Small gold comb", "Gold ring", "Silver necklace"],
  2: ["Gold comb with gold filigree", "Silver pendant with gemstone", "Gold ring with jewel", "Brooch with gemstone"],
  3: ["Gold cup with gemstones", "Silver necklace with gemstones", "Gold crown with jewels", "Jeweled bracelet"],
  4: ["Gold statuette with gems", "Painted portrait with jeweled frame", "Gold chalice with gemstones", "Silver mask with gems"],
  5: ["Golden throne with jewels", "Sculpture of precious metal with gems", "Gold bowl with gemstones", "Ancient tapestry with gold thread"],
  6: ["Golden crown with many jewels", "Silver statue with gemstones", "Gold chest with jewels", "Enchanted painting"],
  7: ["Golden throne with many jewels", "Silver chest with gemstones", "Golden crown with ancient jewels", "Jeweled crown of royalty"],
  8: ["Golden throne with many jewels", "Silver chest with gemstones", "Golden crown with ancient jewels", "Jeweled crown of royalty"],
  9: ["Golden throne with many jewels", "Silver chest with gemstones", "Golden crown with ancient jewels", "Jeweled crown of royalty"],
  10: ["Golden throne with many jewels", "Silver chest with gemstones", "Golden crown with ancient jewels", "Jeweled crown of royalty"],
};

/**
 * Gem value tiers in GP
 */
const GEM_VALUE_TIERS: Record<number, { min: number; max: number }> = {
  1: { min: 10, max: 50 },
  2: { min: 50, max: 100 },
  3: { min: 100, max: 500 },
  4: { min: 500, max: 1000 },
  5: { min: 1000, max: 5000 },
  6: { min: 5000, max: 10000 },
  7: { min: 10000, max: 25000 },
  8: { min: 25000, max: 50000 },
  9: { min: 50000, max: 100000 },
  10: { min: 100000, max: 500000 },
};

/**
 * Art object value tiers in GP
 */
const ART_VALUE_TIERS: Record<number, { min: number; max: number }> = {
  1: { min: 10, max: 25 },
  2: { min: 25, max: 75 },
  3: { min: 75, max: 250 },
  4: { min: 250, max: 750 },
  5: { min: 750, max: 2500 },
  6: { min: 2500, max: 7500 },
  7: { min: 7500, max: 25000 },
  8: { min: 25000, max: 75000 },
  9: { min: 75000, max: 250000 },
  10: { min: 250000, max: 1000000 },
};

/**
 * Magic Item Tables (DMG p.144-146)
 */
interface MagicItemEntry {
  d100: number;
  description: string;
  rarity: string;
}

const MAGIC_TABLE_A: MagicItemEntry[] = [
  { d100: 50, description: "Potion of healing", rarity: "Common" },
  { d100: 60, description: "Spell scroll (cantrip)", rarity: "Common" },
  { d100: 70, description: "Potion of climbing", rarity: "Common" },
  { d100: 90, description: "Spell scroll (1st level)", rarity: "Common" },
  { d100: 94, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 99, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 100, description: "Driftglobe", rarity: "Uncommon" },
];

const MAGIC_TABLE_B: MagicItemEntry[] = [
  { d100: 15, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 22, description: "Potion of swiftness", rarity: "Uncommon" },
  { d100: 29, description: "Potion of vitality", rarity: "Uncommon" },
  { d100: 36, description: "Potion of resistance", rarity: "Uncommon" },
  { d100: 43, description: "Ammunition, +1", rarity: "Uncommon" },
  { d100: 50, description: "Potion of animal friendship", rarity: "Uncommon" },
  { d100: 57, description: "Potion of hill giant strength", rarity: "Uncommon" },
  { d100: 64, description: "Potion of growth", rarity: "Uncommon" },
  { d100: 71, description: "Potion of water breathing", rarity: "Uncommon" },
  { d100: 79, description: "Spell scroll (2nd level)", rarity: "Uncommon" },
  { d100: 86, description: "Spell scroll (3rd level)", rarity: "Uncommon" },
  { d100: 93, description: "Bag of beans", rarity: "Uncommon" },
  { d100: 98, description: "Chime of opening", rarity: "Uncommon" },
  { d100: 100, description: "Decanter of endless water", rarity: "Uncommon" },
];

const MAGIC_TABLE_C: MagicItemEntry[] = [
  { d100: 15, description: "Potion of flight", rarity: "Uncommon" },
  { d100: 22, description: "Potion of giant strength (hill giant)", rarity: "Uncommon" },
  { d100: 29, description: "Potion of giant strength (stone giant)", rarity: "Uncommon" },
  { d100: 36, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 43, description: "Potion of invulnerability", rarity: "Uncommon" },
  { d100: 50, description: "Potion of mind reading", rarity: "Uncommon" },
  { d100: 57, description: "Potion of speed", rarity: "Uncommon" },
  { d100: 64, description: "Potion of water breathing", rarity: "Uncommon" },
  { d100: 70, description: "Spell scroll (4th level)", rarity: "Rare" },
  { d100: 75, description: "Spell scroll (5th level)", rarity: "Rare" },
  { d100: 80, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 85, description: "Keoghtom's ointment", rarity: "Uncommon" },
  { d100: 90, description: "Oil of slipperiness", rarity: "Uncommon" },
  { d100: 95, description: "Dust of disappearance", rarity: "Uncommon" },
  { d100: 98, description: "Dust of dryness", rarity: "Uncommon" },
  { d100: 100, description: "Dust of sneezing and choking", rarity: "Uncommon" },
];

const MAGIC_TABLE_D: MagicItemEntry[] = [
  { d100: 20, description: "+1 weapon", rarity: "Uncommon" },
  { d100: 30, description: "+1 armor", rarity: "Uncommon" },
  { d100: 40, description: "Potion of flight", rarity: "Rare" },
  { d100: 50, description: "Potion of giant strength (fire giant)", rarity: "Rare" },
  { d100: 55, description: "Potion of giant strength (frost giant)", rarity: "Rare" },
  { d100: 60, description: "+1 ammunition", rarity: "Uncommon" },
  { d100: 65, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 70, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 75, description: "Potion of invulnerability", rarity: "Rare" },
  { d100: 80, description: "Potion of mind reading", rarity: "Rare" },
  { d100: 85, description: "Potion of speed", rarity: "Rare" },
  { d100: 90, description: "Potion of vitality", rarity: "Rare" },
  { d100: 95, description: "Spell scroll (6th level)", rarity: "Rare" },
  { d100: 100, description: "Spell scroll (7th level)", rarity: "Very Rare" },
];

const MAGIC_TABLE_E: MagicItemEntry[] = [
  { d100: 30, description: "+1 weapon", rarity: "Uncommon" },
  { d100: 55, description: "+1 shield, +1 armor, or +1 weapon", rarity: "Uncommon" },
  { d100: 70, description: "Potion of giant strength (cloud giant)", rarity: "Rare" },
  { d100: 85, description: "Potion of giant strength (storm giant)", rarity: "Rare" },
  { d100: 90, description: "Potion of speed", rarity: "Rare" },
  { d100: 95, description: "Spell scroll (8th level)", rarity: "Very Rare" },
  { d100: 100, description: "Potion of invulnerability", rarity: "Rare" },
];

const MAGIC_TABLE_F: MagicItemEntry[] = [
  { d100: 15, description: "Potion of healing", rarity: "Common" },
  { d100: 22, description: "Spell scroll (1st level)", rarity: "Common" },
  { d100: 29, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 36, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 43, description: "Driftglobe", rarity: "Uncommon" },
  { d100: 50, description: "Keoghtom's ointment", rarity: "Uncommon" },
  { d100: 57, description: "Oil of slipperiness", rarity: "Uncommon" },
  { d100: 64, description: "Potion of climbing", rarity: "Common" },
  { d100: 71, description: "Potion of giant strength (hill giant)", rarity: "Uncommon" },
  { d100: 79, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 86, description: "Potion of water breathing", rarity: "Uncommon" },
  { d100: 93, description: "Spell scroll (2nd level)", rarity: "Uncommon" },
  { d100: 100, description: "Potion of resistance", rarity: "Uncommon" },
];

const MAGIC_TABLE_G: MagicItemEntry[] = [
  { d100: 11, description: "+1 weapon", rarity: "Uncommon" },
  { d100: 14, description: "+1 armor", rarity: "Uncommon" },
  { d100: 20, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 25, description: "Potion of giant strength (hill giant)", rarity: "Uncommon" },
  { d100: 30, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 35, description: "Potion of speed", rarity: "Uncommon" },
  { d100: 40, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 45, description: "Chime of opening", rarity: "Uncommon" },
  { d100: 50, description: "Decanter of endless water", rarity: "Uncommon" },
  { d100: 55, description: "Spell scroll (3rd level)", rarity: "Uncommon" },
  { d100: 60, description: "Spell scroll (4th level)", rarity: "Rare" },
  { d100: 65, description: "Driftglobe", rarity: "Uncommon" },
  { d100: 70, description: "Bag of beans", rarity: "Uncommon" },
  { d100: 75, description: "Keoghtom's ointment", rarity: "Uncommon" },
  { d100: 80, description: "Oil of slipperiness", rarity: "Uncommon" },
  { d100: 85, description: "Potion of climbing", rarity: "Common" },
  { d100: 90, description: "Potion of healing", rarity: "Common" },
  { d100: 95, description: "Spell scroll (2nd level)", rarity: "Uncommon" },
  { d100: 100, description: "Potion of resistance", rarity: "Uncommon" },
];

const MAGIC_TABLE_H: MagicItemEntry[] = [
  { d100: 5, description: "+2 weapon", rarity: "Rare" },
  { d100: 10, description: "+1 shield, +2 armor, or +2 weapon", rarity: "Rare" },
  { d100: 15, description: "Potion of flight", rarity: "Rare" },
  { d100: 20, description: "Potion of giant strength (fire giant)", rarity: "Rare" },
  { d100: 25, description: "Potion of giant strength (frost giant)", rarity: "Rare" },
  { d100: 30, description: "Potion of invulnerability", rarity: "Rare" },
  { d100: 35, description: "Potion of mind reading", rarity: "Rare" },
  { d100: 40, description: "Potion of speed", rarity: "Rare" },
  { d100: 45, description: "Potion of vitality", rarity: "Rare" },
  { d100: 50, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 55, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 60, description: "Spell scroll (5th level)", rarity: "Rare" },
  { d100: 65, description: "Spell scroll (6th level)", rarity: "Rare" },
  { d100: 70, description: "Spell scroll (7th level)", rarity: "Very Rare" },
  { d100: 75, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 80, description: "Keoghtom's ointment", rarity: "Uncommon" },
  { d100: 85, description: "Oil of slipperiness", rarity: "Uncommon" },
  { d100: 90, description: "Potion of climbing", rarity: "Common" },
  { d100: 95, description: "Potion of healing", rarity: "Common" },
  { d100: 100, description: "Potion of resistance", rarity: "Uncommon" },
];

const MAGIC_TABLE_I: MagicItemEntry[] = [
  { d100: 3, description: "+3 weapon", rarity: "Very Rare" },
  { d100: 6, description: "+2 shield, +3 armor, or +3 weapon", rarity: "Very Rare" },
  { d100: 9, description: "Potion of giant strength (cloud giant)", rarity: "Rare" },
  { d100: 12, description: "Potion of giant strength (storm giant)", rarity: "Rare" },
  { d100: 15, description: "Potion of invulnerability", rarity: "Rare" },
  { d100: 18, description: "Potion of speed", rarity: "Rare" },
  { d100: 21, description: "Potion of vitality", rarity: "Rare" },
  { d100: 24, description: "Spell scroll (8th level)", rarity: "Very Rare" },
  { d100: 27, description: "Spell scroll (9th level)", rarity: "Very Rare" },
  { d100: 30, description: "Potion of flight", rarity: "Rare" },
  { d100: 35, description: "Potion of giant strength (fire giant)", rarity: "Rare" },
  { d100: 40, description: "Potion of giant strength (frost giant)", rarity: "Rare" },
  { d100: 45, description: "Potion of greater healing", rarity: "Uncommon" },
  { d100: 50, description: "Potion of heroism", rarity: "Uncommon" },
  { d100: 55, description: "Potion of speed", rarity: "Uncommon" },
  { d100: 60, description: "Spell scroll (5th level)", rarity: "Rare" },
  { d100: 65, description: "Spell scroll (6th level)", rarity: "Rare" },
  { d100: 70, description: "Spell scroll (7th level)", rarity: "Very Rare" },
  { d100: 75, description: "Bag of holding", rarity: "Uncommon" },
  { d100: 80, description: "Keoghtom's ointment", rarity: "Uncommon" },
  { d100: 85, description: "Oil of slipperiness", rarity: "Uncommon" },
  { d100: 90, description: "Potion of climbing", rarity: "Common" },
  { d100: 95, description: "Potion of healing", rarity: "Common" },
  { d100: 100, description: "Potion of resistance", rarity: "Uncommon" },
];

/**
 * Map table letters to their entries
 */
const MAGIC_TABLES: Record<string, MagicItemEntry[]> = {
  "A": MAGIC_TABLE_A,
  "B": MAGIC_TABLE_B,
  "C": MAGIC_TABLE_C,
  "D": MAGIC_TABLE_D,
  "E": MAGIC_TABLE_E,
  "F": MAGIC_TABLE_F,
  "G": MAGIC_TABLE_G,
  "H": MAGIC_TABLE_H,
  "I": MAGIC_TABLE_I,
};

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
 * Generate gems for a given count and value tier
 */
function generateGems(count: number, valueTier: number, descriptionTier: number): TreasureObject[] {
  const gems: TreasureObject[] = [];
  const valueRange = GEM_VALUE_TIERS[valueTier] || { min: 10, max: 50 };
  const descriptions = GEM_DESCRIPTIONS[descriptionTier] || GEM_DESCRIPTIONS[1];

  for (let i = 0; i < count; i++) {
    const value = rollDice(1, valueRange.max - valueRange.min + 1) + valueRange.min - 1;
    const description = descriptions[rollDice(1, descriptions.length) - 1];
    gems.push({
      type: "gem",
      value,
      description: `${description} (${value} gp)`,
    });
  }

  return gems;
}

/**
 * Generate art objects for a given count and value tier
 */
function generateArt(count: number, valueTier: number, descriptionTier: number): TreasureObject[] {
  const artObjects: TreasureObject[] = [];
  const valueRange = ART_VALUE_TIERS[valueTier] || { min: 10, max: 25 };
  const descriptions = ART_DESCRIPTIONS[descriptionTier] || ART_DESCRIPTIONS[1];

  for (let i = 0; i < count; i++) {
    const value = rollDice(1, valueRange.max - valueRange.min + 1) + valueRange.min - 1;
    const description = descriptions[rollDice(1, descriptions.length) - 1];
    artObjects.push({
      type: "art",
      value,
      description: `${description} (${value} gp)`,
    });
  }

  return artObjects;
}

/**
 * Roll on a magic item table
 */
function rollMagicItemTable(tableLetter: string, magicItemPreference: "none" | "few" | "many"): MagicItem | null {
  if (magicItemPreference === "none") {
    return null;
  }

  const table = MAGIC_TABLES[tableLetter.toUpperCase()];
  if (!table) {
    return null;
  }

  // Adjust roll chance based on preference
  const roll = rollPercentile();
  
  // For "few", skip some entries
  if (magicItemPreference === "few" && roll > 70) {
    return null;
  }

  const entry = table.find((e) => roll <= e.d100);
  if (!entry) {
    return null;
  }

  return {
    table: `Table ${tableLetter}`,
    description: entry.description,
    rarity: entry.rarity,
  };
}

/**
 * Generate individual treasure by CR
 */
export function generateIndividualTreasure(cr: number | string): TreasureHoard {
  const normalizedCR = normalizeCR(cr);
  const coinEntry = INDIVIDUAL_TREASURE[normalizedCR] || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  const totalValueGP = coinEntry.cp * 0.01 + coinEntry.sp * 0.1 + coinEntry.ep * 0.5 + coinEntry.gp + coinEntry.pp * 10;

  const description = `Individual treasure for CR ${normalizedCR}: ${formatCoins(coinEntry)}`;

  return {
    coins: coinEntry,
    gems: [],
    art: [],
    magicItems: [],
    totalValueGP,
    description,
    hoardType: "individual",
    cr: parseFloat(normalizedCR.includes("/") ? eval(normalizedCR) : normalizedCR),
  };
}

/**
 * Generate hoard treasure by tier
 */
export function generateHoardTreasure(
  tier: "tier1" | "tier2" | "tier3" | "tier4",
  magicItemPreference: "none" | "few" | "many" = "few"
): TreasureHoard {
  let hoardTable: HoardTreasureEntry[];
  let tierDescription: string;

  switch (tier) {
    case "tier1":
      hoardTable = HOARD_TIER1;
      tierDescription = "Tier 1 (levels 1-4)";
      break;
    case "tier2":
      hoardTable = HOARD_TIER2;
      tierDescription = "Tier 2 (levels 5-10)";
      break;
    case "tier3":
      hoardTable = HOARD_TIER3;
      tierDescription = "Tier 3 (levels 11-16)";
      break;
    case "tier4":
      hoardTable = HOARD_TIER4;
      tierDescription = "Tier 4 (levels 17-20)";
      break;
  }

  // Roll on the hoard table
  const roll = rollPercentile();
  const entry = hoardTable.find((e) => roll <= e.d100) || hoardTable[0];

  const coins = entry.coins();
  const gems = entry.gems ? entry.gems() : [];
  const art = entry.art ? entry.art() : [];
  const magicItems: MagicItem[] = [];

  // Roll for magic items if applicable
  if (entry.magicTable) {
    const magicItem = rollMagicItemTable(entry.magicTable, magicItemPreference);
    if (magicItem) {
      magicItems.push(magicItem);
    }
  }

  const totalValueGP =
    coins.cp * 0.01 +
    coins.sp * 0.1 +
    coins.ep * 0.5 +
    coins.gp +
    coins.pp * 10 +
    gems.reduce((sum, g) => sum + g.value, 0) +
    art.reduce((sum, a) => sum + a.value, 0);

  const descriptionParts = [`Hoard treasure - ${tierDescription}`];
  descriptionParts.push(formatCoins(coins));

  if (gems.length > 0) {
    descriptionParts.push(`Gems: ${gems.map((g) => g.description).join(", ")}`);
  }

  if (art.length > 0) {
    descriptionParts.push(`Art: ${art.map((a) => a.description).join(", ")}`);
  }

  if (magicItems.length > 0) {
    descriptionParts.push(`Magic Items: ${magicItems.map((m) => `${m.description} (${m.rarity})`).join(", ")}`);
  }

  return {
    coins,
    gems,
    art,
    magicItems,
    totalValueGP,
    description: descriptionParts.join("\n"),
    hoardType: "hoard",
    tier,
  };
}

/**
 * Generate treasure by CR (individual) or tier (hoard)
 */
export function generateTreasure(options: {
  challenge_rating?: number;
  hoard_tier?: "tier1" | "tier2" | "tier3" | "tier4";
  magic_item_preference?: "none" | "few" | "many";
}): TreasureHoard {
  const { challenge_rating, hoard_tier, magic_item_preference = "few" } = options;

  // If hoard_tier is specified, generate hoard treasure
  if (hoard_tier) {
    return generateHoardTreasure(hoard_tier, magic_item_preference);
  }

  // Otherwise, use CR for individual treasure
  if (challenge_rating !== undefined) {
    return generateIndividualTreasure(challenge_rating);
  }

  // Default: Tier 1 hoard
  return generateHoardTreasure("tier1", magic_item_preference);
}

/**
 * Format coins for display
 */
function formatCoins(coins: CoinAmount): string {
  const parts: string[] = [];
  if (coins.cp > 0) parts.push(`${coins.cp} cp`);
  if (coins.sp > 0) parts.push(`${coins.sp} sp`);
  if (coins.ep > 0) parts.push(`${coins.ep} ep`);
  if (coins.gp > 0) parts.push(`${coins.gp} gp`);
  if (coins.pp > 0) parts.push(`${coins.pp} pp`);
  return parts.length > 0 ? parts.join(", ") : "No coins";
}

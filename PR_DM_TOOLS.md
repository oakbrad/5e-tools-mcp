# Add DM Prep Tools

## Summary

Implements four essential DM preparation tools that dramatically reduce the number of queries needed during session prep. Based on Brad's request to streamline encounter planning, treasure generation, and magic item selection workflows.

## New Tools

### 1. `generate_treasure` 
**Purpose**: Generate treasure following DMG Chapter 7 treasure tables

**Input**:
- `challenge_rating?: number` - CR of the encounter (0-30) for individual treasure
- `hoard_tier?: "tier1"|"tier2"|"tier3"|"tier4"` - Hoard tier for party level ranges
- `magic_item_preference?: "none"|"few"|"many"` - Adjust magic item frequency

**Output**:
- Copper/Silver/Electrum/Gold/Platinum coins
- Gems with values and descriptions
- Art objects with values and descriptions
- Magic items from Tables A-I
- Total gold piece value

**Features**:
- Full DMG treasure tables (individual + hoard)
- 10 gem value tiers with flavor descriptions
- Magic item tables A-I with proper distributions
- Configurable magic item frequency

**Example**:
```typescript
{
  hoard_tier: "tier2",
  magic_item_preference: "many"
  // Returns: 12,000 gp, 4 gems (500gp each), 2 art objects (750gp each), 
  // 3 magic items (Tables A-D)
}
```

---

### 2. `random_encounter`
**Purpose**: Generate environment-appropriate random encounters

**Input**:
- `environment: string` - Terrain type (forest, underdark, mountain, desert, urban, coast, arctic, swamp, grassland)
- `party: number[]` - Character levels
- `difficulty: "easy"|"medium"|"hard"|"deadly"` - Desired difficulty
- `monster_count?: number` - Preferred number of monsters
- `ruleset?: "2014"|"2024"|"any"` - Ruleset filter

**Output**:
- Thematically appropriate monsters for environment
- Encounter difficulty rating
- Total XP (base and adjusted)
- Flavor text describing the encounter

**Features**:
- 9 environment types with curated monster type lists
- Forest: beasts, fey, plants
- Underdark: aberrations, oozes, drow
- Mountain: giants, dragons, orcs
- Desert: elementals, monstrosities
- Urban: humanoids, constructs, undead
- Coast/Arctic/Swamp/Grassland: appropriate creature types

**Example**:
```typescript
{
  environment: "underdark",
  party: [5, 5, 5, 5],
  difficulty: "hard"
  // Returns: 3× Mind Flayer (CR 7), adjusted XP 3600, Hard encounter
  // "Deep in the lightless depths, horror stirs..."
}
```

---

### 3. `scale_encounter`
**Purpose**: Adjust encounters to new difficulty or party composition

**Input**:
- `current_encounter: Array<{cr: number|string, count: number}>` - Current monsters
- `current_party: number[]` - Original party levels
- `target_party?: number[]` - New party levels (if party changed)
- `target_difficulty?: "easy"|"medium"|"hard"|"deadly"` - Desired difficulty
- `adjustment?: "easier"|"harder"` - Relative adjustment

**Output**:
- Original encounter summary (XP, difficulty)
- Scaled encounter with adjusted counts/CRs
- New difficulty rating
- Detailed rationale explaining what changed and why
- Scaling strategy used

**Features**:
- Three scaling strategies:
  - **Count scaling**: Increase/decrease monster numbers
  - **CR swapping**: Replace with higher/lower CR versions
  - **Mixed**: Combination approach
- Preserves encounter "feel" (same monster types)
- Supports party size/level changes

**Example**:
```typescript
{
  current_encounter: [{cr: 5, count: 2}],
  current_party: [7, 7, 7, 7],
  target_difficulty: "deadly"
  // Returns: 4× CR 5 (scaled from 2), Medium → Deadly
  // Rationale: "Increased monster count from 2 to 4 to reach deadly threshold"
}
```

---

### 4. `suggest_magic_items`
**Purpose**: Suggest tier-appropriate magic items for party level

**Input**:
- `party_level?: number` - Average party level (1-20)
- `tier?: "tier1"|"tier2"|"tier3"|"tier4"` - Alternative to party_level
- `item_type?: string` - Filter by type (weapon, armor, wondrous, potion, scroll, ring, rod, staff, wand)
- `rarity?: "common"|"uncommon"|"rare"|"very rare"|"legendary"|"artifact"` - Override tier-appropriate rarity
- `count?: number` - How many items to suggest (default: 5, max: 50)
- `source?: string` - Filter by source abbreviation
- `ruleset?: "2014"|"2024"|"any"` - Ruleset filter

**Output**:
- Array of magic items appropriate for tier
- Each item: name, rarity, type, source, brief description

**Features**:
- Tier-appropriate rarity distributions:
  - **Tier 1 (1-4)**: Common 30%, Uncommon 70%
  - **Tier 2 (5-10)**: Uncommon 50%, Rare 50%
  - **Tier 3 (11-16)**: Rare 40%, Very Rare 60%
  - **Tier 4 (17-20)**: Very Rare 60%, Legendary 40%
- Weighted selection within tier constraints
- Multiple filter options (type, rarity, source, ruleset)

**Example**:
```typescript
{
  party_level: 8,
  item_type: "weapon",
  count: 3
  // Returns: 3 tier-appropriate weapons (mix of Uncommon/Rare)
  // e.g., +1 Longsword, Flame Tongue, Oathbow
}
```

---

## Implementation

**Files Added**:
- `src/treasure.ts` (27KB) - Treasure generation with DMG tables
- `src/random-encounter.ts` - Environment-based encounter generation
- `src/scale-encounter.ts` - Encounter scaling logic
- `src/magic-items.ts` - Magic item suggestion with tier weighting
- `tests/treasure.test.ts` (44 tests)
- `tests/random-encounter.test.ts` (29 tests)
- `tests/scale-encounter.test.ts` (25 tests)
- `tests/magic-items.test.ts` (24 tests)

**Files Modified**:
- `src/server.ts` - 4 new tool registrations with comprehensive schemas

**Test Coverage**:
- 122 new tests covering all functionality
- All edge cases (CR 0-30, fractional CRs, party sizes, environments)
- Statistical validation for treasure generation
- DMG compliance verification

---

## Testing

All 234 tests pass:
```bash
npm test
# ✓ 234 tests passed (122 new)
```

---

## Usage Impact

**Before** (manual multi-query workflow):
1. "Search monsters in forest"
2. "What's CR 3 XP?"
3. "Calculate encounter difficulty for 4× 5th level"
4. "What magic items for tier 2?"
5. "Roll treasure for CR 5 hoard"
→ **5+ queries per encounter**

**After** (streamlined single queries):
- `random_encounter({environment: "forest", party: [5,5,5,5], difficulty: "medium"})` → Complete thematic encounter
- `generate_treasure({hoard_tier: "tier2"})` → Full treasure hoard
- `suggest_magic_items({party_level: 5, count: 3})` → Tier-appropriate loot
- `scale_encounter({...})` → Instant difficulty adjustment
→ **1 query per task**

---

## Reference

Based on **Dungeon Master's Guide (2014)**:
- Chapter 7: Treasure (individual/hoard tables, magic items)
- Chapter 13: Building Encounters (XP, multipliers, thresholds)
- Appendix A: Random Dungeons (environment encounter tables)

Full encounter design reference: `~/.openclaw/workspace/skills/5etools/references/encounter-design.md`

---

## Next Steps

Potential enhancements:
- NPC generator (stats + personality traits)
- Trap generator (CR-appropriate traps)
- Lair action generator for boss encounters
- Weather/environment hazard generator

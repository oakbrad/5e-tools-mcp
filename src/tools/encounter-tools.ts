// src/tools/encounter-tools.ts
// MCP tool registrations for encounter building:
// calculate_party_thresholds, evaluate_encounter, suggest_encounter,
// scale_encounter, random_encounter

import { z } from "zod";
import { calculatePartyThresholds, evaluateEncounter, suggestEncounters } from "../encounter.js";
import { scaleEncounter } from "../scale-encounter.js";
import { generateRandomEncounter } from "../random-encounter.js";
import type { ToolContext, ToolResponse } from "../types.js";

export function registerEncounterTools(ctx: ToolContext): void {
  const { server, idx } = ctx;

  server.registerTool(
    "calculate_party_thresholds",
    {
      title: "Calculate party XP thresholds",
      description:
        "Calculate Easy/Medium/Hard/Deadly XP thresholds and daily budget for a party of characters.",
      inputSchema: {
        party: z
          .array(z.number().int().min(1).max(20))
          .describe("Array of character levels (e.g., [3, 3, 3, 2])"),
      },
    },
    async ({ party }) => {
      try {
        const thresholds = calculatePartyThresholds(party);
        const text = `**Party of ${thresholds.partySize} characters**
Levels: ${party.join(", ")}

**Encounter Thresholds:**
• Easy: ${thresholds.easy} XP
• Medium: ${thresholds.medium} XP
• Hard: ${thresholds.hard} XP
• Deadly: ${thresholds.deadly} XP

**Daily XP Budget:** ${thresholds.dailyBudget} XP`;

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(thresholds, null, 2) },
          ],
        } as ToolResponse;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }
    },
  );

  server.registerTool(
    "evaluate_encounter",
    {
      title: "Evaluate encounter difficulty",
      description:
        "Calculate the difficulty of an encounter given a party and monsters. Supports fractional CR (e.g., '1/4', 0.25).",
      inputSchema: {
        party: z.array(z.number().int().min(1).max(20)).describe("Array of character levels"),
        monsters: z
          .array(
            z.object({
              cr: z
                .union([z.number(), z.string()])
                .describe("Challenge Rating (supports '1/8', '1/4', '1/2', or decimal/integer)"),
              count: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Number of monsters of this CR (default: 1)"),
            }),
          )
          .describe("Array of monsters with their CR and count"),
      },
    },
    async ({ party, monsters }) => {
      try {
        const evaluation = evaluateEncounter(party, monsters);

        const monsterSummary = evaluation.monsters
          .map((m) => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
          .join("\n");

        const text = `**Encounter Evaluation**

**Party:** ${party.length} characters at levels ${party.join(", ")}

**Monsters:**
${monsterSummary}

**XP Calculation:**
• Base XP: ${evaluation.totalBaseXP}
• Multiplier: ×${evaluation.multiplier} (${evaluation.monsters.reduce((sum, m) => sum + m.count, 0)} monsters, ${party.length} PCs)
• Adjusted XP: ${evaluation.adjustedXP}

**Difficulty:** **${evaluation.difficulty}**

**Party Thresholds:**
• Easy: ${evaluation.partyThresholds.easy}
• Medium: ${evaluation.partyThresholds.medium}
• Hard: ${evaluation.partyThresholds.hard}
• Deadly: ${evaluation.partyThresholds.deadly}`;

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(evaluation, null, 2) },
          ],
        } as ToolResponse;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }
    },
  );

  server.registerTool(
    "suggest_encounter",
    {
      title: "Suggest encounter compositions",
      description:
        "Generate encounter suggestions for a desired difficulty. Returns 5-10 balanced encounter options with actual monster names.",
      inputSchema: {
        party: z.array(z.number().int().min(1).max(20)).describe("Array of character levels"),
        difficulty: z
          .enum(["easy", "medium", "hard", "deadly"])
          .describe("Desired encounter difficulty"),
        monster_count: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Preferred number of monsters (default: 1 per 4 PCs)"),
        cr_min: z.number().optional().describe("Minimum CR to consider"),
        cr_max: z.number().optional().describe("Maximum CR to consider"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Ruleset to use for monster selection (default: any)"),
      },
    },
    async ({ party, difficulty, monster_count, cr_min, cr_max, ruleset = "any" }) => {
      try {
        const suggestions = suggestEncounters(party, difficulty, {
          monsterCount: monster_count,
          crMin: cr_min,
          crMax: cr_max,
          searchIndex: idx,
          ruleset,
        });

        if (suggestions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No suitable encounters found for a ${difficulty} encounter with the given constraints.`,
              },
            ],
            isError: true,
          } as ToolResponse;
        }

        const lines = [`**Encounter Suggestions for ${difficulty.toUpperCase()} difficulty**\n`];
        lines.push(`Party: ${party.length} characters at levels ${party.join(", ")}\n`);

        suggestions.forEach((suggestion, i) => {
          const monsterDesc = suggestion.monsters
            .map((m) => {
              const crPart = `${m.count}× CR ${m.cr}`;
              return m.name ? `${crPart} (${m.name})` : crPart;
            })
            .join(" + ");

          lines.push(`**${i + 1}.** ${monsterDesc}`);
          lines.push(
            `   Base XP: ${suggestion.totalBaseXP} | Adjusted: ${suggestion.adjustedXP} | Difficulty: ${suggestion.difficulty}\n`,
          );
        });

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            { type: "text", text: JSON.stringify(suggestions, null, 2) },
          ],
        } as ToolResponse;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }
    },
  );

  server.registerTool(
    "scale_encounter",
    {
      title: "Scale encounter difficulty",
      description:
        "Adjust an existing encounter to match a new difficulty or party composition. Preserves the encounter's feel by scaling monster counts and CRs proportionally.",
      inputSchema: {
        current_encounter: z
          .array(
            z.object({
              cr: z
                .union([z.number(), z.string()])
                .describe("Challenge Rating (supports '1/8', '1/4', '1/2', or decimal/integer)"),
              count: z.number().int().positive().describe("Number of monsters of this CR"),
            }),
          )
          .describe("Current monsters in the encounter"),
        current_party: z.array(z.number().int().min(1).max(20)).describe("Original party levels"),
        target_party: z
          .array(z.number().int().min(1).max(20))
          .optional()
          .describe("New party levels (if party composition changed)"),
        target_difficulty: z
          .enum(["easy", "medium", "hard", "deadly"])
          .optional()
          .describe("Desired difficulty (alternative to adjustment)"),
        adjustment: z
          .enum(["easier", "harder"])
          .optional()
          .describe("Relative adjustment: 'easier' or 'harder' (alternative to target_difficulty)"),
      },
    },
    async ({ current_encounter, current_party, target_party, target_difficulty, adjustment }) => {
      try {
        const result = scaleEncounter({
          current_encounter,
          current_party,
          target_party,
          target_difficulty,
          adjustment,
        });

        const originalMonsters = result.original.monsters
          .map((m) => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
          .join("\n");

        const scaledMonsters = result.scaled.monsters
          .map((m) => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
          .join("\n");

        const text = `**Encounter Scaling**

**Original Encounter:**
• Party: ${current_party.length} characters at levels ${current_party.join(", ")}
• Monsters:
${originalMonsters}
• Base XP: ${result.original.totalBaseXP}
• Adjusted XP: ${result.original.adjustedXP}
• Difficulty: **${result.original.difficulty}**

**Scaled Encounter:**
• Party: ${target_party?.length ?? current_party.length} characters at levels ${(target_party ?? current_party).join(", ")}
• Monsters:
${scaledMonsters}
• Base XP: ${result.scaled.totalBaseXP}
• Adjusted XP: ${result.scaled.adjustedXP}
• Difficulty: **${result.scaled.difficulty}**

**Scaling Rationale:**
${result.rationale.map((r) => `• ${r}`).join("\n")}

**Strategy Used:** ${result.strategy.replace(/_/g, " ")}`;

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        } as ToolResponse;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }
    },
  );

  server.registerTool(
    "random_encounter",
    {
      title: "Generate random encounter",
      description:
        "Generate a thematic random encounter based on environment and party level. Returns a complete encounter with monsters, XP values, difficulty rating, and flavor text.",
      inputSchema: {
        environment: z
          .enum([
            "forest",
            "underdark",
            "mountain",
            "desert",
            "urban",
            "coast",
            "arctic",
            "swamp",
            "grassland",
          ])
          .describe("Terrain/environment type for the encounter"),
        party: z
          .array(z.number().int().min(1).max(20))
          .describe("Array of character levels (e.g., [3, 3, 3, 2])"),
        difficulty: z
          .enum(["easy", "medium", "hard", "deadly"])
          .describe("Desired encounter difficulty"),
        monster_count: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Preferred number of monsters (default: 1 per 4 PCs)"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Ruleset to use for monster selection (default: any)"),
      },
    },
    async ({ environment, party, difficulty, monster_count, ruleset = "any" }) => {
      try {
        const encounter = generateRandomEncounter(party, environment, difficulty, idx, {
          ruleset,
          monsterCount: monster_count,
        });

        const monsterDesc = encounter.monsters
          .map((m) => `${m.count}× ${m.name} (CR ${m.cr})`)
          .join("\n  ");

        const lines = [
          `**Random Encounter: ${environment.charAt(0).toUpperCase() + environment.slice(1)}**`,
          ``,
          encounter.flavorText,
          ``,
          `**Party:** ${party.length} characters at levels ${party.join(", ")}`,
          ``,
          `**Monsters:**`,
          `  ${monsterDesc}`,
          ``,
          `**XP Calculation:**`,
          `• Base XP: ${encounter.totalBaseXP}`,
          `• Multiplier: ×${encounter.encounterMultiplier}`,
          `• Adjusted XP: ${encounter.adjustedXP}`,
          ``,
          `**Difficulty:** **${encounter.difficultyRating}**`,
          ``,
          `**Party Thresholds:**`,
          `• Easy: ${encounter.partyThresholds.easy} XP`,
          `• Medium: ${encounter.partyThresholds.medium} XP`,
          `• Hard: ${encounter.partyThresholds.hard} XP`,
          `• Deadly: ${encounter.partyThresholds.deadly} XP`,
        ];

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            { type: "text", text: JSON.stringify(encounter, null, 2) },
          ],
        } as ToolResponse;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }
    },
  );
}

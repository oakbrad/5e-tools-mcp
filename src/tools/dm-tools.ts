// src/tools/dm-tools.ts
// MCP tool registrations for DM prep utilities:
// generate_treasure, suggest_magic_items, roll_on_table, roll_on_tables

import { z } from "zod";
import { generateTreasure } from "../treasure.js";
import { suggestMagicItems, levelToTier } from "../magic-items.js";
import { rollOnTable, formatRollResults, formatMultiRollResults } from "../tables.js";
import { fuzzyScore } from "../search.js";
import type { ToolContext, ToolResponse } from "../types.js";

export function registerDmTools(ctx: ToolContext): void {
  const { server, idx, tableStore } = ctx;

  server.registerTool(
    "generate_treasure",
    {
      title: "Generate treasure/loot",
      description: "Generate treasure/loot by CR or hoard tier following DMG treasure tables.",
      inputSchema: {
        challenge_rating: z
          .number()
          .optional()
          .describe("Challenge Rating of the encounter (0-30). Used for individual treasure."),
        hoard_tier: z
          .enum(["tier1", "tier2", "tier3", "tier4"])
          .optional()
          .describe(
            "Treasure hoard tier (alternative to CR). Tier 1: levels 1-4, Tier 2: levels 5-10, Tier 3: levels 11-16, Tier 4: levels 17-20.",
          ),
        magic_item_preference: z
          .enum(["none", "few", "many"])
          .optional()
          .describe("Adjust magic item frequency. Default: 'few'."),
      },
    },
    async ({ challenge_rating, hoard_tier, magic_item_preference = "few" }) => {
      if (challenge_rating === undefined && hoard_tier === undefined) {
        return {
          content: [
            { type: "text" as const, text: "Provide either challenge_rating or hoard_tier." },
          ],
          isError: true,
        };
      }
      try {
        const treasure = generateTreasure({
          challenge_rating,
          hoard_tier,
          magic_item_preference,
        });

        const lines = [
          `**${treasure.hoardType === "individual" ? "Individual" : "Hoard"} Treasure**\n`,
        ];

        if (treasure.cr !== undefined) {
          lines.push(`Challenge Rating: ${treasure.cr}`);
        }
        if (treasure.tier) {
          lines.push(`Tier: ${treasure.tier}`);
        }

        lines.push("\n**Coins:**");
        const coins = treasure.coins;
        if (coins.cp > 0) lines.push(`  • ${coins.cp} copper`);
        if (coins.sp > 0) lines.push(`  • ${coins.sp} silver`);
        if (coins.ep > 0) lines.push(`  • ${coins.ep} electrum`);
        if (coins.gp > 0) lines.push(`  • ${coins.gp} gold`);
        if (coins.pp > 0) lines.push(`  • ${coins.pp} platinum`);

        if (treasure.gems.length > 0) {
          lines.push("\n**Gems:**");
          treasure.gems.forEach((gem) => {
            lines.push(`  • ${gem.description}`);
          });
        }

        if (treasure.art.length > 0) {
          lines.push("\n**Art Objects:**");
          treasure.art.forEach((art) => {
            lines.push(`  • ${art.description}`);
          });
        }

        if (treasure.magicItems.length > 0) {
          lines.push("\n**Magic Items:**");
          treasure.magicItems.forEach((item) => {
            lines.push(`  • ${item.description} (${item.rarity})`);
          });
        }

        lines.push(`\n**Total Value:** ${treasure.totalValueGP.toFixed(2)} gp`);

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            { type: "text", text: JSON.stringify(treasure, null, 2) },
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
    "suggest_magic_items",
    {
      title: "Suggest magic items",
      description:
        "Suggest appropriate magic items for a given party tier/level, with options to filter by type and rarity.",
      inputSchema: {
        party_level: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Average party level (1-20). Alternative to tier parameter."),
        tier: z
          .enum(["tier1", "tier2", "tier3", "tier4"])
          .optional()
          .describe(
            "Party tier (tier1=1-4, tier2=5-10, tier3=11-16, tier4=17-20). Alternative to party_level.",
          ),
        item_type: z
          .string()
          .optional()
          .describe(
            "Filter by item type (e.g., weapon, armor, wondrous, potion, scroll, ring, rod, staff, wand)",
          ),
        rarity: z
          .enum(["common", "uncommon", "rare", "very rare", "legendary", "artifact"])
          .optional()
          .describe("Filter by rarity. If not specified, uses tier-appropriate rarities."),
        count: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("How many items to suggest (default: 5, max: 50)"),
        source: z
          .string()
          .optional()
          .describe("Filter by source abbreviation (e.g., PHB, DMG, XPHB)"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Ruleset to use for item selection (default: any)"),
      },
    },
    async ({ party_level, tier, item_type, rarity, count = 5, source, ruleset = "any" }) => {
      if (party_level === undefined && tier === undefined) {
        return {
          content: [{ type: "text" as const, text: "Provide either party_level or tier." }],
          isError: true,
        };
      }
      try {
        const suggestions = suggestMagicItems(idx, {
          party_level,
          tier,
          item_type,
          rarity,
          count,
          source,
          ruleset,
        });

        if (suggestions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No suitable magic items found for the given criteria. Try adjusting rarity, type, or source filters.`,
              },
            ],
            isError: true,
          } as ToolResponse;
        }

        // Build tier description
        let tierDesc: string;
        if (party_level) {
          tierDesc = `Party level ${party_level} (${levelToTier(party_level)})`;
        } else if (tier) {
          const levelRange =
            tier === "tier1"
              ? "1-4"
              : tier === "tier2"
                ? "5-10"
                : tier === "tier3"
                  ? "11-16"
                  : "17-20";
          tierDesc = `${tier.toUpperCase()} (levels ${levelRange})`;
        } else {
          tierDesc = "Default tier (5-10)";
        }

        const lines = [`**Magic Item Suggestions for ${tierDesc}**\n`];

        if (item_type) lines.push(`Type: ${item_type}\n`);
        if (rarity) lines.push(`Rarity: ${rarity}\n`);
        lines.push(`Ruleset: ${ruleset === "any" ? "Any" : ruleset}\n`);

        suggestions.forEach((item, i) => {
          lines.push(`**${i + 1}. ${item.name}**`);
          lines.push(`   Rarity: ${item.rarity} | Type: ${item.type} | Source: ${item.source}`);
          if (item.description) {
            lines.push(`   ${item.description}...`);
          }
          lines.push("");
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

  // ── Table Rolling Tools ──────────────────────────────────────────

  server.registerTool(
    "roll_on_table",
    {
      title: "Roll on a table",
      description:
        "Roll one or more times on a specific rollable table and return the results. " +
        "Identify the table by name (fuzzy matched) and optionally source. " +
        "Use search_tables first to discover available tables.",
      inputSchema: {
        table_name: z
          .string()
          .describe(
            "Name of the table (e.g., 'Arctic Encounters (Levels 1-4)', 'Dragonborn Names (Male)', 'Books of Pyora')",
          ),
        source: z
          .string()
          .optional()
          .describe(
            "Source abbreviation to disambiguate tables with similar names (e.g., PHB, XGE, DungeonChurch)",
          ),
        times: z
          .number()
          .int()
          .positive()
          .max(20)
          .optional()
          .describe("Number of times to roll (default: 1, max: 20)"),
      },
    },
    async ({ table_name, source, times }) => {
      const allTables = idx.byKind.get("table") ?? [];
      const candidates = source
        ? allTables.filter((r) => r.source.toLowerCase() === source.toLowerCase())
        : allTables;

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tables found${source ? ` from source "${source}"` : ""}. Use search_tables to discover available tables.`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }

      // Find best fuzzy match
      const scored = candidates
        .map((r) => ({ r, s: fuzzyScore(table_name, r) }))
        .sort((a, b) => b.s - a.s);
      const best = scored[0];

      if (best.s < 10) {
        return {
          content: [
            {
              type: "text",
              text: `No table matching "${table_name}" found. Use search_tables to discover available tables.`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }

      const table = tableStore.get(best.r.uri);
      if (!table || !table.rollable) {
        return {
          content: [
            {
              type: "text",
              text: `Table "${best.r.name}" is not rollable (it is a reference-only table).`,
            },
          ],
          isError: true,
        } as ToolResponse;
      }

      const results = rollOnTable(table, times ?? 1);
      const text = formatRollResults(results);

      return {
        content: [
          { type: "text", text },
          { type: "text", text: JSON.stringify(results, null, 2) },
        ],
      } as ToolResponse;
    },
  );

  server.registerTool(
    "roll_on_tables",
    {
      title: "Roll on multiple tables",
      description:
        "Roll on multiple tables in a single call and return combined results. " +
        "Useful for combining results from different tables, e.g., '3x from Trinkets + 1x from an encounter table'. " +
        "Each entry specifies a table name, optional source, and number of rolls.",
      inputSchema: {
        rolls: z
          .array(
            z.object({
              table_name: z.string().describe("Name of the table to roll on"),
              source: z.string().optional().describe("Source abbreviation to disambiguate"),
              times: z
                .number()
                .int()
                .positive()
                .max(20)
                .optional()
                .describe("Number of times to roll (default: 1)"),
            }),
          )
          .min(1)
          .max(10)
          .describe("Array of table rolls to perform (max 10 tables per call)"),
      },
    },
    async ({ rolls }) => {
      const allTables = idx.byKind.get("table") ?? [];
      const groups: { tableName: string; results: ReturnType<typeof rollOnTable> }[] = [];
      const errors: string[] = [];

      for (const roll of rolls) {
        const candidates = roll.source
          ? allTables.filter((r) => r.source.toLowerCase() === roll.source!.toLowerCase())
          : allTables;

        const scored = candidates
          .map((r) => ({ r, s: fuzzyScore(roll.table_name, r) }))
          .sort((a, b) => b.s - a.s);
        const best = scored[0];

        if (!best || best.s < 10) {
          errors.push(`Table "${roll.table_name}" not found.`);
          continue;
        }

        const table = tableStore.get(best.r.uri);
        if (!table || !table.rollable) {
          errors.push(`Table "${best.r.name}" is not rollable.`);
          continue;
        }

        const results = rollOnTable(table, roll.times ?? 1);
        groups.push({ tableName: best.r.name, results });
      }

      const text = formatMultiRollResults(groups);
      const errorText =
        errors.length > 0 ? `\n\n**Errors:**\n${errors.map((e) => `- ${e}`).join("\n")}` : "";

      return {
        content: [
          { type: "text", text: text + errorText },
          { type: "text", text: JSON.stringify({ groups, errors }, null, 2) },
        ],
        // Mark as error only if ALL rolls failed (no successful groups)
        ...(groups.length === 0 && errors.length > 0 ? { isError: true } : {}),
      } as ToolResponse;
    },
  );
}

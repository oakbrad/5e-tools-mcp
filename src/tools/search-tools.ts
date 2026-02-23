// src/tools/search-tools.ts
// MCP tool registrations for search operations:
// search_entities, search_spells, search_monsters, search_items, search_tables

import { z } from "zod";
import {
  searchSpells,
  searchMonsters,
  searchItems,
  fuzzyScore,
  type Kind,
  type RecordLite,
} from "../search.js";
import { searchTables } from "../tables.js";
import { makeResourceLink } from "../helpers.js";
import type { ToolContext, ToolResponse } from "../types.js";

export function registerSearchTools(ctx: ToolContext): void {
  const { server, idx } = ctx;

  server.registerTool(
    "search_entities",
    {
      title: "Search 5eTools entities",
      description:
        "Fuzzy search across all indexed entity kinds. " +
        "Available kinds: monster, spell, item, feat, background, race, class, subclass, condition, rule, " +
        "adventure, book, table, deity, vehicle, trap, optionalfeature, psionic, language, object, reward, recipe, deck, facility. " +
        "Use the 'kinds' parameter to filter by type.",
      inputSchema: {
        query: z.string().describe("Search text (fuzzy matched against entity names)"),
        kinds: z
          .array(z.string())
          .optional()
          .describe(
            "Filter to specific entity kinds (e.g., ['spell', 'item']). Omit to search all kinds.",
          ),
        sources: z
          .array(z.string())
          .optional()
          .describe("Filter to specific source abbreviations (e.g., ['PHB', 'DMG'])"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Filter by ruleset (default: any)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum results to return (default: 10, max: 50)"),
      },
    },
    async ({ query, kinds, sources, ruleset = "any", limit = 10 }) => {
      try {
        const q = query.toLowerCase();
        const searchKinds = (kinds?.length ? kinds : Array.from(idx.byKind.keys())) as Kind[];
        const candidates: RecordLite[] = [];
        for (const k of searchKinds) {
          for (const r of idx.byKind.get(k) ?? []) {
            if (sources?.length && !sources.includes(r.source)) continue;
            if (ruleset !== "any" && r.ruleset !== ruleset) continue;
            candidates.push(r);
          }
        }
        const scored = candidates
          .map((r) => ({ r, s: fuzzyScore(q, r) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, limit)
          .map((x) => x.r);

        return {
          content: [
            { type: "text", text: `Found ${scored.length} result(s).` },
            ...scored.map(makeResourceLink),
          ] as ToolResponse["content"],
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
    "search_spells",
    {
      title: "Search spells",
      description:
        "Search for D&D spells with domain-specific filters like level, school, and classes.",
      inputSchema: {
        name: z.string().optional().describe("Spell name to search for (fuzzy matched)"),
        level: z
          .number()
          .int()
          .min(0)
          .max(9)
          .optional()
          .describe("Filter by spell level (0 for cantrips, 1-9 for leveled spells)"),
        school: z
          .enum(["A", "C", "D", "E", "I", "N", "T", "V"])
          .optional()
          .describe(
            "Filter by school: A=Abjuration, C=Conjuration, D=Divination, E=Enchantment, I=Illusion, N=Necromancy, T=Transmutation, V=Evocation",
          ),
        classes: z
          .array(z.string())
          .optional()
          .describe("Filter by class spell lists (e.g., ['Wizard', 'Cleric'])"),
        source: z
          .string()
          .optional()
          .describe("Filter by source abbreviation (e.g., PHB, XPHB, XGE)"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Filter by ruleset (default: any)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum results to return (default: 10, max: 50)"),
      },
    },
    async ({ name, level, school, classes, source, ruleset = "any", limit = 10 }) => {
      try {
        const candidates = searchSpells(idx, {
          name,
          level,
          school,
          classes,
          source,
          ruleset,
          limit,
        });

        return {
          content: [
            { type: "text", text: `Found ${candidates.length} spell(s).` },
            ...candidates.map(makeResourceLink),
          ] as ToolResponse["content"],
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
    "search_monsters",
    {
      title: "Search monsters",
      description:
        "Search for D&D monsters/creatures with domain-specific filters like CR and type.",
      inputSchema: {
        name: z.string().optional().describe("Monster name to search for (fuzzy matched)"),
        cr_min: z
          .number()
          .optional()
          .describe("Minimum Challenge Rating (e.g., 0, 0.25 for CR 1/4, 0.5 for CR 1/2)"),
        cr_max: z.number().optional().describe("Maximum Challenge Rating"),
        type: z
          .string()
          .optional()
          .describe("Filter by creature type (e.g., undead, fiend, dragon, humanoid, beast)"),
        source: z
          .string()
          .optional()
          .describe("Filter by source abbreviation (e.g., MM, VGM, MPMM)"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Filter by ruleset (default: any)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum results to return (default: 10, max: 50)"),
      },
    },
    async ({ name, cr_min, cr_max, type, source, ruleset = "any", limit = 10 }) => {
      try {
        const candidates = searchMonsters(idx, {
          name,
          cr_min,
          cr_max,
          type,
          source,
          ruleset,
          limit,
        });

        return {
          content: [
            { type: "text", text: `Found ${candidates.length} monster(s).` },
            ...candidates.map(makeResourceLink),
          ] as ToolResponse["content"],
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
    "search_items",
    {
      title: "Search items",
      description:
        "Search for D&D items with domain-specific filters like rarity, type, and attunement.",
      inputSchema: {
        name: z.string().optional().describe("Item name to search for (fuzzy matched)"),
        rarity: z
          .enum([
            "none",
            "common",
            "uncommon",
            "rare",
            "very rare",
            "legendary",
            "artifact",
            "unknown",
            "unknown (magic)",
            "varies",
          ])
          .optional()
          .describe("Filter by item rarity"),
        type: z
          .string()
          .optional()
          .describe(
            "Filter by item type (e.g., weapon, armor, potion, scroll, wondrous, ring, rod, staff, wand)",
          ),
        attunement: z
          .boolean()
          .optional()
          .describe(
            "Filter by attunement requirement (true = requires attunement, false = no attunement)",
          ),
        source: z
          .string()
          .optional()
          .describe("Filter by source abbreviation (e.g., DMG, PHB, XGE)"),
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Filter by ruleset (default: any)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum results to return (default: 10, max: 50)"),
      },
    },
    async ({ name, rarity, type, attunement, source, ruleset = "any", limit = 10 }) => {
      try {
        const candidates = searchItems(idx, {
          name,
          rarity,
          type,
          attunement,
          source,
          ruleset,
          limit,
        });

        return {
          content: [
            { type: "text", text: `Found ${candidates.length} item(s).` },
            ...candidates.map(makeResourceLink),
          ] as ToolResponse["content"],
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
    "search_tables",
    {
      title: "Search rollable tables",
      description:
        "Find rollable tables by name. Searches across general tables (art objects, trinkets, etc.), " +
        "encounter tables (by environment and level range), name tables (by race/culture), and homebrew tables. " +
        "Use this to discover what tables are available before rolling on them.",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe(
            "Table name to search for (e.g., 'arctic encounters', 'dragonborn names', 'books of pyora')",
          ),
        category: z
          .enum(["display", "encounter", "name"])
          .optional()
          .describe(
            "Filter by table category: 'display' for general tables, 'encounter' for random encounter tables, 'name' for character name tables",
          ),
        source: z
          .string()
          .optional()
          .describe("Filter by source abbreviation (e.g., PHB, XGE, DungeonChurch)"),
        homebrew_only: z.boolean().optional().describe("If true, only return homebrew tables"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum results to return (default: 20)"),
      },
    },
    async ({ name, category, source, homebrew_only, limit }) => {
      try {
        const allTables = idx.byKind.get("table") ?? [];

        const candidates = searchTables(
          allTables,
          {
            name,
            category,
            source,
            homebrew: homebrew_only === true ? true : undefined,
            rollableOnly: true,
            limit: limit ?? 20,
          },
          fuzzyScore,
        );

        if (candidates.length === 0) {
          return {
            content: [{ type: "text", text: "No tables found matching your criteria." }],
          } as ToolResponse;
        }

        const lines = [`Found ${candidates.length} table(s):\n`];
        for (const rec of candidates) {
          const dice = rec.facets.diceExpression ?? "?";
          const cat = rec.facets.category ?? "?";
          const brew = rec.facets.homebrew ? " [homebrew]" : "";
          lines.push(`- **${rec.name}** (${rec.source}) — ${dice} | ${cat}${brew}`);
        }

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            {
              type: "text",
              text: JSON.stringify(
                candidates.map((r) => ({
                  name: r.name,
                  source: r.source,
                  uri: r.uri,
                  category: r.facets.category,
                  diceExpression: r.facets.diceExpression,
                  homebrew: r.facets.homebrew,
                })),
                null,
                2,
              ),
            },
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

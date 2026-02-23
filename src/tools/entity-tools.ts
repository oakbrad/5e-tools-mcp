// src/tools/entity-tools.ts
// MCP tool registrations for entity retrieval and rendering:
// get_entity, render_entries, list_sources, get_rules_section, resolve_tag

import { z } from "zod";
import { renderEntries } from "../renderer.js";
import { toSlug } from "../utils.js";
import { findEntity, makeResourceLink, TAG_TO_KIND } from "../helpers.js";
import type { Kind } from "../search.js";
import type { ToolContext, ToolResponse } from "../types.js";

export function registerEntityTools(ctx: ToolContext): void {
  const { server, idx } = ctx;

  server.registerTool(
    "get_entity",
    {
      title: "Get an entity",
      description: "Fetch one entity by URI or by (kind,name,source).",
      inputSchema: {
        uri: z
          .string()
          .optional()
          .describe("Direct entity URI (e.g., fiveet://entity/spell/PHB/fireball)"),
        key: z
          .object({
            kind: z
              .string()
              .describe("Entity kind (e.g., spell, monster, item, feat, class, deity, etc.)"),
            name: z.string().describe("Entity name to look up (fuzzy matched)"),
            source: z
              .string()
              .optional()
              .describe("Source abbreviation (e.g., PHB, DMG, MM). Omit to search all sources."),
            ruleset: z
              .enum(["2014", "2024"])
              .optional()
              .describe("Preferred ruleset when duplicates exist (default: 2024)"),
          })
          .optional()
          .describe("Look up by kind + name instead of URI"),
        format: z
          .enum(["json", "markdown", "html"])
          .optional()
          .describe("Response format (default: json)"),
        includeFluff: z.boolean().optional().describe("Include flavor text/lore if available"),
      },
    },
    async ({ uri, key, format = "json", includeFluff = false }) => {
      try {
        let e: import("../search.js").StoredEntity | undefined;

        if (uri) {
          // Direct URI lookup
          e = idx.byUri.get(uri);
        } else if (key) {
          // Fuzzy lookup with optional source filter and ruleset preference
          const rec = findEntity(
            idx,
            key.kind as Kind,
            key.name,
            key.source,
            key.ruleset ?? "2024",
          );
          if (rec) {
            uri = rec.uri;
            e = idx.byUri.get(uri);
          }
        }

        if (!uri)
          return {
            content: [
              {
                type: "text",
                text: "No entity specified. Provide a URI or a key with kind and name.",
              },
            ],
            isError: true,
          };
        if (!e) return { content: [{ type: "text", text: `Not found: ${uri}` }], isError: true };

        // Look up fluff data if requested
        const fluff = includeFluff
          ? idx.fluffByKey.get(`${e._kind}/${e._source}/${toSlug(e.name)}`)
          : undefined;

        if (format === "json") {
          const result = fluff ? { ...e, _fluff: fluff } : e;
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          } as ToolResponse;
        }

        const body = renderEntries(e.entries ?? e.entry ?? e.text ?? "");
        const parts = [`# ${e.name}\n\n${body}`];

        // Adventure/book entities: render metadata + table of contents + content
        if (e._kind === "adventure" || e._kind === "book") {
          const meta: string[] = [];
          if (e.author) meta.push(`**Author:** ${e.author}`);
          if (e.published) meta.push(`**Published:** ${e.published}`);
          if (e.group) meta.push(`**Group:** ${e.group}`);
          if (e.storyline) meta.push(`**Storyline:** ${e.storyline}`);
          if (e.level) meta.push(`**Levels:** ${e.level.start}\u2013${e.level.end}`);
          if (meta.length) parts.push(meta.join(" | ") + "\n");

          if (e.contents?.length) {
            parts.push("\n## Contents\n");
            const tocLines: string[] = [];
            for (const ch of e.contents) {
              let prefix = "";
              if (ch.ordinal) {
                const label =
                  ch.ordinal.type === "chapter"
                    ? "Ch."
                    : ch.ordinal.type === "appendix"
                      ? "App."
                      : "Part";
                prefix = `${label} ${ch.ordinal.identifier}: `;
              }
              tocLines.push(`- **${prefix}${ch.name}**`);
            }
            parts.push(tocLines.join("\n"));
          }

          if (e._contentData?.length) {
            parts.push("\n\n---\n\n");
            parts.push(renderEntries(e._contentData));
          }
        }

        if (fluff) {
          const fluffEntries = fluff.entries ?? fluff.entry ?? fluff.text;
          if (fluffEntries) {
            parts.push(`\n\n## Lore\n\n${renderEntries(fluffEntries)}`);
          }
          if (fluff.images?.length) {
            parts.push(`\n\n*${fluff.images.length} image(s) available in source data.*`);
          }
        }

        return { content: [{ type: "text", text: parts.join("") }] } as ToolResponse;
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
    "render_entries",
    {
      title: "Render 5eTools entries",
      description: "Convert 5eTools entries+{@tags} to Markdown",
      inputSchema: {
        entries: z
          .any()
          .describe("5eTools entry data (string, array, or object with entries/type fields)"),
        format: z
          .enum(["markdown", "html"])
          .optional()
          .describe("Output format (default: markdown)"),
      },
    },
    async ({ entries }) => {
      try {
        return { content: [{ type: "text", text: renderEntries(entries) }] } as ToolResponse;
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
    "list_sources",
    {
      title: "List known sources",
      description: "Enumerate sources from _meta.sources with optional filters.",
      inputSchema: {
        ruleset: z
          .enum(["2014", "2024", "any"])
          .optional()
          .describe("Filter by ruleset (default: any)"),
        kind: z
          .string()
          .optional()
          .describe("Filter to sources that contain this entity kind (e.g., spell, monster)"),
      },
    },
    async ({ ruleset = "any", kind }) => {
      try {
        const items = Array.from(idx.sourcesMeta.values())
          .filter(
            (s) =>
              (ruleset === "any" || s.ruleset === ruleset) && (!kind || s.kinds.has(kind as Kind)),
          )
          .map((s) => ({
            abbreviation: s.abbreviation,
            full: s.full,
            ruleset: s.ruleset,
            kinds: Array.from(s.kinds),
          }));
        return {
          content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
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
    "get_rules_section",
    {
      title: "Get a rules section",
      description: "Fetch and render a rule by title or slug, with ruleset preference.",
      inputSchema: {
        slugOrTitle: z
          .string()
          .describe("Rule name or slug to look up (e.g., 'Flanking', 'multiclassing')"),
        ruleset: z
          .enum(["2014", "2024"])
          .optional()
          .describe("Preferred ruleset when duplicates exist"),
      },
    },
    async ({ slugOrTitle, ruleset }) => {
      try {
        const list = idx.byKind.get("rule") ?? [];
        const q = slugOrTitle.toLowerCase();
        let candidates = list.filter((r) => r.slug === toSlug(q) || r.name.toLowerCase() === q);
        if (ruleset) candidates = candidates.filter((r) => r.ruleset === ruleset);
        const rec = candidates[0] ?? list.find((r) => r.name.toLowerCase().includes(q));
        if (!rec)
          return {
            content: [{ type: "text", text: `Rule not found: "${slugOrTitle}"` }],
            isError: true,
          } as ToolResponse;
        const ent = idx.byUri.get(rec.uri);
        const body = renderEntries(ent?.entries ?? ent?.entry ?? ent?.text ?? "");
        const text = `# ${ent?.name ?? rec.name}\n\n${body}`;
        return { content: [makeResourceLink(rec), { type: "text", text }] } as ToolResponse;
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
    "resolve_tag",
    {
      title: "Resolve a 5eTools tag",
      description: "Normalize an inline tag like {@spell fireball|PHB} to a canonical entity.",
      inputSchema: {
        tag: z
          .string()
          .describe("A 5eTools inline tag (e.g., '{@spell fireball|PHB}', '{@creature Goblin}')"),
      },
    },
    async ({ tag }) => {
      try {
        const m = tag.match(/^\{@(\w+)\s+([^}]+)\}$/);
        if (!m)
          return {
            content: [
              {
                type: "text",
                text: `Unrecognized tag format: "${tag}". Expected {\\@kind name|source}.`,
              },
            ],
            isError: true,
          } as ToolResponse;
        const rawKind = m[1].toLowerCase();
        const rest = m[2];
        const parts = rest.split("|");
        const name = parts[0].trim();
        const source = parts[1]?.trim() || undefined;

        const kind = TAG_TO_KIND[rawKind];
        if (!kind)
          return {
            content: [{ type: "text", text: `Unsupported tag kind: "${rawKind}"` }],
            isError: true,
          } as ToolResponse;

        const rec =
          findEntity(idx, kind, name, source, "2024") ||
          findEntity(idx, kind, name, source, "2014");
        if (!rec)
          return {
            content: [
              {
                type: "text",
                text: `Entity not found: ${rawKind} "${name}"${source ? ` (${source})` : ""}`,
              },
            ],
            isError: true,
          } as ToolResponse;

        return { content: [makeResourceLink(rec)] } as ToolResponse;
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

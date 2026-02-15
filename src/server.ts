// src/server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { renderEntries } from "./renderer.js";
import { toSlug } from "./utils.js";
import { searchSpells, searchMonsters, searchItems } from "./search.js";
import {
  calculatePartyThresholds,
  evaluateEncounter,
  suggestEncounters,
  type MonsterEntry,
} from "./encounter.js";
import { generateTreasure } from "./treasure.js";
import { scaleEncounter } from "./scale-encounter.js";
import { generateRandomEncounter, type Environment, type Difficulty } from "./random-encounter.js";
import {
  suggestMagicItems,
  type MagicItemSuggestion,
} from "./magic-items.js";

type Ruleset = "2014" | "2024" | "any";
type Kind =
  | "monster" | "spell" | "item" | "feat" | "background"
  | "race" | "class" | "subclass" | "condition"
  | "rule" | "adventure" | "book";

type RecordLite = {
  uri: string;
  name: string;
  slug: string;
  source: string;
  ruleset: Ruleset;
  facets: Record<string, any>;
  aliases?: string[];
  kind: Kind;
};

const ROOT = process.env.FIVETOOLS_SRC_DIR
  ?? path.join(process.cwd(), "5etools-src");
const DATA = path.join(ROOT, "data");
const HOMEBREW = path.join(ROOT, "homebrew");

const idx = {
  byKind: new Map<Kind, RecordLite[]>(),
  byUri: new Map<string, any>(),
  sourcesMeta: new Map<string, { abbreviation: string; full?: string; ruleset: Ruleset; kinds: Set<Kind> }>(),
};

function rulesetFromSource(abbrev: string): Ruleset {
  return /^x/i.test(abbrev) ? "2024" : "2014";
}

function entityUri(kind: Kind, source: string, name: string) {
  return `fiveet://entity/${kind}/${source}/${toSlug(name)}`;
}

function addSourceMeta(abbreviation: string, full?: string, kind?: Kind) {
  const rs = rulesetFromSource(abbreviation);
  const existing = idx.sourcesMeta.get(abbreviation);
  if (existing) {
    if (full && !existing.full) existing.full = full;
    if (kind) existing.kinds.add(kind);
  } else {
    idx.sourcesMeta.set(abbreviation, {
      abbreviation,
      full,
      ruleset: rs,
      kinds: new Set(kind ? [kind] : []),
    });
  }
}

/** Map from Kind to JSON key in data files */
const kindToKey: Record<Kind, string> = {
  monster: "monster",
  spell: "spell",
  item: "item",
  feat: "feat",
  background: "background",
  race: "race",
  class: "class",
  subclass: "subclass",
  condition: "condition",
  rule: "rule",
  adventure: "adventure",
  book: "book",
};

/** Process entities of a given kind from a JSON file and add to index */
function processEntities(json: any, kind: Kind, metaSources: any[]): RecordLite[] {
  const key = kindToKey[kind];
  const arr = key && json[key] ? (json[key] as any[]) : [];
  const records: RecordLite[] = [];

  for (const e of arr) {
    const name: string = e.name ?? e.title ?? "";
    if (!name) continue;
    const source: string = (e.source ?? metaSources?.[0]?.abbreviation) ?? "UNK";
    const uri = entityUri(kind, source, name);
    const ruleset = rulesetFromSource(source);

    const facets: Record<string, any> = {};
    if (kind === "monster") { facets.cr = e.cr; facets.type = e.type?.type ?? e.type; }
    if (kind === "spell") { facets.level = e.level; facets.school = e.school; }
    if (kind === "item") { facets.rarity = e.rarity; facets.reqAttune = !!e.reqAttune; }

    const aliases: string[] = Array.isArray(e.alias) ? e.alias
      : (e.alias ? [e.alias] : (Array.isArray(e.aliases) ? e.aliases : []));

    records.push({ uri, name, slug: toSlug(name), source, ruleset, facets, aliases, kind });
    idx.byUri.set(uri, { ...e, _uri: uri, _source: source, _ruleset: ruleset, _kind: kind });
    addSourceMeta(source, undefined, kind);
  }

  return records;
}

async function loadAll() {
  const kindToFolder: Record<Kind, string> = {
    monster: "bestiary",
    spell: "spells",
    item: "items",
    feat: "feats",
    background: "backgrounds",
    race: "races",
    class: "class",
    subclass: "class",
    condition: "conditionsdiseases",
    rule: "rules",
    adventure: "adventure",
    book: "book",
  };

  for (const [kind, folder] of Object.entries(kindToFolder) as [Kind, string][]) {
    const dir = path.join(DATA, folder);
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f: string) => f.endsWith(".json"));
    } catch {
      continue;
    }

    const records: RecordLite[] = [];
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const raw = await fs.readFile(fullPath, "utf8");
      const json = JSON.parse(raw);

      // harvest _meta.sources if present
      const metaSources: any[] = json?._meta?.sources ?? [];
      for (const s of metaSources) {
        const abbr: string = s.abbreviation || s.abbrev || s.source || s.json || s.id || "UNK";
        const fullName: string | undefined = s.full || s.name || s.title;
        addSourceMeta(abbr, fullName, kind);
      }

      records.push(...processEntities(json, kind, metaSources));
    }
    idx.byKind.set(kind as Kind, records);
  }
}

/** Supported kinds for homebrew indexing */
const homebrewKinds: Kind[] = [
  "monster", "spell", "item", "feat", "background",
  "race", "class", "subclass", "condition"
];

async function loadHomebrew() {
  const indexPath = path.join(HOMEBREW, "index.json");
  let indexJson: { toImport?: string[] };
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    indexJson = JSON.parse(raw);
  } catch {
    // No homebrew index or unreadable - skip silently
    return;
  }

  const toImport = indexJson.toImport ?? [];
  if (toImport.length === 0) return;

  for (const relPath of toImport) {
    const fullPath = path.join(HOMEBREW, relPath);
    let json: any;
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      json = JSON.parse(raw);
    } catch {
      // Skip files that can't be read
      continue;
    }

    // harvest _meta.sources
    const metaSources: any[] = json?._meta?.sources ?? [];
    for (const s of metaSources) {
      const abbr: string = s.abbreviation || s.abbrev || s.source || s.json || s.id || "UNK";
      const fullName: string | undefined = s.full || s.name || s.title;
      // Add source meta for all homebrew kinds it might contain
      for (const kind of homebrewKinds) {
        if (json[kindToKey[kind]]) {
          addSourceMeta(abbr, fullName, kind);
        }
      }
    }

    // Process each supported kind from this homebrew file
    for (const kind of homebrewKinds) {
      const records = processEntities(json, kind, metaSources);
      if (records.length > 0) {
        const existing = idx.byKind.get(kind) ?? [];
        idx.byKind.set(kind, [...existing, ...records]);
      }
    }
  }
}

/** simple Levenshtein distance */
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** fuzzy ranking across name, slug, aliases */
function fuzzyScore(q: string, rec: RecordLite): number {
  const ql = q.toLowerCase();
  const name = rec.name.toLowerCase();
  const slug = rec.slug;
  const aliases = (rec.aliases ?? []).map(s => s.toLowerCase());

  if (name === ql) return 100;
  if (slug === toSlug(ql)) return 95;
  if (name.startsWith(ql)) return 90;

  let score = 0;
  if (name.includes(ql)) score += 60;
  for (const al of aliases) {
    if (al === ql) score += 80;
    else if (al.includes(ql)) score += 40;
  }

  // token coverage
  const qTokens = ql.split(/[^a-z0-9]+/g).filter(Boolean);
  for (const t of qTokens) {
    if (t.length >= 3) {
      if (name.includes(t)) score += 6;
      for (const al of aliases) if (al.includes(t)) { score += 4; break; }
    }
  }

  // edit distance bonus for short strings
  if (ql.length <= 20) {
    const d = lev(ql, name);
    score += Math.max(0, 30 - d * 3);
  }

  return score;
}

// renderer is now provided by src/renderer.ts

function makeResourceLink(rec: RecordLite) {
  return {
    type: "resource",
    resource: {
      uri: rec.uri,
      text: `${rec.name} — ${rec.kind} • ${rec.source} • ${rec.ruleset}`,
      mimeType: "text/plain"
    }
  } as const;
}

function findEntity(kind: Kind, name: string, source?: string, prefer: Exclude<Ruleset, "any"> = "2024"): RecordLite | undefined {
  const list = idx.byKind.get(kind) ?? [];
  const ql = name.toLowerCase();
  // exact name + source
  if (source) {
    const exact = list.find(r => r.source === source && r.name.toLowerCase() === ql);
    if (exact) return exact;
  }
  // exact name, prefer ruleset
  const exactAny = list.filter(r => r.name.toLowerCase() === ql);
  if (exactAny.length) {
    const pref = exactAny.find(r => r.ruleset === prefer);
    return pref ?? exactAny[0];
  }
  // fuzzy
  let best: { rec: RecordLite; score: number } | undefined;
  for (const r of list) {
    const s = fuzzyScore(name, r);
    if (!best || s > best.score) best = { rec: r, score: s };
  }
  return best?.rec;
}

async function main() {
  await loadAll();
  await loadHomebrew();

  const server = new McpServer({ name: "mcp-5etools", version: "0.2.0" });

  server.registerTool(
    "search_entities",
    {
      title: "Search 5eTools entities",
      description: "Fuzzy search across monsters, spells, items, etc.",
      inputSchema: {
        query: z.string(),
        kinds: z.array(z.string()).optional(),
        sources: z.array(z.string()).optional(),
        ruleset: z.enum(["2014","2024","any"]).optional(),
        limit: z.number().int().positive().max(50).optional(),
      }
    },
    async ({ query, kinds, sources, ruleset = "any", limit = 10 }) => {
      const q = query.toLowerCase();
      const searchKinds = (kinds?.length ? kinds : Array.from(idx.byKind.keys())) as Kind[];
      let candidates: RecordLite[] = [];
      for (const k of searchKinds) {
        for (const r of idx.byKind.get(k) ?? []) {
          if (sources?.length && !sources.includes(r.source)) continue;
          if (ruleset !== "any" && r.ruleset !== ruleset) continue;
          candidates.push(r);
        }
      }
      const scored = candidates
        .map(r => ({ r, s: fuzzyScore(q, r) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map(x => x.r);

      return {
        content: [
          { type: "text", text: `Found ${scored.length} result(s).` },
          ...scored.map(makeResourceLink)
        ] as any
      } as any;
    }
  );

  server.registerTool(
    "search_spells",
    {
      title: "Search spells",
      description: "Search for D&D spells with domain-specific filters like level, school, and classes.",
      inputSchema: {
        name: z.string().optional(),
        level: z.number().int().min(0).max(9).optional(),
        school: z.enum(["A","C","D","E","I","N","T","V"]).optional(),
        classes: z.array(z.string()).optional(),
        source: z.string().optional(),
        ruleset: z.enum(["2014","2024","any"]).optional(),
        limit: z.number().int().positive().max(50).optional(),
      }
    },
    async ({ name, level, school, classes, source, ruleset = "any", limit = 10 }) => {
      const candidates = searchSpells(idx, { name, level, school, classes, source, ruleset, limit });

      return {
        content: [
          { type: "text", text: `Found ${candidates.length} spell(s).` },
          ...candidates.map(makeResourceLink)
        ] as any
      } as any;
    }
  );

  server.registerTool(
    "search_monsters",
    {
      title: "Search monsters",
      description: "Search for D&D monsters/creatures with domain-specific filters like CR and type.",
      inputSchema: {
        name: z.string().optional(),
        cr_min: z.number().optional(),
        cr_max: z.number().optional(),
        type: z.string().optional(),
        source: z.string().optional(),
        ruleset: z.enum(["2014","2024","any"]).optional(),
        limit: z.number().int().positive().max(50).optional(),
      }
    },
    async ({ name, cr_min, cr_max, type, source, ruleset = "any", limit = 10 }) => {
      const candidates = searchMonsters(idx, { name, cr_min, cr_max, type, source, ruleset, limit });

      return {
        content: [
          { type: "text", text: `Found ${candidates.length} monster(s).` },
          ...candidates.map(makeResourceLink)
        ] as any
      } as any;
    }
  );

  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description: "Search for D&D items with domain-specific filters like rarity, type, and attunement.",
      inputSchema: {
        name: z.string().optional(),
        rarity: z.enum(["none","common","uncommon","rare","very rare","legendary","artifact","unknown","unknown (magic)","varies"]).optional(),
        type: z.string().optional(),
        attunement: z.boolean().optional(),
        source: z.string().optional(),
        ruleset: z.enum(["2014","2024","any"]).optional(),
        limit: z.number().int().positive().max(50).optional(),
      }
    },
    async ({ name, rarity, type, attunement, source, ruleset = "any", limit = 10 }) => {
      const candidates = searchItems(idx, { name, rarity, type, attunement, source, ruleset, limit });

      return {
        content: [
          { type: "text", text: `Found ${candidates.length} item(s).` },
          ...candidates.map(makeResourceLink)
        ] as any
      } as any;
    }
  );

  server.registerTool(
    "get_entity",
    {
      title: "Get an entity",
      description: "Fetch one entity by URI or by (kind,name,source).",
      inputSchema: {
        uri: z.string().optional(),
        key: z.object({
          kind: z.string(),
          name: z.string(),
          source: z.string().optional(),
          ruleset: z.enum(["2014","2024"]).optional()
        }).optional(),
        format: z.enum(["json","markdown","html"]).optional(),
        includeFluff: z.boolean().optional()
      }
    },
    async ({ uri, key, format = "json" }) => {
      if (!uri && key) {
        uri = entityUri(key.kind as Kind, key.source ?? "PHB", key.name);
      }
      if (!uri) return { content: [{ type: "text", text: "No entity specified." }] };

      const e = idx.byUri.get(uri);
      if (!e) return { content: [{ type: "text", text: "Not found." }] };

      if (format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(e, null, 2) }] } as any;
      }
      const body = renderEntries(e.entries ?? e.entry ?? e.text ?? "");
      const text = `# ${e.name}\n\n${body}`;
      return { content: [{ type: "text", text }] } as any;
    }
  );

  server.registerTool(
    "render_entries",
    {
      title: "Render 5eTools entries",
      description: "Convert 5eTools entries+{@tags} to Markdown",
      inputSchema: { entries: z.any(), format: z.enum(["markdown","html"]).optional() }
    },
    async ({ entries }) => ({ content: [{ type: "text", text: renderEntries(entries) }] } as any)
  );

  server.registerTool(
    "list_sources",
    {
      title: "List known sources",
      description: "Enumerate sources from _meta.sources with optional filters.",
      inputSchema: {
        ruleset: z.enum(["2014","2024","any"]).optional(),
        kind: z.string().optional()
      }
    },
    async ({ ruleset = "any", kind }) => {
      const items = Array.from(idx.sourcesMeta.values())
        .filter(s => (ruleset === "any" || s.ruleset === ruleset) && (!kind || s.kinds.has(kind as Kind)))
        .map(s => ({ abbreviation: s.abbreviation, full: s.full, ruleset: s.ruleset, kinds: Array.from(s.kinds) }));
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] } as any;
    }
  );

  server.registerTool(
    "get_rules_section",
    {
      title: "Get a rules section",
      description: "Fetch and render a rule by title or slug, with ruleset preference.",
      inputSchema: {
        slugOrTitle: z.string(),
        ruleset: z.enum(["2014","2024"]).optional()
      }
    },
    async ({ slugOrTitle, ruleset }) => {
      const list = idx.byKind.get("rule") ?? [];
      const q = slugOrTitle.toLowerCase();
      let candidates = list.filter(r => r.slug === toSlug(q) || r.name.toLowerCase() === q);
      if (ruleset) candidates = candidates.filter(r => r.ruleset === ruleset);
      const rec = candidates[0] ?? (list.find(r => r.name.toLowerCase().includes(q)) ?? list[0]);
      if (!rec) return { content: [{ type: "text", text: "Not found." }] } as any;
      const ent = idx.byUri.get(rec.uri);
      const body = renderEntries(ent?.entries ?? ent?.entry ?? ent?.text ?? "");
      const text = `# ${ent?.name ?? rec.name}\n\n${body}`;
      return { content: [ makeResourceLink(rec), { type: "text", text } ] } as any;
    }
  );

  server.registerTool(
    "resolve_tag",
    {
      title: "Resolve a 5eTools tag",
      description: "Normalize an inline tag like {@spell fireball|PHB} to a canonical entity.",
      inputSchema: {
        tag: z.string()
      }
    },
    async ({ tag }) => {
      const m = tag.match(/^\{@(\w+)\s+([^}]+)\}$/);
      if (!m) return { content: [{ type: "text", text: "Unrecognized tag format." }] } as any;
      const rawKind = m[1].toLowerCase();
      const rest = m[2];
      const parts = rest.split("|");
      const name = parts[0].trim();
      const source = (parts[1]?.trim()) || undefined;

      const kindMap: Record<string, Kind> = {
        "spell": "spell",
        "item": "item",
        "feat": "feat",
        "race": "race",
        "class": "class",
        "subclass": "subclass",
        "condition": "condition",
        "monster": "monster",
        "creature": "monster"
      };
      const kind = kindMap[rawKind];
      if (!kind) return { content: [{ type: "text", text: `Unsupported tag kind: ${rawKind}` }] } as any;

      const rec = findEntity(kind, name, source, "2024") || findEntity(kind, name, source, "2014");
      if (!rec) return { content: [{ type: "text", text: "Entity not found." }] } as any;

      return { content: [ makeResourceLink(rec) ] } as any;
    }
  );

  // Encounter building tools
  server.registerTool(
    "calculate_party_thresholds",
    {
      title: "Calculate party XP thresholds",
      description: "Calculate Easy/Medium/Hard/Deadly XP thresholds and daily budget for a party of characters.",
      inputSchema: {
        party: z.array(z.number().int().min(1).max(20))
          .describe("Array of character levels (e.g., [3, 3, 3, 2])"),
      }
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
            { type: "text", text: JSON.stringify(thresholds, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "evaluate_encounter",
    {
      title: "Evaluate encounter difficulty",
      description: "Calculate the difficulty of an encounter given a party and monsters. Supports fractional CR (e.g., '1/4', 0.25).",
      inputSchema: {
        party: z.array(z.number().int().min(1).max(20))
          .describe("Array of character levels"),
        monsters: z.array(z.object({
          cr: z.union([z.number(), z.string()])
            .describe("Challenge Rating (supports '1/8', '1/4', '1/2', or decimal/integer)"),
          count: z.number().int().positive().optional()
            .describe("Number of monsters of this CR (default: 1)"),
        })).describe("Array of monsters with their CR and count"),
      }
    },
    async ({ party, monsters }) => {
      try {
        const evaluation = evaluateEncounter(party, monsters);
        
        const monsterSummary = evaluation.monsters
          .map(m => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
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
            { type: "text", text: JSON.stringify(evaluation, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "suggest_encounter",
    {
      title: "Suggest encounter compositions",
      description: "Generate encounter suggestions for a desired difficulty. Returns 5-10 balanced encounter options with actual monster names.",
      inputSchema: {
        party: z.array(z.number().int().min(1).max(20))
          .describe("Array of character levels"),
        difficulty: z.enum(["easy", "medium", "hard", "deadly"])
          .describe("Desired encounter difficulty"),
        monster_count: z.number().int().positive().optional()
          .describe("Preferred number of monsters (default: 1 per 4 PCs)"),
        cr_min: z.number().optional()
          .describe("Minimum CR to consider"),
        cr_max: z.number().optional()
          .describe("Maximum CR to consider"),
        ruleset: z.enum(["2014","2024","any"]).optional()
          .describe("Ruleset to use for monster selection (default: any)"),
      }
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
            content: [{
              type: "text",
              text: `No suitable encounters found for a ${difficulty} encounter with the given constraints.`
            }]
          } as any;
        }

        const lines = [`**Encounter Suggestions for ${difficulty.toUpperCase()} difficulty**\n`];
        lines.push(`Party: ${party.length} characters at levels ${party.join(", ")}\n`);

        suggestions.forEach((suggestion, i) => {
          const monsterDesc = suggestion.monsters
            .map(m => {
              const crPart = `${m.count}× CR ${m.cr}`;
              return m.name ? `${crPart} (${m.name})` : crPart;
            })
            .join(" + ");

          lines.push(`**${i + 1}.** ${monsterDesc}`);
          lines.push(`   Base XP: ${suggestion.totalBaseXP} | Adjusted: ${suggestion.adjustedXP} | Difficulty: ${suggestion.difficulty}\n`);
        });

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            { type: "text", text: JSON.stringify(suggestions, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "scale_encounter",
    {
      title: "Scale encounter difficulty",
      description: "Adjust an existing encounter to match a new difficulty or party composition. Preserves the encounter's feel by scaling monster counts and CRs proportionally.",
      inputSchema: {
        current_encounter: z.array(z.object({
          cr: z.union([z.number(), z.string()])
            .describe("Challenge Rating (supports '1/8', '1/4', '1/2', or decimal/integer)"),
          count: z.number().int().positive()
            .describe("Number of monsters of this CR"),
        })).describe("Current monsters in the encounter"),
        current_party: z.array(z.number().int().min(1).max(20))
          .describe("Original party levels"),
        target_party: z.array(z.number().int().min(1).max(20)).optional()
          .describe("New party levels (if party composition changed)"),
        target_difficulty: z.enum(["easy", "medium", "hard", "deadly"]).optional()
          .describe("Desired difficulty (alternative to adjustment)"),
        adjustment: z.enum(["easier", "harder"]).optional()
          .describe("Relative adjustment: 'easier' or 'harder' (alternative to target_difficulty)"),
      }
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
          .map(m => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
          .join("\n");

        const scaledMonsters = result.scaled.monsters
          .map(m => `  • ${m.count}× CR ${m.cr} (${m.xp} XP each)`)
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
${result.rationale.map(r => `• ${r}`).join("\n")}

**Strategy Used:** ${result.strategy.replace(/_/g, " ")}`;

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(result, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "generate_treasure",
    {
      title: "Generate treasure/loot",
      description: "Generate treasure/loot by CR or hoard tier following DMG treasure tables.",
      inputSchema: {
        challenge_rating: z.number().optional()
          .describe("Challenge Rating of the encounter (0-30). Used for individual treasure."),
        hoard_tier: z.enum(["tier1", "tier2", "tier3", "tier4"]).optional()
          .describe("Treasure hoard tier (alternative to CR). Tier 1: levels 1-4, Tier 2: levels 5-10, Tier 3: levels 11-16, Tier 4: levels 17-20."),
        magic_item_preference: z.enum(["none", "few", "many"]).optional()
          .describe("Adjust magic item frequency. Default: 'few'."),
      }
    },
    async ({ challenge_rating, hoard_tier, magic_item_preference = "few" }) => {
      try {
        const treasure = generateTreasure({
          challenge_rating,
          hoard_tier,
          magic_item_preference,
        });

        const lines = [`**${treasure.hoardType === 'individual' ? 'Individual' : 'Hoard'} Treasure**\n`];

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
          treasure.gems.forEach(gem => {
            lines.push(`  • ${gem.description}`);
          });
        }

        if (treasure.art.length > 0) {
          lines.push("\n**Art Objects:**");
          treasure.art.forEach(art => {
            lines.push(`  • ${art.description}`);
          });
        }

        if (treasure.magicItems.length > 0) {
          lines.push("\n**Magic Items:**");
          treasure.magicItems.forEach(item => {
            lines.push(`  • ${item.description} (${item.rarity})`);
          });
        }

        lines.push(`\n**Total Value:** ${treasure.totalValueGP.toFixed(2)} gp`);

        return {
          content: [
            { type: "text", text: lines.join("\n") },
            { type: "text", text: JSON.stringify(treasure, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "random_encounter",
    {
      title: "Generate random encounter",
      description: "Generate a thematic random encounter based on environment and party level. Returns a complete encounter with monsters, XP values, difficulty rating, and flavor text.",
      inputSchema: {
        environment: z.enum(["forest", "underdark", "mountain", "desert", "urban", "coast", "arctic", "swamp", "grassland"])
          .describe("Terrain/environment type for the encounter"),
        party: z.array(z.number().int().min(1).max(20))
          .describe("Array of character levels (e.g., [3, 3, 3, 2])"),
        difficulty: z.enum(["easy", "medium", "hard", "deadly"])
          .describe("Desired encounter difficulty"),
        monster_count: z.number().int().positive().optional()
          .describe("Preferred number of monsters (default: 1 per 4 PCs)"),
        ruleset: z.enum(["2014","2024","any"]).optional()
          .describe("Ruleset to use for monster selection (default: any)"),
      }
    },
    async ({ environment, party, difficulty, monster_count, ruleset = "any" }) => {
      try {
        const encounter = generateRandomEncounter(party, environment, difficulty, idx, {
          ruleset,
          monsterCount: monster_count,
        });

        const monsterDesc = encounter.monsters
          .map(m => `${m.count}× ${m.name} (CR ${m.cr})`)
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
            { type: "text", text: JSON.stringify(encounter, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerTool(
    "suggest_magic_items",
    {
      title: "Suggest magic items",
      description: "Suggest appropriate magic items for a given party tier/level, with options to filter by type and rarity.",
      inputSchema: {
        party_level: z.number().int().min(1).max(20).optional()
          .describe("Average party level (1-20). Alternative to tier parameter."),
        tier: z.enum(["tier1", "tier2", "tier3", "tier4"]).optional()
          .describe("Party tier (tier1=1-4, tier2=5-10, tier3=11-16, tier4=17-20). Alternative to party_level."),
        item_type: z.string().optional()
          .describe("Filter by item type (e.g., weapon, armor, wondrous, potion, scroll, ring, rod, staff, wand)"),
        rarity: z.enum(["common", "uncommon", "rare", "very rare", "legendary", "artifact"]).optional()
          .describe("Filter by rarity. If not specified, uses tier-appropriate rarities."),
        count: z.number().int().positive().max(50).optional()
          .describe("How many items to suggest (default: 5, max: 50)"),
        source: z.string().optional()
          .describe("Filter by source abbreviation (e.g., PHB, DMG, XPHB)"),
        ruleset: z.enum(["2014", "2024", "any"]).optional()
          .describe("Ruleset to use for item selection (default: any)"),
      }
    },
    async ({ party_level, tier, item_type, rarity, count = 5, source, ruleset = "any" }) => {
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
            content: [{
              type: "text",
              text: `No suitable magic items found for the given criteria. Try adjusting rarity, type, or source filters.`
            }]
          } as any;
        }

        // Build tier description
        let tierDesc: string;
        if (party_level) {
          tierDesc = `Party level ${party_level} (${levelToTier(party_level)})`;
        } else if (tier) {
          const levelRange = tier === "tier1" ? "1-4" :
                            tier === "tier2" ? "5-10" :
                            tier === "tier3" ? "11-16" : "17-20";
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
            { type: "text", text: JSON.stringify(suggestions, null, 2) }
          ]
        } as any;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        } as any;
      }
    }
  );

  server.registerResource(
    "entity",
    new ResourceTemplate("fiveet://entity/{kind}/{source}/{slug}", { list: undefined }),
    { title: "5eTools Entity", description: "Single entity record", mimeType: "application/json" },
    async (uri, { kind, source, slug }) => {
      const key = `fiveet://entity/${kind}/${source}/${slug}`;
      const e = idx.byUri.get(key);
      if (!e) return { contents: [{ uri: uri.href, text: "Not found" }] };
      return { contents: [{ uri: uri.href, text: JSON.stringify(e, null, 2) }] };
    }
  );

  /** Helper function to map level to tier */
  function levelToTier(level: number): "tier1" | "tier2" | "tier3" | "tier4" {
    if (level >= 1 && level <= 4) return "tier1";
    if (level >= 5 && level <= 10) return "tier2";
    if (level >= 11 && level <= 16) return "tier3";
    return "tier4";
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

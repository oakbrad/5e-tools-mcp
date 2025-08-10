// src/server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { renderEntries } from "./renderer.js";
import { toSlug } from "./utils.js";

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

      const key =
        kind === "monster" ? "monster" :
        kind === "spell" ? "spell" :
        kind === "item" ? "item" :
        kind === "feat" ? "feat" :
        kind === "background" ? "background" :
        kind === "race" ? "race" :
        kind === "class" ? "class" :
        kind === "subclass" ? "subclass" :
        kind === "condition" ? "condition" :
        kind === "rule" ? "rule" :
        kind === "adventure" ? "adventure" :
        kind === "book" ? "book" : undefined;

      const arr = key && json[key] ? (json[key] as any[]) : [];
      for (const e of arr) {
        const name: string = e.name ?? e.title ?? "";
        if (!name) continue;
        const source: string = (e.source ?? metaSources?.[0]?.abbreviation) ?? "UNK";
        const uri = entityUri(kind as Kind, source, name);
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
    }
    idx.byKind.set(kind as Kind, records);
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
        return { content: [{ type: "json", json: e }] } as any;
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
      return { content: [{ type: "json", json: items }] } as any;
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

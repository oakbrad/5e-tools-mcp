// src/loader.ts
// Data loading pipeline — reads 5eTools JSON files and populates
// the in-memory search index and table store at startup.
// Two loading paths: directory-based (bestiary/, spells/, etc.)
// and single-file-based (items.json, deities.json, etc.)

import fs from "node:fs/promises";
import path from "node:path";
import { toSlug } from "./utils.js";
import type { Kind, RecordLite } from "./search.js";
import type { RollableTable } from "./tables.js";
import { normalizeDisplayTable, normalizeEncounterTables, normalizeNameTables } from "./tables.js";
import type { AppIndex } from "./types.js";
import { rulesetFromSource, entityUri, addSourceMeta, kindToKey } from "./helpers.js";

// ── Internals ──────────────────────────────────────────────────────

/** Process entities of a given kind from a parsed JSON file and add to index.
 *  keyOverride lets one file contribute arrays under different JSON keys
 *  to the same kind (e.g., "disease" → condition, "hazard" → trap). */
export function processEntities(
  idx: AppIndex,
  json: any,
  kind: Kind,
  metaSources: any[],
  keyOverride?: string,
): RecordLite[] {
  const key = keyOverride ?? kindToKey[kind];
  const arr = key && json[key] ? (json[key] as any[]) : [];
  const records: RecordLite[] = [];

  for (const e of arr) {
    const name: string = e.name ?? e.title ?? "";
    if (!name) continue;
    const source: string = e.source ?? metaSources?.[0]?.abbreviation ?? "UNK";
    const uri = entityUri(kind, source, name);
    const ruleset = rulesetFromSource(source);

    const facets: Record<string, any> = {};
    // Kind-specific facet extraction
    if (kind === "monster") {
      facets.cr = e.cr;
      facets.type = e.type?.type ?? e.type;
    }
    if (kind === "spell") {
      facets.level = e.level;
      facets.school = e.school;
      // Extract class list for search filtering (avoids runtime byUri lookups)
      facets.classes =
        (e.classes?.fromClassList as any[] | undefined)
          ?.map((c: any) => (c.name ?? "").toLowerCase())
          .filter(Boolean) ?? [];
    }
    if (kind === "item") {
      facets.rarity = e.rarity;
      facets.reqAttune = !!e.reqAttune;
      facets.type = e.type ?? "";
    }
    if (kind === "deity") {
      facets.pantheon = e.pantheon;
      facets.alignment = e.alignment;
    }
    if (kind === "vehicle") {
      facets.vehicleType = e.vehicleType;
    }
    if (kind === "trap") {
      facets.trapHazType = e.trapHazType;
    }
    if (kind === "optionalfeature") {
      facets.featureType = e.featureType;
    }
    if (kind === "recipe") {
      facets.type = e.type;
    }
    if (kind === "facility") {
      facets.facilityType = e.facilityType;
      facets.level = e.level;
    }
    if (kind === "adventure") {
      facets.author = e.author;
      facets.group = e.group;
      facets.storyline = e.storyline;
      facets.level = e.level;
      facets.published = e.published;
    }
    if (kind === "book") {
      facets.author = e.author;
      facets.group = e.group;
      facets.published = e.published;
    }
    // Generic type facet for kinds that have one
    if (
      kind === "reward" ||
      kind === "psionic" ||
      kind === "language" ||
      kind === "object" ||
      kind === "rule"
    ) {
      if (e.type) facets.type = e.type;
    }

    const aliases: string[] = Array.isArray(e.alias)
      ? e.alias
      : e.alias
        ? [e.alias]
        : Array.isArray(e.aliases)
          ? e.aliases
          : [];

    records.push({ uri, name, slug: toSlug(name), source, ruleset, facets, aliases, kind });
    idx.byUri.set(uri, { ...e, _uri: uri, _source: source, _ruleset: ruleset, _kind: kind });
    addSourceMeta(idx, source, undefined, kind);
  }

  return records;
}

// ── Loading path configuration ────────────────────────────────────

/** Kinds stored in subdirectories with multiple JSON files */
const directoryKinds: { folder: string; kinds: Kind[] }[] = [
  { folder: "bestiary", kinds: ["monster"] },
  { folder: "spells", kinds: ["spell"] },
  { folder: "class", kinds: ["class", "subclass"] },
];

/** Kinds stored as single JSON files at the data root.
 *  extraKeys lets one file contribute additional JSON arrays to the same kind. */
const singleFileKinds: { file: string; kind: Kind; extraKeys?: string[] }[] = [
  { file: "items.json", kind: "item", extraKeys: ["itemGroup"] },
  { file: "feats.json", kind: "feat" },
  { file: "backgrounds.json", kind: "background" },
  { file: "races.json", kind: "race", extraKeys: ["subrace"] },
  { file: "conditionsdiseases.json", kind: "condition", extraKeys: ["disease", "status"] },
  { file: "variantrules.json", kind: "rule" },
  { file: "deities.json", kind: "deity" },
  { file: "vehicles.json", kind: "vehicle", extraKeys: ["vehicleUpgrade"] },
  { file: "trapshazards.json", kind: "trap", extraKeys: ["hazard"] },
  { file: "optionalfeatures.json", kind: "optionalfeature" },
  { file: "psionics.json", kind: "psionic" },
  { file: "languages.json", kind: "language", extraKeys: ["languageScript"] },
  { file: "objects.json", kind: "object" },
  { file: "rewards.json", kind: "reward" },
  { file: "recipes.json", kind: "recipe" },
  { file: "decks.json", kind: "deck", extraKeys: ["card"] },
  { file: "bastions.json", kind: "facility" },
];

/** Kinds with a metadata index file + per-entity content files in a subdirectory.
 *  The index file (e.g., adventures.json) has the entity list with metadata;
 *  individual content files (e.g., adventure/adventure-lmop.json) hold the
 *  full text as a "data" array of section entries. */
const indexedKinds: {
  indexFile: string;
  kind: Kind;
  jsonKey: string;
  contentDir: string;
  contentPrefix: string;
}[] = [
  {
    indexFile: "adventures.json",
    kind: "adventure",
    jsonKey: "adventure",
    contentDir: "adventure",
    contentPrefix: "adventure-",
  },
  {
    indexFile: "books.json",
    kind: "book",
    jsonKey: "book",
    contentDir: "book",
    contentPrefix: "book-",
  },
];

/** All entity kinds that homebrew files may contain */
const homebrewKinds: Kind[] = [
  "monster",
  "spell",
  "item",
  "feat",
  "background",
  "race",
  "class",
  "subclass",
  "condition",
  "rule",
  "deity",
  "vehicle",
  "trap",
  "optionalfeature",
  "psionic",
  "language",
  "object",
  "reward",
  "recipe",
  "deck",
  "facility",
  "adventure",
  "book",
];

// ── Shared helpers ────────────────────────────────────────────────

/** Read and parse a JSON file, returning null on any error */
async function readJsonFile(fullPath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      `[5etools] Skipping ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/** Extract _meta.sources from a parsed JSON file and register them */
function harvestMetaSources(json: any, idx: AppIndex, kind: Kind): any[] {
  const metaSources: any[] = json?._meta?.sources ?? [];
  for (const s of metaSources) {
    const abbr: string = s.abbreviation || s.abbrev || s.source || s.json || s.id || "UNK";
    const fullName: string | undefined = s.full || s.name || s.title;
    addSourceMeta(idx, abbr, fullName, kind);
  }
  return metaSources;
}

// ── Public API ─────────────────────────────────────────────────────

/** Load all official 5eTools data files into the index */
export async function loadAll(
  idx: AppIndex,
  tableStore: Map<string, RollableTable>,
  dataDir: string,
): Promise<void> {
  // ── Path 1: Directory-based kinds (bestiary/, spells/, etc.) ──
  // Read all directories in parallel, then process sequentially
  await Promise.all(
    directoryKinds.map(async ({ folder, kinds }) => {
      const dir = path.join(dataDir, folder);
      let fileNames: string[];
      try {
        fileNames = (await fs.readdir(dir)).filter((f: string) => f.endsWith(".json"));
      } catch {
        return;
      }

      // Read all JSON files in this directory in parallel
      const parsed = await Promise.all(fileNames.map((f) => readJsonFile(path.join(dir, f))));

      // Process entities (synchronous — safe for shared index)
      const recordsByKind = new Map<Kind, RecordLite[]>();
      for (const k of kinds) recordsByKind.set(k, []);

      for (const json of parsed) {
        if (!json) continue;
        for (const kind of kinds) {
          const metaSources = harvestMetaSources(json, idx, kind);
          const recs = processEntities(idx, json, kind, metaSources);
          recordsByKind.get(kind)!.push(...recs);
        }
      }

      for (const [kind, records] of recordsByKind) {
        if (records.length > 0) {
          const existing = idx.byKind.get(kind) ?? [];
          idx.byKind.set(kind, [...existing, ...records]);
        }
      }
    }),
  );

  // ── Path 2: Single-file kinds (items.json, deities.json, etc.) ──
  // Read all single files in parallel, then process sequentially
  const singleFiles = await Promise.all(
    singleFileKinds.map(async ({ file, kind, extraKeys }) => {
      const json = await readJsonFile(path.join(dataDir, file));
      return { json, kind, extraKeys };
    }),
  );

  for (const { json, kind, extraKeys } of singleFiles) {
    if (!json) continue;
    const metaSources = harvestMetaSources(json, idx, kind);
    const records: RecordLite[] = [];

    records.push(...processEntities(idx, json, kind, metaSources));

    if (extraKeys) {
      for (const extraKey of extraKeys) {
        records.push(...processEntities(idx, json, kind, metaSources, extraKey));
      }
    }

    if (records.length > 0) {
      const existing = idx.byKind.get(kind) ?? [];
      idx.byKind.set(kind, [...existing, ...records]);
    }
  }

  // ── Path 3: Indexed kinds (adventures, books) ──
  // Metadata in index files at data root; content in per-entity files in subdirectories
  await Promise.all(
    indexedKinds.map(async ({ indexFile, kind, jsonKey, contentDir, contentPrefix }) => {
      const indexJson = await readJsonFile(path.join(dataDir, indexFile));
      if (!indexJson) return;

      // Create RecordLite entries from the index metadata
      const metaSources = harvestMetaSources(indexJson, idx, kind);
      const records = processEntities(idx, indexJson, kind, metaSources);
      if (records.length > 0) {
        const existing = idx.byKind.get(kind) ?? [];
        idx.byKind.set(kind, [...existing, ...records]);
      }

      // Load content data from individual files and merge into byUri
      const entries = (indexJson[jsonKey] as any[]) ?? [];
      await Promise.all(
        entries.map(async (entry: any) => {
          const id = (entry.id ?? entry.source ?? "").toLowerCase();
          if (!id) return;
          const contentPath = path.join(dataDir, contentDir, `${contentPrefix}${id}.json`);
          const contentJson = await readJsonFile(contentPath);
          if (!contentJson?.data) return;

          const name = entry.name ?? entry.title ?? "";
          const source = entry.source ?? entry.id ?? "UNK";
          const uri = entityUri(kind, source, name);
          const stored = idx.byUri.get(uri);
          if (stored) {
            stored._contentData = contentJson.data;
          }
        }),
      );
    }),
  );

  // ── Load rollable tables from dedicated data files ──
  const tableRecords: RecordLite[] = [];

  function indexTable(table: RollableTable, rawJson: any) {
    const uri = `fiveet://table/${table.source}/${toSlug(table.name)}`;
    const rec: RecordLite = {
      uri,
      name: table.name,
      slug: toSlug(table.name),
      source: table.source,
      ruleset: rulesetFromSource(table.source),
      facets: {
        category: table.category,
        diceExpression: table.diceExpression.raw,
        rollable: table.rollable,
        homebrew: table.homebrew,
        parentName: table.parentName,
        subtable: table.subtable,
      },
      kind: "table",
    };
    tableRecords.push(rec);
    idx.byUri.set(uri, { ...rawJson, _uri: uri, _kind: "table" });
    tableStore.set(uri, table);
    addSourceMeta(idx, table.source, undefined, "table");
  }

  // Read all 3 table files in parallel
  const [tablesRaw, encountersRaw, namesRaw] = await Promise.all([
    readJsonFile(path.join(dataDir, "tables.json")),
    readJsonFile(path.join(dataDir, "encounters.json")),
    readJsonFile(path.join(dataDir, "names.json")),
  ]);

  if (tablesRaw) {
    for (const t of tablesRaw.table ?? []) {
      const table = normalizeDisplayTable(t, false);
      if (table) indexTable(table, t);
    }
  }
  if (encountersRaw) {
    for (const enc of encountersRaw.encounter ?? []) {
      for (const table of normalizeEncounterTables(enc)) {
        indexTable(table, enc);
      }
    }
  }
  if (namesRaw) {
    for (const nm of namesRaw.name ?? []) {
      for (const table of normalizeNameTables(nm)) {
        indexTable(table, nm);
      }
    }
  }

  idx.byKind.set("table", tableRecords);

  // ── Load fluff data ──
  await loadFluff(idx, dataDir);

  // ── Startup summary ──
  const summary: string[] = [];
  for (const [kind, records] of idx.byKind) {
    if (records.length > 0) summary.push(`${records.length} ${kind}(s)`);
  }
  console.warn(`[5etools] Loaded: ${summary.join(", ")}`);
}

/** Load fluff (flavor text) files and index by kind/source/slug */
async function loadFluff(idx: AppIndex, dataDir: string): Promise<void> {
  // Map of fluff filename → { kind, jsonKey }
  const fluffFiles: { file: string; kind: Kind; jsonKey: string }[] = [
    { file: "fluff-bestiary.json", kind: "monster", jsonKey: "monsterFluff" },
    { file: "fluff-spells.json", kind: "spell", jsonKey: "spellFluff" },
    { file: "fluff-items.json", kind: "item", jsonKey: "itemFluff" },
    { file: "fluff-backgrounds.json", kind: "background", jsonKey: "backgroundFluff" },
    { file: "fluff-races.json", kind: "race", jsonKey: "raceFluff" },
    { file: "fluff-conditionsdiseases.json", kind: "condition", jsonKey: "conditionFluff" },
    { file: "fluff-vehicles.json", kind: "vehicle", jsonKey: "vehicleFluff" },
    { file: "fluff-objects.json", kind: "object", jsonKey: "objectFluff" },
    { file: "fluff-trapshazards.json", kind: "trap", jsonKey: "trapFluff" },
    { file: "fluff-recipes.json", kind: "recipe", jsonKey: "recipeFluff" },
    { file: "fluff-decks.json", kind: "deck", jsonKey: "deckFluff" },
    { file: "fluff-rewards.json", kind: "reward", jsonKey: "rewardFluff" },
    { file: "fluff-deities.json", kind: "deity", jsonKey: "deityFluff" },
    { file: "fluff-languages.json", kind: "language", jsonKey: "languageFluff" },
  ];

  // Read all fluff files in parallel
  const fluffParsed = await Promise.all(
    fluffFiles.map(async ({ file, kind, jsonKey }) => {
      const json = await readJsonFile(path.join(dataDir, file));
      return { json, kind, jsonKey };
    }),
  );

  for (const { json, kind, jsonKey } of fluffParsed) {
    if (!json) continue;
    const entries = json[jsonKey] as any[] | undefined;
    if (!entries) continue;

    for (const entry of entries) {
      const name = entry.name ?? entry.title ?? "";
      const source = entry.source ?? "UNK";
      if (!name) continue;
      const fluffKey = `${kind}/${source}/${toSlug(name)}`;
      idx.fluffByKey.set(fluffKey, entry);
    }
  }
}

/** Load homebrew content from a homebrew directory */
export async function loadHomebrew(
  idx: AppIndex,
  tableStore: Map<string, RollableTable>,
  homebrewDir: string,
): Promise<void> {
  const indexPath = path.join(homebrewDir, "index.json");
  let indexJson: { toImport?: string[] };
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    indexJson = JSON.parse(raw);
  } catch {
    // No homebrew index or unreadable — skip silently
    return;
  }

  const toImport = indexJson.toImport ?? [];
  if (toImport.length === 0) return;

  for (const relPath of toImport) {
    const fullPath = path.join(homebrewDir, relPath);
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
          addSourceMeta(idx, abbr, fullName, kind);
        }
      }
    }

    // Process each supported kind from this homebrew file
    for (const kind of homebrewKinds) {
      const records: RecordLite[] = [];
      records.push(...processEntities(idx, json, kind, metaSources));

      // Also process extraKeys (e.g., "disease" → condition, "hazard" → trap)
      const config = singleFileKinds.find((s) => s.kind === kind);
      if (config?.extraKeys) {
        for (const extraKey of config.extraKeys) {
          records.push(...processEntities(idx, json, kind, metaSources, extraKey));
        }
      }

      // Mark all homebrew records so they get tie-breaking preference in search
      for (const r of records) r.homebrew = true;

      if (records.length > 0) {
        const existing = idx.byKind.get(kind) ?? [];
        idx.byKind.set(kind, [...existing, ...records]);
      }
    }

    // Process homebrew tables (display format)
    for (const t of json.table ?? []) {
      const table = normalizeDisplayTable(t, true);
      if (!table) continue;
      const uri = `fiveet://table/${table.source}/${toSlug(table.name)}`;
      const rec: RecordLite = {
        uri,
        name: table.name,
        slug: toSlug(table.name),
        source: table.source,
        ruleset: rulesetFromSource(table.source),
        facets: {
          category: table.category,
          diceExpression: table.diceExpression.raw,
          rollable: table.rollable,
          homebrew: true,
          parentName: table.parentName,
          subtable: table.subtable,
        },
        kind: "table",
        homebrew: true,
      };
      const existing = idx.byKind.get("table") ?? [];
      idx.byKind.set("table", [...existing, rec]);
      idx.byUri.set(uri, { ...t, _uri: uri, _kind: "table" });
      tableStore.set(uri, table);
      addSourceMeta(idx, table.source, undefined, "table");
    }
  }
}

// src/helpers.ts
// Shared helper functions used by the loader and tool modules.
// Each function that needs the index takes it as an explicit parameter
// so the dependency is visible in the call site.

import { toSlug } from "./utils.js";
import { fuzzyScore, type Kind, type Ruleset, type RecordLite } from "./search.js";
import type { AppIndex } from "./types.js";

/** Heuristic: source abbreviations starting with 'x' are 2024 rules */
export function rulesetFromSource(abbrev: string): Ruleset {
  return /^x/i.test(abbrev) ? "2024" : "2014";
}

/** Build a stable, deterministic URI for an entity */
export function entityUri(kind: Kind, source: string, name: string): string {
  return `fiveet://entity/${kind}/${source}/${toSlug(name)}`;
}

/** Register or update source metadata in the index */
export function addSourceMeta(
  idx: AppIndex,
  abbreviation: string,
  full?: string,
  kind?: Kind,
): void {
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

/**
 * Canonical mapping from 5eTools inline tag names to entity Kind.
 * Used by both the renderer (for link generation) and resolve_tag tool.
 * Keeps both in sync — add new tag aliases here, not in individual files.
 */
export const TAG_TO_KIND: Record<string, Kind> = {
  spell: "spell",
  item: "item",
  creature: "monster",
  monster: "monster",
  background: "background",
  feat: "feat",
  race: "race",
  class: "class",
  subclass: "subclass",
  condition: "condition",
  deity: "deity",
  vehicle: "vehicle",
  trap: "trap",
  hazard: "trap",
  optfeature: "optionalfeature",
  variantrule: "rule",
  reward: "reward",
  object: "object",
  recipe: "recipe",
  deck: "deck",
  card: "deck",
  facility: "facility",
  psionic: "psionic",
  language: "language",
  table: "table",
  book: "book",
  adventure: "adventure",
};

/**
 * Default source abbreviation for each tag, used when generating entity links
 * from inline tags that don't specify a source (e.g., {@spell fireball}).
 */
export const TAG_DEFAULT_SOURCE: Record<string, string> = {
  spell: "PHB",
  item: "DMG",
  creature: "MM",
  monster: "MM",
  background: "PHB",
  feat: "PHB",
  race: "PHB",
  class: "PHB",
  subclass: "PHB",
  condition: "PHB",
  deity: "PHB",
  vehicle: "DMG",
  trap: "DMG",
  hazard: "DMG",
  optfeature: "PHB",
  variantrule: "DMG",
  reward: "DMG",
  object: "DMG",
  recipe: "HF",
  deck: "DMG",
  card: "DMG",
  facility: "DMG",
  psionic: "UAMystic",
  language: "PHB",
  table: "DMG",
  book: "PHB",
  adventure: "PHB",
};

/** Map from entity Kind to JSON key in data files */
export const kindToKey: Record<Kind, string> = {
  monster: "monster",
  spell: "spell",
  item: "item",
  feat: "feat",
  background: "background",
  race: "race",
  class: "class",
  subclass: "subclass",
  condition: "condition",
  rule: "variantrule",
  adventure: "adventure",
  book: "book",
  table: "table",
  deity: "deity",
  vehicle: "vehicle",
  trap: "trap",
  optionalfeature: "optionalfeature",
  psionic: "psionic",
  language: "language",
  object: "object",
  reward: "reward",
  recipe: "recipe",
  deck: "deck",
  facility: "facility",
};

/** Format an entity record as an MCP resource link */
export function makeResourceLink(rec: RecordLite) {
  return {
    type: "resource",
    resource: {
      uri: rec.uri,
      text: `${rec.name} — ${rec.kind} • ${rec.source} • ${rec.ruleset}`,
      mimeType: "text/plain",
    },
  } as const;
}

/** Find an entity by kind/name with optional source filter and ruleset preference */
export function findEntity(
  idx: AppIndex,
  kind: Kind,
  name: string,
  source?: string,
  prefer: Exclude<Ruleset, "any"> = "2024",
): RecordLite | undefined {
  const list = idx.byKind.get(kind) ?? [];
  const ql = name.toLowerCase();

  // exact name + source
  if (source) {
    const exact = list.find((r) => r.source === source && r.name.toLowerCase() === ql);
    if (exact) return exact;
  }

  // exact name — prefer homebrew first, then preferred ruleset
  const exactAny = list.filter((r) => r.name.toLowerCase() === ql);
  if (exactAny.length) {
    const brew = exactAny.find((r) => r.homebrew);
    if (brew) return brew;
    const pref = exactAny.find((r) => r.ruleset === prefer);
    return pref ?? exactAny[0];
  }

  // fuzzy fallback — require a minimum score to avoid returning unrelated entities
  let best: { rec: RecordLite; score: number } | undefined;
  for (const r of list) {
    const s = fuzzyScore(name, r);
    if (!best || s > best.score) best = { rec: r, score: s };
  }
  return best && best.score >= 10 ? best.rec : undefined;
}

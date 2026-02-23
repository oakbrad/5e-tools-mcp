/**
 * Search logic for domain-specific tools
 * Extracted for testability
 */

import { toSlug } from "./utils.js";

export type Ruleset = "2014" | "2024" | "any";
export type Kind =
  | "monster"
  | "spell"
  | "item"
  | "feat"
  | "background"
  | "race"
  | "class"
  | "subclass"
  | "condition"
  | "rule"
  | "adventure"
  | "book"
  | "table"
  | "deity"
  | "vehicle"
  | "trap"
  | "optionalfeature"
  | "psionic"
  | "language"
  | "object"
  | "reward"
  | "recipe"
  | "deck"
  | "facility";

export type RecordLite = {
  uri: string;
  name: string;
  slug: string;
  source: string;
  ruleset: Ruleset;
  facets: Record<string, any>;
  aliases?: string[];
  kind: Kind;
  homebrew?: boolean;
};

/**
 * Shape of entities stored in the byUri map. Injected metadata fields (_uri,
 * _source, etc.) are always present; common fields like name/entries are
 * typed for safety. The index signature allows access to entity-specific
 * fields (author, level, cr, etc.) without explicit casts.
 */
export type StoredEntity = {
  // Injected during loading (always present)
  _uri: string;
  _source: string;
  _ruleset: Ruleset;
  _kind: Kind;
  _contentData?: any[];

  // Common across all entity kinds
  name: string;
  source: string;

  // Content fields — shape varies by kind
  entries?: any;
  entry?: any;
  text?: any;

  // Entity-specific fields (cr, level, author, type, etc.)
  [key: string]: any;
};

export type SearchIndex = {
  byKind: Map<Kind, RecordLite[]>;
  byUri: Map<string, StoredEntity>;
};

/** simple Levenshtein distance */
function lev(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** fuzzy ranking across name, slug, aliases */
export function fuzzyScore(q: string, rec: RecordLite): number {
  const ql = q.toLowerCase();
  const name = rec.name.toLowerCase();
  const slug = rec.slug;
  const aliases = (rec.aliases ?? []).map((s) => s.toLowerCase());

  // homebrew tie-breaker: small bonus so homebrew surfaces first when
  // text relevance is equal (won't override a better text match)
  const brew = rec.homebrew ? 2 : 0;

  if (name === ql) return 100 + brew;
  if (slug === toSlug(ql)) return 95 + brew;
  if (name.startsWith(ql)) return 90 + brew;

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
      for (const al of aliases)
        if (al.includes(t)) {
          score += 4;
          break;
        }
    }
  }

  // edit distance bonus for short strings
  if (ql.length <= 20) {
    const d = lev(ql, name);
    score += Math.max(0, 30 - d * 3);
  }

  return score + brew;
}

export type SearchSpellsParams = {
  name?: string;
  level?: number;
  school?: "A" | "C" | "D" | "E" | "I" | "N" | "T" | "V";
  classes?: string[];
  source?: string;
  ruleset?: Ruleset;
  limit?: number;
};

export function searchSpells(idx: SearchIndex, params: SearchSpellsParams): RecordLite[] {
  const { name, level, school, classes, source, ruleset = "any", limit = 10 } = params;
  const spells = idx.byKind.get("spell") ?? [];

  let candidates = spells.filter((r) => {
    if (ruleset !== "any" && r.ruleset !== ruleset) return false;
    if (source && r.source !== source) return false;
    if (level !== undefined && r.facets.level !== level) return false;
    if (school && r.facets.school !== school) return false;
    if (classes?.length) {
      const spellClasses: string[] = r.facets.classes ?? [];
      const hasMatchingClass = classes.some((cls) =>
        spellClasses.some((sc: string) => sc.includes(cls.toLowerCase())),
      );
      if (!hasMatchingClass) return false;
    }
    return true;
  });

  if (name) {
    const q = name.toLowerCase();
    candidates = candidates
      .map((r) => ({ r, s: fuzzyScore(q, r) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.r);
  } else {
    candidates = candidates.slice(0, limit);
  }

  return candidates;
}

export type SearchMonstersParams = {
  name?: string;
  cr_min?: number;
  cr_max?: number;
  type?: string;
  source?: string;
  ruleset?: Ruleset;
  limit?: number;
};

export function searchMonsters(idx: SearchIndex, params: SearchMonstersParams): RecordLite[] {
  const { name, cr_min, cr_max, type, source, ruleset = "any", limit = 10 } = params;
  const monsters = idx.byKind.get("monster") ?? [];

  // Helper to convert CR to numeric value for comparison
  const crToNumber = (cr: any): number => {
    if (typeof cr === "number") return cr;
    if (typeof cr === "string") {
      if (cr === "0") return 0;
      if (cr.includes("/")) {
        const [num, denom] = cr.split("/").map(Number);
        return num / denom;
      }
      return parseFloat(cr);
    }
    if (cr?.cr) return crToNumber(cr.cr);
    return 0;
  };

  let candidates = monsters.filter((r) => {
    if (ruleset !== "any" && r.ruleset !== ruleset) return false;
    if (source && r.source !== source) return false;

    if (cr_min !== undefined || cr_max !== undefined) {
      const monsterCr = crToNumber(r.facets.cr);
      if (cr_min !== undefined && monsterCr < cr_min) return false;
      if (cr_max !== undefined && monsterCr > cr_max) return false;
    }

    if (type) {
      const monsterType = (r.facets.type || "").toLowerCase();
      if (!monsterType.includes(type.toLowerCase())) return false;
    }

    return true;
  });

  if (name) {
    const q = name.toLowerCase();
    candidates = candidates
      .map((r) => ({ r, s: fuzzyScore(q, r) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.r);
  } else {
    candidates = candidates.slice(0, limit);
  }

  return candidates;
}

export type SearchItemsParams = {
  name?: string;
  rarity?:
    | "none"
    | "common"
    | "uncommon"
    | "rare"
    | "very rare"
    | "legendary"
    | "artifact"
    | "unknown"
    | "unknown (magic)"
    | "varies";
  type?: string;
  attunement?: boolean;
  source?: string;
  ruleset?: Ruleset;
  limit?: number;
};

export function searchItems(idx: SearchIndex, params: SearchItemsParams): RecordLite[] {
  const { name, rarity, type, attunement, source, ruleset = "any", limit = 10 } = params;
  const items = idx.byKind.get("item") ?? [];

  let candidates = items.filter((r) => {
    if (ruleset !== "any" && r.ruleset !== ruleset) return false;
    if (source && r.source !== source) return false;
    if (rarity && r.facets.rarity !== rarity) return false;
    if (attunement !== undefined && r.facets.reqAttune !== attunement) return false;

    if (type) {
      const itemType = (r.facets.type || "").toLowerCase();
      if (!itemType.includes(type.toLowerCase())) return false;
    }

    return true;
  });

  if (name) {
    const q = name.toLowerCase();
    candidates = candidates
      .map((r) => ({ r, s: fuzzyScore(q, r) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.r);
  } else {
    candidates = candidates.slice(0, limit);
  }

  return candidates;
}

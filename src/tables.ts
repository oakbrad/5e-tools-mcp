// src/tables.ts
// Table normalization, dice parsing, rolling, and search for 5eTools table data.

import { renderTextWithTags, renderEntries } from "./renderer.js";
import { rollDice } from "./treasure.js";
import type { RecordLite } from "./search.js";

// ── Types ──────────────────────────────────────────────────────────────

/** A single dice term like "2d6" */
export type DiceTerm = {
  count: number;
  sides: number;
};

/** A parsed dice expression — one or more terms summed, with optional modifier */
export type DiceExpression = {
  terms: DiceTerm[];
  modifier: number;
  raw: string;
  min: number;
  max: number;
};

/** A single row in a normalized rollable table */
export type RollableRow = {
  min: number;
  max: number;
  results: string[]; // one string per result column
};

/** A fully normalized table ready for rolling */
export type RollableTable = {
  name: string;
  source: string;
  page?: number;
  caption?: string;
  category: "display" | "encounter" | "name";
  parentName?: string;
  subtable?: string;
  diceExpression: DiceExpression;
  resultColumns: string[];
  rows: RollableRow[];
  rollable: boolean;
  homebrew: boolean;
};

/** Result from a single roll on a table */
export type RollResult = {
  tableName: string;
  tableSource: string;
  diceExpression: string;
  rollValue: number;
  results: Record<string, string>;
};

// ── Dice Parsing ───────────────────────────────────────────────────────

/**
 * Parse a dice expression string into a structured DiceExpression.
 * Handles: "d20", "2d6", "1d6+3", "d12 + d8", "{@dice d100}", "{@damage 2d6}"
 * Returns null if the string is not a recognizable dice expression.
 */
export function parseDiceExpression(raw: string): DiceExpression | null {
  // Strip 5eTools tag wrappers: {@dice ...}, {@damage ...}
  const cleaned = raw.replace(/\{@(?:dice|damage)\s+([^}]+)\}/gi, "$1").trim();

  // Split on " + " for compound expressions like "d12 + d8"
  const parts = cleaned.split(/\s*\+\s*/);

  const terms: DiceTerm[] = [];
  let modifier = 0;

  for (const part of parts) {
    // Match dice notation: optional count, "d", sides
    const diceMatch = part.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      if (count > 0 && sides > 0) {
        terms.push({ count, sides });
        continue;
      }
    }

    // Match plain number modifier (e.g., the "3" in "1d6 + 3")
    const numMatch = part.match(/^(-?\d+)$/);
    if (numMatch) {
      modifier += parseInt(numMatch[1], 10);
      continue;
    }

    // Unrecognized part — not a dice expression
    return null;
  }

  if (terms.length === 0) return null;

  const min = terms.reduce((sum, t) => sum + t.count, 0) + modifier;
  const max = terms.reduce((sum, t) => sum + t.count * t.sides, 0) + modifier;

  return { terms, modifier, raw: cleaned, min, max };
}

/**
 * Parse a display table row's dice value cell into a min/max range.
 * Handles: "3" → {3,3}, "03" → {3,3}, "01–20" → {1,20}, "91–00" → {91,100}
 * The en-dash U+2013 or hyphen is used as range separator.
 */
export function parseDisplayRowRange(cell: string): { min: number; max: number } | null {
  const s = String(cell).trim();

  // Range with en-dash or hyphen: "01–20", "91-00"
  const rangeMatch = s.match(/^(\d+)[\u2013-](\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    let hi = parseInt(rangeMatch[2], 10);
    // "00" at the end of a d100 range means 100
    if (hi === 0 && rangeMatch[2] === "00") hi = 100;
    return { min: lo, max: hi };
  }

  // Single numeric value: "3", "03"
  const numMatch = s.match(/^(\d+)$/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    // "00" as a standalone value means 100 on d100 tables
    if (val === 0 && numMatch[1] === "00") return { min: 100, max: 100 };
    return { min: val, max: val };
  }

  return null;
}

// ── Dice Rolling ───────────────────────────────────────────────────────

/** Roll a parsed dice expression and return the total */
export function rollExpression(expr: DiceExpression): number {
  let total = expr.modifier;
  for (const term of expr.terms) {
    total += rollDice(term.count, term.sides);
  }
  return total;
}

// ── Table Normalization ────────────────────────────────────────────────

/**
 * Render a table cell value to a string.
 * Cells can be plain strings, numbers, or nested 5eTools entry objects.
 */
function cellToString(cell: any): string {
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return String(cell);
  // Entry object — render recursively
  return renderEntries(cell);
}

/**
 * Normalize a display-format table (from tables.json or homebrew) into a RollableTable.
 * Returns null if the table has no rows.
 */
export function normalizeDisplayTable(raw: any, homebrew: boolean): RollableTable | null {
  const name: string = raw.name ?? raw.caption ?? "Unknown Table";
  const source: string = raw.source ?? "UNK";
  const colLabels: string[] = raw.colLabels ?? [];
  const rows: any[][] = raw.rows ?? [];

  if (rows.length === 0) return null;

  // Try to parse the first column label as a dice expression
  const diceExpr = colLabels.length > 0 ? parseDiceExpression(colLabels[0]) : null;
  const rollable = diceExpr !== null;

  // Result column labels are everything after the dice column
  const resultColumns = colLabels.length > 1 ? colLabels.slice(1) : ["Result"];

  // Normalize rows
  const normalizedRows: RollableRow[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const range = rollable ? parseDisplayRowRange(String(row[0])) : null;
    const min = range?.min ?? normalizedRows.length + 1;
    const max = range?.max ?? min;

    // Result cells are everything after the first (dice) column
    const results = row.length > 1 ? row.slice(1).map(cellToString) : [cellToString(row[0])];

    normalizedRows.push({ min, max, results });
  }

  // Build a fallback dice expression for non-rollable tables
  const fallbackExpr: DiceExpression = {
    terms: [{ count: 1, sides: normalizedRows.length }],
    modifier: 0,
    raw: `d${normalizedRows.length}`,
    min: 1,
    max: normalizedRows.length,
  };

  return {
    name,
    source,
    page: raw.page,
    caption: raw.caption,
    category: "display",
    diceExpression: diceExpr ?? fallbackExpr,
    resultColumns,
    rows: normalizedRows,
    rollable,
    homebrew,
  };
}

/**
 * Normalize encounter subtables into individual RollableTable entries.
 * One encounter group produces multiple tables (one per level range or caption).
 */
export function normalizeEncounterTables(raw: any): RollableTable[] {
  const baseName: string = raw.name ?? "Unknown";
  const source: string = raw.source ?? "UNK";
  const page: number | undefined = raw.page;
  const subtables: any[] = raw.tables ?? [];
  const results: RollableTable[] = [];

  for (const sub of subtables) {
    // Build composite name from level range or caption
    let qualifier: string;
    if (sub.minlvl !== undefined && sub.maxlvl !== undefined) {
      qualifier = `Levels ${sub.minlvl}-${sub.maxlvl}`;
    } else if (sub.caption) {
      qualifier = sub.caption;
    } else {
      qualifier = `Table ${results.length + 1}`;
    }
    const compositeName = `${baseName} Encounters (${qualifier})`;

    const diceExpr = parseDiceExpression(sub.diceExpression ?? "d100");
    if (!diceExpr) continue;

    const rows: RollableRow[] = (sub.table ?? []).map((row: any) => ({
      min: row.min,
      max: row.max,
      results: [cellToString(row.result ?? "")],
    }));

    results.push({
      name: compositeName,
      source,
      page,
      category: "encounter",
      parentName: baseName,
      subtable: qualifier,
      diceExpression: diceExpr,
      resultColumns: ["Encounter"],
      rows,
      rollable: true,
      homebrew: false,
    });
  }

  return results;
}

/**
 * Normalize name subtables into individual RollableTable entries.
 * One name group produces multiple tables (one per option like Male/Female/Clan).
 */
export function normalizeNameTables(raw: any): RollableTable[] {
  const baseName: string = raw.name ?? "Unknown";
  const source: string = raw.source ?? "UNK";
  const page: number | undefined = raw.page;
  const subtables: any[] = raw.tables ?? [];
  const results: RollableTable[] = [];

  for (const sub of subtables) {
    const option: string = sub.option ?? `Table ${results.length + 1}`;
    const compositeName = `${baseName} Names (${option})`;

    const diceExpr = parseDiceExpression(sub.diceExpression ?? "d100");
    if (!diceExpr) continue;

    const rows: RollableRow[] = (sub.table ?? []).map((row: any) => ({
      min: row.min,
      max: row.max,
      results: [cellToString(row.result ?? "")],
    }));

    results.push({
      name: compositeName,
      source,
      page,
      category: "name",
      parentName: baseName,
      subtable: option,
      diceExpression: diceExpr,
      resultColumns: ["Name"],
      rows,
      rollable: true,
      homebrew: false,
    });
  }

  return results;
}

// ── Rolling ────────────────────────────────────────────────────────────

/** Look up the matching row for a given dice value */
export function lookupRow(table: RollableTable, value: number): RollableRow | null {
  for (const row of table.rows) {
    if (value >= row.min && value <= row.max) return row;
  }
  return null;
}

/** Roll on a table N times and return rendered results */
export function rollOnTable(table: RollableTable, times: number): RollResult[] {
  const results: RollResult[] = [];

  for (let i = 0; i < times; i++) {
    const value = rollExpression(table.diceExpression);
    const row = lookupRow(table, value);

    const rendered: Record<string, string> = {};
    if (row) {
      for (let c = 0; c < table.resultColumns.length; c++) {
        const raw = row.results[c] ?? "";
        rendered[table.resultColumns[c]] = renderTextWithTags(raw);
      }
    } else {
      rendered["Result"] = "(no matching entry)";
    }

    results.push({
      tableName: table.name,
      tableSource: table.source,
      diceExpression: table.diceExpression.raw,
      rollValue: value,
      results: rendered,
    });
  }

  return results;
}

// ── Search ─────────────────────────────────────────────────────────────

export type SearchTablesParams = {
  name?: string;
  category?: "display" | "encounter" | "name";
  source?: string;
  homebrew?: boolean;
  rollableOnly?: boolean;
  limit?: number;
};

/**
 * Search tables in the index using fuzzy matching and facet filters.
 * Uses the same fuzzyScore approach as server.ts for consistency.
 */
export function searchTables(
  allTables: RecordLite[],
  params: SearchTablesParams,
  fuzzyScore: (query: string, rec: RecordLite) => number,
): RecordLite[] {
  const { name, category, source, homebrew, rollableOnly = true, limit = 10 } = params;

  let candidates = allTables;

  // Apply facet filters
  if (category) candidates = candidates.filter((r) => r.facets.category === category);
  if (source)
    candidates = candidates.filter((r) => r.source.toLowerCase() === source.toLowerCase());
  if (homebrew === true) candidates = candidates.filter((r) => r.facets.homebrew === true);
  if (rollableOnly) candidates = candidates.filter((r) => r.facets.rollable !== false);

  // Score and sort by fuzzy match if name provided, otherwise alphabetical
  if (name) {
    const scored = candidates
      .map((r) => ({ r, s: fuzzyScore(name, r) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map((x) => x.r);
  }

  return candidates.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
}

// ── Formatting ─────────────────────────────────────────────────────────

/** Format a single group of roll results as markdown */
export function formatRollResults(results: RollResult[]): string {
  if (results.length === 0) return "No results.";

  const first = results[0];
  const lines: string[] = [
    `**Rolled on: ${first.tableName} (${first.tableSource}) — ${first.diceExpression}**\n`,
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const cols = Object.entries(r.results);
    // Single-column: just show the value
    if (cols.length === 1) {
      lines.push(`Roll ${i + 1}: **${r.rollValue}** → ${cols[0][1]}`);
    } else {
      // Multi-column: label each
      const parts = cols.map(([label, val]) => `${label}: ${val}`).join(" | ");
      lines.push(`Roll ${i + 1}: **${r.rollValue}** → ${parts}`);
    }
  }

  return lines.join("\n");
}

/** Format multiple groups of roll results (from roll_on_tables) */
export function formatMultiRollResults(
  groups: { tableName: string; results: RollResult[] }[],
): string {
  if (groups.length === 0) return "No results.";
  return groups.map((g) => formatRollResults(g.results)).join("\n\n---\n\n");
}

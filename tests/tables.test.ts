import { describe, it, expect } from "vitest";
import {
  parseDiceExpression,
  parseDisplayRowRange,
  rollExpression,
  normalizeDisplayTable,
  normalizeEncounterTables,
  normalizeNameTables,
  lookupRow,
  rollOnTable,
  searchTables,
  formatRollResults,
  formatMultiRollResults,
  type RollableTable,
  type RecordLite,
} from "../src/tables.js";

// ── parseDiceExpression ────────────────────────────────────────────────

describe("parseDiceExpression", () => {
  it("parses simple d20", () => {
    const r = parseDiceExpression("d20");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 20 }]);
    expect(r!.modifier).toBe(0);
    expect(r!.min).toBe(1);
    expect(r!.max).toBe(20);
  });

  it("parses 2d6", () => {
    const r = parseDiceExpression("2d6");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 2, sides: 6 }]);
    expect(r!.min).toBe(2);
    expect(r!.max).toBe(12);
  });

  it("parses d100", () => {
    const r = parseDiceExpression("d100");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 100 }]);
    expect(r!.min).toBe(1);
    expect(r!.max).toBe(100);
  });

  it("parses 1d100", () => {
    const r = parseDiceExpression("1d100");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 100 }]);
    expect(r!.min).toBe(1);
    expect(r!.max).toBe(100);
  });

  it("parses compound expression d12 + d8", () => {
    const r = parseDiceExpression("d12 + d8");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([
      { count: 1, sides: 12 },
      { count: 1, sides: 8 },
    ]);
    expect(r!.min).toBe(2);
    expect(r!.max).toBe(20);
  });

  it("parses expression with modifier 1d6 + 3", () => {
    const r = parseDiceExpression("1d6 + 3");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 6 }]);
    expect(r!.modifier).toBe(3);
    expect(r!.min).toBe(4);
    expect(r!.max).toBe(9);
  });

  it("strips {@dice ...} tag wrapper", () => {
    const r = parseDiceExpression("{@dice d100}");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 100 }]);
  });

  it("strips {@damage ...} tag wrapper", () => {
    const r = parseDiceExpression("{@damage 2d6}");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 2, sides: 6 }]);
  });

  it("parses unusual die sizes like d102", () => {
    const r = parseDiceExpression("d102");
    expect(r).not.toBeNull();
    expect(r!.terms).toEqual([{ count: 1, sides: 102 }]);
  });

  it("returns null for non-dice string 'Rank'", () => {
    expect(parseDiceExpression("Rank")).toBeNull();
  });

  it("returns null for non-dice string 'Interaction'", () => {
    expect(parseDiceExpression("Interaction")).toBeNull();
  });

  it("returns null for non-dice string 'Level 1'", () => {
    expect(parseDiceExpression("Level 1")).toBeNull();
  });

  it("returns null for non-dice string 'Name'", () => {
    expect(parseDiceExpression("Name")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDiceExpression("")).toBeNull();
  });
});

// ── parseDisplayRowRange ───────────────────────────────────────────────

describe("parseDisplayRowRange", () => {
  it("parses single digit '3'", () => {
    expect(parseDisplayRowRange("3")).toEqual({ min: 3, max: 3 });
  });

  it("parses zero-padded '03'", () => {
    expect(parseDisplayRowRange("03")).toEqual({ min: 3, max: 3 });
  });

  it("parses range with en-dash '01\u201320'", () => {
    expect(parseDisplayRowRange("01\u201320")).toEqual({ min: 1, max: 20 });
  });

  it("parses range with hyphen '01-20'", () => {
    expect(parseDisplayRowRange("01-20")).toEqual({ min: 1, max: 20 });
  });

  it("parses d100 end range '91\u201300' where 00 means 100", () => {
    expect(parseDisplayRowRange("91\u201300")).toEqual({ min: 91, max: 100 });
  });

  it("parses standalone '00' as 100", () => {
    expect(parseDisplayRowRange("00")).toEqual({ min: 100, max: 100 });
  });

  it("parses '1'", () => {
    expect(parseDisplayRowRange("1")).toEqual({ min: 1, max: 1 });
  });

  it("parses '10'", () => {
    expect(parseDisplayRowRange("10")).toEqual({ min: 10, max: 10 });
  });

  it("returns null for non-numeric 'Acid'", () => {
    expect(parseDisplayRowRange("Acid")).toBeNull();
  });

  it("returns null for non-numeric 'Fire damage'", () => {
    expect(parseDisplayRowRange("Fire damage")).toBeNull();
  });
});

// ── rollExpression ─────────────────────────────────────────────────────

describe("rollExpression", () => {
  it("rolls d20 within valid range", () => {
    const expr = parseDiceExpression("d20")!;
    for (let i = 0; i < 100; i++) {
      const result = rollExpression(expr);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it("rolls 2d6 within valid range (2-12)", () => {
    const expr = parseDiceExpression("2d6")!;
    for (let i = 0; i < 100; i++) {
      const result = rollExpression(expr);
      expect(result).toBeGreaterThanOrEqual(2);
      expect(result).toBeLessThanOrEqual(12);
    }
  });

  it("rolls d12 + d8 within valid range (2-20)", () => {
    const expr = parseDiceExpression("d12 + d8")!;
    for (let i = 0; i < 100; i++) {
      const result = rollExpression(expr);
      expect(result).toBeGreaterThanOrEqual(2);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it("rolls 1d6 + 3 within valid range (4-9)", () => {
    const expr = parseDiceExpression("1d6 + 3")!;
    for (let i = 0; i < 100; i++) {
      const result = rollExpression(expr);
      expect(result).toBeGreaterThanOrEqual(4);
      expect(result).toBeLessThanOrEqual(9);
    }
  });

  it("rolls d100 within valid range", () => {
    const expr = parseDiceExpression("d100")!;
    for (let i = 0; i < 100; i++) {
      const result = rollExpression(expr);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    }
  });
});

// ── normalizeDisplayTable ──────────────────────────────────────────────

describe("normalizeDisplayTable", () => {
  it("normalizes a standard d10 table", () => {
    const raw = {
      name: "Art Objects",
      source: "PSX",
      page: 26,
      caption: "2,500 gp Art Objects",
      colLabels: ["d10", "Object"],
      rows: [
        ["1", "A golden crown"],
        ["2", "A silver chalice"],
        ["3", "A jade necklace"],
      ],
    };
    const table = normalizeDisplayTable(raw, false);
    expect(table).not.toBeNull();
    expect(table!.name).toBe("Art Objects");
    expect(table!.source).toBe("PSX");
    expect(table!.category).toBe("display");
    expect(table!.rollable).toBe(true);
    expect(table!.diceExpression.terms).toEqual([{ count: 1, sides: 10 }]);
    expect(table!.resultColumns).toEqual(["Object"]);
    expect(table!.rows).toHaveLength(3);
    expect(table!.rows[0]).toEqual({ min: 1, max: 1, results: ["A golden crown"] });
    expect(table!.homebrew).toBe(false);
  });

  it("normalizes a multi-column homebrew table", () => {
    const raw = {
      name: "Books of Pyora",
      source: "DungeonChurch",
      colLabels: ["1d100", "Book", "Language"],
      rows: [
        ["1", "Urgaud's Culinary Travels", "Common"],
        ["2", "The Book of the Dead", "Infernal"],
      ],
    };
    const table = normalizeDisplayTable(raw, true);
    expect(table).not.toBeNull();
    expect(table!.resultColumns).toEqual(["Book", "Language"]);
    expect(table!.rows[0].results).toEqual(["Urgaud's Culinary Travels", "Common"]);
    expect(table!.homebrew).toBe(true);
    expect(table!.diceExpression.terms).toEqual([{ count: 1, sides: 100 }]);
  });

  it("marks table without dice column as non-rollable but still usable", () => {
    const raw = {
      name: "Damage Types",
      source: "PHB",
      colLabels: ["Type", "Description"],
      rows: [
        ["Acid", "Corrosive spray"],
        ["Fire", "Burning flames"],
      ],
    };
    const table = normalizeDisplayTable(raw, false);
    expect(table).not.toBeNull();
    // Non-rollable because "Type" is not a dice expression
    expect(table!.rollable).toBe(false);
    // But still has rows indexed sequentially
    expect(table!.rows).toHaveLength(2);
  });

  it("returns null for empty rows", () => {
    const raw = { name: "Empty", source: "TST", rows: [] };
    expect(normalizeDisplayTable(raw, false)).toBeNull();
  });

  it("handles rows with entry objects as cell values", () => {
    const raw = {
      name: "Effects",
      source: "TST",
      colLabels: ["d4", "Effect"],
      rows: [
        ["1", { type: "entries", entries: ["A strange glow"] }],
        ["2", "Normal text"],
      ],
    };
    const table = normalizeDisplayTable(raw, false);
    expect(table).not.toBeNull();
    expect(table!.rows[0].results[0]).toBe("A strange glow");
    expect(table!.rows[1].results[0]).toBe("Normal text");
  });

  it("handles {@dice} tag in colLabels", () => {
    const raw = {
      name: "Creatures",
      source: "TST",
      colLabels: ["{@dice d8}", "Creature"],
      rows: [
        ["1", "Goblin"],
        ["2", "Wolf"],
      ],
    };
    const table = normalizeDisplayTable(raw, false);
    expect(table).not.toBeNull();
    expect(table!.rollable).toBe(true);
    expect(table!.diceExpression.terms).toEqual([{ count: 1, sides: 8 }]);
  });
});

// ── normalizeEncounterTables ───────────────────────────────────────────

describe("normalizeEncounterTables", () => {
  it("normalizes encounter with level-range subtables", () => {
    const raw = {
      name: "Arctic",
      source: "XGE",
      page: 92,
      tables: [
        {
          minlvl: 1,
          maxlvl: 4,
          diceExpression: "d100",
          table: [
            { min: 1, max: 1, result: "1 {@creature giant owl}" },
            { min: 2, max: 5, result: "{@dice 1d6 + 3} {@creature kobold||kobolds}" },
          ],
        },
        {
          minlvl: 5,
          maxlvl: 10,
          diceExpression: "d100",
          table: [
            { min: 1, max: 5, result: "2 {@creature saber-toothed tiger||saber-toothed tigers}" },
          ],
        },
      ],
    };

    const tables = normalizeEncounterTables(raw);
    expect(tables).toHaveLength(2);

    expect(tables[0].name).toBe("Arctic Encounters (Levels 1-4)");
    expect(tables[0].parentName).toBe("Arctic");
    expect(tables[0].subtable).toBe("Levels 1-4");
    expect(tables[0].category).toBe("encounter");
    expect(tables[0].rollable).toBe(true);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0].min).toBe(1);
    expect(tables[0].rows[0].max).toBe(1);

    expect(tables[1].name).toBe("Arctic Encounters (Levels 5-10)");
    expect(tables[1].subtable).toBe("Levels 5-10");
    expect(tables[1].rows).toHaveLength(1);
  });

  it("normalizes encounter with caption subtables", () => {
    const raw = {
      name: "Sigil",
      source: "SatO",
      tables: [
        {
          caption: "Clerks' Ward",
          diceExpression: "d100",
          table: [{ min: 1, max: 10, result: "A lost modron" }],
        },
      ],
    };

    const tables = normalizeEncounterTables(raw);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("Sigil Encounters (Clerks' Ward)");
    expect(tables[0].subtable).toBe("Clerks' Ward");
  });

  it("handles encounter with no subtables", () => {
    const raw = { name: "Empty", source: "TST", tables: [] };
    expect(normalizeEncounterTables(raw)).toHaveLength(0);
  });
});

// ── normalizeNameTables ────────────────────────────────────────────────

describe("normalizeNameTables", () => {
  it("normalizes name table with option subtables", () => {
    const raw = {
      name: "Dragonborn",
      source: "XGE",
      page: 175,
      tables: [
        {
          option: "Female",
          diceExpression: "d100",
          table: [
            { min: 1, max: 2, result: "Akra" },
            { min: 3, max: 4, result: "Aasathra" },
          ],
        },
        {
          option: "Male",
          diceExpression: "d100",
          table: [{ min: 1, max: 2, result: "Arjhan" }],
        },
        {
          option: "Clan",
          diceExpression: "d100",
          table: [{ min: 1, max: 2, result: "Clethtinthiallor" }],
        },
      ],
    };

    const tables = normalizeNameTables(raw);
    expect(tables).toHaveLength(3);

    expect(tables[0].name).toBe("Dragonborn Names (Female)");
    expect(tables[0].parentName).toBe("Dragonborn");
    expect(tables[0].subtable).toBe("Female");
    expect(tables[0].category).toBe("name");
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0]).toEqual({ min: 1, max: 2, results: ["Akra"] });

    expect(tables[1].name).toBe("Dragonborn Names (Male)");
    expect(tables[2].name).toBe("Dragonborn Names (Clan)");
  });

  it("handles name group with no subtables", () => {
    const raw = { name: "Empty", source: "TST", tables: [] };
    expect(normalizeNameTables(raw)).toHaveLength(0);
  });
});

// ── lookupRow ──────────────────────────────────────────────────────────

describe("lookupRow", () => {
  const table: RollableTable = {
    name: "Test",
    source: "TST",
    category: "display",
    diceExpression: parseDiceExpression("d10")!,
    resultColumns: ["Result"],
    rows: [
      { min: 1, max: 3, results: ["Low"] },
      { min: 4, max: 7, results: ["Mid"] },
      { min: 8, max: 10, results: ["High"] },
    ],
    rollable: true,
    homebrew: false,
  };

  it("finds row for value at range start", () => {
    expect(lookupRow(table, 1)?.results).toEqual(["Low"]);
  });

  it("finds row for value at range end", () => {
    expect(lookupRow(table, 3)?.results).toEqual(["Low"]);
  });

  it("finds row for mid-range value", () => {
    expect(lookupRow(table, 5)?.results).toEqual(["Mid"]);
  });

  it("finds row for max value", () => {
    expect(lookupRow(table, 10)?.results).toEqual(["High"]);
  });

  it("returns null for out-of-range value", () => {
    expect(lookupRow(table, 11)).toBeNull();
  });
});

// ── rollOnTable ────────────────────────────────────────────────────────

describe("rollOnTable", () => {
  const table: RollableTable = {
    name: "Simple Table",
    source: "TST",
    category: "display",
    diceExpression: parseDiceExpression("d4")!,
    resultColumns: ["Item"],
    rows: [
      { min: 1, max: 1, results: ["Apple"] },
      { min: 2, max: 2, results: ["Banana"] },
      { min: 3, max: 3, results: ["Cherry"] },
      { min: 4, max: 4, results: ["Date"] },
    ],
    rollable: true,
    homebrew: false,
  };

  it("returns correct number of results", () => {
    const results = rollOnTable(table, 5);
    expect(results).toHaveLength(5);
  });

  it("each result has correct table metadata", () => {
    const results = rollOnTable(table, 1);
    expect(results[0].tableName).toBe("Simple Table");
    expect(results[0].tableSource).toBe("TST");
    expect(results[0].diceExpression).toBe("d4");
  });

  it("each result has a valid roll value", () => {
    const results = rollOnTable(table, 50);
    for (const r of results) {
      expect(r.rollValue).toBeGreaterThanOrEqual(1);
      expect(r.rollValue).toBeLessThanOrEqual(4);
    }
  });

  it("each result has the Item column", () => {
    const results = rollOnTable(table, 10);
    for (const r of results) {
      expect(r.results).toHaveProperty("Item");
      expect(["Apple", "Banana", "Cherry", "Date"]).toContain(r.results["Item"]);
    }
  });

  it("renders 5eTools tags in results", () => {
    const tagTable: RollableTable = {
      name: "Tagged",
      source: "TST",
      category: "encounter",
      diceExpression: parseDiceExpression("d1")!, // always rolls 1
      resultColumns: ["Encounter"],
      rows: [{ min: 1, max: 1, results: ["1 {@creature giant owl}"] }],
      rollable: true,
      homebrew: false,
    };
    // d1 doesn't exist but parseDiceExpression handles it — always rolls 1
    // Actually d1 = {count:1, sides:1}, rollDice(1,1) = 1
    const results = rollOnTable(tagTable, 1);
    // renderTextWithTags converts {@creature giant owl} to a markdown link
    expect(results[0].results["Encounter"]).toContain("giant owl");
    expect(results[0].results["Encounter"]).toContain("fiveet://entity/monster");
  });
});

// ── searchTables ───────────────────────────────────────────────────────

describe("searchTables", () => {
  // Simple fuzzy score mock that matches on name containment
  function mockFuzzyScore(query: string, rec: RecordLite): number {
    const q = query.toLowerCase();
    const n = rec.name.toLowerCase();
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    if (n.includes(q)) return 60;
    return 0;
  }

  const records: RecordLite[] = [
    {
      uri: "fiveet://table/XGE/arctic-encounters-levels-1-4",
      name: "Arctic Encounters (Levels 1-4)",
      slug: "arctic-encounters-levels-1-4",
      source: "XGE",
      ruleset: "2014",
      facets: { category: "encounter", rollable: true, homebrew: false, parentName: "Arctic" },
      kind: "table",
    },
    {
      uri: "fiveet://table/XGE/dragonborn-names-female-",
      name: "Dragonborn Names (Female)",
      slug: "dragonborn-names-female-",
      source: "XGE",
      ruleset: "2014",
      facets: { category: "name", rollable: true, homebrew: false, parentName: "Dragonborn" },
      kind: "table",
    },
    {
      uri: "fiveet://table/DungeonChurch/books-of-pyora",
      name: "Books of Pyora",
      slug: "books-of-pyora",
      source: "DungeonChurch",
      ruleset: "2014",
      facets: { category: "display", rollable: true, homebrew: true },
      kind: "table",
    },
    {
      uri: "fiveet://table/TST/damage-types",
      name: "Damage Types",
      slug: "damage-types",
      source: "TST",
      ruleset: "2014",
      facets: { category: "display", rollable: false, homebrew: false },
      kind: "table",
    },
  ];

  it("finds tables by name", () => {
    const results = searchTables(records, { name: "arctic" }, mockFuzzyScore);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Arctic Encounters (Levels 1-4)");
  });

  it("filters by category", () => {
    const results = searchTables(records, { category: "encounter" }, mockFuzzyScore);
    expect(results).toHaveLength(1);
    expect(results[0].name).toContain("Arctic");
  });

  it("filters by source", () => {
    const results = searchTables(records, { source: "DungeonChurch" }, mockFuzzyScore);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Books of Pyora");
  });

  it("filters homebrew only", () => {
    const results = searchTables(records, { homebrew: true }, mockFuzzyScore);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Books of Pyora");
  });

  it("excludes non-rollable tables by default", () => {
    const results = searchTables(records, {}, mockFuzzyScore);
    expect(results.find((r) => r.name === "Damage Types")).toBeUndefined();
  });

  it("includes non-rollable tables when rollableOnly is false", () => {
    const results = searchTables(records, { rollableOnly: false }, mockFuzzyScore);
    expect(results.find((r) => r.name === "Damage Types")).toBeDefined();
  });

  it("respects limit", () => {
    const results = searchTables(records, { limit: 2 }, mockFuzzyScore);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// ── formatRollResults ──────────────────────────────────────────────────

describe("formatRollResults", () => {
  it("formats single result", () => {
    const text = formatRollResults([
      {
        tableName: "Trinkets",
        tableSource: "PHB",
        diceExpression: "d100",
        rollValue: 47,
        results: { Trinket: "A petrified mouse" },
      },
    ]);
    expect(text).toContain("Rolled on: Trinkets (PHB)");
    expect(text).toContain("d100");
    expect(text).toContain("47");
    expect(text).toContain("A petrified mouse");
  });

  it("formats multiple results", () => {
    const text = formatRollResults([
      {
        tableName: "Test",
        tableSource: "TST",
        diceExpression: "d4",
        rollValue: 1,
        results: { Item: "Apple" },
      },
      {
        tableName: "Test",
        tableSource: "TST",
        diceExpression: "d4",
        rollValue: 3,
        results: { Item: "Cherry" },
      },
    ]);
    expect(text).toContain("Roll 1:");
    expect(text).toContain("Roll 2:");
    expect(text).toContain("Apple");
    expect(text).toContain("Cherry");
  });

  it("formats multi-column results with labels", () => {
    const text = formatRollResults([
      {
        tableName: "Books",
        tableSource: "DC",
        diceExpression: "d100",
        rollValue: 5,
        results: { Book: "Salt & Stone", Language: "Common" },
      },
    ]);
    expect(text).toContain("Book: Salt & Stone");
    expect(text).toContain("Language: Common");
  });

  it("returns 'No results.' for empty array", () => {
    expect(formatRollResults([])).toBe("No results.");
  });
});

// ── formatMultiRollResults ─────────────────────────────────────────────

describe("formatMultiRollResults", () => {
  it("formats multiple groups separated by dividers", () => {
    const text = formatMultiRollResults([
      {
        tableName: "Table A",
        results: [
          {
            tableName: "Table A",
            tableSource: "TST",
            diceExpression: "d4",
            rollValue: 2,
            results: { Item: "Banana" },
          },
        ],
      },
      {
        tableName: "Table B",
        results: [
          {
            tableName: "Table B",
            tableSource: "TST",
            diceExpression: "d6",
            rollValue: 5,
            results: { Thing: "Widget" },
          },
        ],
      },
    ]);
    expect(text).toContain("Table A");
    expect(text).toContain("Table B");
    expect(text).toContain("---");
  });

  it("returns 'No results.' for empty groups", () => {
    expect(formatMultiRollResults([])).toBe("No results.");
  });
});

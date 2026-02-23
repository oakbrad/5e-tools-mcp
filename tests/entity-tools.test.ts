import { describe, it, expect } from "vitest";
import { findEntity } from "../src/helpers.js";
import { toSlug } from "../src/utils.js";
import type { AppIndex } from "../src/types.js";
import type { RecordLite, Kind } from "../src/search.js";

// ── Helpers ─────────────────────────────────────────────────────────

function emptyIndex(): AppIndex {
  return {
    byKind: new Map(),
    byUri: new Map(),
    sourcesMeta: new Map(),
    fluffByKey: new Map(),
  };
}

function rec(overrides: Partial<RecordLite> & { name: string; kind: Kind }): RecordLite {
  const name = overrides.name;
  return {
    uri:
      overrides.uri ??
      `fiveet://entity/${overrides.kind}/${overrides.source ?? "PHB"}/${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    source: overrides.source ?? "PHB",
    ruleset: overrides.ruleset ?? "2014",
    facets: overrides.facets ?? {},
    kind: overrides.kind,
  };
}

// ── get_entity source fallback fix ──────────────────────────────────
// The bug: get_entity used to hardcode key.source ?? "PHB" and do a
// direct byUri.get() lookup, so any entity not from PHB was unfindable.
// The fix: use findEntity() which does fuzzy matching across all sources.

describe("get_entity source fallback — findEntity behavior", () => {
  it("finds entity without specifying source", () => {
    const idx = emptyIndex();
    const tyr = rec({ name: "Tyr", kind: "deity", source: "SCAG" });
    idx.byKind.set("deity", [tyr]);

    // Old code would construct fiveet://entity/deity/PHB/tyr → not found
    // New code uses findEntity which searches across all sources
    const result = findEntity(idx, "deity", "Tyr");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Tyr");
    expect(result!.source).toBe("SCAG");
  });

  it("finds entity from non-PHB source when source not specified", () => {
    const idx = emptyIndex();
    const item = rec({ name: "Holy Avenger", kind: "item", source: "DMG" });
    idx.byKind.set("item", [item]);

    const result = findEntity(idx, "item", "Holy Avenger");
    expect(result).toBeDefined();
    expect(result!.source).toBe("DMG");
  });

  it("prefers 2024 ruleset when both exist and no source given", () => {
    const idx = emptyIndex();
    const old = rec({ name: "Shield", kind: "spell", source: "PHB", ruleset: "2014" });
    const new24 = rec({
      name: "Shield",
      kind: "spell",
      source: "XPHB",
      ruleset: "2024",
      uri: "fiveet://entity/spell/XPHB/shield",
    });
    idx.byKind.set("spell", [old, new24]);

    const result = findEntity(idx, "spell", "Shield", undefined, "2024");
    expect(result).toBeDefined();
    expect(result!.ruleset).toBe("2024");
  });

  it("respects explicit source when provided", () => {
    const idx = emptyIndex();
    const phb = rec({ name: "Shield", kind: "spell", source: "PHB", ruleset: "2014" });
    const xphb = rec({
      name: "Shield",
      kind: "spell",
      source: "XPHB",
      ruleset: "2024",
      uri: "fiveet://entity/spell/XPHB/shield",
    });
    idx.byKind.set("spell", [phb, xphb]);

    const result = findEntity(idx, "spell", "Shield", "PHB");
    expect(result).toBeDefined();
    expect(result!.source).toBe("PHB");
  });

  it("fuzzy matches when name is close but not exact", () => {
    const idx = emptyIndex();
    const entity = rec({ name: "Apparatus of Kwalish", kind: "vehicle", source: "DMG" });
    idx.byKind.set("vehicle", [entity]);

    const result = findEntity(idx, "vehicle", "apparatus kwalish");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Apparatus of Kwalish");
  });
});

// ── Bug C regression: get_rules_section must not fall back to random rule ──
// This tests the logic inlined in the tool handler. We simulate the same
// candidate selection that the handler performs.

describe("get_rules_section candidate selection", () => {
  function ruleRec(name: string): RecordLite {
    return rec({ name, kind: "rule", source: "DMG" });
  }

  it("returns exact slug match", () => {
    const list = [ruleRec("Flanking"), ruleRec("Multiclassing"), ruleRec("Cover")];
    const q = "flanking";
    const candidates = list.filter((r) => r.slug === toSlug(q) || r.name.toLowerCase() === q);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe("Flanking");
  });

  it("returns partial match when no exact match", () => {
    const list = [ruleRec("Flanking"), ruleRec("Multiclassing"), ruleRec("Cover")];
    const q = "multi";
    const candidates = list.filter((r) => r.slug === toSlug(q) || r.name.toLowerCase() === q);
    // No exact match
    expect(candidates).toHaveLength(0);
    // But partial match should work
    const fallback = list.find((r) => r.name.toLowerCase().includes(q));
    expect(fallback).toBeDefined();
    expect(fallback!.name).toBe("Multiclassing");
  });

  it("returns undefined (no fallback to list[0]) for garbage input", () => {
    const list = [ruleRec("Flanking"), ruleRec("Multiclassing"), ruleRec("Cover")];
    const q = "xyzzyplugh12345";
    const candidates = list.filter((r) => r.slug === toSlug(q) || r.name.toLowerCase() === q);
    const result = candidates[0] ?? list.find((r) => r.name.toLowerCase().includes(q));
    // Must be undefined — not list[0]
    expect(result).toBeUndefined();
  });
});

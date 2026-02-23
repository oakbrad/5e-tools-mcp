import { describe, it, expect } from "vitest";
import { renderTextWithTags, renderEntries } from "../src/renderer.js";

// ── renderTextWithTags — existing tag coverage ──────────────────────

describe("renderTextWithTags", () => {
  it("renders spell links", () => {
    const out = renderTextWithTags("Cast {@spell Fireball|PHB}.");
    expect(out).toContain("[Fireball](fiveet://entity/spell/PHB/fireball)");
  });

  it("renders item links", () => {
    const out = renderTextWithTags("Use {@item Bag of Holding|DMG}.");
    expect(out).toContain("[Bag of Holding](fiveet://entity/item/DMG/bag-of-holding)");
  });

  it("renders creature links (monster)", () => {
    const out = renderTextWithTags("A {@creature Ogre|MM} appears!");
    expect(out).toContain("[Ogre](fiveet://entity/monster/MM/ogre)");
  });

  it("renders recharge with range", () => {
    const out = renderTextWithTags("{@recharge 5}");
    expect(out).toBe("(Recharge 5–6)");
  });

  it("renders recharge default 6", () => {
    const out = renderTextWithTags("{@recharge}");
    expect(out).toBe("(Recharge 6)");
  });

  it("renders dice and damage and dc/hit", () => {
    const out = renderTextWithTags(
      "Roll {@dice 2d6+3} for {@damage 2d6 fire}, save {@dc 15}, attack {@hit +7}.",
    );
    expect(out).toContain("`2d6+3`");
    expect(out).toContain("**2d6 fire**");
    expect(out).toContain("DC 15");
    expect(out).toContain("+7 to hit");
  });
});

// ── renderTextWithTags — formatting tags ────────────────────────────

describe("renderTextWithTags — formatting", () => {
  it("renders {@b text} as bold", () => {
    expect(renderTextWithTags("{@b important}")).toBe("**important**");
  });

  it("renders {@bold text} as bold", () => {
    expect(renderTextWithTags("{@bold also important}")).toBe("**also important**");
  });

  it("renders {@i text} as italic", () => {
    expect(renderTextWithTags("{@i emphasis}")).toBe("*emphasis*");
  });

  it("renders {@italic text} as italic", () => {
    expect(renderTextWithTags("{@italic stress}")).toBe("*stress*");
  });

  it("renders {@strike text} as strikethrough", () => {
    expect(renderTextWithTags("{@strike removed}")).toBe("~~removed~~");
  });

  it("renders {@note text} as italic", () => {
    expect(renderTextWithTags("{@note DM discretion}")).toBe("*DM discretion*");
  });

  it("strips {@h} header marker", () => {
    expect(renderTextWithTags("{@h}")).toBe("");
  });
});

// ── renderTextWithTags — game mechanic tags ─────────────────────────

describe("renderTextWithTags — mechanics", () => {
  it("renders {@atk mw} as melee weapon attack", () => {
    expect(renderTextWithTags("{@atk mw}")).toBe("*Melee Weapon Attack:*");
  });

  it("renders {@atk rw} as ranged weapon attack", () => {
    expect(renderTextWithTags("{@atk rw}")).toBe("*Ranged Weapon Attack:*");
  });

  it("renders {@atk ms} as melee spell attack", () => {
    expect(renderTextWithTags("{@atk ms}")).toBe("*Melee Spell Attack:*");
  });

  it("renders compound {@atk mw,rw}", () => {
    expect(renderTextWithTags("{@atk mw,rw}")).toBe(
      "*Melee Weapon Attack: or Ranged Weapon Attack:*",
    );
  });

  it("renders {@atkr rw} same as atk", () => {
    expect(renderTextWithTags("{@atkr rw}")).toBe("*Ranged Weapon Attack:*");
  });

  it("renders {@chance 50} as percentage", () => {
    expect(renderTextWithTags("{@chance 50}")).toBe("50%");
  });

  it("renders {@chance 50|text} with label", () => {
    expect(renderTextWithTags("{@chance 50|half the time}")).toBe("half the time (50%)");
  });

  it("renders {@scaledice} to first value", () => {
    expect(renderTextWithTags("{@scaledice 1d10|5-9,1d12}")).toBe("`1d10`");
  });

  it("renders {@scaledamage} to first value", () => {
    expect(renderTextWithTags("{@scaledamage 2d6|2-3|3d6}")).toBe("`2d6`");
  });
});

// ── renderTextWithTags — bold reference tags ────────────────────────

describe("renderTextWithTags — bold references", () => {
  it("renders {@skill Athletics} as bold", () => {
    expect(renderTextWithTags("{@skill Athletics}")).toBe("**Athletics**");
  });

  it("renders {@sense darkvision} as bold", () => {
    expect(renderTextWithTags("{@sense darkvision}")).toBe("**darkvision**");
  });

  it("renders {@action Dash} as bold", () => {
    expect(renderTextWithTags("{@action Dash}")).toBe("**Dash**");
  });

  it("renders {@status prone} as bold", () => {
    expect(renderTextWithTags("{@status prone}")).toBe("**prone**");
  });

  it("renders {@condition Grappled} as bold", () => {
    expect(renderTextWithTags("{@condition Grappled}")).toBe("**Grappled**");
  });

  it("strips source from bold reference tags", () => {
    expect(renderTextWithTags("{@skill Athletics|PHB}")).toBe("**Athletics**");
  });
});

// ── renderTextWithTags — entity link tags ───────────────────────────

describe("renderTextWithTags — entity links", () => {
  it("links {@feat Sentinel} to feat", () => {
    const out = renderTextWithTags("{@feat Sentinel|PHB}");
    expect(out).toBe("[Sentinel](fiveet://entity/feat/PHB/sentinel)");
  });

  it("links {@race Elf} with default source", () => {
    const out = renderTextWithTags("{@race Elf}");
    expect(out).toBe("[Elf](fiveet://entity/race/PHB/elf)");
  });

  it("links {@background Acolyte}", () => {
    const out = renderTextWithTags("{@background Acolyte|PHB}");
    expect(out).toBe("[Acolyte](fiveet://entity/background/PHB/acolyte)");
  });

  it("links {@class Fighter}", () => {
    const out = renderTextWithTags("{@class Fighter}");
    expect(out).toBe("[Fighter](fiveet://entity/class/PHB/fighter)");
  });

  it("links {@deity Tyr}", () => {
    const out = renderTextWithTags("{@deity Tyr|PHB}");
    expect(out).toBe("[Tyr](fiveet://entity/deity/PHB/tyr)");
  });

  it("links {@vehicle Apparatus of Kwalish}", () => {
    const out = renderTextWithTags("{@vehicle Apparatus of Kwalish|DMG}");
    expect(out).toBe("[Apparatus of Kwalish](fiveet://entity/vehicle/DMG/apparatus-of-kwalish)");
  });

  it("links {@trap Pit Trap}", () => {
    const out = renderTextWithTags("{@trap Pit Trap}");
    expect(out).toBe("[Pit Trap](fiveet://entity/trap/DMG/pit-trap)");
  });

  it("links {@hazard Brown Mold} as trap kind", () => {
    const out = renderTextWithTags("{@hazard Brown Mold}");
    expect(out).toBe("[Brown Mold](fiveet://entity/trap/DMG/brown-mold)");
  });

  it("links {@variantrule Flanking} as rule kind", () => {
    const out = renderTextWithTags("{@variantrule Flanking}");
    expect(out).toBe("[Flanking](fiveet://entity/rule/DMG/flanking)");
  });

  it("links {@table Trinkets}", () => {
    const out = renderTextWithTags("{@table Trinkets|PHB}");
    expect(out).toBe("[Trinkets](fiveet://entity/table/PHB/trinkets)");
  });

  it("links {@book Player's Handbook|PHB}", () => {
    const out = renderTextWithTags("{@book Player's Handbook|PHB}");
    expect(out).toContain("[Player's Handbook]");
    expect(out).toContain("fiveet://entity/book/PHB/");
  });

  it("links {@adventure Lost Mine of Phandelver|LMoP}", () => {
    const out = renderTextWithTags("{@adventure Lost Mine of Phandelver|LMoP}");
    expect(out).toContain("[Lost Mine of Phandelver]");
    expect(out).toContain("fiveet://entity/adventure/LMoP/");
  });

  it("uses default source when none specified", () => {
    const out = renderTextWithTags("{@spell Magic Missile}");
    expect(out).toBe("[Magic Missile](fiveet://entity/spell/PHB/magic-missile)");
  });

  it("strips links when linkify=false", () => {
    const out = renderTextWithTags("{@spell Fireball|PHB}", false);
    expect(out).toBe("Fireball");
  });
});

// ── renderTextWithTags — external links and navigation ──────────────

describe("renderTextWithTags — links and navigation", () => {
  it("renders {@link text|url} as markdown link", () => {
    expect(renderTextWithTags("{@link D&D Beyond|https://dndbeyond.com}")).toBe(
      "[D&D Beyond](https://dndbeyond.com)",
    );
  });

  it("renders {@area text} as bold", () => {
    expect(renderTextWithTags("{@area Main Hall}")).toBe("**Main Hall**");
  });

  it("renders {@quickref text} as bold", () => {
    expect(renderTextWithTags("{@quickref Actions in Combat}")).toBe("**Actions in Combat**");
  });

  it("strips {@filter text} to plain text", () => {
    expect(renderTextWithTags("{@filter spells|spells}")).toBe("spells");
  });
});

// ── renderTextWithTags — catch-all ──────────────────────────────────

describe("renderTextWithTags — catch-all", () => {
  it("strips unknown tags to their text content", () => {
    expect(renderTextWithTags("{@unknowntag some text}")).toBe("some text");
  });

  it("strips unknown tags with extra params", () => {
    expect(renderTextWithTags("{@comic panel text|extra}")).toBe("panel text");
  });
});

// ── renderEntries ───────────────────────────────────────────────────

describe("renderEntries", () => {
  it("renders simple string via tag renderer", () => {
    const out = renderEntries("{@spell Fireball|PHB}");
    expect(out).toBe("[Fireball](fiveet://entity/spell/PHB/fireball)");
  });

  it("renders list items as bullets", () => {
    const out = renderEntries({ type: "list", items: ["{@condition Grappled}", "{@dice 1d4}"] });
    expect(out).toContain("- **Grappled**");
    expect(out).toContain("- `1d4`");
  });

  it("renders named block with entries", () => {
    const out = renderEntries({ name: "Feature", entries: ["{@hit +5}"] });
    expect(out).toBe("**Feature.** +5 to hit");
  });

  it("renders table with caption and rows", () => {
    const out = renderEntries({
      type: "table",
      caption: "Random Trinkets",
      colLabels: ["d6", "Trinket"],
      rows: [
        ["1", "A bone"],
        ["2", "A feather"],
      ],
    });
    expect(out).toContain("**Random Trinkets**");
    expect(out).toContain("| d6 | Trinket |");
    expect(out).toContain("| --- | --- |");
    expect(out).toContain("| 1 | A bone |");
    expect(out).toContain("| 2 | A feather |");
  });

  it("renders table row objects with .row property", () => {
    const out = renderEntries({
      type: "table",
      colLabels: ["Roll", "Result"],
      rows: [{ row: ["1", "Nothing"] }],
    });
    expect(out).toContain("| 1 | Nothing |");
  });

  it("renders quote with attribution", () => {
    const out = renderEntries({
      type: "quote",
      entries: ["To be or not to be."],
      by: "Shakespeare",
    });
    expect(out).toContain("> To be or not to be.");
    expect(out).toContain("— *Shakespeare*");
  });

  it("renders inset blocks", () => {
    const out = renderEntries({
      type: "inset",
      name: "Sidebar",
      entries: ["Extra info here."],
    });
    expect(out).toContain("**Sidebar.**");
    expect(out).toContain("Extra info here.");
  });

  it("renders variant blocks", () => {
    const out = renderEntries({
      type: "variant",
      name: "Optional Rule",
      entries: ["You may use this rule."],
    });
    expect(out).toContain("**Optional Rule.**");
    expect(out).toContain("You may use this rule.");
  });

  it("falls back to text field on unknown object", () => {
    const out = renderEntries({ text: "fallback text" });
    expect(out).toBe("fallback text");
  });

  it("falls back to entry field on unknown object", () => {
    const out = renderEntries({ entry: "single entry" });
    expect(out).toBe("single entry");
  });

  it("returns empty string for unrecognized object", () => {
    const out = renderEntries({ foo: "bar" });
    expect(out).toBe("");
  });
});

// ── renderEntries — new entry types ─────────────────────────────────

describe("renderEntries — inline", () => {
  it("joins inline entries without paragraph breaks", () => {
    const out = renderEntries({
      type: "inline",
      entries: ["Some text ", "and more text."],
    });
    expect(out).toBe("Some text and more text.");
  });

  it("renders nested tags inline", () => {
    const out = renderEntries({
      type: "inline",
      entries: ["You can cast ", "{@spell Fireball|PHB}", " at will."],
    });
    expect(out).toContain("You can cast ");
    expect(out).toContain("[Fireball]");
    expect(out).toContain(" at will.");
    expect(out).not.toContain("\n");
  });
});

describe("renderEntries — hr", () => {
  it("renders horizontal rule", () => {
    expect(renderEntries({ type: "hr" })).toBe("---");
  });
});

describe("renderEntries — image", () => {
  it("renders image with title and credit", () => {
    const out = renderEntries({
      type: "image",
      href: { type: "internal", path: "items/BGG/Adze.webp" },
      title: "Adze of Annam",
      credit: "Isabel Gibney",
    });
    expect(out).toContain("[Image: Adze of Annam]");
    expect(out).toContain("Credit: Isabel Gibney");
  });

  it("renders image without title", () => {
    const out = renderEntries({
      type: "image",
      href: { type: "internal", path: "blank.webp" },
    });
    expect(out).toBe("*[Image]*");
  });
});

describe("renderEntries — abilityDc", () => {
  it("renders DC block with single attribute", () => {
    const out = renderEntries({
      type: "abilityDc",
      name: "Spell",
      attributes: ["int"],
    });
    expect(out).toBe("**Spell save DC** = 8 + your proficiency bonus + your INT modifier");
  });

  it("renders DC block with multiple attributes", () => {
    const out = renderEntries({
      type: "abilityDc",
      name: "Buggy Code",
      attributes: ["wis", "int"],
    });
    expect(out).toContain("WIS or INT");
  });
});

describe("renderEntries — abilityGeneric", () => {
  it("renders generic ability with name and text", () => {
    const out = renderEntries({
      type: "abilityGeneric",
      name: "Passive Perception",
      text: "10 + Wisdom ({@skill Perception|XPHB}) check modifier",
    });
    expect(out).toContain("**Passive Perception**");
    expect(out).toContain("10 + Wisdom");
    expect(out).toContain("**Perception**");
  });

  it("renders generic ability with text only", () => {
    const out = renderEntries({
      type: "abilityGeneric",
      text: "leave out the 'name' as required",
    });
    expect(out).toContain("leave out the 'name' as required");
    expect(out).not.toContain("**");
  });
});

describe("renderEntries — statblockInline", () => {
  it("renders inline stat block with name and type", () => {
    const out = renderEntries({
      type: "statblockInline",
      dataType: "monster",
      data: { name: "Unicorn", entries: ["A magical creature."] },
    });
    expect(out).toContain("**Unicorn** *(monster)*");
    expect(out).toContain("A magical creature.");
  });

  it("renders inline stat block without entries", () => {
    const out = renderEntries({
      type: "statblockInline",
      dataType: "spell",
      data: { name: "Fireball" },
    });
    expect(out).toBe("**Fireball** *(spell)*");
  });

  it("defaults dataType to creature", () => {
    const out = renderEntries({
      type: "statblockInline",
      data: { name: "Goblin" },
    });
    expect(out).toContain("*(creature)*");
  });
});

describe("renderEntries — statblock", () => {
  it("renders stat block reference as entity link", () => {
    const out = renderEntries({
      type: "statblock",
      tag: "creature",
      name: "Goblin",
    });
    expect(out).toContain("[Goblin]");
    expect(out).toContain("fiveet://entity/monster/MM/goblin");
  });

  it("uses source from entry when provided", () => {
    const out = renderEntries({
      type: "statblock",
      tag: "deity",
      name: "Abbathor",
      source: "SCAG",
    });
    expect(out).toContain("[Abbathor]");
    expect(out).toContain("fiveet://entity/deity/SCAG/abbathor");
  });

  it("uses displayName when available", () => {
    const out = renderEntries({
      type: "statblock",
      prop: "subclass",
      name: "Wild Magic",
      displayName: "Wild Magic Sorcerer",
      source: "XPHB",
    });
    expect(out).toContain("[Wild Magic Sorcerer]");
    expect(out).toContain("fiveet://entity/subclass/XPHB/wild-magic");
  });

  it("falls back to bold for unknown tags", () => {
    const out = renderEntries({
      type: "statblock",
      tag: "unknowntype",
      name: "Thing",
    });
    expect(out).toBe("**Thing**");
  });
});

// ── renderTextWithTags — malformed input ──────────────────────────

describe("renderTextWithTags — malformed input", () => {
  it("handles empty string", () => {
    expect(renderTextWithTags("")).toBe("");
  });

  it("returns plain text when no tags present", () => {
    expect(renderTextWithTags("Just regular text.")).toBe("Just regular text.");
  });

  it("strips tag with no name content {@unknowntag}", () => {
    // {@spell} with no name — the regex won't match, so it passes through
    const out = renderTextWithTags("Check {@spell}");
    expect(out).toBe("Check {@spell}");
  });

  it("handles completely empty tag {@}", () => {
    const out = renderTextWithTags("Ref: {@}");
    expect(out).toBe("Ref: {@}");
  });

  it("handles tag with only whitespace content", () => {
    const out = renderTextWithTags("{@b  }");
    expect(out).toBe("** **");
  });

  it("handles multiple tags in succession without separating text", () => {
    const out = renderTextWithTags("{@b one}{@i two}{@strike three}");
    expect(out).toBe("**one***two*~~three~~");
  });

  it("handles extremely long entity name", () => {
    const longName = "A".repeat(500);
    const out = renderTextWithTags(`{@spell ${longName}|PHB}`);
    expect(out).toContain(`[${longName}]`);
  });

  it("handles nested curly braces in text (not tags)", () => {
    const out = renderTextWithTags("Use {something} here");
    expect(out).toBe("Use {something} here");
  });
});

// ── renderEntries — malformed/edge-case input ─────────────────────

describe("renderEntries — malformed input", () => {
  it("returns empty string for null", () => {
    expect(renderEntries(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(renderEntries(undefined)).toBe("");
  });

  it("returns empty string for 0", () => {
    expect(renderEntries(0)).toBe("");
  });

  it("returns empty string for false", () => {
    expect(renderEntries(false)).toBe("");
  });

  it("coerces number to empty string", () => {
    // numbers aren't strings, renderEntries checks typeof === "string"
    expect(renderEntries(42)).toBe("");
  });

  it("handles array with null/undefined elements", () => {
    const out = renderEntries([null, "valid text", undefined]);
    expect(out).toContain("valid text");
  });

  it("handles empty array", () => {
    expect(renderEntries([])).toBe("");
  });

  it("handles deeply nested entries (10 levels)", () => {
    let nested: any = "leaf text";
    for (let i = 0; i < 10; i++) {
      nested = { type: "entries", name: `Level ${i}`, entries: [nested] };
    }
    const out = renderEntries(nested);
    expect(out).toContain("leaf text");
    expect(out).toContain("Level 0");
    expect(out).toContain("Level 9");
  });

  it("handles table with no colLabels", () => {
    const out = renderEntries({
      type: "table",
      rows: [["1", "Something"]],
    });
    expect(out).toContain("| 1 | Something |");
    // Should not have a header separator row
    expect(out).not.toContain("| --- |");
  });

  it("handles table with empty rows", () => {
    const out = renderEntries({
      type: "table",
      colLabels: ["d6", "Effect"],
      rows: [],
    });
    expect(out).toContain("| d6 | Effect |");
  });

  it("handles list with no items property", () => {
    const out = renderEntries({ type: "list" });
    expect(out).toBe("");
  });

  it("handles list with empty items array", () => {
    const out = renderEntries({ type: "list", items: [] });
    expect(out).toBe("");
  });

  it("handles quote with no entries", () => {
    const out = renderEntries({ type: "quote" });
    expect(out).toContain(">");
  });

  it("handles image with no title or href", () => {
    const out = renderEntries({ type: "image" });
    expect(out).toBe("*[Image]*");
  });

  it("handles abilityDc with no attributes", () => {
    const out = renderEntries({ type: "abilityDc" });
    expect(out).toContain("save DC");
  });

  it("handles statblockInline with no data", () => {
    const out = renderEntries({ type: "statblockInline" });
    expect(out).toBe("");
  });

  it("handles statblock with no name", () => {
    const out = renderEntries({ type: "statblock" });
    expect(out).toBe("**Unknown**");
  });

  it("handles section type like entries", () => {
    const out = renderEntries({
      type: "section",
      name: "Chapter 1",
      entries: ["Some chapter content."],
    });
    expect(out).toContain("**Chapter 1.**");
    expect(out).toContain("Some chapter content.");
  });

  it("handles insetReadaloud type", () => {
    const out = renderEntries({
      type: "insetReadaloud",
      entries: ["Read this aloud to the players."],
    });
    expect(out).toContain("Read this aloud to the players.");
  });

  it("handles table cell objects with type 'cell'", () => {
    const out = renderEntries({
      type: "table",
      colLabels: ["A", "B"],
      rows: [[{ type: "cell", entry: "cell content" }, "plain"]],
    });
    expect(out).toContain("cell content");
    expect(out).toContain("plain");
  });
});

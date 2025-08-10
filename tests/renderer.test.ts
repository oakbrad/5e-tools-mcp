import { describe, it, expect } from "vitest";
import { renderTextWithTags, renderEntries } from "../src/renderer.js";

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
    const out = renderTextWithTags("Roll {@dice 2d6+3} for {@damage 2d6 fire}, save {@dc 15}, attack {@hit +7}.");
    expect(out).toContain("`2d6+3`");
    expect(out).toContain("**2d6 fire**");
    expect(out).toContain("DC 15");
    expect(out).toContain("+7 to hit");
  });
});

describe("renderEntries", () => {
  it("renders simple string via tag renderer", () => {
    const out = renderEntries("{@spell Fireball|PHB}");
    expect(out).toBe("[Fireball](fiveet://entity/spell/PHB/fireball)");
  });

  it("renders list items as bullets", () => {
    const out = renderEntries({ type: "list", items: [
      "{@condition Grappled}",
      "{@dice 1d4}",
    ]});
    expect(out).toContain("- **Grappled**");
    expect(out).toContain("- `1d4`");
  });

  it("renders named block with entries", () => {
    const out = renderEntries({ name: "Feature", entries: ["{@hit +5}"] });
    expect(out).toBe("**Feature.** +5 to hit");
  });
});



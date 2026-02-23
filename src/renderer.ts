import { toSlug } from "./utils.js";
import { TAG_TO_KIND, TAG_DEFAULT_SOURCE } from "./helpers.js";

/** Attack type abbreviation → readable label */
const atkLabels: Record<string, string> = {
  mw: "Melee Weapon Attack:",
  rw: "Ranged Weapon Attack:",
  ms: "Melee Spell Attack:",
  rs: "Ranged Spell Attack:",
  m: "Melee Attack:",
  r: "Ranged Attack:",
};

/**
 * Apply inline 5eTools tag transforms to a string, producing Markdown.
 * Tags are processed in priority order so earlier replacements don't
 * interfere with later ones (each replacement removes the {@...} wrapper).
 */
export function renderTextWithTags(input: string, linkify = true): string {
  return (
    input

      // ── Formatting tags ──────────────────────────────────────────────
      .replace(/\{@(?:b|bold) ([^}]+)\}/g, "**$1**")
      .replace(/\{@(?:i|italic) ([^}]+)\}/g, "*$1*")
      .replace(/\{@strike ([^}]+)\}/g, "~~$1~~")
      .replace(/\{@note ([^}]+)\}/g, "*$1*")
      .replace(/\{@h\}/g, "")

      // ── Game mechanic tags ───────────────────────────────────────────
      .replace(/\{@dice ([^}]+)\}/g, "`$1`")
      .replace(/\{@(?:scaledice|scaledamage) ([^|}]+)(?:\|[^}]*)?\}/g, "`$1`")
      .replace(/\{@damage ([^}]+)\}/g, "**$1**")
      .replace(/\{@dc (\d+)\}/g, "DC $1")
      .replace(/\{@hit ([+-]?\d+)\}/g, (_, n: string) => {
        const sign = n.startsWith("-") || n.startsWith("+") ? "" : "+";
        return `${sign}${n} to hit`;
      })
      .replace(/\{@recharge(?:\s+(\d))?\}/g, (_, n?: string) => {
        if (n && n !== "6") return `(Recharge ${n}–6)`;
        return "(Recharge 6)";
      })
      .replace(/\{@(?:atk|atkr)\s+([^}]+)\}/g, (_, abbr: string) => {
        const parts = abbr.split(",").map((s) => atkLabels[s.trim()] ?? s.trim());
        return `*${parts.join(" or ")}*`;
      })
      .replace(/\{@chance (\d+)(?:\|([^}]+))?\}/g, (_, pct: string, text?: string) =>
        text ? `${text} (${pct}%)` : `${pct}%`,
      )

      // ── Bold reference tags (no link, just bold) ─────────────────────
      .replace(
        /\{@(?:condition|skill|sense|action|status|savingThrow) ([^}|]+)(?:\|[^}]*)?\}/gi,
        "**$1**",
      )

      // ── External links ───────────────────────────────────────────────
      .replace(/\{@link ([^}|]+)\|([^}]+)\}/g, "[$1]($2)")

      // ── Navigation / filter tags (strip to bold or plain text) ───────
      .replace(/\{@(?:area|quickref) ([^}|]+)(?:\|[^}]*)?\}/g, "**$1**")
      .replace(/\{@filter ([^}|]+)(?:\|[^}]*)?\}/g, "$1")

      // ── Entity link tags (unified map-based handler) ─────────────────
      // Handles all entity kinds via shared TAG_TO_KIND map. Runs after all
      // specific tags above, so only unprocessed tags reach here.
      .replace(
        /\{@(\w+) ([^}|]+)(?:\|([^}|]*))?(?:\|[^}]*)?\}/g,
        (_match, tag: string, name: string, src?: string) => {
          const tagLower = tag.toLowerCase();
          const kind = TAG_TO_KIND[tagLower];
          if (kind) {
            if (!linkify) return name;
            const source = src?.trim() || TAG_DEFAULT_SOURCE[tagLower] || "PHB";
            return `[${name}](fiveet://entity/${kind}/${source}/${toSlug(name)})`;
          }
          // Unknown tag — strip to just the text content
          return name;
        },
      )

      // ── Catch-all: strip any remaining unhandled {@tag text} ─────────
      .replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1")
  );
}

/**
 * Render 5eTools entries recursively to Markdown.
 * Handles nested entry objects, lists, tables, quotes, and inset blocks.
 */
export function renderEntries(entries: any): string {
  if (!entries) return "";
  if (typeof entries === "string") return renderTextWithTags(entries);
  if (Array.isArray(entries)) return entries.map(renderEntries).join("\n\n");

  switch (entries.type) {
    // Container types — unwrap and recurse into child entries
    case "entries":
    case "section":
    case "inset":
    case "insetReadaloud":
    case "variant":
    case "variantInner":
    case "variantSub":
    case "options":
    case "patron": {
      const heading = entries.name ? `**${entries.name}.** ` : "";
      return heading + renderEntries(entries.entries);
    }

    case "list":
      return (entries.items ?? []).map((it: any) => `- ${renderEntries(it)}`).join("\n");

    case "table": {
      const lines: string[] = [];
      if (entries.caption) lines.push(`**${entries.caption}**\n`);
      if (entries.colLabels?.length) {
        lines.push(
          `| ${entries.colLabels.map((l: any) => renderTextWithTags(String(l))).join(" | ")} |`,
        );
        lines.push(`| ${entries.colLabels.map(() => "---").join(" | ")} |`);
      }
      for (const row of entries.rows ?? []) {
        // Rows can be arrays or objects with a .row array
        const cells: any[] = Array.isArray(row) ? row : (row?.row ?? []);
        const rendered = cells.map((c: any) => {
          if (typeof c === "string") return renderTextWithTags(c);
          if (typeof c === "object" && c?.type === "cell")
            return renderEntries(c.entry ?? c.entries ?? "");
          return renderEntries(c);
        });
        lines.push(`| ${rendered.join(" | ")} |`);
      }
      return lines.join("\n");
    }

    case "quote": {
      const body = renderEntries(entries.entries);
      const by = entries.by ? `\n> — *${entries.by}*` : "";
      return `> ${body.split("\n").join("\n> ")}${by}`;
    }

    // Inline content — entries flow together without paragraph breaks
    case "inline":
      return (entries.entries ?? []).map((e: any) => renderEntries(e)).join("");

    // Horizontal rule
    case "hr":
      return "---";

    // Image — render title/credit as text (images can't be displayed in text)
    case "image": {
      const parts: string[] = [];
      if (entries.title) parts.push(`*[Image: ${entries.title}]*`);
      else parts.push("*[Image]*");
      if (entries.credit) parts.push(`*Credit: ${entries.credit}*`);
      return parts.join(" ");
    }

    // Ability DC block — "**Spell save DC** = 8 + proficiency bonus + INT modifier"
    case "abilityDc": {
      const attrs = (entries.attributes ?? []).map((a: string) => a.toUpperCase()).join(" or ");
      const label = entries.name ?? "Ability";
      return `**${label} save DC** = 8 + your proficiency bonus + your ${attrs} modifier`;
    }

    // Generic ability block — flexible formula display
    case "abilityGeneric": {
      const parts: string[] = [];
      if (entries.name) parts.push(`**${entries.name}**`);
      if (entries.text) parts.push(` = ${renderTextWithTags(entries.text)}`);
      return parts.join("");
    }

    // Inline stat block — full entity data embedded in the document
    case "statblockInline": {
      const data = entries.data;
      if (!data) return "";
      const dtype = entries.dataType ?? "creature";
      const name = data.name ?? "Unknown";
      // Render a heading + any entries the stat block contains
      const inner = data.entries ? `\n\n${renderEntries(data.entries)}` : "";
      return `**${name}** *(${dtype})*${inner}`;
    }

    // Stat block reference — link to an external entity
    case "statblock": {
      const name = entries.displayName ?? entries.name ?? "Unknown";
      const tag = entries.tag ?? entries.prop ?? "creature";
      const kind = TAG_TO_KIND[tag];
      if (kind && entries.name) {
        const source = entries.source ?? TAG_DEFAULT_SOURCE[tag] ?? "PHB";
        return `[${name}](fiveet://entity/${kind}/${source}/${toSlug(entries.name)})`;
      }
      return `**${name}**`;
    }

    default:
      break;
  }

  // Named block with entries (common pattern without explicit type)
  if (entries.name && entries.entries) {
    return `**${entries.name}.** ${renderEntries(entries.entries)}`;
  }

  // Fallback: try to extract text from any remaining object shape
  if (entries.text) return renderTextWithTags(String(entries.text));
  if (entries.entry) return renderEntries(entries.entry);

  return "";
}

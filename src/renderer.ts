import { toSlug } from "./utils.js";

/**
 * Apply inline 5eTools tag transforms to a string, producing deterministic Markdown.
 * Link URIs must be fiveet://entity/{kind}/{source}/{slug}.
 */
export function renderTextWithTags(input: string, linkify = true): string {
  return input
    // {@spell name|SRC}
    .replace(/\{@spell ([^}|]+)(?:\|([^}]+))?\}/g, (_: string, name: string, src?: string) =>
      linkify ? `[${name}](fiveet://entity/spell/${(src ?? "PHB")}/${toSlug(name)})` : name)
    // {@item name|SRC}
    .replace(/\{@item ([^}|]+)(?:\|([^}]+))?\}/g, (_: string, name: string, src?: string) =>
      linkify ? `[${name}](fiveet://entity/item/${(src ?? "DMG")}/${toSlug(name)})` : name)
    // {@creature name|SRC} → link to monster
    .replace(/\{@creature ([^}|]+)(?:\|([^}]+))?\}/g, (_: string, name: string, src?: string) =>
      linkify ? `[${name}](fiveet://entity/monster/${(src ?? "MM")}/${toSlug(name)})` : name)
    // {@condition name}
    .replace(/\{@condition ([^}]+)\}/g, (_: string, c: string) => `**${c}**`)
    // {@dice 2d6+3}
    .replace(/\{@dice ([^}]+)\}/g, (_: string, d: string) => `\`${d}\``)
    // {@damage 2d6 fire}
    .replace(/\{@damage ([^}]+)\}/g, (_: string, d: string) => `**${d}**`)
    // {@dc 15}
    .replace(/\{@dc (\d+)\}/g, (_: string, n: string) => `DC ${n}`)
    // {@hit +7}
    .replace(/\{@hit ([+-]?\d+)\}/g, (_: string, n: string) => {
      const sign = n.startsWith("-") || n.startsWith("+") ? "" : "+";
      return `${sign}${n} to hit`;
    })
    // {@recharge 5} or {@recharge} → (Recharge 5–6) or (Recharge 6)
    .replace(/\{@recharge(?:\s+(\d))?\}/g, (_: string, n?: string) => {
      if (n && n !== "6") return `(Recharge ${n}–6)`;
      return `(Recharge 6)`;
    });
}

/**
 * Render 5eTools entries recursively to Markdown.
 */
export function renderEntries(entries: any): string {
  if (!entries) return "";
  if (typeof entries === "string") return renderTextWithTags(entries);
  if (Array.isArray(entries)) return entries.map(renderEntries).join("\n\n");
  if (entries.type === "entries" || entries.type === "section") return renderEntries(entries.entries);
  if (entries.type === "list") return (entries.items ?? []).map((it: any) => `- ${renderEntries(it)}`).join("\n");
  if (entries.name && entries.entries) return `**${entries.name}.** ${renderEntries(entries.entries)}`;
  return "";
}



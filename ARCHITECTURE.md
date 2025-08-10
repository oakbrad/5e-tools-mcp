# Architecture

## Data layout
- Upstream repository: `./5etools-src` (not included).
- We scan `./5etools-src/data/**.json`, extracting arrays like `monster`, `spell`, `item`, etc.
- Each entity is keyed to a stable URI: `fiveet://entity/{kind}/{source}/{slug}`.

## Indexing
- On startup, we stream JSON files per domain and build lightweight indices:
  - `byKind`: list of `{ uri, name, slug, source, ruleset, facets }`
  - `byUri`: full entity JSON (plus `_uri`, `_source`, `_ruleset` for convenience)

## Ruleset heuristic
- Source abbreviations starting with `x` (e.g., `xPHB`, `xDMG`, `xMM`) are treated as **2024**; others default to **2014**.
- This is a heuristic that can be refined with a source map later.

## MCP surfaces
- **Tools**
  - `search_entities` — name/alias match with optional kind/source/ruleset filters.
  - `get_entity` — fetch by URI or composite key; return JSON or rendered Markdown/HTML.
  - `render_entries` — convert 5eTools entries + inline `{@tags}` into Markdown/HTML.
- **Resources**
  - `fiveet://entity/{kind}/{source}/{slug}` — returns canonical JSON for that entity.

## Rendering strategy
- Walk the entries structure:
  - strings → apply inline tag transforms
  - `entries/section` → render nested content
  - `list.items[]` → bullets
  - named blocks → `**Name.** content`
- Inline tags handled initially: `{@spell}`, `{@item}`, `{@condition}`, `{@dice}`, `{@damage}`, `{@dc}`, `{@hit}`.

## Extensibility
- Add additional tools: `list_sources`, `get_rules_section`, `resolve_tag`.
- Add `/schema/{kind}` resources if schema snapshots are needed by clients.
- Swap the search with a proper index when performance matters.

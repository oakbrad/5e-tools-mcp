# mcp-5etools — MCP Server for 5eTools Data

Senior Platform Engineer goal: **Expose 5eTools-style data to LLMs via Model Context Protocol (MCP)** so the model can
- **search** rules/entities,
- **fetch** structured records (monster/spell/item/etc.),
- **render** 5eTools `entries` + `{@tags}` into Markdown/HTML,
- **cite** stable URIs (so the model can reference content consistently).

> **Important layout assumption:** This repository contains a checked-out copy of **`5etools-src/`** at the project root:
>
> ```text
> / (project root)
> ├─ 5etools-src/        # the upstream 5eTools data repo (not included in this package)
> ├─ src/                # MCP server implementation
> ├─ README.md           # you are here
> ├─ .cursorrules        # Cursor AI project guidance
> └─ ...
> ```
>
> The server **reads data from `./5etools-src` by default**. Do not modify upstream content; treat it as read-only data.

---

## Why this server exists

LLMs don’t need whole books — they need **fast, reliable primitives**:
1. *Search* by name/aliases with minimal facets (e.g., CR/type for monsters; level/school for spells).
2. *Get entity* in structured JSON or rendered Markdown/HTML.
3. *Render entries* with `{@tags}` (e.g., `{@spell fireball}`) into linkable text.
4. *List sources* and *resolve rules sections* across 2014 vs 2024 rulesets.
5. *Stable URIs* to cite/compare entities.

This MCP server provides those primitives so downstream LLM agents stop guessing and start calling tools.

---


> **Cursor Rules:** This repo uses **Project Rules** in `.cursor/rules/*.mdc` (MDC format). Legacy `.cursorrules` is removed. See: `.cursor/rules/`.

## Quickstart

```bash
# 1) Ensure Node 18+
node -v

# 2) Place/clone the upstream 5eTools repository at project root:
git clone https://github.com/5etools-mirror-3/5etools-src ./5etools-src
# (Optionally pin to a specific tag for deterministic behavior.)

# 3) Install & build
npm install
npm run build

# 4) Run (stdio transport)
npm start
# or: node dist/server.js
```

If you prefer an explicit path, set `FIVETOOLS_SRC_DIR`:
```bash
FIVETOOLS_SRC_DIR=./5etools-src npm start
```

---

## MCP Surfaces (Tools & Resources)

**Tools**
- `search_entities({ query, kinds?, sources?, ruleset?, limit? })` — generic fuzzy search across all entity types
- `search_spells({ name?, level?, school?, classes?, source?, ruleset?, limit? })` — domain-specific spell search
- `search_monsters({ name?, cr_min?, cr_max?, type?, source?, ruleset?, limit? })` — domain-specific monster search
- `search_items({ name?, rarity?, type?, attunement?, source?, ruleset?, limit? })` — domain-specific item search
- `get_entity({ uri? | key:{kind,name,source?,ruleset?}, format?, includeFluff? })`
- `render_entries({ entries, format? })`
- `list_sources({ ruleset?, kind? })`
- `get_rules_section({ slugOrTitle, ruleset? })`
- `resolve_tag({ tag })`

**Resources**
- `fiveet://entity/{kind}/{source}/{slug}` → entity JSON

Minimal tag rendering supports common tags (`{@spell}`, `{@item}`, `{@condition}`, `{@dice}`, `{@damage}`, `{@dc}`, `{@hit}`) and can be extended.

### Domain-Specific Search Examples

**Search for 3rd-level evocation spells:**
```json
{
  "tool": "search_spells",
  "parameters": {
    "level": 3,
    "school": "E"
  }
}
```

**Search for wizards spells named "fireball":**
```json
{
  "tool": "search_spells",
  "parameters": {
    "name": "fireball",
    "classes": ["wizard"]
  }
}
```

**Search for CR 5-10 dragons:**
```json
{
  "tool": "search_monsters",
  "parameters": {
    "cr_min": 5,
    "cr_max": 10,
    "type": "dragon"
  }
}
```

**Search for legendary items that require attunement:**
```json
{
  "tool": "search_items",
  "parameters": {
    "rarity": "legendary",
    "attunement": true
  }
}
```

**Notes:**
- `school` uses abbreviated codes: A (abjuration), C (conjuration), D (divination), E (evocation), I (illusion), N (necromancy), T (transmutation), V (enchantment)
- `cr_min`/`cr_max` accept fractional values (e.g., 0.125 for CR 1/8, 0.25 for CR 1/4)
- All domain-specific tools support `ruleset` filtering ("2014", "2024", or "any")
- Use `search_entities` for cross-domain or exploratory searches

---

## Repository scripts

- `npm run build` — TypeScript → `dist/`
- `npm start` — launch MCP server on stdio

---

## Project constraints

- **Read-only**: Treat `5etools-src/` as immutable input.
- **Determinism**: For production, **pin a 5eTools tag/commit**.
- **Licensing**: This project ships *no* 5eTools content. Review upstream licensing before redistribution.

---

## Integration notes

- MCP clients (e.g., Claude Desktop, OpenWebUI MCP, custom hosts) can execute this binary and communicate over stdio.
- Prefer returning `resource_link`s to `fiveet://entity/...` when possible; clients can fetch entity JSON as needed.
- When disambiguation is required, prefer **2024** rules unless explicitly asked for 2014.

---

## Roadmap (next steps)

- Expand tag renderer to cover 20+ `{@...}` forms with unit tests.
- Add fuzzy search (Minisearch/Lunr) with facets and source/ruleset filters.
- Add `get_rules_section`, `resolve_tag`, and `list_sources` tools.
- Provide Dockerfile + GitHub Actions CI for lint/test/build.
- Optional: expose `/schema/{kind}` resources with JSON Schema snapshots.

---

## Dev Tips

- Use `npm run build` after changes; TypeScript config is strict.
- The loader builds in-memory indices at startup; for large-scale use, consider persistent indices on disk.
- Keep renderer pure/deterministic for reliable LLM outputs.

---

## License

This MCP server’s code is MIT-licensed (see `LICENSE`). Upstream 5eTools data is not included and is subject to its own licensing.


## Prompts
Reusable LLM prompt templates live in `./prompts/`:
- `00-agent-system.md` — system-level behavior (MCP-first)
- `10-search-lookup.md` — lookup flow
- `20-compare-entities.md` — comparison tables
- `30-render-entries.md` — render 5eTools entries blobs
- `40-rules-qa.md` — rules Q&A
- `50-resolve-tag.md` — inline tag resolver
- `60-adventure-parsing.md` — module parsing notes
- `70-house-rules-overlay.md` — official + house rules
- `80-eval-checklist.md` — preflight checklist

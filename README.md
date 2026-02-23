# mcp-5etools — MCP Server for D&D 5e Data

An MCP (Model Context Protocol) server that exposes D&D 5th Edition data from [5eTools](https://github.com/5etools-mirror-3/5etools-src) to LLMs and AI agents. Search, fetch, render, and cite game entities through structured tool calls.

**Features:**

- **19 tools** for search, entity lookup, encounter building, DM prep, and table rolling
- **24 entity kinds** (monsters, spells, items, feats, classes, and more)
- **9 reusable prompts** for common D&D assistant workflows
- **Homebrew support** with priority tie-breaking (homebrew surfaces first)
- **2014 & 2024 ruleset** awareness with configurable preference
- Fuzzy search with aliases, faceted filtering, and source/ruleset scoping
- **Docker ready** with HTTP transport and auto-bootstrap

> **Data requirement:** This server reads from a local `5etools-src/` directory. No copyrighted content is included in this package.

---

## Quickstart

```bash
# 1) Ensure Node 18+
node -v

# 2) Install, build, and run (data auto-bootstraps on first start)
npm install
npm run build
npm start
```

On first start, the server automatically clones the 5eTools data repo if `5etools-src/` doesn't exist. If git isn't installed, it downloads the tarball instead.

To use a custom data path:

```bash
FIVETOOLS_SRC_DIR=/path/to/data npm start
```

### Docker

```bash
# Build and run (TypeScript compiles inside the container)
docker build -t mcp-5etools .
docker run -p 3524:3524 -v 5etools-data:/data mcp-5etools

# Or with docker-compose
docker compose up
```

The Docker image runs in HTTP mode on port 3524. Data is stored in a named volume and only cloned once.

### Environment Variables

| Variable           | Default                                              | Description                                |
| ------------------ | ---------------------------------------------------- | ------------------------------------------ |
| `FIVETOOLS_SRC_DIR`| `./5etools-src`                                      | Path to the 5eTools data directory         |
| `MCP_HTTP_PORT`    | *(unset — stdio mode)*                               | Set to enable HTTP transport on this port  |
| `5E_MIRROR_REPO`   | `https://github.com/5etools-mirror-3/5etools-src`    | Git repo URL for auto-bootstrap            |
| `HOMEBREW_REPO`    | *(unset — empty homebrew dir)*                       | Git repo URL for homebrew auto-bootstrap   |

### Homebrew

Place homebrew JSON files in `5etools-src/homebrew/` with an `index.json`:

```json
{ "toImport": ["my-campaign.json"] }
```

Or set `HOMEBREW_REPO` to auto-clone a homebrew repo on first start:

```bash
HOMEBREW_REPO=https://git.example.com/user/my-homebrew.git npm start
```

Homebrew entities get automatic search priority — when an official and homebrew entity share the same name, homebrew surfaces first.

---

## Tools (19)

### Search Tools

| Tool              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `search_entities` | Generic fuzzy search across all entity types     |
| `search_spells`   | Search spells by name, level, school, class      |
| `search_monsters` | Search monsters by name, CR range, type          |
| `search_items`    | Search items by name, rarity, type, attunement   |
| `search_tables`   | Search rollable tables by name, category, source |

### Entity Tools

| Tool                | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `get_entity`        | Fetch entity by URI or key (kind + name), JSON or markdown    |
| `render_entries`    | Render 5eTools entry blobs into markdown                      |
| `list_sources`      | List all known source books, filterable by ruleset/kind       |
| `get_rules_section` | Look up variant rules by slug or title                        |
| `resolve_tag`       | Resolve a 5eTools inline tag (e.g., `{@spell Fireball\|PHB}`) |

### Encounter Tools

| Tool                         | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `calculate_party_thresholds` | Calculate XP thresholds for a party                    |
| `evaluate_encounter`         | Evaluate difficulty of an encounter composition        |
| `suggest_encounter`          | Generate encounter suggestions for a target difficulty |
| `scale_encounter`            | Scale an encounter for different party size/level      |
| `random_encounter`           | Generate a random encounter by environment and level   |

### DM Tools

| Tool                  | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `generate_treasure`   | Generate treasure by CR (individual) or tier (hoard) |
| `suggest_magic_items` | Suggest level-appropriate magic items for a party    |
| `roll_on_table`       | Roll on a specific rollable table                    |
| `roll_on_tables`      | Roll on multiple tables in sequence                  |

---

## Entity Kinds (24)

| Kind              | JSON Key          | Source                                   |
| ----------------- | ----------------- | ---------------------------------------- |
| `monster`         | `monster`         | bestiary/                                |
| `spell`           | `spell`           | spells/                                  |
| `item`            | `item`            | items.json                               |
| `feat`            | `feat`            | feats.json                               |
| `background`      | `background`      | backgrounds.json                         |
| `race`            | `race`            | races.json                               |
| `class`           | `class`           | class/                                   |
| `subclass`        | `subclass`        | class/                                   |
| `condition`       | `condition`       | conditionsdiseases.json                  |
| `rule`            | `variantrule`     | variantrules.json                        |
| `adventure`       | `adventure`       | adventures.json + adventure/             |
| `book`            | `book`            | books.json + book/                       |
| `table`           | `table`           | tables.json, encounters.json, names.json |
| `deity`           | `deity`           | deities.json                             |
| `vehicle`         | `vehicle`         | vehicles.json                            |
| `trap`            | `trap`            | trapshazards.json                        |
| `optionalfeature` | `optionalfeature` | optionalfeatures.json                    |
| `psionic`         | `psionic`         | psionics.json                            |
| `language`        | `language`        | languages.json                           |
| `object`          | `object`          | objects.json                             |
| `reward`          | `reward`          | rewards.json                             |
| `recipe`          | `recipe`          | recipes.json                             |
| `deck`            | `deck`            | decks.json                               |
| `facility`        | `facility`        | bastions.json                            |

---

## Prompts (9)

Reusable LLM prompt templates registered as MCP prompts:

| Prompt                | Description                                        |
| --------------------- | -------------------------------------------------- |
| `agent-system`        | System prompt for MCP-first D&D assistant behavior |
| `search-lookup`       | Workflow for searching and looking up entities     |
| `compare-entities`    | Side-by-side entity comparison tables              |
| `render-entries`      | Render 5eTools entries blobs to readable text      |
| `rules-qa`            | Rules question-answering workflow                  |
| `resolve-tag`         | Resolve inline `{@tag}` references                 |
| `adventure-parsing`   | Parse adventure/book sections                      |
| `house-rules-overlay` | Layer house rules over official content            |
| `eval-checklist`      | Self-evaluation checklist before responding        |

---

## Resources

Entity URIs follow the pattern:

```
fiveet://entity/{kind}/{source}/{slug}
```

Example: `fiveet://entity/spell/PHB/fireball`

MCP clients can fetch entity JSON via these stable URIs.

---

## Development

```bash
npm run build        # TypeScript → dist/
npm test             # Run all tests (vitest)
npm run lint         # ESLint check
npm run format:check # Prettier check
npm run lint:fix     # Auto-fix lint issues
npm run format       # Auto-format with prettier
```

### Search Examples

**3rd-level evocation spells:**

```json
{ "tool": "search_spells", "parameters": { "level": 3, "school": "E" } }
```

**CR 5-10 dragons:**

```json
{ "tool": "search_monsters", "parameters": { "cr_min": 5, "cr_max": 10, "type": "dragon" } }
```

**Legendary items requiring attunement:**

```json
{ "tool": "search_items", "parameters": { "rarity": "legendary", "attunement": true } }
```

**Notes:**

- `school` codes: A (abjuration), C (conjuration), D (divination), E (evocation), I (illusion), N (necromancy), T (transmutation), V (enchantment)
- `cr_min`/`cr_max` accept fractions: 0.125 (CR 1/8), 0.25 (CR 1/4), 0.5 (CR 1/2)
- All search tools support `ruleset` filtering (`"2014"`, `"2024"`, or `"any"`)

---

## Architecture

```
src/
├── server.ts           # MCP server setup, stdio + HTTP transport
├── bootstrap.ts        # Auto-bootstrap data/homebrew via git or tarball
├── loader.ts           # Data loading pipeline (official + homebrew)
├── search.ts           # Fuzzy search, scoring, domain-specific searches
├── helpers.ts          # Shared utilities (URI building, tag maps, entity lookup)
├── renderer.ts         # 5eTools entries/tags → markdown
├── encounter.ts        # XP thresholds, encounter evaluation
├── scale-encounter.ts  # Encounter scaling strategies
├── random-encounter.ts # Random encounter generation
├── magic-items.ts      # Magic item suggestion logic
├── treasure.ts         # Treasure generation (individual + hoard)
├── tables.ts           # Table normalization, dice rolling, search
├── types.ts            # Shared type definitions
├── utils.ts            # Utility functions
└── tools/
    ├── search-tools.ts    # 5 search tool handlers
    ├── entity-tools.ts    # 5 entity tool handlers
    ├── encounter-tools.ts # 5 encounter tool handlers
    ├── dm-tools.ts        # 4 DM tool handlers
    └── prompt-tools.ts    # Dynamic prompt registration
```

---

## Constraints

- **Read-only data**: `5etools-src/` is treated as immutable input
- **Pin for production**: Use a specific 5eTools tag/commit for deterministic behavior
- **Licensing**: No 5eTools content is shipped. Review upstream licensing before redistribution

---

## License

This MCP server's code is MIT-licensed (see `LICENSE`). Upstream 5eTools data is subject to its own licensing.

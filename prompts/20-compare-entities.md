# Prompt — Compare Entities

**Goal:** Compare multiple entities (e.g., spells, monsters, items) side-by-side.

**Steps:**
1. For each name in **{{names_csv}}**, do:
   - `search_entities({ query: name, kinds: {{kinds_json}}, ruleset: "{{ruleset_or_2024}}", limit: 5 })`
   - Pick the best match by exact name + preferred source if available.
   - `get_entity({ uri, format: "json" })` to extract structured fields.
2. Build a table with key fields by kind:
   - Spells: level, school, casting time, range, components, duration, concentration, classes.
   - Monsters: CR, type, AC, HP, speeds, main actions, legendary/lair actions.
   - Items: rarity, type, attunement, properties.
3. Add citations (source + ruleset). Offer alternatives if close matches exist.

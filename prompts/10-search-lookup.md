# Prompt — Search & Lookup

**Goal:** Find an entity and present its canonical information.

**Steps:**
1. Call `search_entities` with:
   - `query: "{{query}}"`
   - `kinds: {{kinds_json}}`   <!-- e.g., ["spell"] -->
   - `ruleset: "{{ruleset_or_2024}}"`  <!-- "2024" by default -->
   - `limit: {{limit_or_10}}`
2. Choose the top relevant result (validate kind/source).
3. Call `get_entity` with the returned `uri` and `format:"markdown"`.
4. Return the rendered text with a short summary (level/CR, school/type, notable effects).

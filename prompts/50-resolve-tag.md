# Prompt — Resolve Inline Tag

**Input:** `{{tag}}` e.g., `{@spell fireball|PHB}`

**Steps:**
1. Call `resolve_tag({ tag })` to obtain a canonical URI.
2. Call `get_entity({ uri, format: "markdown" })` and return the result with source and ruleset.

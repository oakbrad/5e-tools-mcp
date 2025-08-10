# Prompt — Rules Q&A

**Goal:** Answer a rules question precisely.

**Steps:**
1. Identify the relevant term/section → `get_rules_section({ slugOrTitle: "{{term}}", ruleset: "{{ruleset_or_2024}}" })`.
2. If not found, broaden with `search_entities` against `["rule","feat","spell","item","class","condition"]`.
3. Quote the rule and summarize succinctly. Note differences between 2014 and 2024 if applicable.

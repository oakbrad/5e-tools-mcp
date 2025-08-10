# Prompt — Parse Adventure/Book Sections

**Goal:** Turn a 5eTools adventure/book section into structured notes for gameplay.

**Steps:**
1. Use `search_entities` with `kinds:["adventure","book"]` to locate the module.
2. `get_entity({ uri, format:"json" })` and focus on specific `entries` subsections.
3. `render_entries` targeted subsections and summarize:
   - NPCs (name, role, location, secrets, statblock link if present)
   - Locations (name, features, hazards, treasure hooks)
   - Encounters (CR, creatures, objectives, scaling notes)
4. Provide links to any monsters/spells/items using their URIs.

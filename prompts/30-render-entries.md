# Prompt — Render Entries Blob

**Input:** a 5eTools-style `entries` object (may be nested).

**Steps:**
1. Call `render_entries({ entries })` to produce Markdown.
2. If inline tags appear unresolved, call `resolve_tag` for each and supply helpful links.
3. Keep headings, bullet lists, and inline code blocks intact. Do not paraphrase rules text.

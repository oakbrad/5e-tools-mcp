# Contributing

## Setup
- Node.js 18+
- `5etools-src/` present at repo root (git submodule or local clone).

```bash
npm install
npm run build
npm start
```

## Guidelines
- Do not modify `5etools-src/` content.
- Keep rendering deterministic and covered by tests.
- Prefer returning `resource_link`s so MCP clients can fetch resources on demand.
- Update docs when changing tools/resources or rendering behavior.

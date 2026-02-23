// src/server.ts
// MCP server entry point — loads data, registers tools, connects transport.
// Supports two modes:
//   - Stdio (default): for local CLI integration
//   - HTTP (when MCP_HTTP_PORT is set): for networked/Docker deployment
// All tool definitions live in src/tools/; data loading lives in src/loader.ts.

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AppIndex, ToolContext } from "./types.js";
import type { RollableTable } from "./tables.js";
import { loadAll, loadHomebrew } from "./loader.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerEntityTools } from "./tools/entity-tools.js";
import { registerEncounterTools } from "./tools/encounter-tools.js";
import { registerDmTools } from "./tools/dm-tools.js";
import { registerPrompts } from "./tools/prompt-tools.js";
import { bootstrapData } from "./bootstrap.js";

const ROOT = process.env.FIVETOOLS_SRC_DIR ?? path.join(process.cwd(), "5etools-src");
const DATA = path.join(ROOT, "data");
const HOMEBREW = path.join(ROOT, "homebrew");
const PROMPTS = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "prompts");

// ── Shared setup ─────────────────────────────────────────────────────

/** Create and wire up an McpServer instance with all tools, prompts, and resources.
 *  The idx and tableStore are shared read-only across sessions. */
function buildServer(idx: AppIndex, tableStore: Map<string, RollableTable>): McpServer {
  const server = new McpServer({ name: "mcp-5etools", version: "0.2.0" });
  const ctx: ToolContext = { server, idx, tableStore };

  registerSearchTools(ctx);
  registerEntityTools(ctx);
  registerEncounterTools(ctx);
  registerDmTools(ctx);
  registerPrompts(server, PROMPTS);

  server.registerResource(
    "entity",
    new ResourceTemplate("fiveet://entity/{kind}/{source}/{slug}", { list: undefined }),
    { title: "5eTools Entity", description: "Single entity record", mimeType: "application/json" },
    async (uri, { kind, source, slug }) => {
      const key = `fiveet://entity/${kind}/${source}/${slug}`;
      const e = idx.byUri.get(key);
      if (!e) return { contents: [{ uri: uri.href, text: "Not found" }] };
      return { contents: [{ uri: uri.href, text: JSON.stringify(e, null, 2) }] };
    },
  );

  return server;
}

// ── HTTP transport ───────────────────────────────────────────────────

/** Read the full request body as a string */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

/** Start an HTTP server with Streamable HTTP transport on the given port */
function startHttpServer(
  idx: AppIndex,
  tableStore: Map<string, RollableTable>,
  port: number,
): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // Health check endpoint for Docker/load balancers
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // POST — JSON-RPC messages (initialize or subsequent)
      if (req.method === "POST") {
        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body);
          const sessionId = req.headers["mcp-session-id"] as string | undefined;

          if (sessionId && transports.has(sessionId)) {
            // Existing session — reuse transport
            const transport = transports.get(sessionId)!;
            await transport.handleRequest(req, res, parsed);
          } else if (!sessionId && isInitializeRequest(parsed)) {
            // New session — create transport + server
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid) => {
                transports.set(sid, transport);
                console.error(`[5etools] HTTP session initialized: ${sid}`);
              },
              onsessionclosed: (sid) => {
                transports.delete(sid);
                console.error(`[5etools] HTTP session closed: ${sid}`);
              },
            });

            const server = buildServer(idx, tableStore);
            await server.connect(transport);
            await transport.handleRequest(req, res, parsed);
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session" },
                id: null,
              }),
            );
          }
        } catch (err) {
          console.error(`[5etools] HTTP error:`, err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
              }),
            );
          }
        }
        return;
      }

      // GET — SSE stream for an existing session
      if (req.method === "GET") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (!sessionId || !transports.has(sessionId)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid or missing session ID");
          return;
        }
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // DELETE — terminate session
      if (req.method === "DELETE") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (!sessionId || !transports.has(sessionId)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid or missing session ID");
          return;
        }
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
        return;
      }
    }

    // Fallback — 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.error(`[5etools] Shutting down HTTP server...`);
    for (const [sid, transport] of transports) {
      try {
        await transport.close();
      } catch (err) {
        console.error(`[5etools] Error closing session ${sid}:`, err);
      }
    }
    transports.clear();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(port, () => {
    console.error(`[5etools] HTTP server listening on port ${port}`);
    console.error(`[5etools] Health: http://localhost:${port}/health`);
    console.error(`[5etools] MCP:    http://localhost:${port}/mcp`);
  });
}

// ── Entry point ──────────────────────────────────────────────────────

async function main() {
  // Auto-bootstrap data directories if needed
  await bootstrapData(ROOT);

  // Build the in-memory data index
  const idx: AppIndex = {
    byKind: new Map(),
    byUri: new Map(),
    sourcesMeta: new Map(),
    fluffByKey: new Map(),
  };
  const tableStore = new Map<string, RollableTable>();

  await loadAll(idx, tableStore, DATA);
  await loadHomebrew(idx, tableStore, HOMEBREW);

  // Choose transport based on environment
  const httpPort = process.env.MCP_HTTP_PORT;
  if (httpPort) {
    startHttpServer(idx, tableStore, parseInt(httpPort, 10));
  } else {
    const server = buildServer(idx, tableStore);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

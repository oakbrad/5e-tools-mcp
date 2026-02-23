import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http from "node:http";

// These tests require the HTTP server to be running.
// We import the server module dynamically after setting env vars.

const TEST_PORT = 9876; // Use a non-standard port to avoid conflicts

/** Make an HTTP request and return the response */
function httpRequest(options: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: TEST_PORT,
        path: options.path,
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          });
        });
      },
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Only run these tests when 5etools data is available (CI or dev with data)
const dataDir = process.env.FIVETOOLS_SRC_DIR ?? "./5etools-src";
import fs from "node:fs";
const hasData = fs.existsSync(dataDir + "/data");

describe.skipIf(!hasData)("HTTP server integration", () => {
  let serverProcess: ReturnType<typeof import("node:child_process").fork> | null = null;

  beforeAll(async () => {
    // Start the server as a child process with HTTP mode
    const { fork } = await import("node:child_process");
    serverProcess = fork("dist/server.js", [], {
      env: {
        ...process.env,
        MCP_HTTP_PORT: String(TEST_PORT),
        FIVETOOLS_SRC_DIR: dataDir,
      },
      stdio: "pipe",
    });

    // Wait for server to be ready by polling /health
    const maxWait = 60_000; // 60s — data loading can be slow
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        const res = await httpRequest({ method: "GET", path: "/health" });
        if (res.status === 200) break;
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }, 120_000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
  });

  it("GET /health returns 200", async () => {
    const res = await httpRequest({ method: "GET", path: "/health" });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
  });

  it("GET /nonexistent returns 404", async () => {
    const res = await httpRequest({ method: "GET", path: "/nonexistent" });
    expect(res.status).toBe(404);
  });

  it("POST /mcp with initialize request returns valid JSON-RPC response", async () => {
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };

    const res = await httpRequest({
      method: "POST",
      path: "/mcp",
      body: JSON.stringify(initRequest),
    });

    // The response might be SSE or JSON — check we got a successful status
    expect(res.status).toBe(200);

    // Should include a session ID header
    const sessionId = res.headers["mcp-session-id"];
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
  });

  it("POST /mcp without session ID and non-init request returns 400", async () => {
    const badRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    };

    const res = await httpRequest({
      method: "POST",
      path: "/mcp",
      body: JSON.stringify(badRequest),
    });

    expect(res.status).toBe(400);
  });
});

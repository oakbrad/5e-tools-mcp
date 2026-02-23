// src/types.ts
// Shared type definitions for the MCP server infrastructure.
// AppIndex extends the search index with source metadata;
// ToolContext bundles everything a tool registration module needs.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Kind, Ruleset, SearchIndex } from "./search.js";
import type { RollableTable } from "./tables.js";

/** Typed alias for MCP tool handler responses — replaces `as any` casts */
export type ToolResponse = CallToolResult;

/** Runtime search index with source metadata and fluff data added during loading */
export type AppIndex = SearchIndex & {
  sourcesMeta: Map<
    string,
    {
      abbreviation: string;
      full?: string;
      ruleset: Ruleset;
      kinds: Set<Kind>;
    }
  >;
  /** Flavor text indexed by "kind/source/slug" */
  fluffByKey: Map<string, any>;
};

/** Passed to each registerXxxTools() function — explicit dependency injection */
export type ToolContext = {
  server: McpServer;
  idx: AppIndex;
  tableStore: Map<string, RollableTable>;
};

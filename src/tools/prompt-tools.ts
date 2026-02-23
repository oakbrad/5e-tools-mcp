// src/tools/prompt-tools.ts
// Reads markdown files from the prompts/ directory and registers them as MCP prompts.
// Template variables like {{query}} become prompt arguments that get substituted in.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register all prompt files from a directory as MCP prompts.
 * Files are sorted by name so numbering (00-, 10-, etc.) controls order.
 * Template variables like {{query}} are extracted as optional string arguments.
 */
export function registerPrompts(server: McpServer, promptsDir: string): void {
  let files: string[];
  try {
    files = fs
      .readdirSync(promptsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    // No prompts directory — not fatal, just skip
    return;
  }

  for (const file of files) {
    const content = fs.readFileSync(path.join(promptsDir, file), "utf-8");

    // Derive prompt name from filename: "10-search-lookup.md" → "search-lookup"
    const name = file.replace(/^\d+-/, "").replace(/\.md$/, "");

    // Extract first heading as description
    const titleMatch = content.match(/^#\s+(.+)/m);
    const description = titleMatch?.[1] ?? name;

    // Find all {{variable}} template placeholders
    const varMatches = [...content.matchAll(/\{\{(\w+)\}\}/g)];
    const varNames = [...new Set(varMatches.map((m) => m[1]))];

    if (varNames.length > 0) {
      // Build args schema from detected template variables
      const shape: Record<string, z.ZodOptional<z.ZodString>> = {};
      for (const v of varNames) {
        shape[v] = z.string().optional();
      }

      server.registerPrompt(
        name,
        { title: description, description, argsSchema: z.object(shape) as any },
        (args: Record<string, string | undefined>) => {
          let text = content;
          for (const v of varNames) {
            const val = (args as Record<string, string | undefined>)[v];
            if (val !== undefined) {
              text = text.replaceAll(`{{${v}}}`, val);
            }
          }
          return {
            messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
          };
        },
      );
    } else {
      // No template variables — static prompt
      server.registerPrompt(name, { title: description, description }, () => ({
        messages: [{ role: "user" as const, content: { type: "text" as const, text: content } }],
      }));
    }
  }
}

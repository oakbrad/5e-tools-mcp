import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { bootstrapData, hasGit, resetGitCache } from "../src/bootstrap.js";

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a temporary directory for test isolation */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-test-"));
}

/** Clean up a temporary directory */
function cleanTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("hasGit", () => {
  afterEach(() => resetGitCache());

  it("returns a boolean", () => {
    const result = hasGit();
    expect(typeof result).toBe("boolean");
  });

  it("caches the result on second call", () => {
    const first = hasGit();
    const second = hasGit();
    expect(first).toBe(second);
  });
});

describe("bootstrapData — homebrew directory creation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Suppress console.error during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanTmpDir(tmpDir);
    vi.restoreAllMocks();
    // Clean env vars
    delete process.env["FIVETOOLS_MIRROR_REPO"];
    delete process.env["HOMEBREW_REPO"];
  });

  it("creates empty homebrew dir with index.json when dataDir exists but has no homebrew", async () => {
    // Create a dataDir that already has data (so bootstrap doesn't try to clone)
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(path.join(dataDir, "data"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "data", "test.json"), "{}");

    await bootstrapData(dataDir);

    const homebrewDir = path.join(dataDir, "homebrew");
    expect(fs.existsSync(homebrewDir)).toBe(true);

    const indexPath = path.join(homebrewDir, "index.json");
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    expect(content).toEqual({ toImport: [] });
  });

  it("does not overwrite existing homebrew directory", async () => {
    // Create dataDir with existing homebrew
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(path.join(dataDir, "data"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "data", "test.json"), "{}");
    const homebrewDir = path.join(dataDir, "homebrew");
    fs.mkdirSync(homebrewDir, { recursive: true });
    fs.writeFileSync(path.join(homebrewDir, "index.json"), '{"toImport": ["my-custom.json"]}');

    await bootstrapData(dataDir);

    // Verify the custom content was preserved
    const content = JSON.parse(fs.readFileSync(path.join(homebrewDir, "index.json"), "utf8"));
    expect(content.toImport).toContain("my-custom.json");
  });

  it("skips data bootstrap when dataDir already has files", async () => {
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "existing.json"), "{}");

    // Should not attempt to clone — just create homebrew dir
    await bootstrapData(dataDir);

    // Only homebrew dir should have been created
    expect(fs.existsSync(path.join(dataDir, "homebrew"))).toBe(true);
    // Original file still there
    expect(fs.existsSync(path.join(dataDir, "existing.json"))).toBe(true);
  });

  it("attempts to bootstrap when dataDir is missing", async () => {
    const dataDir = path.join(tmpDir, "nonexistent");

    // Point to a URL that will definitely fail fast
    process.env["FIVETOOLS_MIRROR_REPO"] = "https://localhost:1/nonexistent-repo.git";

    await expect(bootstrapData(dataDir)).rejects.toThrow();
  });

  it("attempts to bootstrap when dataDir is empty", async () => {
    const dataDir = path.join(tmpDir, "empty");
    fs.mkdirSync(dataDir);

    // Point to a URL that will definitely fail fast
    process.env["FIVETOOLS_MIRROR_REPO"] = "https://localhost:1/nonexistent-repo.git";

    await expect(bootstrapData(dataDir)).rejects.toThrow();
  });
});

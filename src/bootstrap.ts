// src/bootstrap.ts
// Auto-bootstrap 5etools data and homebrew directories on first run.
// Tries git clone first; falls back to downloading a tarball if git isn't installed.
// Controlled by env vars: FIVETOOLS_SRC_DIR, FIVETOOLS_MIRROR_REPO, HOMEBREW_REPO.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const DEFAULT_MIRROR = "https://github.com/5etools-mirror-3/5etools-src";

/** Check whether git is available on this system (cached after first call) */
let _hasGit: boolean | null = null;
export function hasGit(): boolean {
  if (_hasGit === null) {
    try {
      execSync("git --version", { stdio: "ignore" });
      _hasGit = true;
    } catch {
      _hasGit = false;
    }
  }
  return _hasGit;
}

/** Reset the cached git check (for testing) */
export function resetGitCache(): void {
  _hasGit = null;
}

/** Check if a directory exists and contains at least one entry */
function dirExistsAndNonEmpty(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Clone a git repo or download its tarball into targetDir.
 * Prefers git clone --depth 1; falls back to tarball download via fetch + tar.
 */
export async function cloneOrDownload(repoUrl: string, targetDir: string): Promise<void> {
  if (hasGit()) {
    console.error(`[5etools] Cloning ${repoUrl} → ${targetDir} ...`);
    execSync(`git clone --depth 1 --progress ${repoUrl} ${targetDir}`, {
      stdio: ["ignore", "inherit", "inherit"],
    });
    return;
  }

  // Fallback: download tarball
  // GitHub/Forgejo repos serve tarballs at /archive/refs/heads/<branch>.tar.gz
  const tarballUrl = `${repoUrl.replace(/\.git$/, "")}/archive/refs/heads/master.tar.gz`;
  console.error(`[5etools] git not found — downloading tarball from ${tarballUrl} ...`);

  const resp = await fetch(tarballUrl);
  if (!resp.ok || !resp.body) {
    throw new Error(
      `Failed to download tarball from ${tarballUrl}: ${resp.status} ${resp.statusText}`,
    );
  }

  // Save to a temp file, then extract
  const tmpFile = path.join(path.dirname(targetDir), `.5etools-download-${Date.now()}.tar.gz`);
  try {
    // Stream response body → gunzip isn't needed for the file itself,
    // we save the .tar.gz and let `tar` handle decompression
    const fileStream = createWriteStream(tmpFile);
    // Node fetch body is a ReadableStream (web), convert to node stream
    const nodeStream = readableStreamToNodeReadable(resp.body);
    await pipeline(nodeStream, fileStream);

    // Extract: --strip-components=1 removes the top-level directory GitHub wraps in
    fs.mkdirSync(targetDir, { recursive: true });
    execSync(`tar xzf ${tmpFile} -C ${targetDir} --strip-components=1`, {
      stdio: ["ignore", "inherit", "inherit"],
    });
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

/** Convert a web ReadableStream to a Node.js Readable stream */
function readableStreamToNodeReadable(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(value);
      }
    },
  });
}

/**
 * Bootstrap data and homebrew directories if they don't exist.
 * Called once at server startup before data loading.
 *
 * - If dataDir is missing/empty, clones from FIVETOOLS_MIRROR_REPO (or default mirror)
 * - If homebrew dir is missing and HOMEBREW_REPO is set, clones it
 * - If homebrew dir is missing and no HOMEBREW_REPO, creates empty dir with index.json
 */
export async function bootstrapData(dataDir: string): Promise<void> {
  // Bootstrap main data directory
  if (!dirExistsAndNonEmpty(dataDir)) {
    const repo = process.env["FIVETOOLS_MIRROR_REPO"] ?? DEFAULT_MIRROR;
    console.error(`[5etools] First run — downloading 5etools data (this may take a few minutes)...`);
    console.error(`[5etools] Source: ${repo}`);
    const start = Date.now();
    try {
      await cloneOrDownload(repo, dataDir);
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`[5etools] Data download complete (${secs}s)`);
    } catch (err) {
      console.error(
        `[5etools] Failed to bootstrap data: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.error(`[5etools] Please install git or manually download 5etools-src to ${dataDir}`);
      throw err;
    }
  } else {
    console.error(`[5etools] Using existing data at ${dataDir}`);
  }

  // Bootstrap homebrew directory
  // The mirror ships an empty homebrew/ with a blank index.json.
  // If HOMEBREW_REPO is set, always replace it with the user's repo.
  const homebrewDir = path.join(dataDir, "homebrew");
  const homebrewRepo = process.env["HOMEBREW_REPO"];

  if (homebrewRepo) {
    console.error(`[5etools] Downloading homebrew from ${homebrewRepo} ...`);
    fs.rmSync(homebrewDir, { recursive: true, force: true });
    try {
      await cloneOrDownload(homebrewRepo, homebrewDir);
      console.error(`[5etools] Homebrew ready`);
    } catch (err) {
      console.error(
        `[5etools] Failed to bootstrap homebrew: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Non-fatal — create empty homebrew dir as fallback
      fs.mkdirSync(homebrewDir, { recursive: true });
      fs.writeFileSync(path.join(homebrewDir, "index.json"), '{"toImport": []}');
      console.error(`[5etools] Created empty homebrew directory as fallback`);
    }
  } else if (!dirExistsAndNonEmpty(homebrewDir)) {
    fs.mkdirSync(homebrewDir, { recursive: true });
    fs.writeFileSync(path.join(homebrewDir, "index.json"), '{"toImport": []}');
  }
}

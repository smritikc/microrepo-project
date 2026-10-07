import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PackageInfo, CacheEntry } from "./types.js";

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".cache",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
]);

/**
 * Computes a SHA-256 hash of all source files in a package directory.
 */
export function getPackageSourceHash(packagePath: string): string {
  const hash = crypto.createHash("sha256");

  function hashDirectory(dir: string, relDir = ""): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir).sort();

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry)) continue;

      const fullPath = path.join(dir, entry);
      const relPath = path.join(relDir, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        hashDirectory(fullPath, relPath);
      } else if (stats.isFile()) {
        hash.update(relPath.replace(/\\/g, "/"));
        const content = fs.readFileSync(fullPath);
        hash.update(content);
      }
    }
  }

  hashDirectory(packagePath);
  return hash.digest("hex");
}

/**
 * Computes composite task hash for a package including its upstream dependencies.
 */
export function getCompositeTaskHash(
  packageName: string,
  packages: Map<string, PackageInfo>,
  dependencyGraph: Map<string, string[]>,
  visiting = new Set<string>()
): string {
  if (visiting.has(packageName)) return "";
  visiting.add(packageName);

  const pkg = packages.get(packageName);
  if (!pkg) return "";

  const hash = crypto.createHash("sha256");
  const sourceHash = getPackageSourceHash(pkg.path);
  hash.update(sourceHash);

  // Incorporate direct internal dependency hashes
  const deps = (dependencyGraph.get(packageName) || []).slice().sort();
  for (const dep of deps) {
    const depHash = getCompositeTaskHash(dep, packages, dependencyGraph, visiting);
    hash.update(depHash);
  }

  visiting.delete(packageName);
  return hash.digest("hex");
}

export class CacheManager {
  private cacheDir: string;

  constructor(workspacePath: string) {
    this.cacheDir = path.join(workspacePath, ".cache", "microrepo");
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheFilePath(packageName: string, taskName: string): string {
    const safePkg = packageName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeTask = taskName.replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(this.cacheDir, `${safePkg}-${safeTask}.json`);
  }

  public get(packageName: string, taskName: string): CacheEntry | null {
    const file = this.getCacheFilePath(packageName, taskName);
    if (!fs.existsSync(file)) return null;

    try {
      const content = fs.readFileSync(file, "utf-8");
      return JSON.parse(content) as CacheEntry;
    } catch {
      return null;
    }
  }

  public save(packageName: string, taskName: string, hash: string, pkgPath?: string): void {
    const file = this.getCacheFilePath(packageName, taskName);

    const entry: CacheEntry = {
      packageName,
      taskName,
      hash,
      timestamp: new Date().toISOString(),
    };

    // If build output folders exist, track them
    if (pkgPath) {
      const outputs: Record<string, string> = {};
      const possibleOutputs = ["dist", "build", "out"];
      for (const outDir of possibleOutputs) {
        const fullOutDir = path.join(pkgPath, outDir);
        if (fs.existsSync(fullOutDir)) {
          outputs[outDir] = fullOutDir;
        }
      }
      if (Object.keys(outputs).length > 0) {
        entry.outputs = outputs;
      }
    }

    fs.writeFileSync(file, JSON.stringify(entry, null, 2), "utf-8");
  }
}

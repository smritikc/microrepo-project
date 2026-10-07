import fs from "node:fs";
import path from "node:path";
import type { PackageInfo } from "./types.js";

/**
 * Resolves packages in the workspace by reading package.json workspaces or fallback directories.
 */
export function discoverPackages(workspacePath: string): PackageInfo[] {
  const rootPackageJsonPath = path.join(workspacePath, "package.json");

  if (!fs.existsSync(rootPackageJsonPath)) {
    throw new Error(`Workspace root package.json not found at: ${rootPackageJsonPath}`);
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, "utf-8"));
  let patterns: string[] = [];

  if (Array.isArray(rootPkg.workspaces)) {
    patterns = rootPkg.workspaces;
  } else if (rootPkg.workspaces && Array.isArray(rootPkg.workspaces.packages)) {
    patterns = rootPkg.workspaces.packages;
  } else {
    // Default fallback
    patterns = ["packages/*", "apps/*", "libs/*"];
  }

  const packageDirs = new Set<string>();

  for (const pattern of patterns) {
    resolvePattern(workspacePath, pattern, packageDirs);
  }

  const packages: PackageInfo[] = [];

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const content = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      if (!content.name) continue;

      const deps = Object.keys(content.dependencies || {});
      const devDeps = Object.keys(content.devDependencies || {});
      const allDeps = Array.from(new Set([...deps, ...devDeps]));

      packages.push({
        name: content.name,
        path: pkgDir,
        relativePath: path.relative(workspacePath, pkgDir),
        dependencies: deps,
        devDependencies: devDeps,
        allDependencies: allDeps,
        scripts: content.scripts || {},
      });
    } catch {
      // Ignore invalid package.json
    }
  }

  return packages;
}

function resolvePattern(baseDir: string, pattern: string, results: Set<string>): void {
  const cleanPattern = pattern.replace(/[\\/]+$/, "");
  const parts = cleanPattern.split(/[\\/]/);

  function walk(currentDir: string, index: number): void {
    if (!fs.existsSync(currentDir)) return;

    if (index >= parts.length) {
      if (fs.existsSync(path.join(currentDir, "package.json"))) {
        results.add(currentDir);
      }
      return;
    }

    const part = parts[index];

    if (part === "*") {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(path.join(currentDir, entry.name), index + 1);
        }
      }
    } else if (part === "**") {
      // Direct children & nested
      walk(currentDir, index + 1);
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(path.join(currentDir, entry.name), index);
        }
      }
    } else {
      walk(path.join(currentDir, part), index + 1);
    }
  }

  walk(baseDir, 0);
}

import { spawn } from "node:child_process";
import path from "node:path";
import type { PackageInfo } from "./types.js";

/**
 * Gets a list of modified, added, or untracked files in the workspace via Git.
 */
export async function getChangedFiles(workspacePath: string, sinceRef?: string): Promise<string[]> {
  const changedFiles = new Set<string>();

  try {
    // 1. Check git diff against ref or working tree
    const diffArgs = sinceRef ? ["diff", "--name-only", sinceRef] : ["diff", "--name-only", "HEAD"];
    const diffOutput = await runGitCommand(workspacePath, diffArgs);
    for (const line of diffOutput.split(/\r?\n/)) {
      const file = line.trim();
      if (file) changedFiles.add(path.normalize(file));
    }
  } catch {
    // Fallback to unstaged diff if HEAD fails (e.g., initial commit)
    try {
      const unstaged = await runGitCommand(workspacePath, ["diff", "--name-only"]);
      for (const line of unstaged.split(/\r?\n/)) {
        const file = line.trim();
        if (file) changedFiles.add(path.normalize(file));
      }
    } catch {
      // Git may not be initialized or clean
    }
  }

  // 2. Also check untracked / staged files via status
  try {
    const statusOutput = await runGitCommand(workspacePath, ["status", "--porcelain"]);
    for (const line of statusOutput.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length > 3) {
        const file = trimmed.slice(3).trim();
        if (file) changedFiles.add(path.normalize(file));
      }
    }
  } catch {
    // Ignore status errors
  }

  return Array.from(changedFiles);
}

/**
 * Determines which packages contain changed files.
 */
export function getDirectlyAffectedPackages(
  packages: PackageInfo[],
  changedFiles: string[],
  workspacePath: string
): Set<string> {
  const affected = new Set<string>();

  for (const pkg of packages) {
    const pkgRelPath = path.normalize(path.relative(workspacePath, pkg.path));

    for (const file of changedFiles) {
      const normalizedFile = path.normalize(file);
      if (normalizedFile.startsWith(pkgRelPath + path.sep) || normalizedFile === pkgRelPath) {
        affected.add(pkg.name);
        break;
      }
    }
  }

  return affected;
}

function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err) => reject(err));
  });
}

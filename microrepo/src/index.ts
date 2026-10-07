#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./cli.js";
import { discoverPackages } from "./scanner.js";
import { getChangedFiles, getDirectlyAffectedPackages } from "./git.js";
import { buildDependencyGraph } from "./graph.js";
import { executeTasks } from "./runner.js";

async function main() {
  const options = parseArgs(process.argv);
  const resolvedWorkspacePath = path.resolve(process.cwd(), options.workspacePath);
  options.workspacePath = resolvedWorkspacePath;

  console.log(`\n🔍 Scanning workspace: ${resolvedWorkspacePath}`);
  const packages = discoverPackages(resolvedWorkspacePath);
  console.log(`📦 Discovered ${packages.length} package(s)`);

  let targetFilter: Set<string> | undefined;

  // 1. Handle explicit --filter
  if (options.filter && options.filter.length > 0) {
    targetFilter = new Set(options.filter);
    console.log(`🎯 Filtering by target package(s): ${Array.from(targetFilter).join(", ")}`);
  }

  // 2. Handle --changed / --since
  if (options.changed) {
    console.log(`🌿 Checking Git status${options.since ? ` since ${options.since}` : ""}...`);
    const changedFiles = await getChangedFiles(resolvedWorkspacePath, options.since);
    console.log(`   Found ${changedFiles.length} modified file(s) in workspace`);

    const affected = getDirectlyAffectedPackages(packages, changedFiles, resolvedWorkspacePath);
    if (affected.size === 0) {
      console.log(`✨ No workspace packages affected by git changes. Nothing to run.`);
      process.exit(0);
    }

    console.log(`🎯 Affected package(s): ${Array.from(affected).join(", ")}`);

    if (targetFilter) {
      // Intersection if both filter and changed are used
      targetFilter = new Set(Array.from(targetFilter).filter((p) => affected.has(p)));
    } else {
      targetFilter = affected;
    }
  }

  // 3. Build DAG & compute topological execution tiers
  const graph = buildDependencyGraph(packages, targetFilter);

  if (graph.executionOrder.length === 0) {
    console.log(`ℹ No packages matched the execution criteria.`);
    process.exit(0);
  }

  // 4. Run tasks
  const result = await executeTasks(graph, options);

  if (!result.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n💥 Fatal error: ${err.message}`);
  process.exit(1);
});
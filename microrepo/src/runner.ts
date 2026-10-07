import { spawn } from "node:child_process";
import type { PackageInfo, CLIOptions } from "./types.js";
import type { DependencyGraph } from "./graph.js";
import { CacheManager, getCompositeTaskHash } from "./cache.js";

export interface TaskResult {
  packageName: string;
  taskName: string;
  status: "cached" | "success" | "skipped" | "failed";
  durationMs: number;
  error?: Error;
}

export async function executeTasks(
  graph: DependencyGraph,
  options: CLIOptions
): Promise<{ success: boolean; results: TaskResult[] }> {
  const cacheManager = new CacheManager(options.workspacePath);
  const results: TaskResult[] = [];
  const completed = new Set<string>();

  console.log(`\n🎯 Planned execution order:`);
  graph.executionBatches.forEach((batch, index) => {
    console.log(`  Tier ${index + 1}: ${batch.join(", ")}`);
  });

  if (options.dryRun) {
    console.log(`\n🔍 [Dry Run] No commands will be executed.`);
    for (const pkgName of graph.executionOrder) {
      results.push({
        packageName: pkgName,
        taskName: options.task,
        status: "skipped",
        durationMs: 0,
      });
    }
    return { success: true, results };
  }

  const startTime = Date.now();

  for (let i = 0; i < graph.executionBatches.length; i++) {
    const batch = graph.executionBatches[i];
    console.log(`\n🚀 [Tier ${i + 1}/${graph.executionBatches.length}] Running: ${batch.join(", ")}`);

    // Execute batch respecting concurrency if specified
    const concurrency = options.concurrency && options.concurrency > 0 ? options.concurrency : batch.length;
    const batchResults = await runBatchWithConcurrency(
      batch,
      graph,
      options,
      cacheManager,
      concurrency
    );

    for (const res of batchResults) {
      results.push(res);
      if (res.status === "failed") {
        console.error(`\n❌ Execution halted due to failure in ${res.packageName}`);
        return { success: false, results };
      }
      completed.add(res.packageName);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const cachedCount = results.filter((r) => r.status === "cached").length;
  const successCount = results.filter((r) => r.status === "success").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  console.log(`\n═════════════════════════════════════════════════`);
  console.log(`✨ Tasks completed in ${totalTime}s:`);
  console.log(`   ⚡ Cached:  ${cachedCount}`);
  console.log(`   🔨 Built:   ${successCount}`);
  console.log(`   ⚠  Skipped: ${skippedCount}`);
  console.log(`═════════════════════════════════════════════════\n`);

  return { success: true, results };
}

async function runBatchWithConcurrency(
  batch: string[],
  graph: DependencyGraph,
  options: CLIOptions,
  cacheManager: CacheManager,
  concurrency: number
): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  const queue = [...batch];

  const workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
    while (queue.length > 0) {
      const pkgName = queue.shift();
      if (!pkgName) break;

      const res = await runSinglePackageTask(pkgName, graph, options, cacheManager);
      results.push(res);
    }
  });

  await Promise.all(workers);
  return results;
}

async function runSinglePackageTask(
  packageName: string,
  graph: DependencyGraph,
  options: CLIOptions,
  cacheManager: CacheManager
): Promise<TaskResult> {
  const pkg = graph.packages.get(packageName);
  if (!pkg) {
    return {
      packageName,
      taskName: options.task,
      status: "failed",
      durationMs: 0,
      error: new Error(`Package not found: ${packageName}`),
    };
  }

  const scriptCommand = pkg.scripts[options.task];
  if (!scriptCommand) {
    console.log(`  ⚠ [${packageName}] No "${options.task}" script found. Skipping.`);
    return {
      packageName,
      taskName: options.task,
      status: "skipped",
      durationMs: 0,
    };
  }

  const currentHash = getCompositeTaskHash(packageName, graph.packages, graph.dependencies);
  const cached = cacheManager.get(packageName, options.task);

  if (!options.force && cached && cached.hash === currentHash) {
    console.log(`  ⚡ [${packageName}] CACHE HIT (Hash: ${currentHash.slice(0, 8)})`);
    return {
      packageName,
      taskName: options.task,
      status: "cached",
      durationMs: 0,
    };
  }

  console.log(`  🔨 [${packageName}] CACHE MISS -> Running: "${scriptCommand}"`);
  const taskStart = Date.now();

  try {
    await executeShellCommand(scriptCommand, pkg.path);
    const duration = Date.now() - taskStart;

    cacheManager.save(packageName, options.task, currentHash, pkg.path);
    console.log(`  ✓ [${packageName}] Completed in ${duration}ms`);

    return {
      packageName,
      taskName: options.task,
      status: "success",
      durationMs: duration,
    };
  } catch (err: any) {
    const duration = Date.now() - taskStart;
    console.error(`  ❌ [${packageName}] Failed in ${duration}ms: ${err.message}`);
    return {
      packageName,
      taskName: options.task,
      status: "failed",
      durationMs: duration,
      error: err,
    };
  }
}

function executeShellCommand(command: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Avoid passing arguments array when shell is true to avoid node deprecation warnings and shell escaping issues
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    child.on("error", (err) => reject(err));
  });
}

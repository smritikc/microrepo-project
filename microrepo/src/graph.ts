import type { PackageInfo } from "./types.js";

export interface DependencyGraph {
  packages: Map<string, PackageInfo>;
  // Map of packageName -> internal packages that this package depends on
  dependencies: Map<string, string[]>;
  // Map of packageName -> internal packages that depend on this package (dependents)
  dependents: Map<string, string[]>;
  executionBatches: string[][];
  executionOrder: string[];
}

/**
 * Builds a directed acyclic graph of workspace packages and calculates execution order.
 */
export function buildDependencyGraph(
  packages: PackageInfo[],
  targetFilter?: Set<string>
): DependencyGraph {
  const packageMap = new Map<string, PackageInfo>();
  const packageNames = new Set<string>();

  for (const pkg of packages) {
    packageMap.set(pkg.name, pkg);
    packageNames.add(pkg.name);
  }

  // 1. Build adjacency maps considering ALL internal dependencies (both deps and devDeps)
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const pkg of packages) {
    const internalDeps = pkg.allDependencies.filter((dep) => packageNames.has(dep));
    dependencies.set(pkg.name, internalDeps);

    if (!dependents.has(pkg.name)) {
      dependents.set(pkg.name, []);
    }

    for (const dep of internalDeps) {
      const list = dependents.get(dep) || [];
      list.push(pkg.name);
      dependents.set(dep, list);
    }
  }

  // 2. Filter if targetFilter is specified (include targets + their downstream dependents)
  let activePackageNames = new Set<string>(packageNames);
  if (targetFilter && targetFilter.size > 0) {
    activePackageNames = resolveAllDependents(targetFilter, dependents);
  }

  // Subgraph for active packages
  const subGraphDeps = new Map<string, string[]>();
  for (const name of activePackageNames) {
    const deps = (dependencies.get(name) || []).filter((d) => activePackageNames.has(d));
    subGraphDeps.set(name, deps);
  }

  // 3. Detect Cycles & Compute Topological Batches using in-degrees
  const inDegree = new Map<string, number>();
  for (const [pkgName, deps] of subGraphDeps) {
    inDegree.set(pkgName, deps.length);
  }

  const ready: string[] = [];
  for (const [pkgName, deg] of inDegree) {
    if (deg === 0) {
      ready.push(pkgName);
    }
  }

  const executionBatches: string[][] = [];
  const executionOrder: string[] = [];
  const visited = new Set<string>();

  const remainingDegrees = new Map(inDegree);

  while (ready.length > 0) {
    const currentBatch = ready.splice(0);
    currentBatch.sort(); // Stable sort
    executionBatches.push(currentBatch);

    for (const completedPkg of currentBatch) {
      visited.add(completedPkg);
      executionOrder.push(completedPkg);

      for (const [pkgName, deps] of subGraphDeps) {
        if (deps.includes(completedPkg)) {
          const newDeg = (remainingDegrees.get(pkgName) ?? 0) - 1;
          remainingDegrees.set(pkgName, newDeg);
          if (newDeg === 0) {
            ready.push(pkgName);
          }
        }
      }
    }
  }

  if (visited.size !== activePackageNames.size) {
    const unvisited = Array.from(activePackageNames).filter((p) => !visited.has(p));
    throw new Error(
      `Circular dependency detected involving packages: ${unvisited.join(", ")}`
    );
  }

  return {
    packages: packageMap,
    dependencies: subGraphDeps,
    dependents,
    executionBatches,
    executionOrder,
  };
}

/**
 * Given a set of modified packages, recursively finds all downstream packages that depend on them.
 */
function resolveAllDependents(
  startPackages: Set<string>,
  dependentsMap: Map<string, string[]>
): Set<string> {
  const result = new Set<string>(startPackages);
  const queue = Array.from(startPackages);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const directDependents = dependentsMap.get(current) || [];

    for (const dep of directDependents) {
      if (!result.has(dep)) {
        result.add(dep);
        queue.push(dep);
      }
    }
  }

  return result;
}

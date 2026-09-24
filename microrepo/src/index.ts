
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

type PackageInfo = {
  name: string;
  path: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
};

function getPackageHash(packagePath: string): string {
  const hash = crypto.createHash("sha256");

  const ignoredDirectories = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".cache",
  ]);

  function hashDirectory(
    directory: string,
    relativeDirectory = ""
  ): void {
    const entries = fs
      .readdirSync(directory)
      .sort();

    for (const entry of entries) {
      const fullPath = path.join(directory, entry);
      const relativePath = path.join(
        relativeDirectory,
        entry
      );

      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        if (ignoredDirectories.has(entry)) {
          continue;
        }

        hashDirectory(fullPath, relativePath);
        continue;
      }

      if (stats.isFile()) {
        // Include the file path
        hash.update(relativePath);

        // Include the file contents
        const content = fs.readFileSync(fullPath);
        hash.update(content);
      }
    }
  }

  hashDirectory(packagePath);

  return hash.digest("hex");
}


function runTask(
  packageName: string,
  packagePath: string,
//   taskName: string,
  command: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ Building ${packageName}...`);
    console.log(`Running: ${command}`);

    const [program, ...args] = command.split(" ");

    if (!program) {
      reject(new Error(`Invalid command: ${command}`));
      return;
    }

    const child = spawn(program, args, {
      cwd: packagePath,
      shell: true,
      stdio: "inherit",
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        console.log(`✓ ${packageName} completed`);
        resolve();
      } else {
        reject(
          new Error(
            `${packageName} failed with exit code ${code}`
          )
        );
      }
    });

    child.on("error", (error: Error) => {
      reject(error);
    });
  });
}

function getRequiredArgument(
  value: string | undefined,
  message: string
): string {
  if (!value) {
    console.error(message);
    process.exit(1);
  }

  return value;
}

const workspacePath = getRequiredArgument(
  process.argv[2],
  "Please provide a workspace path.\nUsage: pnpm tsx src/index.ts <workspace-path> <task>"
);

const taskName = getRequiredArgument(
  process.argv[3],
  "Please provide a task.\nUsage: pnpm tsx src/index.ts <workspace-path> <task>"
);

console.log("Scanning workspace...");
console.log("Workspace:", workspacePath);
console.log("Task:", taskName);

const packageJsonPath = path.join(
  workspacePath,
  "package.json"
);

const packageJsonContent = fs.readFileSync(
  packageJsonPath,
  "utf-8"
);

const packageJson = JSON.parse(packageJsonContent);

console.log("Workspace patterns:");
console.log(packageJson.workspaces);

const packagesPath = path.join(
  workspacePath,
  "packages"
);

const packageFolders = fs.readdirSync(packagesPath);

console.log("Package folders:");
console.log(packageFolders);

const packages: PackageInfo[] = [];

for (const folder of packageFolders) {
  const packagePath = path.join(
    packagesPath,
    folder
  );

  const packageJsonPath = path.join(
    packagePath,
    "package.json"
  );

  const packageJsonContent = fs.readFileSync(
    packageJsonPath,
    "utf-8"
  );

  const packageJson = JSON.parse(packageJsonContent);

  const packageInfo: PackageInfo = {
    name: packageJson.name,
    path: packagePath,
    dependencies: Object.keys(
      packageJson.dependencies ?? {}
    ),
    devDependencies: Object.keys(
      packageJson.devDependencies ?? {}
    ),
    scripts: packageJson.scripts ?? {},
  };

  packages.push(packageInfo);
}

console.log("Discovered packages:");
console.log(packages);

const packageNames = new Set(
  packages.map((pkg) => pkg.name)
);

const graph = new Map<string, string[]>();


function getTaskHash(
  packageName: string,
  packagePath: string,
  visiting = new Set<string>()
): string {
  // Prevent infinite recursion if a circular dependency
  // somehow reaches this function.
  if (visiting.has(packageName)) {
    return "";
  }

  visiting.add(packageName);

  const hash = crypto.createHash("sha256");

  // 1. Hash this package's own files
  hash.update(getPackageHash(packagePath));

  // 2. Get this package's dependencies
  const dependencies = [
    ...(graph.get(packageName) ?? []),
  ].sort();

  // 3. Include each dependency's task hash
  for (const dependency of dependencies) {
    const dependencyPackage = packages.find(
      (pkg) => pkg.name === dependency
    );

    if (!dependencyPackage) {
      continue;
    }

    const dependencyHash = getTaskHash(
      dependencyPackage.name,
      dependencyPackage.path,
      visiting
    );

    hash.update(dependencyHash);
  }

  // This package is no longer in the current recursion path.
  visiting.delete(packageName);

  return hash.digest("hex");
}

for (const pkg of packages) {
  const internalDependencies =
    pkg.dependencies.filter((dependency) =>
      packageNames.has(dependency)
    );

  graph.set(pkg.name, internalDependencies);
}

console.log("Dependency graph:");
console.log(graph);

const inDegree = new Map<string, number>();

for (const [packageName, dependencies] of graph) {
  inDegree.set(
    packageName,
    dependencies.length
  );
}

console.log("In-degree:");
console.log(inDegree);

const queue: string[] = [];

for (const [packageName, degree] of inDegree) {
  if (degree === 0) {
    queue.push(packageName);
  }
}

console.log("Starting queue:");
console.log(queue);

const buildOrder: string[] = [];

while (queue.length > 0) {
  const current = queue.shift();

  if (!current) {
    break;
  }

  buildOrder.push(current);

  for (const [packageName, dependencies] of graph) {
    if (dependencies.includes(current)) {
      const currentDegree = inDegree.get(packageName);

      if (currentDegree === undefined) {
        continue;
      }

      const newDegree = currentDegree - 1;

      inDegree.set(packageName, newDegree);

      if (newDegree === 0) {
        queue.push(packageName);
      }
    }
  }
}

console.log("Build order:");
console.log(buildOrder);

if (buildOrder.length !== graph.size) {
  throw new Error(
    "Circular dependency detected in workspace packages."
  );
}


// if (!taskName) {
//   console.log("\nNo task specified.");
//   console.log(
//     "Example: pnpm tsx src/index.ts ../test-monorepo build"
//   );
//   process.exit(0);
// }

async function runBuildParallel() {
  // How many dependencies does each package still have?
  const remainingDependencies = new Map<string, number>();

  for (const [packageName, dependencies] of graph) {
    remainingDependencies.set(packageName, dependencies.length);
  }

  // Packages that are ready to run
  const ready: string[] = [];

  for (const [packageName, degree] of remainingDependencies) {
    if (degree === 0) {
      ready.push(packageName);
    }
  }

  const completed = new Set<string>();

  while (ready.length > 0) {
    // Take all currently-ready packages
    const currentBatch = ready.splice(0);

    console.log(
      `\n🚀 Running in parallel: ${currentBatch.join(", ")}`
    );

    // Run all packages in this batch at the same time
    await Promise.all(
      currentBatch.map(async (packageName) => {
        const pkg = packages.find((p) => p.name === packageName);

        if (!pkg) {
          throw new Error(`Package not found: ${packageName}`);
        }

       const currentHash = getTaskHash(
  packageName,
  pkg.path
);
const cachedHash = getCachedHash(
  packageName,
  taskName
);

if (currentHash === cachedHash) {
  console.log(`⚡ CACHE HIT: ${packageName}`);
  completed.add(packageName);
  return;
}

console.log(`🔨 CACHE MISS: ${packageName}`);

        const command = pkg.scripts[taskName];

        if (!command) {
          console.log(
            `\n⚠ ${packageName} has no "${taskName}" script. Skipping.`
          );
          completed.add(packageName);
          return;
        }

       await runTask(packageName, pkg.path, command);

savePackageHash(
  packageName,
  taskName,
  currentHash
);

completed.add(packageName);
      })
    );

    // The packages in this batch are now finished.
    // Remove them from the dependency count of their dependents.
    for (const completedPackage of currentBatch) {
      for (const [packageName, dependencies] of graph) {
        if (dependencies.includes(completedPackage)) {
          const currentDegree =
            remainingDependencies.get(packageName);

          if (currentDegree === undefined) {
            continue;
          }

          const newDegree = currentDegree - 1;

          remainingDependencies.set(packageName, newDegree);

          // All dependencies are now complete
          if (newDegree === 0) {
            ready.push(packageName);
          }
        }
      }
    }
  }

  if (completed.size !== graph.size) {
    throw new Error(
      "Build could not complete. Possible circular dependency."
    );
  }
}



function getCachePath(): string {
  const cachePath = path.join(process.cwd(), ".cache");

  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }

  return cachePath;
}

function savePackageHash(
  packageName: string,
  taskName: string,
  hash: string
): void {
  const cachePath = getCachePath();

  const safePackageName = packageName.replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );

  const safeTaskName = taskName.replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );

  const filePath = path.join(
    cachePath,
    `${safePackageName}-${safeTaskName}.json`
  );

  const cacheData = {
    packageName,
    taskName,
    hash,
  };

  fs.writeFileSync(
    filePath,
    JSON.stringify(cacheData, null, 2)
  );
}

function getCachedHash(
  packageName: string,
  taskName: string
): string | null {
  const cachePath = getCachePath();

  const safePackageName = packageName.replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );

  const safeTaskName = taskName.replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );

  const filePath = path.join(
    cachePath,
    `${safePackageName}-${safeTaskName}.json`
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(
    filePath,
    "utf-8"
  );

  const cacheData = JSON.parse(content);

  return cacheData.hash;
}

runBuildParallel().catch((error) => {
  console.error("\n❌ Build failed:");
  console.error(error);
  process.exit(1);
});
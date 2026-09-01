
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type PackageInfo = {
  name: string;
  path: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
};

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

async function runBuild() {
  for (const packageName of buildOrder) {
    const pkg = packages.find((p) => p.name === packageName);

    if (!pkg) {
      throw new Error(`Package not found: ${packageName}`);
    }

    const command = pkg.scripts[taskName];

    if (!command) {
      console.log(
        `\n⚠ ${packageName} has no "${taskName}" script. Skipping.`
      );
      continue;
    }

    await runTask(
      packageName,
      pkg.path,
    //   taskName,
      command
    );
  }
}

runBuild().catch((error) => {
  console.error("\n❌ Build failed:");
  console.error(error);
  process.exit(1);
});
import type { CLIOptions } from "./types.js";

export function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const positional: string[] = [];
  const filter: string[] = [];
  let changed = false;
  let force = false;
  let dryRun = false;
  let since: string | undefined;
  let concurrency: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--filter" || arg === "-f") {
      const val = args[++i];
      if (val) {
        val.split(",").forEach((p) => filter.push(p.trim()));
      }
    } else if (arg.startsWith("--filter=")) {
      arg.slice("--filter=".length).split(",").forEach((p) => filter.push(p.trim()));
    } else if (arg === "--changed") {
      changed = true;
    } else if (arg === "--since") {
      since = args[++i];
      changed = true;
    } else if (arg.startsWith("--since=")) {
      since = arg.slice("--since=".length);
      changed = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--concurrency" || arg === "-c") {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) concurrency = val;
    } else if (arg.startsWith("--concurrency=")) {
      const val = parseInt(arg.slice("--concurrency=".length), 10);
      if (!isNaN(val)) concurrency = val;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error("❌ Error: Missing required arguments.\n");
    printHelp();
    process.exit(1);
  }

  return {
    workspacePath: positional[0],
    task: positional[1],
    filter: filter.length > 0 ? filter : undefined,
    changed,
    since,
    force,
    dryRun,
    concurrency,
  };
}

function printHelp(): void {
  console.log(`
📦 microrepo - Fast, lightweight Monorepo Task Runner

Usage:
  microrepo <workspace-path> <task> [options]
  pnpm tsx src/index.ts <workspace-path> <task> [options]

Arguments:
  <workspace-path>    Path to monorepo root
  <task>              Name of the script to run (e.g., build, test, lint)

Options:
  --filter, -f <pkg>  Run only for specific package(s) and their dependents
  --changed           Only run for packages with uncommitted / modified git changes
  --since <ref>       Only run for packages modified since specified git commit/branch
  --force             Ignore cache and force all tasks to rerun
  --concurrency, -c   Maximum number of tasks to run concurrently in parallel
  --dry-run           Print planned execution graph without running commands
  -h, --help          Show help information

Examples:
  microrepo ../test-monorepo build
  microrepo ../test-monorepo test --filter=@test/api
  microrepo ../test-monorepo build --changed
  microrepo ../test-monorepo build --force --concurrency=2
`);
}

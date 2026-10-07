# 📦 microrepo

A fast, lightweight **Monorepo Build System and Task Runner** built from scratch in TypeScript. Inspired by modern tools like **Turborepo** and **Nx**.

---

## 🌟 What Is This Project?

When building software in a **monorepo** (a single repository containing multiple apps and libraries), running builds or tests across all packages can become extremely slow and repetitive.

**`microrepo`** solves this by:
1. Understanding the relationships between your packages (who depends on whom).
2. Running independent builds **in parallel**.
3. **Caching** results using cryptographic file hashes, so unchanged packages finish in **`0.01s`**.
4. Checking **Git changes** so you only test or build what actually changed.

---

## 📖 Plain-English Glossary (Technical Terms Explained)

| Technical Term | What It Means in Simple Words |
| :--- | :--- |
| **Monorepo** | A single code repository (folder) that contains multiple related projects or packages (e.g., frontend, backend API, shared types, UI components). |
| **DAG (Directed Acyclic Graph)** | A one-way map showing package dependencies (e.g., `Frontend` $\rightarrow$ `API` $\rightarrow$ `Database` $\rightarrow$ `Shared`). "Acyclic" means there are no infinite circular loops. |
| **Topological Sort** | An algorithm that figures out the correct order to build packages so that dependencies are always built *before* the packages that need them. |
| **Execution Tiers** | Groups of packages that can be built at the same time in parallel because they don't depend on each other. |
| **SHA-256 Hashing** | A digital fingerprint generated from a package's files. If even a single letter in your code changes, the hash changes completely. |
| **Task Caching** | Remembering the results of previous builds. If the code hash hasn't changed, the runner skips executing the task (`CACHE HIT`). |
| **Concurrency** | The maximum number of tasks allowed to run simultaneously on your computer at the exact same time. |

---

## ⚙️ How It Works Under the Hood

```
   1. SCAN WORKSPACE            2. BUILD GRAPH (DAG)           3. CACHE & EXECUTE
┌──────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│ Read package.json    │ ──► │ Calculate build order │ ──► │ Hash source files     │
│ Discover packages    │     │ Group into parallel   │     │ CACHE HIT ➜ Skip (0s) │
│ Find dependencies    │     │ execution tiers       │     │ CACHE MISS ➜ Run task │
└──────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

1. **Workspace Discovery ([`src/scanner.ts`](file:///d:/microrepo-project/microrepo/src/scanner.ts))**:
   - Reads the root `package.json` workspaces.
   - Finds all packages and extracts their `dependencies`, `devDependencies`, and `scripts`.

2. **Graph Resolution ([`src/graph.ts`](file:///d:/microrepo-project/microrepo/src/graph.ts))**:
   - Builds a dependency graph.
   - Calculates in-degrees (how many prerequisites each package has).
   - Groups packages into **Tiers** (e.g., Tier 1: `shared` $\rightarrow$ Tier 2: `database`, `ui` in parallel $\rightarrow$ Tier 3: `api` $\rightarrow$ Tier 4: `frontend`).
   - Detects and prevents circular dependency loops (e.g., A needs B, but B needs A).

3. **Cryptographic Caching ([`src/cache.ts`](file:///d:/microrepo-project/microrepo/src/cache.ts))**:
   - Computes: $\text{Task Hash} = \text{Hash}(\text{Source Files} + \text{Dependency Hashes})$.
   - If `@test/shared` changes, its hash changes, which automatically invalidates all downstream packages (`@test/database`, `@test/api`, `@test/frontend`).

4. **Parallel Task Execution ([`src/runner.ts`](file:///d:/microrepo-project/microrepo/src/runner.ts))**:
   - Executes shell tasks safely with clean logging, timing statistics, and concurrency control.

---

## 🚀 Quick Start

### 1. Installation
Install dependencies inside the `microrepo` engine:
```powershell
cd microrepo
pnpm install
```

### 2. Run a Build on the Sample Monorepo
From the `microrepo` directory:
```powershell
pnpm tsx src/index.ts ../test-monorepo build
```

Or from the workspace root:
```powershell
pnpm --dir microrepo tsx src/index.ts ../test-monorepo build
```

---

## 🛠️ CLI Options & Flags

| Flag | Shorthand | Description | Example |
| :--- | :--- | :--- | :--- |
| `--filter <package>` | `-f` | Only build specific package(s) and their downstream dependents. | `pnpm tsx src/index.ts ../test-monorepo build --filter=@test/database` |
| `--changed` | | Only run tasks on packages with uncommitted Git modifications. | `pnpm tsx src/index.ts ../test-monorepo build --changed` |
| `--since <ref>` | | Only run tasks modified since a specific Git branch or commit. | `pnpm tsx src/index.ts ../test-monorepo build --since=main` |
| `--force` | | Ignore all cache and force all tasks to re-run from scratch. | `pnpm tsx src/index.ts ../test-monorepo build --force` |
| `--concurrency <n>` | `-c` | Limit the maximum number of parallel tasks running at once. | `pnpm tsx src/index.ts ../test-monorepo build --concurrency=2` |
| `--dry-run` | | Preview the planned execution graph without running any scripts. | `pnpm tsx src/index.ts ../test-monorepo build --dry-run` |
| `--help` | `-h` | Show help information and options. | `pnpm tsx src/index.ts --help` |

---

## 📂 Project Structure

```text
microrepo-project/
├── .gitignore              # Files excluded from git (node_modules, cache, dist)
├── README.md               # Complete project documentation
├── microrepo/              # ⚙️ The Task Runner Engine
│   ├── package.json        # Engine configuration & dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   └── src/
│       ├── types.ts        # TypeScript interfaces & types
│       ├── scanner.ts      # Workspace package discovery & glob matching
│       ├── graph.ts        # DAG dependency graph & topological sorter
│       ├── cache.ts        # SHA-256 file hasher & cache manager
│       ├── git.ts          # Git diff & changed file detector
│       ├── runner.ts       # Parallel batch task executor
│       ├── cli.ts          # CLI argument parser
│       └── index.ts        # Main CLI entry point
│
└── test-monorepo/          # 🧪 Sample Monorepo (for testing)
    ├── package.json        # Defines workspace packages ("packages/*")
    └── packages/
        ├── shared/         # Base library (no dependencies)
        ├── database/       # Depends on @test/shared
        ├── ui/             # Depends on @test/shared
        ├── api/            # Depends on @test/database, @test/shared
        └── frontend/       # Depends on @test/api, @test/ui
```

---

## 🏗️ Compiling to Standalone Executable

To compile the TypeScript source into production JavaScript:
```powershell
cd microrepo
pnpm run build
```
The compiled output is placed in `microrepo/dist/index.js`. You can then run it directly using Node:
```powershell
node dist/index.js ../test-monorepo build
```

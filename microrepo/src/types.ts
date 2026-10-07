export interface PackageInfo {
  name: string;
  path: string;
  relativePath: string;
  dependencies: string[];
  devDependencies: string[];
  allDependencies: string[];
  scripts: Record<string, string>;
}

export interface CLIOptions {
  workspacePath: string;
  task: string;
  filter?: string[];
  changed?: boolean;
  since?: string;
  force?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}

export interface CacheEntry {
  packageName: string;
  taskName: string;
  hash: string;
  timestamp: string;
  outputs?: Record<string, string>;
}

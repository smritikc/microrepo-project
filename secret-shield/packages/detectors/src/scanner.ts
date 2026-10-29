import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SecretFinding, DetectionRule, ScanResult } from "@shield/types";
import { DEFAULT_RULES } from "./rules.js";
import { calculateShannonEntropy } from "./entropy.js";

const IGNORED_PATHS = new Set([
  "node_modules",
  ".git",
  ".cache",
  "dist",
  "build",
  ".next",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

export function scanContent(
  content: string,
  filePath: string,
  rules: DetectionRule[] = DEFAULT_RULES
): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const rule of rules) {
      // Clone regex to reset state
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const rawSecret = match[1] || match[0];
        const entropy = calculateShannonEntropy(rawSecret);

        if (rule.entropyThreshold && entropy < rule.entropyThreshold) {
          continue; // False positive filter
        }

        const findingId = crypto
          .createHash("sha1")
          .update(`${filePath}:${lineIdx + 1}:${match.index}:${rawSecret}`)
          .digest("hex")
          .slice(0, 12);

        findings.push({
          id: findingId,
          ruleId: rule.id,
          ruleName: rule.name,
          filePath,
          lineNumber: lineIdx + 1,
          columnStart: match.index + 1,
          columnEnd: match.index + 1 + rawSecret.length,
          rawSecret,
          maskedSecret: maskString(rawSecret),
          entropy,
          severity: rule.severity,
          timestamp: new Date().toISOString(),
          remediationSuggestion: rule.remediationGuide,
        });
      }
    }
  }

  return findings;
}

export function scanDirectory(
  targetDir: string,
  rules: DetectionRule[] = DEFAULT_RULES
): ScanResult {
  const startTime = Date.now();
  const findings: SecretFinding[] = [];
  let totalFilesScanned = 0;

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_PATHS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        totalFilesScanned++;
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const fileFindings = scanContent(content, fullPath, rules);
          findings.push(...fileFindings);
        } catch {
          // Skip binary or inaccessible files
        }
      }
    }
  }

  walk(targetDir);

  return {
    workspacePath: targetDir,
    totalFilesScanned,
    totalFindings: findings.length,
    findings,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

function maskString(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  const visible = 4;
  return `${secret.slice(0, visible)}${"•".repeat(Math.min(secret.length - visible * 2, 12))}${secret.slice(-visible)}`;
}

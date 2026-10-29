#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { scanDirectory } from "@shield/detectors";
import { generateEnvExample } from "@shield/remediation";

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || ".";
  const resolvedPath = path.resolve(process.cwd(), targetDir);

  console.log(`\n🛡️  SecretShield Security Scanner`);
  console.log(`📁 Scanning target directory: ${resolvedPath}\n`);

  const result = scanDirectory(resolvedPath);

  if (result.findings.length === 0) {
    console.log(`✅ Clean! Scanned ${result.totalFilesScanned} files in ${result.durationMs}ms. No secrets found.\n`);
    process.exit(0);
  }

  console.log(`🚨 FOUND ${result.findings.length} POTENTIAL SECRET LEAKS!\n`);

  for (const finding of result.findings) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔴 [${finding.severity}] ${finding.ruleName}`);
    console.log(`   File:     ${path.relative(process.cwd(), finding.filePath)}:${finding.lineNumber}`);
    console.log(`   Secret:   ${finding.maskedSecret}`);
    console.log(`   Entropy:  ${finding.entropy} bits`);
    console.log(`   Action:   ${finding.remediationSuggestion}`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Optionally generate .env.example
  if (args.includes("--generate-env")) {
    const envContent = generateEnvExample(result.findings);
    const envPath = path.join(resolvedPath, ".env.example");
    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log(`📝 Generated safe template at: ${envPath}\n`);
  }

  // Save report to .shield-report.json
  const reportPath = path.join(process.cwd(), ".shield-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`📊 Scan report saved to: ${reportPath}\n`);

  process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal scanner error:`, err);
  process.exit(1);
});

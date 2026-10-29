import { SecretFinding } from "@shield/types";

const mockFindings: SecretFinding[] = [
  {
    id: "f1a2b3c4",
    ruleId: "RULE_OPENAI_KEY",
    ruleName: "OpenAI API Key",
    filePath: "apps/web/.env.local",
    lineNumber: 4,
    columnStart: 16,
    columnEnd: 67,
    rawSecret: "sk-proj-9999999999999999999999999999",
    maskedSecret: "sk-p••••••••••••9999",
    entropy: 4.312,
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    remediationSuggestion: "Revoke key via OpenAI dashboard immediately.",
  },
  {
    id: "d4e5f6a7",
    ruleId: "RULE_AWS_KEY",
    ruleName: "AWS Access Key ID",
    filePath: "packages/db/src/config.ts",
    lineNumber: 12,
    columnStart: 22,
    columnEnd: 42,
    rawSecret: "AKIAIOSFODNN7EXAMPLE",
    maskedSecret: "AKIA••••••••MPLE",
    entropy: 3.451,
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    remediationSuggestion: "Rotate AWS credentials via IAM Console.",
  },
  {
    id: "b8c9d0e1",
    ruleId: "RULE_GENERIC_HIGH_ENTROPY",
    ruleName: "High-Entropy API Secret",
    filePath: "services/auth/jwt.ts",
    lineNumber: 28,
    columnStart: 18,
    columnEnd: 50,
    rawSecret: "xK8#mQ2$vL9@pZ4!wY7&",
    maskedSecret: "xK8#••••••••wY7&",
    entropy: 4.182,
    severity: "HIGH",
    timestamp: new Date().toISOString(),
    remediationSuggestion: "Move hardcoded JWT secret to environment variable.",
  },
];

function renderDashboard(findings: SecretFinding[]) {
  const tbody = document.getElementById("findings-tbody");
  const criticalCount = document.getElementById("critical-count");
  const highCount = document.getElementById("high-count");
  const filesCount = document.getElementById("files-count");
  const healthScore = document.getElementById("health-score");

  if (!tbody || !criticalCount || !highCount || !filesCount || !healthScore) return;

  const criticals = findings.filter((f) => f.severity === "CRITICAL").length;
  const highs = findings.filter((f) => f.severity === "HIGH").length;

  criticalCount.textContent = criticals.toString();
  highCount.textContent = highs.toString();
  filesCount.textContent = "42";
  healthScore.textContent = findings.length === 0 ? "100%" : "45%";

  tbody.innerHTML = findings
    .map(
      (f) => `
      <tr>
        <td><span class="severity-tag ${f.severity}">${f.severity}</span></td>
        <td><strong>${f.ruleName}</strong></td>
        <td><span class="code-font">${f.filePath}:${f.lineNumber}</span></td>
        <td><span class="code-font">${f.maskedSecret}</span></td>
        <td><span class="entropy-pill">${f.entropy} bits</span></td>
        <td><span style="color: var(--text-secondary); font-size: 12px;">${f.remediationSuggestion}</span></td>
      </tr>
    `
    )
    .join("");
}

document.getElementById("scan-btn")?.addEventListener("click", () => {
  const btn = document.getElementById("scan-btn");
  if (btn) {
    btn.textContent = "⏳ Scanning...";
    setTimeout(() => {
      btn.textContent = "⚡ Trigger Live Scan";
      renderDashboard(mockFindings);
    }, 600);
  }
});

// Initial render
renderDashboard(mockFindings);

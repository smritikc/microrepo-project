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

let activeSeverity = "ALL";
let searchQuery = "";

function applyFilters() {
  const filtered = mockFindings.filter((f) => {
    const matchesSeverity = activeSeverity === "ALL" || f.severity === activeSeverity;
    const matchesSearch =
      !searchQuery ||
      f.ruleName.toLowerCase().includes(searchQuery) ||
      f.filePath.toLowerCase().includes(searchQuery) ||
      f.maskedSecret.toLowerCase().includes(searchQuery) ||
      f.severity.toLowerCase().includes(searchQuery);
    return matchesSeverity && matchesSearch;
  });
  renderDashboard(filtered);
}

function updateBadgeCounts() {
  const countAll = document.getElementById("count-all");
  const countCritical = document.getElementById("count-critical");
  const countHigh = document.getElementById("count-high");

  if (countAll) countAll.textContent = mockFindings.length.toString();
  if (countCritical) countCritical.textContent = mockFindings.filter((f) => f.severity === "CRITICAL").length.toString();
  if (countHigh) countHigh.textContent = mockFindings.filter((f) => f.severity === "HIGH").length.toString();
}

function showToast(message: string, icon = "✅") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toast-fade-out 0.3s ease-in forwards";
    setTimeout(() => toast.remove(), 300);
  }, 2400);
}

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
        <td>
          <div class="secret-cell-wrap">
            <span class="code-font">${f.maskedSecret}</span>
            <button class="btn-icon-copy" data-copy="${f.maskedSecret}" title="Copy Masked Token">📋</button>
          </div>
        </td>
        <td><span class="entropy-pill">${f.entropy} bits</span></td>
        <td>
          <div class="remediation-cell">
            <span class="remediation-text">${f.remediationSuggestion}</span>
            <button class="btn-remediate" data-id="${f.id}" data-action="fix">Resolve</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  // Attach row action listeners
  tbody.querySelectorAll(".btn-icon-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-copy") || "";
      navigator.clipboard?.writeText(val);
      showToast(`Copied ${val} to clipboard`, "📋");
    });
  });

  tbody.querySelectorAll(".btn-remediate").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      showToast(`Remediation playbook initiated for finding [${id}]`, "🛡️");
    });
  });
}

document.querySelectorAll("#severity-filters .filter-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#severity-filters .filter-pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeSeverity = btn.getAttribute("data-severity") || "ALL";
    applyFilters();
  });
});

document.getElementById("scan-btn")?.addEventListener("click", () => {
  const btn = document.getElementById("scan-btn");
  if (btn) {
    btn.textContent = "⏳ Scanning...";
    setTimeout(() => {
      btn.textContent = "⚡ Trigger Live Scan";
      updateBadgeCounts();
      applyFilters();
    }, 600);
  }
});

document.getElementById("finding-search")?.addEventListener("input", (e) => {
  searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
  applyFilters();
});

document.getElementById("export-btn")?.addEventListener("click", () => {
  const exportBtn = document.getElementById("export-btn");
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mockFindings, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `secretshield-report-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  if (exportBtn) {
    const originalText = exportBtn.textContent;
    exportBtn.textContent = "✅ Exported!";
    setTimeout(() => {
      exportBtn.textContent = originalText;
    }, 1500);
  }
});

// Initial render
updateBadgeCounts();
renderDashboard(mockFindings);

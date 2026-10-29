export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SecretFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  rawSecret: string;
  maskedSecret: string;
  entropy: number;
  severity: Severity;
  timestamp: string;
  remediationSuggestion: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: Severity;
  entropyThreshold?: number;
  description: string;
  remediationGuide: string;
}

export interface ScanResult {
  workspacePath: string;
  totalFilesScanned: number;
  totalFindings: number;
  findings: SecretFinding[];
  durationMs: number;
  timestamp: string;
}

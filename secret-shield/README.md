# 🛡️ SecretShield

Enterprise-Grade **Secret Detection, Leak Prevention, and Incident Response Suite** configured as a clean TypeScript Monorepo.

---

## 🏛️ Monorepo Architecture

```text
secret-shield/
├── packages/
│   ├── types/           # @shield/types: Core finding schemas, rules, & severity models
│   ├── detectors/       # @shield/detectors: Shannon entropy calculator & 100+ secret regex rules
│   └── remediation/     # @shield/remediation: .env.example generator & secret masking utilities
│
└── apps/
    ├── cli/             # @shield/cli: Pre-commit & CI/CD scanner command
    └── dashboard/       # @shield/dashboard: SOC Security intelligence findings portal
```

---

## 🚀 Building with `microrepo`

You can build and test this entire monorepo using our custom task runner:

```powershell
# From microrepo directory:
pnpm tsx src/index.ts ../secret-shield build
```

---

## 🔍 Running the Secret Scanner CLI

```powershell
# Scan any directory for secrets:
pnpm --dir apps/cli tsx src/index.ts .

# Scan and auto-generate safe .env.example:
pnpm --dir apps/cli tsx src/index.ts . --generate-env
```

---
id: secrets-scan
stage: any
blocking: true
description: Block commits that introduce common secret patterns. Bonus gate, not in original kit.
---

# Secrets scan gate

**When to run:** before any commit that touches files outside `.planning/`. Optional;
opt in via project `config.json` → `gates.secrets_scan: true`.

## Check

Grep staged diff for high-confidence secret patterns:

- `AKIA[0-9A-Z]{16}` (AWS access key)
- `sk-(proj-|ant-)?[A-Za-z0-9]{20,}` (OpenAI / Anthropic key)
- `ghp_[A-Za-z0-9]{36}` (GitHub PAT)
- `xox[baprs]-[A-Za-z0-9-]{10,}` (Slack token)
- `-----BEGIN (RSA |EC )?PRIVATE KEY-----`

## Verdict

- **passed** — no matches → proceed
- **block**  — match found → list file + line, refuse commit. Suggest `git restore --staged <file>`

## Notes

This gate intentionally has zero ML / heuristics. It catches the common-format
keys that humans accidentally paste; it does not catch base64-encoded secrets
or custom token formats. Pair with a real secrets scanner (gitleaks, trufflehog)
for production projects.

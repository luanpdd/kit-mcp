---
name: auditar-release
description: Invoca release-pipeline-auditor — audita CI/CD para hermeticidade (lockfile + frozen-install + image SHA + sem network), reprodutibilidade (versions pinned), policy enforcement (branch protection, signed commits, CODEOWNERS). Cap 8 livro Google SRE.
argument-hint: "[--dimensions hermeticidade,reprodutibilidade,policy-enforcement] [--gh-repo OWNER/REPO]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
---

<objective>
Auditar **release pipeline** (CI/CD + Dockerfile + branch protection) em 3 dimensões: hermeticidade, reprodutibilidade, policy enforcement. Invoca o agente [`release-pipeline-auditor`](../agents/release-pipeline-auditor.md) que aplica skills [`hermetic-builds`](../skills/hermetic-builds/SKILL.md) + [`release-engineering`](../skills/release-engineering/SKILL.md).

**Cria/Atualiza:**
- `.planning/RELEASE-AUDIT.md` — relatório scored 30 pontos com top 5 fixes priorizados

**Após:** o user vê fragility quantificada (não opinião). Resultado feeds PRR Axe 5 (Change Management) v1.10 e gate `release-pipeline-policy` opt-in.
</objective>

<context>
**Argumentos:**
- `--dimensions <list>` — subset de `[hermeticidade, reprodutibilidade, policy-enforcement]` (default: todas)
- `--gh-repo OWNER/REPO` — override de repo detection (default: `gh repo view`)
- `--output PATH` — caminho do output (default: `.planning/RELEASE-AUDIT.md`)

**Exemplos:**
```
/auditar-release                                          # full audit (3 dims)
/auditar-release --dimensions hermeticidade               # só hermeticidade
/auditar-release --gh-repo myorg/myrepo                   # override repo
```

**Pré-requisitos opcionais:**
- `gh` CLI autenticado (`gh auth status`) — para checks de branch protection via API
- Sem `gh`: agent skip dimension policy-enforcement parcialmente (filesystem only)
</context>

<process>

## 1. Parsear argumentos

```bash
DIMENSIONS=$(echo "$ARGUMENTS" | grep -oE -- '--dimensions [^ ]+' | awk '{print $2}')
GH_REPO=$(echo "$ARGUMENTS" | grep -oE -- '--gh-repo [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/RELEASE-AUDIT.md"
mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Dispatch para `release-pipeline-auditor`

```text
Task(
  subagent_type="release-pipeline-auditor",
  prompt="
project_root: .
output_path: ${OUTPUT_PATH}
${DIMENSIONS:+dimensions: ${DIMENSIONS}}
${GH_REPO:+gh_repo: ${GH_REPO}}

Aplicar skills hermetic-builds + release-engineering. Etapas:
1. Detectar lockfile, CI files, Dockerfile
2. Auditar Hermeticidade (10pts): lockfile commitado, frozen-install, image SHA, sem network, SLSA provenance
3. Auditar Reprodutibilidade (10pts): actions pinned, node version pinned, package manager pinned, sem timestamps, build cache
4. Auditar Policy Enforcement (10pts): branch protection, required PR + reviewers + status checks, CODEOWNERS, signed commits, workflow permissions, release via tag
5. Score agregado (0-30) com veredito ROBUST/ADEQUATE/FRAGILE/BROKEN
6. Top 5 fixes priorizados com esforço estimado
"
)
```

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-RELEASE ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do agent]

## Próximos passos

1. **Aplicar top 5 fixes** do RELEASE-AUDIT.md (esforço total ~1-2h)
2. **/prr <service>** (v1.10) — Axe 5 (Change Management) consume este audit
3. **Re-audit em 30d** — verificar progresso
4. **/concluir-marco** (framework + patch v1.11) — opt-in gate `release-pipeline-policy`

## Cross-suite

- v1.10 SRE — PRR Axe 5 (Change Management)
- v1.11 SRE Resilience — esse audit
- v1.12 Legacy — overrides de refactor têm audit trail aqui
- Framework flow — /concluir-marco gate opt-in
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (todos opcionais)
- [ ] `release-pipeline-auditor` invocado via Task
- [ ] RELEASE-AUDIT.md scored 30 pts criado
- [ ] Veredito ROBUST/ADEQUATE/FRAGILE/BROKEN
- [ ] Top 5 fixes priorizados com esforço
- [ ] Cross-references com /prr e /concluir-marco
</success_criteria>

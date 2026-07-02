# PLAN — Phase 155 (v1.27 FINAL) — Cross-suite enrichment + Release artifacts

> Fase **FINAL** do milestone v1.27 (Supabase Branching & CI/CD Workflow — 9ª trilha).
> 8 REQs em 2 categorias.

---

## Contexto

Após phases 149-154 entregarem 5 skills novas + 2 agents novos canônicos, esta fase fecha o marco com:
- **Cross-suite enrichment (XS-01..03):** patches em 3 agents existentes (v1.x) para awareness do novo branching workflow
- **Release artifacts (REL-01..05):** AUTOGEN-COUNTS + manifest + CHANGELOG + glossário + version bump

Não há código novo — apenas patches em agents existentes + artefatos canônicos de release.

**Princípio canônico v1.23 preservado:** handoff cooperativo (agents Supabase materializam, não descartam upstream) referenciado em XS-01 e XS-02.

---

## Tasks

### T1 — XS-01: `supabase-architect` (v1.8) ganha section "Branching Strategy Decision"
**Path:** `kit/agents/supabase-architect.md`

Adicionar section "Branching Strategy Decision (v1.27)" próximo ao topo (antes/depois de "Inputs"). Conteúdo:
- GitHub integration recomendada vs Dashboard alpha
- Persistent vs ephemeral preview
- Cost alert: Branching Compute Hours FORA do Spend Cap
- Cross-suite handoff para `supabase-branching-architect` ANTES de schema design
- Cross-ref skill `supabase-branching-workflow`

**REQ:** XS-01

---

### T2 — XS-02: `supabase-migration-writer` (v1.23) ganha "Caveats v1.27"
**Path:** `kit/agents/supabase-migration-writer.md`

Adicionar section "Caveats v1.27 — Branching & Concurrent Push" com 2 anti-patterns:
- Concurrent `supabase db push` from different machines/CI runners
- Migration com timestamp wrong order após git rebase

Cross-ref skill `supabase-migration-repair`.

**REQ:** XS-02

---

### T3 — XS-03: `release-pipeline-auditor` (v1.10) ganha "Branching Workflow Validation"
**Path:** `kit/agents/release-pipeline-auditor.md`

Adicionar section "Branching Workflow Validation (v1.27)" com 4 checks:
- Required check enforced (Supabase Preview)
- Secrets stored (SUPABASE_ACCESS_TOKEN etc.)
- Migration safety pre-merge
- Backup workflow não em repo público

Cross-ref skill `supabase-ci-cd-github-actions`.

**REQ:** XS-03

---

### T4 — REL-01: AUTOGEN-COUNTS regen

```bash
node scripts/update-readme-counts.js
```

Verificar README.md bloco AUTOGEN-COUNTS: **66 agents · 89 commands · 76 skills · 23 gates** (era 64 + 71).

**REQ:** REL-01

---

### T5 — REL-02: file-manifest regen

```bash
node scripts/regen-manifest.js
```

Verificar `kit/file-manifest.json` atualizado com novos arquivos (v149-154).

**REQ:** REL-02

---

### T6 — REL-03: CHANGELOG v1.27 entry
**Path:** `CHANGELOG.md`

Adicionar entry no TOPO (após header `# Changelog`), descrevendo:
- 5 skills novas (supabase-branching-workflow, supabase-config-toml-remotes, supabase-ci-cd-github-actions, supabase-pgtap-testing, supabase-migration-repair)
- 2 agents novos (supabase-branching-architect, supabase-cicd-pipeline-implementer)
- 3 patches cross-suite (XS-01..03)
- Counts: 64→66 agents, 71→76 skills

**REQ:** REL-03

---

### T7 — REL-04: glossário compartilhado +10 termos
**Path:** `kit/skills/_shared-supabase/glossary.md`

Adicionar 10 termos novos (alphabetical order onde aplicável):
- Branching Compute Hours
- Branching workflow (Supabase)
- Deploy DAG (7 steps)
- dotenvx encrypted fields
- Migration repair
- Persistent branch
- pgTAP testing
- Preview branch
- [remotes] block
- Schema drift

**REQ:** REL-04

---

### T8 — REL-05: package.json bump
**Path:** `package.json`

Mudar `"version": "1.26.0"` → `"version": "1.27.0"`.

**REQ:** REL-05

---

## Verificação

- T1-T3: Edit em 3 agents .md confirmado via `git diff`
- T4: README.md exibe "66 agents · 89 commands · 76 skills · 23 gates" no bloco AUTOGEN-COUNTS
- T5: `kit/file-manifest.json` modificado (mais entries)
- T6: CHANGELOG.md tem entry `## [1.27.0] - 2026-05-11`
- T7: glossary.md tem 10 termos novos preservando alphabetical onde aplicável
- T8: package.json mostra `"version": "1.27.0"`
- Commit único com todos os arquivos modificados

---

## Princípios canônicos preservados

- **v1.23 cooperative handoff:** XS-01 e XS-02 referenciam agent canônico que faz handoff cooperativo (não descarta upstream)
- **PT-BR naming convention:** skills/agents novos do v1.27 já em PT-BR descritivo (estabelecida v1.22)
- **Não-breaking:** todos artefatos são aditivos; stable API v1.0+ preservada (15ª release consecutiva)

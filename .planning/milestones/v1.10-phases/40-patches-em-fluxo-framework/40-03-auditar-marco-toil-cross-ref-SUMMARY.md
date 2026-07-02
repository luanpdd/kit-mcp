---
phase: 40-patches-em-fluxo-framework
plan: 03
subsystem: framework
tags: [auditar-marco, auditar-toil, sre, toil, omm, cross-ref, v1.10]

requires:
  - phase: 36-skills-foundationais-sre
    provides: skill eliminating-toil (cap 5 livro Google SRE)
  - phase: 37-agentes-sre
    provides: agent toil-auditor (gera .planning/TOIL-AUDIT.md)
  - phase: 38-orquestrador-sre
    provides: command /auditar-toil (invoca toil-auditor)
  - phase: 39-patches-em-observabilidade-e-supabase
    provides: omm-auditor patch INT-OBS-02 (Capacidade 3 consume TOIL-AUDIT.md)

provides:
  - bloco <sre_integration> em kit/commands/auditar-marco.md
  - flag workflow.audit_milestone_toil (default true)
  - loop fechado canônico /auditar-marco → /auditar-toil → /auditar-observabilidade → omm-auditor

affects: [auditar-marco, auditar-toil, omm-auditor, eliminating-toil, MILESTONE-AUDIT.md, TOIL-AUDIT.md, OMM-REPORT.md]

tech-stack:
  added: []
  patterns:
    - "Bloco <sre_integration> XML-like — paridade com <observability_integration> v1.9"
    - "Flag workflow.audit_milestone_<thing>=true default — paridade entre v1.9 (omm) e v1.10 (toil)"
    - "Cross-refs Markdown ATIVOS — descoberta cross-command sem hard-coupling"
    - "Score table 5-row replicada — single source of truth distribuída entre command e agent"

key-files:
  created: []
  modified:
    - kit/commands/auditar-marco.md (+81/-1 linhas, puro additive; remoção é apenas marker "no newline at end of file")

key-decisions:
  - "Bloco <sre_integration> posicionado como última seção do arquivo (após </observability_integration>)"
  - "Default workflow.audit_milestone_toil=true para paridade com audit_milestone_omm=true (toil audit é não-bloqueante, sempre vale rodar)"
  - "Ordem canônica /auditar-toil ANTES /auditar-observabilidade para evitar omm-auditor delegar Task ad-hoc se TOIL-AUDIT.md ausente/stale"
  - "Tabela 5-row Capacidade 3 replicada em paridade com omm-auditor.md Step 1 (Phase 39 INT-OBS-02) — single source of truth distribuída para discovery cross-command"

patterns-established:
  - "Cross-ref Markdown literal entre command e agent ([eliminating-toil] skill + [toil-auditor] agent + [omm-auditor] agent) — descoberta natural sem hard-coupling"
  - "Auto-invocação de comando via Skill(skill='framework:<name>') gated por workflow.<flag> — paridade entre v1.9 (audit_milestone_omm) e v1.10 (audit_milestone_toil)"
  - "Anti-patterns prevenidos explicitados em bloco — 4 itens (skip / ignorar relatório / toil = pequeno / toil ≠ overhead)"
  - "Contraindicações para desligar gate explicitadas — 3 itens (solo dev / projeto ≤ 30d / repo bibliotecário sem ops)"

requirements-completed:
  - INT-FW-V2-03

duration: ~12min
completed: 2026-05-07
---

# Plano 40-03: Patch /auditar-marco — invocar /auditar-toil quando audit_milestone_toil=true

**Bloco `<sre_integration>` adicionado ao `/auditar-marco` — auto-invoca `/auditar-toil` antes de `/auditar-observabilidade`, fechando loop cap 5 SRE → omm-auditor Capacidade 3 (Phase 39 INT-OBS-02)**

## Performance

- **Duração:** ~12 min
- **Iniciado:** 2026-05-07T07:30:00Z (aprox)
- **Concluído:** 2026-05-07T07:42:00Z (aprox)
- **Tarefas:** 3 (T1 verificação âncora + T2 patch + T3 smoke validation)
- **Arquivos modificados:** 1 (`kit/commands/auditar-marco.md`)

## Realizações

- Bloco `<sre_integration>` adicionado como **última seção** do arquivo, após `</observability_integration>` v1.9 — coexistência v1.9 + v1.10
- Flag `workflow.audit_milestone_toil=true` (default) documentada com paridade ao `audit_milestone_omm=true`
- Loop fechado canônico documentado: `/auditar-marco → /auditar-toil → /auditar-observabilidade → omm-auditor consulta TOIL-AUDIT.md → score Capacidade 3 → MILESTONE-AUDIT.md inclui anexos`
- Justificativa "Por que rodar `/auditar-toil` ANTES" explicitada (regra `omm-auditor` Cap 3 score > 3 exige TOIL-AUDIT.md fresco ≤ 30d)
- Tabela 5-row Capacidade 3 (`% toil → score 1-5`) replicada em paridade com `omm-auditor.md` Step 1 (Phase 39 INT-OBS-02) — single source of truth distribuída
- 4 anti-patterns prevenidos listados (skip / ignorar / toil = pequeno / toil ≠ overhead)
- 3 contraindicações para desligar gate (solo / ≤ 30d / repo bibliotecário sem ops)
- Cross-refs Markdown ATIVOS: `[eliminating-toil]` skill + `[toil-auditor]` agent + `[omm-auditor]` agent
- Smoke sync propagou bloco para `.claude/commands/auditar-marco.md` (sync OK 279 artefatos)

## Commits das Tarefas

Patch executado como single commit atômico (puro editorial, sem TDD):

1. **T1+T2+T3 — patch <sre_integration>** — `19eb4dd` (feat)

**Diff:** `81 insertions, 1 deletion` (a "deleção" é apenas o marker "no newline at end of file" — patch é puramente aditivo).

## Arquivos Criados/Modificados

- `kit/commands/auditar-marco.md` — adicionado bloco `<sre_integration>` com 80 linhas (auto-invocação `/auditar-toil`, loop canônico, tabela score 5-row, anti-patterns, contraindicações, cross-refs, REQ ID INT-FW-V2-03)

## Decisões Tomadas

- **Posicionamento canônico do bloco** — após `</observability_integration>` v1.9 como última seção do arquivo. Garante coexistência de v1.9 (`<observability_integration>` OMM) + v1.10 (`<sre_integration>` Toil) sem conflito.
- **Default `true` para gate** — paridade com `audit_milestone_omm=true`. Toil audit é não-bloqueante (warns, não fails), então sempre vale rodar para alimentar OMM Cap 3.
- **Ordem canônica `/auditar-toil` ANTES `/auditar-observabilidade`** — `omm-auditor` (Phase 39 INT-OBS-02) tem regra absoluta "score Cap 3 > 3 exige TOIL-AUDIT.md fresco ≤ 30d". Se TOIL-AUDIT.md ausente/stale, `omm-auditor` delega Task ad-hoc — duplicação. Auto-invocar `/auditar-toil` em `/auditar-marco` evita.
- **Tabela 5-row replicada** — single source of truth distribuída entre `auditar-marco.md` (command) e `omm-auditor.md` Step 1 (agent). Paridade arquitetural com `four-golden-signals` skill replicada em `golden-signals-instrumenter` agent + `edge-fn-writer` agent (consistente com Phases 36-39).

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

**1. `.claude/commands/auditar-marco.md` é gitignored**

- **Encontrado durante:** primeira tentativa de commit
- **Problema:** `git add .claude/commands/auditar-marco.md` falhou com "paths are ignored by one of your .gitignore files"
- **Correção:** removido do `git add` — apenas `kit/commands/auditar-marco.md` precisa estar versionado; `.claude/commands/` é regenerado via `kit sync`
- **Verificação:** smoke sync re-rodado, propagação confirmada (`grep` em `.claude/commands/auditar-marco.md` retorna mesmas counts que `kit/commands/auditar-marco.md`)
- **Comitado em:** `19eb4dd` (apenas source `kit/commands/auditar-marco.md`)

## Configuração Manual Necessária

Nenhuma — patch é puramente editorial, zero side-effects de runtime.

## Prontidão para Próxima Fase

- Phase 40 Plan 03 fechado — 1 dos 3 plans Phase 40 concluído (Plans 01 e 02 são paralelos via outras worktrees)
- Loop fechado SRE v1.10 funcional: `/auditar-marco` → `/auditar-toil` (NEW v1.10) → `/auditar-observabilidade` (v1.9) → `omm-auditor` consome `.planning/TOIL-AUDIT.md` (Phase 39 INT-OBS-02 já patcheou) → score Cap 3 → `MILESTONE-AUDIT.md` inclui anexos
- INT-FW-V2-03 fechado integralmente
- Ready para Phase 41 (gates + docs) após Plans 40-01 e 40-02 fecharem

---
*Fase: 40-patches-em-fluxo-framework*
*Concluída: 2026-05-07*

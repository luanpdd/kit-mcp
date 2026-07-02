---
phase: 81-drift-cleanup
plan: 02
subsystem: docs
tags: [readme, drift, counters, hardcode]

requires:
  - phase: 79-critical-security-fixes
    provides: publish gates baseline (separate concern; this plan touches docs only)
provides:
  - README.md counters reflecting filesystem reality (47/87/49/20)
  - Drift recurrence ticket for v1.14 auto-gen documented
affects: [v1.14-roadmap, prepublishOnly-hook, future-release-publishing]

tech-stack:
  added: []
  patterns:
    - "Static substitution with explicit drift acknowledgment (will recur — v1.14 auto-gen ticket)"

key-files:
  created:
    - .planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md
  modified:
    - README.md

key-decisions:
  - "Static substitution (CONTEXT 'abordagem 1') chosen over auto-gen — auto-gen requires script + prepublishOnly wiring + CI gate (deferred to v1.14)"
  - "Per-suite counters (11 skills v1.9, 6 skills v1.10) preserved — they are correct semantics, not drift"
  - "Skill counter line 244 reworded from '1 skill (example only — bring your own)' to '49 skills (bundled workflow)' — old phrasing implied incipient project; reality is 49 foundational skills"

patterns-established:
  - "Drift as recurring debt: when static substitution is cheap-now / expensive-later, document explicit recurrence ticket pointing at automation hook"

requirements-completed:
  - DRIFT-13-02

duration: 1min
completed: 2026-05-09
---

# Phase 81 Plan 02: README Counts Drift Cleanup Summary

**Substituição estática de 10 contadores hardcoded em README.md (drift +147% / +45% / +4800% / +300%) pelos valores reais do filesystem (47 agents, 87 commands, 49 skills, 20 gates) — DRIFT-13-02 fechado.**

## Performance

- **Duração:** ~1 min (substituições paralelas + verificação + commit)
- **Iniciado:** 2026-05-09T05:28:07Z
- **Concluído:** 2026-05-09T05:29:14Z
- **Tarefas:** 2 (1 código + 1 documentação)
- **Arquivos modificados:** 1 (README.md)

## Realizações

- **10 contadores hardcoded substituídos** em 7 chamadas Edit paralelas (5×agents, 2×commands, 1×skills, 1×gates, 1×combined-1.9-aggregate)
- **Drift recurrence explicitly ticketed for v1.14** — auto-gen via bloco `<!-- AUTOGEN-COUNTS-START -->` + `scripts/update-readme-counts.js` + `prepublishOnly` hook (ver seção dedicada abaixo)
- **Zero regressão** — suíte 133 unit + 71 integration verde (README é doc puro, não toca código)
- **Per-suite counters preservados** — "11 skills v1.9", "6 skills v1.10", "8 IDEs" intactos (não eram drift, são semântica correta por-suíte)

## Commits das Tarefas

1. **Tarefa 1: Substituir 10 contadores hardcoded em README.md** — `a2760d1` (fix)
2. **Tarefa 2: Documentar drift recorrente** — embedded no SUMMARY abaixo (sem commit separado — pure documentation task)

## Arquivos Criados/Modificados

- `README.md` — 10 substituições atomic (5 ocorrências `19 agents` → `47`, 2× `60 commands` + 1× `60 slash-commands` → `87`, 1× `1 skill (example only)` → `49 skills (bundled workflow)`, 1× `5 gates` → `20 gates`, 1× `60+ slash-commands, 24+ agents` → `87+ slash-commands, 47+ agents`)

## Decisões Tomadas

- **Static substitution (CONTEXT 'abordagem 1')** chosen over auto-gen — auto-gen requires script + prepublishOnly wiring + CI gate (deferred to v1.14, see "Drift recorrente" section)
- **Skill counter rewording** — line 244 from `# 1 skill (example only — bring your own)` to `# 49 skills (bundled workflow)`. Original phrasing implied incipient project; new wording matches paridade com agents/commands.
- **Preservar per-suite counters** — "11 skills" da Suíte Observabilidade v1.9 e "6 skills" da Suíte SRE v1.10 são contadores **POR SUÍTE**, não totais do kit. São corretos e estáveis. Drift estava nos totais.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. As 10 substituições landaram como tabela em `<interfaces>` previa. Verificação automatizada (`node -e "..."`) retornou `OK: all counters updated` em primeira tentativa.

## Problemas Encontrados

Nenhum.

## Drift recorrente (deferido a v1.14)

**Problema:** Substituição estática vai driftar novamente no próximo release que adicionar/remover artefato em `kit/agents/`, `kit/commands/`, `kit/skills/`, ou `gates/`. Esse é o **terceiro ciclo de drift** documentado (v1.9, v1.10, v1.11/v1.12 acumulado), agora a +147%/+45%/+4800%/+300%. Sem automação, esse drift volta na primeira release que mexer em artefatos do kit.

**Causa raiz:** README é a primeira impressão de quem chega via npm/GitHub. Contadores hardcoded em 7 lugares + zero hook de validação = drift garantido a cada release. O problema escala linearmente com cadência de release × tamanho do kit.

**Solução proposta v1.14 (auto-gen):**

1. **Bloco AUTOGEN no README:** envelopar todas as ocorrências de contadores entre marcadores HTML:
   ```html
   <!-- AUTOGEN-COUNTS-START -->
   ... contadores aqui (regex-substituível) ...
   <!-- AUTOGEN-COUNTS-END -->
   ```

2. **Script `scripts/update-readme-counts.js`:**
   ```javascript
   // Pseudo-code:
   // 1. const counts = { agents: countFiles('kit/agents/*.md'), commands: ..., skills: ..., gates: ... }
   // 2. const md = readFileSync('README.md','utf8')
   // 3. const block = generateBlock(counts)
   // 4. writeFileSync('README.md', md.replace(/<!-- AUTOGEN-COUNTS-START -->[\s\S]*?<!-- AUTOGEN-COUNTS-END -->/g, block))
   ```

3. **Hook `prepublishOnly` em `package.json`:** já existe `prepublishOnly` — só adicionar `&& node scripts/update-readme-counts.js` na cadeia. Não tem custo runtime; só roda em `npm publish`.

4. **Gate em CI (`gates/readme-counts-fresh.md`):** verifica se counts hardcoded no README batem com filesystem; bloqueia PR se diff. Stage `pre-publish`.

**Estimated effort:** 2-3 hours (1 plan onda 1, autonomous execution viable).

**Trigger v1.14:** próximo milestone v1.14 deve incluir REQ explícito tipo `DRIFT-14-01: README counts auto-gen` (origem pode ser `/revisar-backlog` apontando para este SUMMARY como fonte).

**Por que não fazer agora:** abordagem 1 (substituição estática) era decisão CONTEXT.md — abordagem 2 (auto-gen) está fora do escopo de v1.13 hardening. v1.13 é fechar gaps de segurança críticos + replicate fix v1.12.1; auto-gen é trabalho de tooling que merece seu próprio plan.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária (mudança puramente em arquivo doc).

## Prontidão para Próxima Fase

- Phase 81.01 (CHANGELOG backfill) e Phase 81.03 (MCP version sync) podem rodar em paralelo — não tocam README, são domínios disjuntos
- Phase 81 está agora 1/3 plans concluído (este plan)
- Drift recurrence ticket documentado — quando v1.14 abrir, `/revisar-backlog` pode promover para REQ formal lendo este SUMMARY

## Self-Check: PASSED

- README.md exists: FOUND (modified inline)
- Commit a2760d1 exists: FOUND (`git log` shows it)
- All 7 new counter patterns present in README: FOUND (`grep` count = 7)
- All 7 old counter patterns removed: FOUND (`grep` count = 0)
- Test suite green: FOUND (133 unit + 71 integration)
- SUMMARY contains "Drift recorrente" section: FOUND (this section)
- SUMMARY mentions v1.14: FOUND (multiple references)
- SUMMARY mentions auto-gen + prepublishOnly: FOUND (this section)

---
*Fase: 81-drift-cleanup*
*Concluída: 2026-05-09*

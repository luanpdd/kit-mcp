---
phase: 39-patches-em-observabilidade-e-supabase
plan: 01
subsystem: observability
tags: [sre, slo, risk-management, error-budget, cross-skill-ref]

# Grafo de dependências
requires:
  - phase: 32
    provides: skill canônica event-based-slos (v1.9)
  - phase: 36
    provides: skill canônica sre-risk-management (v1.10) com tabela continuum
provides:
  - Bloco editorial "Risk continuum" injetado em event-based-slos
  - Cross-ref Markdown ativo entre skills v1.9 ↔ v1.10
  - Vocabulary mapping "sabedoria 99.99%" presente na skill v1.9
affects: [risk-budget, slo-engineer, omm-auditor, prr-conductor]

# Rastreamento de tecnologia
tech-stack:
  added: []  # patch editorial puro — sem deps novas
  patterns:
    - cross-skill reference via Markdown link relativo (../sibling-skill/SKILL.md)
    - frontmatter byte-idêntico em patches editoriais (anti-pitfall A2)

key-files:
  created: []
  modified:
    - kit/skills/event-based-slos/SKILL.md (+22 linhas, 0 deletions — patch puro de adição)

key-decisions:
  - "Posicionamento editorial — bloco entre Regras absolutas e Patterns canônicos (lugar natural fundacional)"
  - "Resumo + ponteiro em vez de duplicar tabela — skill canônica continua sre-risk-management"
  - "Smoke sync revalidado para v1.7+ stub-mode — patch vive no canonical, stub frontmatter byte-idêntico"

patterns-established:
  - "Cross-ref bidirecional skill v1.9 ↔ v1.10 — sre-risk-management já tem 'Ver também' apontando para event-based-slos; agora event-based-slos referencia sre-risk-management"
  - "Patch editorial puro — frontmatter inalterado, conteúdo existente intacto, apenas inserção de bloco contextual"

requirements-completed:
  - INT-OBS-01

# Métricas
duration: 8min
completed: 2026-05-07
---

# Plan 39-01: event-based-slos com bloco Risk continuum cross-ref sre-risk-management — Resumo

**Patch editorial em kit/skills/event-based-slos/SKILL.md inserindo bloco "Risk continuum — SLO target é decisão explícita" com tabela canônica de 5 linhas (99%–99.99%) + sabedoria 99.99% + cross-ref Markdown ativo para sre-risk-management; frontmatter byte-idêntico preservado.**

## Performance

- **Duração:** ~8 min
- **Iniciado:** 2026-05-07T07:00:00Z (aprox)
- **Concluído:** 2026-05-07T07:08:00Z (aprox)
- **Tarefas:** 3 (T1 verificação preparatória + T2 inserção + T3 validação smoke)
- **Arquivos modificados:** 1 (kit/skills/event-based-slos/SKILL.md)

## Realizações

- Bloco "Risk continuum — SLO target é decisão explícita" inserido **entre** `## Regras absolutas` e `## Patterns canônicos`
- Cross-ref Markdown literal `[sre-risk-management](../sre-risk-management/SKILL.md)` presente e válido (relative path resolve)
- Tabela continuum 5 rows (99% / 99.5% / 99.9% / 99.95% / 99.99%) com 4 colunas (Target, Tolerância 30d, User-perceptible, Quando faz sentido)
- Frase canônica "sabedoria 99.99%" presente — vocabulary mapping com livro Google SRE cap 3
- Error budget descrito como "balanço explícito risk × innovation" (linguagem cap 3)
- Frontmatter (`name`, `description`) **byte-idêntico ao pré-patch** — anti-pitfall A2 preservado
- Patch puro de adição: 22 insertions, 0 deletions (`git diff --numstat` confirmou)
- Cobertura de **INT-OBS-01** integral

## Commits das Tarefas

1. **T2: Insert Risk continuum block** — `ba47d99` (feat)
   - 22 linhas inseridas, zero deletadas
   - Mensagem: `feat(39-01-T2): patch event-based-slos com bloco Risk continuum + cross-ref sre-risk-management`

T1 e T3 foram tarefas de verificação/validação preparatória e pós-patch (não geram commits separados).

## Arquivos Criados/Modificados

- `kit/skills/event-based-slos/SKILL.md` — bloco "Risk continuum — SLO target é decisão explícita" inserido após `## Regras absolutas` e antes de `## Patterns canônicos`. Conteúdo: introdução conceitual + tabela continuum 5 rows + parágrafo sabedoria 99.99% + parágrafo error budget + parágrafo tiers diferenciados + nota de fechamento explicando regra `Target ≤ 99.95%` como consequência do continuum.

## Decisões Tomadas

- **Posicionamento editorial** — bloco entra entre `## Regras absolutas` e `## Patterns canônicos` (em vez de no final em "Ver também") porque risk continuum é regra fundacional do target, lógica antes de exemplos canônicos.
- **Resumo + ponteiro, não duplicação** — tabela continuum aparece resumida (5 rows essenciais) com ponteiro explícito para `sre-risk-management/SKILL.md` que tem a tabela completa (6 rows + custo relativo). Evita drift entre as duas skills.
- **Frase "sabedoria 99.99%" preservada literal** — vocabulary mapping com cap 3 do livro Google SRE. Permite descoberta cross-skill via grep.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

- **Smoke sync inicial via npx falhou silenciosamente** — `npx kit-mcp sync claude-code` não criou diretório de saída.
  - **Causa raiz:** plano usava sintaxe `sync claude-code` (pre-v1.7); CLI atual exige `sync install claude-code` (subcomando explícito).
  - **Resolução:** ajustada invocação para `node bin/cli.js sync install claude-code --project-root <tmp>` — sync funcionou normalmente (279 itens, claude-code OK).
- **Smoke sync esperava `grep -q "Risk continuum"` no arquivo synced** — mas v1.7+ usa stub-only sync mode (PROJECT.md histórico v1.7 confirma: "stub-only mode em sync (lê só frontmatter, não content body) → 3-5× mais rápido"). O stub correto carrega frontmatter byte-idêntico + ponteiro `Canonical source: kit/skills/event-based-slos/SKILL.md` + marker `<!-- kit-mcp:reference -->`. O conteúdo "Risk continuum" vive no canonical (que é o que o LLM consome via reference).
  - **Validação efetiva (revisada):** (a) stub frontmatter `description` byte-idêntico OK; (b) canonical source path resolve; (c) `grep "Risk continuum" kit/skills/event-based-slos/SKILL.md` → match. Critério de aceitação substantivo do plano cumprido (descoberta cross-skill funcional); literal do comando de smoke ajustado a contrato v1.7+.

## Configuração Manual Necessária

Nenhuma — patch editorial puro, sem configuração de serviço externo.

## Prontidão para Próxima Fase

- INT-OBS-01 fechado.
- Próximo plano da Onda 2 (Phase 39): 39-02 (omm-auditor cross-ref toil-auditor) — independente desta tarefa, executável em paralelo.
- Cross-ref bidirecional skill v1.9 ↔ v1.10 fechado: `sre-risk-management` já apontava para `event-based-slos` em "Ver também"; agora `event-based-slos` aponta de volta — loop fechado para descoberta LLM.

---
*Fase: 39-patches-em-observabilidade-e-supabase*
*Concluída: 2026-05-07*

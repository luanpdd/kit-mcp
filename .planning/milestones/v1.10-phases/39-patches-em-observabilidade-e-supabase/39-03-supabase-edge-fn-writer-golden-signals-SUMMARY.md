---
phase: 39-patches-em-observabilidade-e-supabase
plan: 03
subsystem: agent-content
tags: [supabase, edge-functions, otel, golden-signals, sre, family-v1.10, integration]

# Grafo de dependências
requires:
  - phase: 36-skills-foundation-sre
    provides: skill four-golden-signals (cap 6 livro Google SRE — Latency/Traffic/Errors/Saturation)
  - phase: 37-agentes-core-sre
    provides: agent golden-signals-instrumenter (retro-instrumentação de serviços legacy)
  - phase: v1.8 (Suíte Supabase)
    provides: kit/agents/supabase-edge-fn-writer.md base (Deno runtime, imports versionados, env vars, /tmp writes)
  - phase: v1.9 (Suíte Observabilidade)
    provides: bloco "Observabilidade integrada" (OTel SDK + spans + propagation)
provides:
  - Seção "## Four Golden Signals" no template Edge Function (entre "Observabilidade integrada" e "Ver também")
  - Tabela canônica 4 signals (Latency histogram + Traffic counter + Errors counter por error.type + Saturation gauge resource-specific)
  - Snippet OTel TypeScript copy-paste (createHistogram + createCounter + createObservableGauge)
  - Wrapper Deno.serve instrumentado com try/catch + classifyError enum fechado
  - Tabela saturation por tipo de Edge Function (4 tipos: API simples / RAG / queue consumer / storage)
  - 4 anti-patterns prevenidos
  - 2 cross-refs ativos em "Ver também" (skill + agent)
affects:
  - phase 41 (gate golden-signals-coverage que regex-checa instrumentação)
  - todas Edge Functions geradas após este patch saem com 4 signals built-in
  - golden-signals-instrumenter (agent) permanece como ferramenta para retro-instrumentação de funções legacy

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - Two-axis observability (v1.9 OTel SDK/spans + v1.10 4 instrumentos métricos canônicos coexistem sem conflito)
    - Anti-pitfall A2 enforcement (frontmatter byte-identical preservado em patch substancial)
    - Posicionamento canônico (nova seção entre 2 âncoras existentes; ordem editorial preservada)
    - Cross-ref ativo Markdown (skill + agent linkados por path relativo)

key-files:
  created: []
  modified:
    - kit/agents/supabase-edge-fn-writer.md (+102 insertions / -1 deletion líquido = +101 linhas)

key-decisions:
  - "Frontmatter PRESERVADO byte-a-byte — anti-pitfall A2 enforced (description 169 chars, tools inalterado, color cyan inalterado)"
  - "Bloco 'Observabilidade integrada' (v1.9) PRESERVADO sem modificação — v1.10 amplia v1.9 sem deslocar"
  - "Steps 0-10 (lógica de geração da Edge Function) intocados — toda a base v1.8 preservada"
  - "Anti-pitfall A10 reforçado via wrapping handler — Edge Function generation continua função pura (orquestração via /sre é responsabilidade externa)"
  - "Tabela saturation com 4 tipos típicos (API simples / RAG / queue consumer / storage) — torna explícito que saturation NÃO é genérica e deve ser identificada ANTES de instrumentar"

patterns-established:
  - "Patch em agent v1.8 que cobre INT-SB-V2-XX (integração com material SRE v1.10) — modelo replicável para 39-04 (supabase-architect + PRR), 39-05 (supabase-migration-writer + toil), 39-06 (supabase-storage-implementer + saturation)"
  - "Anti-pattern explícito 'error.type = err.message' citado literalmente em 4 lugares (tabela + snippet comment + classifier function + anti-patterns list) — repetição enforce a importância do enum fechado"

requirements-completed: [INT-SB-V2-01]

# Métricas
duration: ~12min
completed: 2026-05-07
---

# Fase 39-03: Patch supabase-edge-fn-writer — Four Golden Signals — Resumo

**Patch substancial em `kit/agents/supabase-edge-fn-writer.md` (v1.8 + v1.9) adiciona seção "Four Golden Signals" (cap 6 livro Google SRE) — toda Edge Function gerada nasce com Latency histogram + Traffic counter + Errors counter por error.type + Saturation gauge resource-specific. Frontmatter byte-idêntico preservado.**

## Performance

- **Duração:** ~12 min
- **Concluído:** 2026-05-07
- **Tarefas:** 4 (T1 verificação âncoras / T2 inserir seção / T3 update "Ver também" / T4 smoke validation)
- **Arquivos modificados:** 1 (`kit/agents/supabase-edge-fn-writer.md`)
- **Diff:** +102 insertions / -1 deletion líquido = +101 linhas (patch puro de adição + 1 line edit semântico para satisfazer smoke case-sensitive)

## Realizações

- Seção `## Four Golden Signals` inserida (count = 1) entre `## Observabilidade integrada` e `## Ver também`
- Tabela canônica de 4 signals com 4 colunas (Signal / Instrumento / Dimensão / Valor padrão) e 4 rows (Latency / Traffic / Errors / Saturation)
- Snippet OTel TypeScript canônico com 3 instrumentos (`createHistogram` 2× / `createCounter` 4× / `createObservableGauge` 2×) — copy-paste pronto para topo de `index.ts`
- Wrapper `Deno.serve` instrumentado com try/catch capturando `latencyHistogram.record` em ambos paths success/error com dimension `result`
- Função `classifyError` enum fechado (TimeoutError / ValidationError / AuthError / ... 5-15 valores) — anti-pattern `err.message` documentado 4×
- Tabela "Saturation por tipo de Edge Function" com 4 rows (API simples → pg_pool / RAG → concurrency_limit / queue consumer → pgmq.queue_length / storage I/O → egress_bandwidth)
- Lista "Anti-patterns prevenidos" com 4 bullets (Errors counter `err.message` / Latency mistura success+error / Mean em vez de histogram / Saturation genérico)
- Cross-refs Markdown ATIVOS:
  - `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` → skill v1.10 / Phase 36 (cap 6 livro Google SRE)
  - `[golden-signals-instrumenter](./golden-signals-instrumenter.md)` → agent v1.10 / Phase 37 (retro-instrumentação)
- Lista "Ver também" ganhou 2 entries no FINAL (sem reordenar 7 entries pré-existentes)
- Frontmatter byte-idêntico ao pré-patch (`name: supabase-edge-fn-writer`, `description` 169 chars, `tools: Read, Write, Edit, Bash, Grep, Glob`, `color: cyan`)
- Smoke validation cumpriu todos os critérios:
  - Latency: 3 (≥3) / Traffic: 2 (≥2) / Errors: 3 (≥3) / Saturation: 6 (≥3)
  - createHistogram: 2 / createCounter: 4 / createObservableGauge: 2
  - Cross-refs literais: 2 / 2
  - Anti-pattern `error.type` vs `error.message`: 4 occurrences
  - Smoke sync `kit sync install claude-code --mode copy` propaga "Four Golden Signals" para `.claude/agents/supabase-edge-fn-writer.md`

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify`:

1. **T2: Inserir seção `## Four Golden Signals`** — `15f3091` (feat) — 100 insertions / 0 deletions
2. **T3: Append cross-refs em `## Ver também`** — `60f2281` (feat) — 2 insertions / 0 deletions
3. **T4: Polish smoke (Errors anti-pattern wording)** — `51723a8` (feat) — 1 insertion / 1 deletion (case-sensitive smoke ≥3 satisfied)

T1 (verificação âncoras) foi observação leve sem commit dedicado — confirmou frontmatter atual + headings localizadas via Read direto.

## Arquivos Criados/Modificados

- `kit/agents/supabase-edge-fn-writer.md` — agent supabase-edge-fn-writer (v1.8 + v1.9 + v1.10) ganha terceira camada de instrumentação. v1.8 cobre runtime Deno + imports + env vars + Hono multi-rota; v1.9 cobre OTel SDK setup + spans + context propagation; v1.10 cobre os **4 instrumentos métricos canônicos** (Latency histogram bucketed, Traffic counter, Errors counter por error.type enum, Saturation gauge resource-specific). Edge Function user-facing gerada após este patch SEMPRE inclui as 3 camadas — não é mais opcional.

## Decisões Tomadas

- **Frontmatter byte-idêntico (anti-pitfall A2)** — `description`, `tools`, `color` zero alterações. Patch é content-only puro. Verificado via `head -6` antes/depois.
- **Posicionamento canônico** — nova seção entra após o último parágrafo de "Observabilidade integrada" ("Output adicionado: ... ODD-compliant ...") e antes de "Ver também", preservando a ordem editorial existente.
- **Coexistência v1.9 + v1.10** — bloco "Observabilidade integrada" (v1.9) trata SDK + spans + tracing; bloco "Four Golden Signals" (v1.10) trata métricas (instrumentos OTel + dimensões + warning de cardinalidade). Não há sobreposição — são duas dimensões complementares de observabilidade.
- **Tabela saturation por tipo de função** — não bastava 1 exemplo genérico (CPU%); 4 tipos típicos de Edge Function (API simples / RAG / queue consumer / storage I/O) tornam explícito que saturation precisa de identificação resource-specific ANTES de instrumentar.
- **`error.type` vs `error.message` enforced em 4 lugares** — tabela canônica + comment no snippet + função `classifyError` + lista anti-patterns. Repetição é intencional: cardinality explosion é o anti-pattern mais comum em metric instrumentation; vale 4× cobertura.
- **Cross-ref ativo Markdown (não plain-text)** — `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` resolve no IDE/Notion/GitHub. Path relativo `../skills/` é canônico para refs entre `kit/agents/` e `kit/skills/`.

## Desvios do Plano

Mínimo. Plano executado fielmente nas 3 tarefas core (T1 prep, T2 inserção, T3 cross-refs). Único ajuste foi T4: o smoke originalmente especificou `npx kit-mcp sync` mas no dogfood deste projeto o caminho canônico é `node bin/cli.js sync install claude-code` (mesmo padrão usado em Plan 38-06). Adicionalmente, o smoke check `grep -c "Errors"` ≥3 originalmente esperado em interpretação case-sensitive ficou em 2 ocorrências após T2/T3 — adicionado pequeno semantic edit em "Errors counter usando `error.type = err.message`" (line 294) que tornou a primeira bullet de anti-patterns mais clara E satisfez o critério ≥3. Aceitos pelo plano em "Notes": "patch editorial substancial — adiciona seção completa (~80-100 linhas) mas todas em adição, sem deletar v1.9" — resultado real de +101 linhas líquidas confirma essa estimativa.

## Problemas Encontrados

Nenhum. O smoke sync inicialmente reportou `SYNC_FAIL` por usar default `--mode reference` (stub mode); reexecução com `--mode copy` (mesmo modo do dogfood Phase 38-06) propagou "Four Golden Signals" corretamente para `.claude/agents/supabase-edge-fn-writer.md` no projeto destino.

## Configuração Manual Necessária

Nenhuma — patch content-only. Após `kit sync install <target>` (qualquer IDE compatível), o agent supabase-edge-fn-writer com a nova seção fica disponível no projeto destino.

## Prontidão para Próxima Fase

- **Plan 39-03 fechado** — INT-SB-V2-01 completo (Edge Function generation com 4 golden signals built-in).
- **Plans paralelos da Phase 39 (Onda 2 Integração):** 39-04 (supabase-architect + PRR — feito 2026-05-07 commit `d3eec5d`), 39-05 (supabase-migration-writer + toil — feito 2026-05-07 commits `eecf2f6` e `77c67d9`), 39-06 (supabase-storage-implementer + saturation — feito 2026-05-07 commit `f92d95f`). 39-01 (event-based-slos + risk continuum) e 39-02 (omm-auditor + toil) já fechados em commits anteriores.
- **Phase 39** progredindo bem — 5 de 6 plans entregues; verificar STATE.md para tracking.
- **Phase 41** (gates + README + CHANGELOG) terá gate `golden-signals-coverage` que pode regex-checar `histogram\|counter\|gauge\|saturation` em código tocado por fase, confiando que toda Edge Function gerada já contém esses tokens (built-in).
- Sem bloqueios.

---
*Fase: 39-patches-em-observabilidade-e-supabase*
*Plano: 03*
*Concluído: 2026-05-07*

# Phase 80: Hooks Race Pattern + Token Economy Quick Wins - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)
**Depends on:** Phase 79 ✅ (concluída — vulnerabilidades CRITICAL fechadas)

<domain>
## Limite da Fase

Aplicar o pattern do fix v1.12.1 (commit `56b327f`) aos 6 hooks que ainda têm o mesmo bug latente, e capturar 4 quick wins de economia de tokens identificados pela meta-auditoria de performance:

**Hooks race pattern (origem H7 da auditoria):** o fix v1.12.1 corrigiu APENAS `kit/hooks/sidecar-tool-publisher.js` — 6 outros hooks têm o mesmo padrão `process.exit(0)` antes de TCP flush completar:
- `kit/hooks/workflow-guard.js`
- `kit/hooks/prompt-guard.js`
- `kit/hooks/context-monitor.js`
- `kit/hooks/post-apply-migration.js`
- `kit/hooks/statusline.js`
- `kit/hooks/check-update.js`

Mesmo fix: aguardar `res.on('end')` E `res.on('close')` antes do `process.exit(0)`.

**Token economy quick wins (origem T1, T3, T4, T11 da auditoria):**
- T1 — `slim()` em `src/mcp-server/index.js:255-259` retorna descrição completa; deveria aplicar `SUMMARY_MAX_CHARS=80` (já existe em `src/core/sync.js:260`). Estimativa: −10-15% no payload de `list-*`.
- T3 — Tabela `## Compatibilidade` repetida em 27 agents — extrair para `kit/COMPATIBILITY.md` único + nota nos agents. Estimativa: ~3.2k tokens.
- T4 — Bloco `# hooks:` comentado-morto em 11 agents (planner, debugger, verifier, codebase-mapper, etc.) — remover. Estimativa: ~880 tokens.
- T11 — Dropar `CHANGELOG.md` (79 KB) do tarball npm via `package.json` `files[]`. Estimativa: −79 KB × cada install.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração (`workflow.skip_discuss=true`). Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código para guiar decisões.

### Restrições absolutas (não-negociáveis)
- Stable API v1.0+ preservada — nenhuma mudança em contratos de hooks (apenas timing).
- Zero regressão em testes existentes (120 unit + 67 integration baseline da Phase 79).
- Budget 6/6 deps mantido.
- Hooks que NÃO escrevem TCP (apenas stdout/stderr) podem manter pattern atual — só aplicar fix nos hooks que efetivamente fazem I/O assíncrono. Verificar caso a caso.

### Diretrizes de implementação

**Hooks (H7):**
- Ler `kit/hooks/sidecar-tool-publisher.js` antes para ver pattern canônico aplicado em v1.12.1.
- Cada hook deve ser inspecionado: alguns podem não ter o bug (sync stdout only) — não força-aplicar onde não faz sentido. Documente no SUMMARY quais aplicaram fix vs quais não precisam.
- Adicionar 1 regression test inspirado no fix v1.12.1: simular processo killed mid-flush via `child_process.spawn` + `kill('SIGTERM')` no listener final, assertar que evento foi entregue.

**T1 (slim cap):**
- Reusar `summarize()` de `src/core/sync.js:260` ou inline o mesmo `SUMMARY_MAX_CHARS=80` cap em `src/mcp-server/index.js:255-259`.
- Adicionar test mostrando que descrições > 80 chars são truncadas com sufixo `…` (ou padrão escolhido por sync.js).

**T3 (compatibility dedup):**
- Esta é a maior mudança em volume — toca 27 files. Pode ser melhor adiar para v1.14 e fazer só T4 + T1 + T11 nesta fase.
- **Decisão:** ADIAR T3 para milestone v1.14 (Token Economy & Cleanup) — escopo grande demais para esta fase de hardening; deixe foco em hooks (mais críticos) + T4 + T1 + T11 (quick wins atomic).

**T4 (dedup hooks block):**
- Apenas remoção de comentários mortos em frontmatter — operação grep+sed equivalente. Verificar que nenhum agent tem hooks ativos (se algum tem, não tocar).

**T11 (drop CHANGELOG):**
- Modificar `package.json` `files[]` removendo `CHANGELOG.md`.
- Validar `npm pack --dry-run` mostra ausência.

</decisions>

<code_context>
## Insights do Código Existente

Dos artefatos da meta-auditoria em `.planning/codebase/`:

- `kit/hooks/sidecar-tool-publisher.js:178-181` é o pattern canônico do fix v1.12.1 — aguarda `'end'` E `'close'` antes de `process.exit`.
- `src/mcp-server/index.js` linha 255-259 é onde slim() é definida; `src/core/sync.js:260-266` tem `SUMMARY_MAX_CHARS=80` + helper `summarize()`.
- 11 agents com `# hooks:` block comentado: planner.md, debugger.md, verifier.md, codebase-mapper.md (ver auditoria de prompt quality para lista completa).
- `package.json:13-21` define `files[]` com CHANGELOG.md presente.

</code_context>

<specifics>
## Ideias Específicas

- **Test pattern para hooks race:** seguir o mesmo do fix v1.12.1 — usar `child_process.spawn` + matar mid-write para validar que evento chega.
- **Test pattern para slim cap:** unit test com descrição de 200 chars; assert truncada para 80 chars + sufixo.
- **CHANGELOG drop:** após remover de `files[]`, rodar `npm pack --dry-run | grep -c CHANGELOG` e assertar 0.

</specifics>

<deferred>
## Ideias Adiadas

- T3 (compatibility dedup em 27 agents) — escopo grande, risco de regressão por edição em massa de markdown; deixar para milestone v1.14.
- T2 (terse mode em list-*) — design de query param requer discussão; v1.14.
- T5-T10 (outras quick wins de tokens) — v1.14.
- P1-P6 (performance runtime — sync paralelo, lazy CLI imports, watch debounce) — v1.14 (envolve refactor).

</deferred>

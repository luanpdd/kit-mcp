# Phase 85: Token Economy Wave 2 - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

Capturar 2 token wins identificados pela meta-auditoria que foram explicitamente deferred em v1.13:

**PERF-15-01 (T2 — terse mode em list-*):**
- Atualmente list-agents/list-commands/list-skills retornam `{kind, name, description}` para cada item.
- MCP clients que só precisam descobrir nomes (não descrições) recebem ~25 KB de descriptions desnecessárias.
- Solução: adicionar suporte a parâmetro `terse: true` (ou tool variant `list-*-terse`) que retorna apenas `{name, slug}`.
- Estimativa: -50% no payload de listagens quando ativo.

**PERF-15-02 (T3 — compatibility dedup em 27 agents):**
- 27 agents em `kit/agents/*.md` repetem tabela `## Compatibilidade` 6 linhas idêntica (5 IDEs todos "Full").
- Substituir por nota única "Compat: Full em todos os IDEs (filesystem-only). Veja kit/COMPATIBILITY.md para casos parciais."
- Tabela canônica vai para `kit/COMPATIBILITY.md` único.
- Estimativa: ~3.2k tokens economizados em sessões que carregam múltiplos agents.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — `terse` é aditivo (default false → comportamento atual). Schema atual não muda.
- Zero regressão em testes (273 baseline pós-v1.14).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**PERF-15-01 (terse mode):**
- Em `src/mcp-server/index.js` handlers list-*: aceitar `args.terse === true` e retornar versão minimal `{name, kind}` (sem `description`, sem `body`).
- Em `src/cli/index.js` equivalentes: `kit kit list-agents --terse` flag.
- Test: corpus real measurement; assert ≥40% redução no payload terse vs default.

**PERF-15-02 (compatibility dedup):**
- Identificar exatamente os 27 agents com `## Compatibilidade` (grep).
- Criar `kit/COMPATIBILITY.md` com tabela canônica única (extraída do conteúdo já presente).
- Substituir cada bloco `## Compatibilidade` em cada agent pela linha única "Compat: Full em todos os IDEs. Veja [COMPATIBILITY.md](../COMPATIBILITY.md)".
- Test: `grep -l "## Compatibilidade" kit/agents/*.md | wc -l` → 0; `kit/COMPATIBILITY.md` existe; conteúdo dos agents não perdeu informação semântica.

### Cuidados especiais
- **Edição em massa** dos 27 agents: usar Edit em batch (não regenerar files inteiros). Preservar todo o resto do agent (frontmatter, role, instructions, output_style etc).
- **Manifest impact:** após editar 27 agents, `kit/file-manifest.json` vai ficar stale (Phase 83 verifyManifest vai bloquear sync). Plan DEVE incluir regen do manifest como última task antes do test integration.
- **Reverse-sync impact:** se algum agent já foi reverse-synced para alguma IDE pelo user, o conteúdo divergente. Documentar isso no SUMMARY como nota não-bloqueadora (user pode reverse-sync de novo).

</decisions>

<code_context>
## Insights do Código Existente

- `src/mcp-server/index.js` slim() (post-v1.13 PERF-13-01) já tem cap de 80 chars em description — terse mode é nível adicional (zero description em vez de truncate).
- `src/core/sync.js` summarize() helper exportado em v1.13 — pode ser reutilizado se necessário.
- 27 agents — confirmar contagem com `grep -l "## Compatibilidade" kit/agents/*.md | wc -l`.

</code_context>

<specifics>
## Ideias Específicas

- **Terse vs verbose mapping:** `verbose` (default false) também poderia ser flag, mas mantém complexidade alta. Decisão: só `terse` flag, default = atual (com slim cap de 80 chars).
- **Tool variant vs param:** preferir param (`terse: true`) sobre tool name novo (`list-agents-terse`) — menos surface, schema muda menos.

</specifics>

<deferred>
## Ideias Adiadas

- Stream chunked listings — overengineering para listings que tipicamente são <100 items.
- Diff-based sync (only changed agents) — separate problem, v1.16+.

</deferred>

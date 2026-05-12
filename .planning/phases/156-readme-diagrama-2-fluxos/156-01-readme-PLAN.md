# 156-01 — README diagrama 2 fluxos

**Goal:** Adicionar section "How kit-mcp works (mental model)" ao README com diagrama de 2 fluxos, tabela "quando uso o quê", e subsection "Why no terminal output?".

## Tasks

1. Localizar insertion point no README.md (após "Why this exists", antes de AUTOGEN-COUNTS)
2. Escrever section "## How kit-mcp works (mental model)" com:
   - Parágrafo introdutório explicando os 2 fluxos
   - Diagrama ASCII Fluxo A (offline projector)
   - Diagrama ASCII Fluxo B (live MCP server)
   - Tabela "Quando uso o quê" (5 colunas)
   - Subsection "### Why no terminal output when I run `kit-mcp`?"
3. Editar README.md com Edit tool
4. Verificar render (sem mermaid, ASCII-art puro)
5. Commit atômico

## REQs

- REQ-156-01, REQ-156-02, REQ-156-03

## Verificação

- `grep -c "How kit-mcp works" README.md` → 1
- `grep -c "Why no terminal output" README.md` → 1
- Tabela tem 5 colunas e ≥ 4 linhas
- Diagramas ASCII renderizam em monospace

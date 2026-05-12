# 156-CONTEXT.md — README diagrama 2 fluxos

**Fase:** 156
**Milestone:** v1.28 UX & Onboarding
**Effort:** XS
**Wave:** 1

## Dor reportada

Usuário não entende a diferença entre `kit sync` (projetor offline) e `kit-mcp` (servidor stdio live). Quando roda `kit-mcp` no terminal, não vê nenhum output e assume que está quebrado. Spec MCP proíbe stdout fora do JSON-RPC, mas o README não explica isso em lugar nenhum.

## Decisões

- Inserir nova section "## How kit-mcp works (mental model)" logo após "Why this exists"
- Usar diagrama ASCII (mermaid não renderiza em npm/github tab consistente)
- Tabela com 5 colunas: ação | fluxo | comando | quando rodar | quem consome
- Section "Why no terminal output?" como subsection

## REQs cobertos

- REQ-156-01 — section "How kit-mcp works" com diagrama 2 fluxos
- REQ-156-02 — tabela "quando uso o quê"
- REQ-156-03 — section "Why no terminal output?"

## Cobertura

100% dos 3 REQs em 1 plano.

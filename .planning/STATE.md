# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: 11 (não iniciada — roadmap criado, aguardando `/discutir-fase`)
Plano: —
Status: Roadmap v1.2 criado. 56 REQs mapeados em 8 fases (11–18).
Última atividade: 2026-05-04 — ROADMAP.md escrito + Rastreabilidade preenchida em REQUIREMENTS.md

## Milestone ativo

**v1.2 — GUI sidecar de acompanhamento** (web localhost + SSE).

Decisões de stack já fechadas:
- HTTP + SSE puro Node, sem Express, sem Vite
- HTML/JS estático servido pelo próprio kit-mcp
- Abertura manual (`kit ui`) + auto-spawn opt-in via flag MCP
- +1 dep máxima (`open@11`)
- Stable API v1.0+ preservada — apenas adições

Fases:
- Fase 11 — Lock arquitetural & gates de PR (decisão pura)
- Fase 12 — Fundações sem I/O (events + port + lockfile)
- Fase 13 — Servidor HTTP standalone + SSE endpoint
- Fase 14 — UI estática (HTML/CSS/JS single-file)
- Fase 15 — Cliente publisher + wrapper + browser-open
- Fase 16 — Integração CLI (`kit ui` + auto-detect)
- Fase 17 — Integração MCP server (`--auto-spawn` flag)
- Fase 18 — Hardening + smoke cross-platform + release 1.2.0

## Próximo passo

Fase 11 — `/discutir-fase` para Lock arquitetural & gates de PR.

## Bloqueadores

(nenhum)

## Todos pendentes

(vazio — captura via `/adicionar-tarefa` ou `/nota`)

## Histórico

- v1.0.0 — concluído 2026-05-03 (`.planning/milestones/v1.0.0/`)
- v1.1.0 — concluído 2026-05-03 (`.planning/milestones/v1.1.0/`)
- v1.2.0 — em planejamento (iniciado 2026-05-04, roadmap criado 2026-05-04)

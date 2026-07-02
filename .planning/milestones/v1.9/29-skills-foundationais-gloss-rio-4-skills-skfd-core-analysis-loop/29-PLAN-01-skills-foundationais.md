---
phase: 29
plan: 01
title: Skills foundationais — glossário + 4 SKFD
goal: Criar 5 artefatos editoriais em kit/skills/ documentando observabilidade conforme livro Observability Engineering caps 1, 5, 6, 7, 8
status: in_progress
covers_reqs: [GLOS-01, GLOS-02, GLOS-03, SKFD-01, SKFD-02, SKFD-03, SKFD-04]
---

# Plan 01: Skills foundationais — glossário + 4 skills SKFD

## Objetivo

Escrever 5 artefatos editoriais em `kit/skills/`:

1. `kit/skills/_shared-observability/glossary.md` — glossário compartilhado bilíngue (não vira skill — precedente `_shared-supabase`)
2. `kit/skills/structured-events/SKILL.md` — wide events
3. `kit/skills/distributed-tracing/SKILL.md` — trace_id/span_id, W3C TraceContext, stitching
4. `kit/skills/opentelemetry-standard/SKILL.md` — OTel SDK, OTLP
5. `kit/skills/core-analysis-loop/SKILL.md` — debug iterativo

## Tarefas

| # | Task | Arquivo | REQ |
|---|------|---------|-----|
| 1 | Criar diretório `_shared-observability/` e escrever `glossary.md` com termos PT-BR↔EN, comandos canônicos, anti-patterns | `kit/skills/_shared-observability/glossary.md` | GLOS-01, GLOS-02, GLOS-03 |
| 2 | Criar diretório `structured-events/` e escrever `SKILL.md` (template 5 seções) | `kit/skills/structured-events/SKILL.md` | SKFD-01 |
| 3 | Criar diretório `distributed-tracing/` e escrever `SKILL.md` (template 5 seções) | `kit/skills/distributed-tracing/SKILL.md` | SKFD-02 |
| 4 | Criar diretório `opentelemetry-standard/` e escrever `SKILL.md` (template 5 seções) | `kit/skills/opentelemetry-standard/SKILL.md` | SKFD-03 |
| 5 | Criar diretório `core-analysis-loop/` e escrever `SKILL.md` (template 5 seções) | `kit/skills/core-analysis-loop/SKILL.md` | SKFD-04 |
| 6 | Smoke: rodar `kit sync claude-code --project-root <tmpdir>` 2× e diff | — | crit-4 |
| 7 | Verificar `description ≤ 200 chars` em todas (anti-pitfall A2) | — | crit-5 |

## Depende de

— (primeira fase do milestone, sem deps)

## Validação

- 5 arquivos existem
- Frontmatter válido nas 4 SKILL.md (`name`, `description`)
- `description` ≤ 200 chars em cada
- Glossário NÃO listado em `listKit` (precedente `_shared-supabase`)
- Sync idempotente (rodada 2× = byte-idêntico)
- CLAUDE.md gerado cresce ≤ +0.8 KB

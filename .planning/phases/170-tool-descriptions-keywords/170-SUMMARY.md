# 170-SUMMARY.md — Tool descriptions enriquecidas (concluída)

**Entregue:** 2026-05-12

## O que mudou

- Tool `kit` (era 47 chars → agora 596): lista explícita de trigger keywords — Supabase + RLS + branching + migrations + Edge Functions + Custom Claims + Postgres Roles + multi-tenant + agentic harness + characterization tests + legacy refactor + observability + SLO + DDIA + SRE + CI/CD
- Tool `auto-install` (era 218 → 499): nova descrição prioriza "IMPORTANT for first contact" para o harness identificar early
- Novo script `scripts/check-tool-descriptions.mjs` valida que nenhuma descrição ultrapassa 1024 chars (limite de hosts)

## Outras tools mantidas

- `sync`, `reverse-sync`, `gates`, `forensics`, `install`, `metrics-snapshot`, `ack-restart` — não enriquecidas; descrições já são objetivas

## Validação

```
$ node scripts/check-tool-descriptions.mjs
kit                   596 chars
sync                   77 chars
reverse-sync           74 chars
gates                  78 chars
forensics              73 chars
install                92 chars
metrics-snapshot      100 chars
auto-install          499 chars
ack-restart           246 chars

9 tools, 0 over 1024 chars
```

## REQs validados

- REQ-170-01 ✓ — `kit` description com lista de trigger keywords
- REQ-170-02 ✓ — todas as descriptions < 1024 chars (validado por script)
- REQ-170-03 ✓ — outras tools mantém descrições objetivas (sem inflação desnecessária)
- REQ-170-04 ✓ — modo MCP puro mais usável — Claude reconhece "Supabase/RLS/refactor/SLO" e roteia via `kit search`/`kit get`

## Próxima fase

171 — `kit doctor` sync drift check.

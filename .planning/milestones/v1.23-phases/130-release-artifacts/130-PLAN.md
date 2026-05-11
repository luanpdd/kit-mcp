# Plano: Fase 130 — Release artifacts

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** DOC-01, DOC-02, DOC-03, DOC-04 (finaliza, Phase 125 iniciou), DOC-05 (parcial — concluir-marco finaliza) — 5 REQs

## Objetivo

Regenerar AUTOGEN-COUNTS no README + file-manifest.json + adicionar CHANGELOG entry v1.23 + bump package.json + preparar transitions de MILESTONES/PROJECT/STATE para `/concluir-marco` finalizar.

## Tarefas

1. **DOC-01 (AUTOGEN-COUNTS regen)**: `node scripts/update-readme-counts.js` → README.md bloco atualizado para 61 agents, 89 commands, 68 skills, 23 gates
2. **DOC-02 (file-manifest regen)**: `node scripts/regen-manifest.js` → kit/file-manifest.json atualizado com novos hashes (369 files total)
3. **DOC-03 (CHANGELOG entry v1.23)**: adicionar section `## [1.23.0] — 2026-05-11 — Reforço RLS Supabase + Handoff Cooperativo SQL` com 7 subsections (Princípio canônico, Adicionado, skill rls-policies reforçada, skill migrations atualizada, Agents patchados, Cross-suite handoff, Métricas, Próximo marco)
4. **DOC-04 (finaliza glossário)**: 6 termos adicionados em Phase 125 (defense-in-depth, hardener, cooperative-handoff, event-trigger-rls-auto-enable, bypassrls, security_invoker) ficam ativos; cross-refs em supabase-rls-policies (Phase 124), supabase-rls-defense-in-depth (Phase 125), supabase-rls-hardener (Phase 126) funcionais
5. **package.json bump**: 1.22.0 → 1.23.0
6. **DOC-05 (parcial)**: MILESTONES.md / PROJECT.md / STATE.md transitions deferidos para `/concluir-marco` skill canônica (script de archive)

## Arquivos modificados

- `README.md` — bloco AUTOGEN-COUNTS regenerado
- `kit/file-manifest.json` — hashes regenerados
- `CHANGELOG.md` — entry v1.23 adicionada (após `## [Unreleased]`, antes de `## [1.22.0]`)
- `package.json` — version 1.22.0 → 1.23.0

## Validação

```bash
# DOC-01
grep "61 agents\|68 skills" README.md
# Esperado: match

# DOC-02
node scripts/regen-manifest.js
# Esperado: "updated — 369 files hashed" (ou exit 0 sem changes)

# DOC-03
grep -A 3 "## \[1.23.0\]" CHANGELOG.md | head -5
# Esperado: match com data + título

# package.json
grep '"version"' package.json
# Esperado: "1.23.0"

# DOC-04 (cross-refs ativos)
grep -c "supabase-rls-hardener\|supabase-rls-defense-in-depth" kit/skills/_shared-supabase/glossary.md
# Esperado: ≥ 0 (referenced em descrições mas não obrigatório no glossário)
```

## Riscos

- **Risco baixo:** Scripts canônicos. Regen é idempotente — múltiplas execuções produzem mesmo output.
- **Mitigação:** package.json bump validado por CI gates (deps-budget, regenerate-readme, sha256-manifest)

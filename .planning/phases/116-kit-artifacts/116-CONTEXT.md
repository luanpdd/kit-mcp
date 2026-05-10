# Fase 116: Kit Artifacts - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento (parcialmente entregue na Onda 1)
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Artefatos cross-cutting da Suíte Multi-Tenant SaaS B2B v1.21:

1. Comando `/multi-tenant` orquestrador com 11 subcomandos + sinônimos PT/EN
2. Glossário `kit/skills/_shared-multi-tenant/glossary.md` com cross-ref ATIVO para `_shared-supabase/glossary.md`
3. 3 audit gates novos:
   - `multi-tenant-rls-coverage` (CREATE TABLE sem ENABLE RLS = BLOCK)
   - `service-role-not-in-user-facing` (Edge Function user-facing com service_role = BLOCK)
   - `dept-cycle-prevention` (departments com parent_id sem trigger anti-cycle = BLOCK)
4. Release artifacts: README + AUTOGEN-COUNTS + file-manifest.json + COMPATIBILITY.md (DEFERIDO para concluir-marco final, após todas as outras phases criarem suas skills/agents)

REQs cobertos: SUITE-01, SUITE-04, SUITE-05, SUITE-07 nesta entrega; SUITE-02, SUITE-03 dependem das outras phases (rastreáveis); SUITE-06 + TEST-01..03 são cobertos no concluir-marco.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via workflow.skip_discuss=true. Decisões guiadas por:
- Pattern do `/supabase` v1.8 como template para `/multi-tenant`
- Pattern do `_shared-supabase/glossary.md` como template para `_shared-multi-tenant/glossary.md`
- Pattern do `gates/no-personal-uuid.md` + `gates/golden-signals-coverage.md` como templates para os 3 gates novos (frontmatter + bash 3.2-portable + skip gracioso)

### Decisões cristalizadas pela pesquisa (vinculantes)
- 11 subcomandos com sinônimos PT/EN (mapeados para 10 agents da suíte)
- Cross-Suite Invocation Pattern documentado explicitamente no command (introdução nova v1.21)
- Glossário tem cross-ref ATIVO para `_shared-supabase` — não duplica termos já definidos
- Gates são bash 3.2-portable, skip gracioso quando projeto não tem migrations/functions

### Release artifacts deferidos
README + AUTOGEN-COUNTS + file-manifest.json + COMPATIBILITY.md serão regenerados no `/concluir-marco` após todas as 13 skills + 10 agents existirem (regen tira contagens reais do disk).

</decisions>

<code_context>
## Insights do Código Existente

- `kit/commands/supabase.md` (v1.8) — template para orquestrador `/multi-tenant`
- `kit/skills/_shared-supabase/glossary.md` (v1.8) — template para glossário multi-tenant
- `gates/no-personal-uuid.md`, `gates/golden-signals-coverage.md` — templates para gates novos
- `tools.cjs commit` — pattern de commit atômico já usado nas outras phases

</code_context>

<specifics>
## Ideias Específicas

Cross-Suite Invocation Pattern é o padrão NOVO desta v1.21 — documentar explicitamente no command + glossário. Outras suítes futuras (v2.x) podem reutilizar esse pattern.

</specifics>

<deferred>
## Ideias Adiadas

- README.md (seção 6ª suíte) — geração no `/concluir-marco` final
- AUTOGEN-COUNTS regen — script existente regenera ao contar disk
- file-manifest.json regen — script existente
- COMPATIBILITY.md update — manual no `/concluir-marco`

</deferred>

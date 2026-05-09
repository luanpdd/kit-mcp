# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.15 — DX & Token Economy Wave 2 (Fases 85-87)

**Milestone:** v1.15 — DX & Token Economy Wave 2 (fecha os 5 tech debt items deferred de v1.13/v1.14)
**Numeração de fases:** continua de v1.14 (último concluído: Fase 84) → v1.15 começa em **Fase 85**
**Total de fases:** 3 (Fases 85-87)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** tech debt explicitamente listado em `.planning/milestones/v1.13-MILESTONE-AUDIT.md` + `v1.14-MILESTONE-AUDIT.md`. Itens não-segurança (DX + token economy + CI ergonomics) que ficaram fora do escopo das ondas anteriores de hardening.
[Detalhes](./milestones/v1.15-ROADMAP.md)

### Phase 85: Token Economy Wave 2

**Goal:** Capturar os 2 últimos token wins identificados pela meta-auditoria que foram explicitamente deferred em v1.13 — terse mode para listings (T2) e dedup da tabela `## Compatibilidade` repetida em 27 agents (T3).
**Plans:** 2 plans (ambos onda 1, paralelos — files disjoints)

Plans:
- [x] 85-01-terse-mode-PLAN.md — terse:true em handleKit + --terse flag CLI + 4 regression tests (PERF-15-01)
- [ ] 85-02-compatibility-dedup-PLAN.md — kit/COMPATIBILITY.md canonical + edita 27 agents + regen file-manifest.json + 3 regression tests (PERF-15-02)

**Escopo:**
- `src/mcp-server/index.js` + `src/cli/index.js` — adicionar suporte a `?terse=true` (ou tool variant `list-*-terse`) em `list-agents`/`list-commands`/`list-skills` que retorna apenas `name + slug` (sem description), permitindo MCP clients listar nomes sem inflar contexto.
- `kit/COMPATIBILITY.md` (novo) — extrair tabela canônica de compatibilidade IDE×capability.
- 27 agents em `kit/agents/*.md` — substituir tabela inline por referência única "Compat: ver `kit/COMPATIBILITY.md`".

**Critérios de sucesso:**
- `list-agents?terse=true` retorna payload ≥40% menor que default (medido em corpus real).
- `kit/COMPATIBILITY.md` existe e contém tabela canônica.
- `grep -l "## Compatibilidade" kit/agents/*.md | wc -l` retorna 0 (substituído pela referência).
- Suite continua passando + 4+ regression tests.

### Phase 86: Drift Auto-Prevention

**Goal:** Eliminar 2 fontes de drift recorrente que v1.13 mitigou estaticamente — README counters drift e manifest staleness — automatizando a regeneração via `prepublishOnly` hook.

**Depends on:** Phase 85

**Escopo:**
- `scripts/update-readme-counts.js` (novo) — lê `kit/agents/*.md`, `kit/commands/*.md`, `kit/skills/**/SKILL.md`, `gates/*.md`; conta; substitui bloco `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->` no README.md.
- `scripts/regen-manifest.js` (novo) — regenera `kit/file-manifest.json` com SHA256 de cada arquivo em kit/; salva com schema atual.
- `package.json:prepublishOnly` — chamar ambos scripts antes do test suite; commit drift se houver (em CI: fail se diff != empty para forçar manual review).
- README.md — adicionar bloco `<!-- AUTOGEN-COUNTS-... -->` substituindo contadores estáticos da v1.13.

**Critérios de sucesso:**
- `scripts/update-readme-counts.js` standalone roda sem erro e produz output esperado (counts reais).
- `scripts/regen-manifest.js` standalone produz manifest idêntico a `kit/file-manifest.json` atual (zero mudanças quando rodado em estado limpo).
- `package.json prepublishOnly` chama ambos scripts antes dos tests.
- README.md tem bloco AUTOGEN delimitado (testável via grep).
- Suite continua passando + 4+ regression tests.

### Phase 87: CI Matrix Expansion (8 IDEs)

**Goal:** Eliminar gap em `.github/workflows/ci.yml` onde só `claude-code` é exercitado em CI matrix — outros 7 IDEs (cursor, codex, gemini, windsurf, antigravity, copilot, trae) regridem em silêncio se sync workflow quebra para algum deles.

**Depends on:** Phase 85

**Escopo:**
- `.github/workflows/ci.yml` — adicionar matrix axis `target: [claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae]` no smoke job; parameterizar comandos `kit sync install/remove` para usar `${{ matrix.target }}`.
- Verificar que cada target tem path resolution válido em `src/core/registry.js`. Se algum target tiver bug específico revelado pela expansion → fix dentro desta fase.

**Critérios de sucesso:**
- CI matrix em ci.yml tem 9 targets axis × 3 OS × 3 Node = 72 runs (ou subset configurado).
- Cada target consegue completar `kit sync install <target> --target <ws>` + `kit sync remove <target> <ws>` round-trip sem erro.
- Workflow file passa YAML lint.
- Suite continua passando.



<details>
<summary>✅ Concluídos</summary>

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- v1.8.0 — Suíte Supabase (Phases 25-28)
- v1.9.0 — Observabilidade (Phases 29-35)
- v1.10.0 — SRE Engagement (Phases 36-41)
- v1.11.0 — SRE Resilience & Release Engineering (Phases 42-47)
- v1.12 — Legacy Code Mastery & AI-Era Refactoring (Phases 48-78) — entregue out-of-band
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — entregue 2026-05-09 09:24Z. 11 REQs (SEC-13-01..05, PERF-13-01..03, DRIFT-13-01..03), 33 testes novos, 210 baseline. Origem: meta-auditoria com 12 agentes paralelos sobre v1.12.1. [Detalhes](./milestones/v1.13-ROADMAP.md) · [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — entregue 2026-05-09. 6 REQs (SEC-14-01..06), 63 testes novos, 273 baseline final. Continuação direta da v1.13 — fechou as 6 issues HIGH deferidas. [Detalhes](./milestones/v1.14-ROADMAP.md) · [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)

</details>

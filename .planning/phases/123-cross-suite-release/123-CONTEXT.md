# Fase 123: Cross-Suite Integration + Release Artifacts — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

Fase final do milestone v1.22 (Suíte DDIA Foundations). Contém **2 grupos de entregáveis**:

1. **12 patches de cross-suite integration** (appendix sections, NÃO refactor) em skills/agents existentes (v1.8 + v1.11 + v1.21):
   - 8 patches em skills (CROSS-01..08): adicionam seções `## ... (v1.22+)` com cross-ref ATIVO via Markdown link relativo para skills v1.22 (`tenant-quente-mitigacao`, `escolha-modelo-consistencia`, `postgres-isolamento-concorrencia`, `armadilhas-sistemas-distribuidos`, `streams-eventos-cdc`, `evolucao-schema-compativel`).
   - 4 patches em agents (CROSS-09..12): adicionam seções que ativam handoff cross-suite para skills/agents v1.22 (auto-validação, detecção opt-in, default behavior).

2. **5 release artifacts** (DOC-01..05):
   - DOC-01: AUTOGEN-COUNTS regen (no `README.md` root, NÃO em `kit/AUTOGEN-COUNTS.md` — esse arquivo não existe; counts vivem no bloco `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->` do README via `scripts/update-readme-counts.js`).
   - DOC-02: file-manifest.json regen via `node scripts/regen-manifest.js` (computa SHA256 normalizado CRLF→LF de todos os arquivos em `kit/`, idempotente — só rewrite se mudou).
   - DOC-03: Seção "Suíte DDIA Foundations (v1.22)" no `kit/README.md`.
   - DOC-04: Entry `[1.22.0] - 2026-05-10 — Suíte DDIA Foundations` no topo do `CHANGELOG.md` root.
   - DOC-05: Verificação que `kit/skills/_shared-dados-distribuidos/glossary.md` seção (i) "Convenção de naming PT-BR (a partir de v1.22)" existe (já criada na Phase 117 — apenas validar).

REQs cobertos: CROSS-01..12 + DOC-01..05 = **17 critérios**.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via `workflow.skip_discuss=true`. Decisões guiadas por:

- Pattern v1.21 herdado: cross-ref ATIVO via Markdown link relativo (`../skill-name/SKILL.md`, `../skills/<name>/SKILL.md`, `../agents/<name>.md`).
- **NÃO refactor**: APPEND seções novas no FINAL do arquivo (antes de "Ver também" se existir, senão no fim absoluto). Sem reordenamento, sem alteração de seções existentes.
- Naming convenção v1.22: skills/agents NOVOS usam PT-BR; skills/agents EXISTENTES (v1.8, v1.11, v1.21) preservam EN/PT-BR original — apenas appendix em PT-BR é adicionado.
- Cross-suite invocation pattern (v1.21 herdado): agents v1.22 detectam, agents v1.8 escrevem fix. Os patches CROSS-09..12 documentam handoff bidirecional explicitamente (ex: `supabase-migration-writer` v1.8 invoca `validador-evolucao-schema` v1.22 ANTES de escrever migration arriscada).

### Decisões cristalizadas pela pesquisa (vinculantes)

**8 patches em skills (CROSS-01..08):**
- CROSS-01 → `multi-tenant-performance-scaling/SKILL.md` — appendix "Detecção e Mitigação de Tenant Quente (v1.22+)" linkando `tenant-quente-mitigacao`.
- CROSS-02 → `multi-tenant-rls-hierarchy/SKILL.md` — appendix "Invariantes Linearizáveis Cross-Tenant (v1.22+)" linkando `escolha-modelo-consistencia`.
- CROSS-03 → `crm-lead-pipeline-patterns/SKILL.md` — appendix "Prevenção de Lost Update em Stage Transition (v1.22+)" linkando `postgres-isolamento-concorrencia` + SQL `SELECT FOR UPDATE` exemplo.
- CROSS-04 → `super-admin-platform-pattern/SKILL.md` — appendix "Fencing Token para TTL de Impersonação (v1.22+)" linkando `armadilhas-sistemas-distribuidos`.
- CROSS-05 → `cascading-failures/SKILL.md` — appendix "Clock Skew como Failure Mode (v1.22+)" linkando `armadilhas-sistemas-distribuidos`.
- CROSS-06 → `audit-log-multi-tenant/SKILL.md` — appendix "Semântica Event Sourcing + Log Compaction (v1.22+)" linkando `streams-eventos-cdc`.
- CROSS-07 → `supabase-cron-queues/SKILL.md` — appendix "Padrões Exactly-Once em pgmq (v1.22+)" linkando `streams-eventos-cdc`.
- CROSS-08 → `supabase-migrations/SKILL.md` — appendix "Padrão Rolling-Upgrade para Migrations Arriscadas (v1.22+)" linkando `evolucao-schema-compativel` + agent `validador-evolucao-schema`.

**4 patches em agents (CROSS-09..12):**
- CROSS-09 → `supabase-architect.md` — appendix "Pergunta de Modelo de Consistência (v1.22+)" com árvore de decisão 2 perguntas linkando `escolha-modelo-consistencia`.
- CROSS-10 → `supabase-migration-writer.md` — appendix "Auto-Validação de Schema Evolution (v1.22+)" com `Task(subagent_type="validador-evolucao-schema", ...)` opt-in pattern.
- CROSS-11 → `multi-tenant-isolation-auditor.md` — appendix "Detecção de Hot Tenant Gap (v1.22+)" com `Task(subagent_type="detector-tenant-quente", ...)`.
- CROSS-12 → `crm-pipeline-implementer.md` — appendix "SELECT FOR UPDATE em Stage Transition (v1.22+ — default agora)" com SQL exemplo gerado.

**5 release artifacts (DOC-01..05):**
- DOC-01: rodar `node scripts/update-readme-counts.js` → atualiza bloco AUTOGEN-COUNTS no `README.md` root. Counts esperados (calculados pelo script, não hardcoded): agents=60, commands=89, skills=67, gates=23.
- DOC-02: rodar `node scripts/regen-manifest.js` → atualiza `kit/file-manifest.json` com hashes SHA256 normalizado CRLF→LF de todos arquivos em `kit/`. Bump version do manifest para `1.22.0` automaticamente via `package.json`.
- DOC-03: APPEND seção "Suíte DDIA Foundations (v1.22)" no fim de `kit/README.md` (mantém o arquivo template original — apenas adiciona seção descritiva da nova suíte).
- DOC-04: APPEND entry `[1.22.0] - 2026-05-10 — Suíte DDIA Foundations` ABAIXO de `## [Unreleased]` e ACIMA de `## [1.21.0]`.
- DOC-05: validar que `kit/skills/_shared-dados-distribuidos/glossary.md` linha 129 tem seção `## (i) Convenção de naming PT-BR (a partir de v1.22)`. Já existe (criado em Phase 117).

**Bump version package.json:** `1.21.0` → `1.22.0` para que o manifest hashe com versão correta.

</decisions>

<code_context>
## Insights do Código Existente

- `package.json` linha 3 — version `1.21.0` (precisa bump para `1.22.0`).
- `README.md` root linhas 26-28 — bloco AUTOGEN-COUNTS-START/END com counts atuais (57/88/60/23).
- `CHANGELOG.md` linha 7 — `## [Unreleased]` placeholder; entry v1.22.0 entra entre linha 7 e linha 9 (`## [1.21.0]`).
- `kit/README.md` — arquivo template de file-format (50 linhas); APPEND da seção "Suíte DDIA Foundations" no final preserva propósito original.
- `kit/file-manifest.json` linha 2 — `"version": "1.21.0"`; regen script lê de `package.json`.
- `scripts/update-readme-counts.js` — idempotente; conta `agents/*.md`, `commands/*.md`, `skills/*/SKILL.md` (skip `_shared-*`), `gates/*.md`.
- `scripts/regen-manifest.js` — idempotente; walks `kit/**`, exclui `file-manifest.json`, normaliza CRLF→LF, sorted keys.
- `kit/skills/_shared-dados-distribuidos/glossary.md` linha 129 — `## (i) Convenção de naming PT-BR (a partir de v1.22)` já presente.
- `.planning/phases/120-isolamento-armadilhas/`, `121-modelo-streams/`, `122-agents-comando/` — fases anteriores v1.22 já entregues + verified passed.

</code_context>

<specifics>
## Ideias Específicas

- **Anchor narrativo CROSS-03 e CROSS-12 (CRM lost update):** o caso "2 reps movem o mesmo lead simultaneamente para `qualified` e `negotiation`, último write vence sem feedback" é exemplo concreto B2B SaaS — bug real reportado em tickets de suporte CRM open-source.
- **Anchor narrativo CROSS-04 (super-admin TTL fencing):** a janela "GC pause de 35min em super-admin A enquanto super-admin B impersona o mesmo target" é exemplo canônico DDIA Ch 8 aplicado a contexto B2B SaaS.
- **Anchor narrativo CROSS-08/CROSS-10 (migration arriscada):** o caso "dev novo aplica `ALTER TABLE ... SET NOT NULL` direto, deploy quebra V1 ainda rodando em paralelo" é break #1 mais comum em equipes em crescimento.
- **Detecção de scripts:** verificar via `package.json` que `scripts/update-readme-counts.js` e `scripts/regen-manifest.js` rodam idempotentes (já estão no `prepublishOnly`).

</specifics>

<deferred>
## Ideias Adiadas

- Cross-suite handoff automático bidirecional sem opt-in (agent v1.8 SEMPRE invoca v1.22): defer para v1.23+. Phase 123 aplica padrão **opt-in via documentation appendix** — usuário precisa ler patch e ativar manualmente. Mais conservador.
- Patches em skills v1.9 (Observabilidade) e v1.10 (SRE) cross-ref para v1.22: defer — DDIA Ch 8 (clock skew) já cross-ref'd em CROSS-05 (`cascading-failures` v1.11). Outros pontos de integração com v1.9/v1.10 podem entrar em milestone futuro.
- Auto-detect "qual subcomando rodar" em `/dados-distribuidos help` baseado em contexto do projeto: defer para v1.23 cross-suite UX.
- Auto-bump version + auto-tag git para release: defer — fica responsabilidade do release manager humano (`npm version minor` + `git push --follow-tags`).

</deferred>
</content>

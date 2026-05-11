# Requisitos: kit-mcp — Milestone v1.23

**Definidos:** 2026-05-10
**Valor Central:** Single canonical source para fluxo de trabalho IA dev (agents, skills, commands, framework) sincronizado em 8 IDEs alvo. v1.23 garante que TODO SQL/Postgres/banco de dados gerado pelo kit passe pela trilha de segurança da Suíte Supabase via **handoff cooperativo** — agents externos planejam, agents Supabase materializam, ninguém descarta upstream.

**Princípio canônico v1.23:** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta o outro — quando há conflito de patterns, agent Supabase explica e propõe alternativa via diff, nunca reescreve silenciosamente.

**Material-fonte:** documentação oficial Supabase Row Level Security fornecida no prompt do milestone (cobertura 100%) + diretrizes de Column-Level Security parqueadas para v1.24.

## Requisitos v1.23

### RLS Skill & Writer Hardening

- [ ] **RLS-01**: Skill `supabase-rls-policies` documenta `GRANT SELECT/INSERT/UPDATE/DELETE TO anon/authenticated/service_role` antes de `ENABLE ROW LEVEL SECURITY`
- [ ] **RLS-02**: Skill `supabase-rls-policies` documenta padrão `auth.uid() IS NOT NULL AND auth.uid() = user_id` (anti silent-fail anônimo)
- [ ] **RLS-03**: Skill `supabase-rls-policies` documenta views com `security_invoker=true` (Postgres 15+) — patternização do bypass default
- [ ] **RLS-04**: Skill `supabase-rls-policies` distingue `anon` Postgres role vs anonymous Auth user (claim `is_anonymous` no JWT)
- [ ] **RLS-05**: Skill `supabase-rls-policies` documenta performance: minimize joins (IN ao invés de JOIN), filtros redundantes client-side (.eq() mesmo com policy), security definer functions com cache via `(select)`
- [ ] **RLS-06**: Skill `supabase-rls-policies` documenta `raw_app_meta_data` vs `raw_user_meta_data` + JWT freshness caveat + cookie 4096 bytes
- [ ] **RLS-07**: Skill `supabase-rls-policies` documenta defense in depth narrative — RLS como camada vs third-party tooling
- [ ] **RLS-08**: Agent `supabase-rls-writer` emite GRANTs antes de ENABLE RLS no output gerado
- [ ] **RLS-09**: Agent `supabase-rls-writer` inclui `IS NOT NULL` check opcional no output (parametrizável via input)
- [ ] **RLS-10**: Agent `supabase-rls-writer` gera views com `security_invoker=true` quando o pattern aplicável for detectado

### Migration Hardening

- [ ] **MIGR-01**: Skill `supabase-migrations` template default inclui GRANT + ALTER ENABLE RLS + indices em colunas RLS + 4 policies granulares como bloco obrigatório para CREATE TABLE
- [ ] **MIGR-02**: Agent `supabase-migration-writer` recebe draft/planejamento SQL via `Task()` upstream context + intent original (handoff cooperativo)
- [ ] **MIGR-03**: Agent `supabase-migration-writer` em CREATE TABLE faz auto-chain cooperativo para `supabase-rls-writer` ou `supabase-rls-hardener`
- [ ] **MIGR-04**: Agent `supabase-migration-writer` devolve SQL hardenado + nota explícita de divergências quando intent upstream conflita com hardening obrigatório

### Command Materialization

- [ ] **CMD-01**: Command `/supabase` documentado como serviço de materialização — recebe planejamento, devolve código pronto; nunca bloqueia upstream
- [ ] **CMD-02**: Subcomando `/supabase migration "<plano>"` exige RLS auto-injetada no output final (via handoff cooperativo com `supabase-rls-hardener`)

### Defense-in-Depth Skill

- [ ] **DEFENSE-01**: Skill nova `supabase-rls-defense-in-depth` documenta event trigger `rls_auto_enable()` (CREATE EVENT TRIGGER + função PLpgSQL) como default em projetos novos
- [ ] **DEFENSE-02**: Skill nova `supabase-rls-defense-in-depth` documenta `BYPASSRLS` role privilege (`alter role ... with bypassrls`) para tarefas admin
- [ ] **DEFENSE-03**: Skill nova `supabase-rls-defense-in-depth` documenta service_role caveat (não bypassa RLS do user logged-in via client lib)
- [ ] **DEFENSE-04**: Skill nova `supabase-rls-defense-in-depth` documenta security definer functions como pattern de bypass controlado para policies caras
- [ ] **DEFENSE-05**: Skill nova `supabase-rls-defense-in-depth` documenta views `security_invoker=true` vs bypass default + revoke em versões pré-15

### Hardener Agent (novo)

- [ ] **HARDEN-01**: Agent novo `supabase-rls-hardener` recebe draft/plano SQL via `Task()` + contexto upstream (intent + origem do caller)
- [ ] **HARDEN-02**: Agent novo `supabase-rls-hardener` produz verdict **GO** quando SQL já tem GRANT + RLS + indices + sem anti-patterns (passa direto)
- [ ] **HARDEN-03**: Agent novo `supabase-rls-hardener` produz verdict **STRENGTHEN** com diff explícito do que mudou e por quê (ajusta mantendo intent)
- [ ] **HARDEN-04**: Agent novo `supabase-rls-hardener` produz verdict **REWRITE** apenas com confirmação obrigatória do caller (nunca silenciosa) quando detecta anti-pattern crítico
- [ ] **HARDEN-05**: Agent novo `supabase-rls-hardener` valida instalação de event trigger `rls_auto_enable` em projetos novos e oferece patch se ausente
- [ ] **HARDEN-06**: Agent novo `supabase-rls-hardener` é invocável cross-suite por agents v1.21/v1.22/framework core via `Task(subagent_type=supabase-rls-hardener)` documentado

### Cross-Suite Cooperative Handoff

- [ ] **CROSS-01**: Agent `multi-tenant-rls-writer` (v1.21) atualizado com handoff cooperativo para `supabase-rls-hardener` (drafts RLS hierárquicas passam pelo hardener final)
- [ ] **CROSS-02**: Agent `audit-log-implementer` (v1.21) atualizado com handoff cooperativo (SQL append-only + REVOKE passa pelo hardener)
- [ ] **CROSS-03**: Agent `crm-pipeline-implementer` (v1.21) atualizado com handoff cooperativo (CREATE TABLE leads + trigger passa pelo hardener)
- [ ] **CROSS-04**: Agent `org-onboarding-implementer` (v1.21) atualizado com handoff cooperativo (signup migration passa pelo hardener)
- [ ] **CROSS-05**: Agent `invite-flow-implementer` (v1.21) atualizado com handoff cooperativo (tabela org_invites + RPC passa pelo hardener)
- [ ] **CROSS-06**: Agent `super-admin-implementer` (v1.21) atualizado com handoff cooperativo (cross-tenant RLS PERMISSIVE passa pelo hardener)
- [ ] **CROSS-07**: Agent `evolution-go-integrator` (v1.21) atualizado com handoff cooperativo (webhook tabela + idempotency passa pelo hardener)
- [ ] **CROSS-08**: Agent `lgpd-compliance-auditor` (v1.21) atualizado com handoff cooperativo (DSR table migrations passa pelo hardener)
- [ ] **CROSS-09**: Agent `auditor-consistencia-isolamento` (v1.22) valida que migrations recentes passaram pelo `supabase-rls-hardener` (audit field em output)
- [ ] **CROSS-10**: Agents framework core (`planner` + `executor` + `debugger`) detectam SQL no plan/output e fazem handoff cooperativo para Supabase via `Task(subagent_type=supabase-rls-hardener)`

### Documentation & Release

- [ ] **DOC-01**: README.md AUTOGEN-COUNTS regenerado (60→61 agents, 67→68 skills; commands/gates inalterados)
- [ ] **DOC-02**: file-manifest.json atualizado com novos artefatos (skill `supabase-rls-defense-in-depth` + agent `supabase-rls-hardener`)
- [ ] **DOC-03**: CHANGELOG entry v1.23 documentando 9 entregáveis + princípio handoff cooperativo
- [ ] **DOC-04**: Glossário `_shared-supabase/glossary.md` (criar se não existir) com termos defense-in-depth/hardener/cooperative-handoff/event-trigger-rls-auto-enable/bypassrls/security_invoker
- [ ] **DOC-05**: MILESTONES.md atualizado pós-`/concluir-marco`; PROJECT.md/STATE.md refletem v1.23 entregue

## Requisitos v1.24 (próximo marco — Column-Level Security)

Parqueados, fora do escopo de v1.23:

### Column-Level Security

- **COL-01**: Skill nova `supabase-column-level-security` cobrindo Postgres column privileges (GRANT col-level)
- **COL-02**: Agent novo `supabase-column-privileges-writer` para gerar GRANT/REVOKE granulares por coluna
- **COL-03**: Patch agents existentes (rls-writer, migration-writer, hardener) com awareness de column-level
- **COL-04**: Cross-suite handoff cooperativo para column-level security (mesmo pattern de v1.23)

## Requisitos v2 (futuros)

Deferidos para milestones posteriores além de v1.24, rastreados mas não no roadmap atual.

### Refinements pós-v1.23
- Burn rate alerting integrado com hardener (alertar quando taxa de REWRITE sobe)
- Telemetry de cooperative handoff (% de drafts upstream que vão direto GO vs STRENGTHEN vs REWRITE)
- Dashboard visual de cobertura RLS por tabela (Supabase MCP query)

## Fora do Escopo (v1.23)

| Funcionalidade | Motivo |
|----------------|--------|
| Column-Level Security | Próximo marco v1.24 — escopo separado para foco em v1.23 RLS row-level |
| RLS testing framework (pgTAP integration) | v1.24+ — não é doc oficial do material-fonte v1.23 |
| Migração automática de policies existentes não-hardenadas | Risco alto, requer dry-run + análise; futuro |
| UI dashboard de hardening status | v2 — kit-mcp é CLI-first, dashboards são out-of-scope |
| Carry-over tech debt v1.20 (cli/index.js extract, mutation baseline 5 files, p99 latency) | Carry-over para v1.24+ — não relacionado ao escopo RLS |

## Rastreabilidade

Quais fases cobrem quais requisitos. Atualizado durante a criação do roadmap.

_(será preenchido pelo roadmapper após Phase mapping)_

| Requisito | Fase | Status |
|-----------|------|--------|
| RLS-01 | TBD | Pending |
| RLS-02 | TBD | Pending |
| ... | ... | ... |

**Cobertura:**
- Requisitos v1.23: **42** total
- Mapeados para fases: _será preenchido pelo roadmapper_
- Não mapeados: 0 (target)

---
*Requisitos definidos: 2026-05-10*
*Última atualização: 2026-05-10 após `/novo-marco v1.23`*

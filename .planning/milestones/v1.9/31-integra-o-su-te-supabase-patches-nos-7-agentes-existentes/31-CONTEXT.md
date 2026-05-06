# Fase 31: Integração Suíte Supabase — patches nos 7 agentes - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

Aplicar patches em 7 agentes Supabase existentes para consultarem skills observabilidade da Phase 29-30 (e forward refs para Phases 32, 34):

1. supabase-architect → projeta SLI tables + audit hooks + OMM scoring desde início
2. supabase-migration-writer → toda migration emite migration_event + audit triggers
3. supabase-rls-writer → RLS deny → log estruturado com policy_name/attempted_op/user.id/tenant_id
4. supabase-edge-fn-writer → OTel SDK + spans canônicos + propagação outbound + sampling head-based
5. supabase-realtime-implementer → trace context no payload do broadcast + atributos canônicos
6. supabase-auth-bootstrapper → auth events estruturados + SLO de "successful login %"
7. supabase-storage-implementer → upload/download events + sampling por size

REQs: INT-SB-01..07 (7 REQs).
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Adicionar bloco "## Observabilidade integrada" antes da seção "Ver também" em cada agente. Cross-refs nas seções "Ver também" expandidas para incluir skills observabilidade.

### Forward references
Skills `event-based-slos`, `telemetry-sampling`, `observability-maturity-model` ainda não existem (Phases 32, 34). Patches usam `*(Phase 32)*` ou `*(Phase 34)*` para sinalizar.
</decisions>

<code_context>
- 7 agentes em `kit/agents/supabase-*.md` com tamanhos 153-298 lines
- Padrão: cada um termina em "Anti-patterns prevenidos" → "Quando NÃO invocar" → "Ver também"
- Cross-refs Markdown relativo `../skills/<name>/SKILL.md`
</code_context>

<specifics>
## Ideias Específicas

Conteúdo do bloco varia por agente — específico ao domínio dele:
- architect: tabela `obs.events` + audit hooks + SLI views + OMM scoring
- migration-writer: migration_event emit + audit triggers em tabelas sensíveis
- rls-writer: RLS deny logging com 6 atributos canônicos (`error.type='authz'`)
- edge-fn-writer: OTel SDK Deno + span SERVER + propagation.inject outbound + sampling
- realtime-implementer: propagation no payload broadcast + atributos canônicos channel
- auth-bootstrapper: 6 event_names canônicos + SLO de login + audit trail
- storage-implementer: upload/download span + sampling por size + audit em buckets sensíveis
</specifics>

<deferred>
## Ideias Adiadas

- Implementar a observabilidade real (gerar OTel events) nos agentes — eles SUGEREM o padrão; user/executor aplica em projeto real
- Skill `event-based-slos` — Phase 32
- Skill `telemetry-sampling` — Phase 34
- Skill `observability-maturity-model` — Phase 34
</deferred>

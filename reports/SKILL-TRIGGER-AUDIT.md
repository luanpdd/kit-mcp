# Auditoria de gatilhos de skills (#9)

Gerado: 2026-05-18T17:36:41.274Z
Skills analisadas: **81**

## 1. Tokens quentes (gatilho fraco)

Termos presentes em ≥ 6 descrições — disparam muitas skills
ao mesmo tempo, então não desambiguam nada. Candidatos a remover/qualificar.

| Token | Nº de skills | Skills |
| --- | --- | --- |
| `supabase` | 35 | armadilhas-sistemas-distribuidos, audit-log-multi-tenant, b2b-saas-architecture, consistencia-leitura-replica, crm-lead-pipeline-patterns, escolha-modelo-consistencia, evolution-go-whatsapp-integration, legacy-api-only-applications, lgpd-multi-tenant-compliance, member-invite-flow, multi-tenant-performance-scaling, multi-tenant-rls-hierarchy, org-onboarding-flow, rbac-permissions-matrix-supabase, streams-eventos-cdc, supabase-auth-ssr, supabase-branching-workflow, supabase-ci-cd-github-actions, supabase-column-level-security, supabase-config-toml-remotes, supabase-custom-claims-rbac, supabase-declarative-schema, supabase-edge-functions, supabase-edge-functions-auth, supabase-edge-functions-limits, supabase-edge-functions-mcp-server, supabase-edge-functions-testing, supabase-edge-runtime-builtins, supabase-migration-repair, supabase-migrations, supabase-pgtap-testing, supabase-postgres-roles, supabase-postgres-style, supabase-rls-defense-in-depth, tenant-quente-mitigacao |
| `implementar` | 15 | audit-log-multi-tenant, crm-lead-pipeline-patterns, lgpd-multi-tenant-compliance, member-invite-flow, member-management-react-shadcn, org-onboarding-flow, org-switcher-react-pattern, permission-gate-react-pattern, retry-strategies, streams-eventos-cdc, supabase-column-level-security, supabase-custom-claims-rbac, supabase-pgvector-rag, supabase-realtime, super-admin-platform-pattern |
| `rls` | 12 | multi-tenant-performance-scaling, multi-tenant-rls-hierarchy, permission-gate-react-pattern, supabase-column-level-security, supabase-declarative-schema, supabase-migrations, supabase-pgvector-rag, supabase-postgres-roles, supabase-realtime, supabase-rls-defense-in-depth, supabase-rls-policies, supabase-storage |
| `edge` | 10 | evolucao-schema-compativel, legacy-api-only-applications, supabase-cron-queues, supabase-edge-functions, supabase-edge-functions-auth, supabase-edge-functions-limits, supabase-edge-functions-mcp-server, supabase-edge-functions-testing, supabase-edge-runtime-builtins, supabase-pgtap-testing |
| `feathers` | 10 | legacy-api-only-applications, legacy-characterization-tests, legacy-effect-analysis, legacy-extract-class, legacy-monster-methods, legacy-programming-by-difference, legacy-seams-and-test-harness, legacy-shotgun-surgery, legacy-sprout-wrap-techniques, legacy-storytelling-naked-crc |
| `multi-tenant` | 9 | audit-log-multi-tenant, b2b-saas-architecture, evolution-go-whatsapp-integration, member-invite-flow, multi-tenant-performance-scaling, multi-tenant-rls-hierarchy, org-switcher-react-pattern, supabase-storage, tenant-quente-mitigacao |
| `escrever` | 9 | evolucao-schema-compativel, legacy-api-only-applications, legacy-effect-analysis, llm-as-dependency, multi-tenant-rls-hierarchy, postgres-isolamento-concorrencia, supabase-edge-functions, supabase-pgtap-testing, supabase-postgres-style |
| `postgres` | 9 | evolucao-schema-compativel, multi-tenant-performance-scaling, postgres-isolamento-concorrencia, supabase-cron-queues, supabase-database-functions, supabase-postgres-roles, supabase-postgres-style, supabase-realtime, tenant-quente-mitigacao |
| `b2b` | 8 | b2b-saas-architecture, crm-lead-pipeline-patterns, evolution-go-whatsapp-integration, lgpd-multi-tenant-compliance, member-invite-flow, org-onboarding-flow, org-switcher-react-pattern, rbac-permissions-matrix-supabase |
| `functions` | 8 | legacy-api-only-applications, multi-tenant-performance-scaling, supabase-edge-functions, supabase-edge-functions-auth, supabase-edge-functions-limits, supabase-edge-functions-mcp-server, supabase-edge-functions-testing, supabase-rls-defense-in-depth |
| `desenhar` | 7 | armadilhas-sistemas-distribuidos, b2b-saas-architecture, cascading-failures, escolha-modelo-consistencia, hermetic-builds, release-engineering, supabase-rls-defense-in-depth |
| `código` | 7 | legacy-api-only-applications, legacy-characterization-tests, legacy-effect-analysis, legacy-programming-by-difference, legacy-seams-and-test-harness, legacy-sprout-wrap-techniques, llm-as-dependency |
| `sre` | 6 | cascading-failures, hermetic-builds, load-shedding-graceful-degradation, production-readiness-review, release-engineering, retry-strategies |
| `canônicos` | 6 | crm-lead-pipeline-patterns, eliminating-toil, member-management-react-shadcn, structured-events, supabase-ci-cd-github-actions, supabase-edge-functions-limits |
| `como` | 6 | eliminating-toil, event-based-slos, legacy-characterization-tests, sre-risk-management, supabase-rls-defense-in-depth, whatsapp-conversation-state-machine |

## 2. Pares com descrição sobreposta

Pares com similaridade Jaccard ≥ 0.3 — colisão real de gatilho.
Candidatos a merge OU a desambiguar a descrição (deixar claro QUANDO cada uma).

| Skill A | Skill B | Similaridade |
| --- | --- | --- |

## Resumo

- 15 tokens quentes (≥ 6 skills).
- 0 pares colidindo (≥ 30% similaridade).
- Próximo passo (#2): reescrever descrições dos pares colidindo para
  deixar explícito o gatilho diferenciador de cada skill.

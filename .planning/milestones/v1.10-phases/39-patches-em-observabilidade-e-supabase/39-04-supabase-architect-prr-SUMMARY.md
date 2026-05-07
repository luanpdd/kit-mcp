---
phase: 39-patches-em-observabilidade-e-supabase
plan: 04
subsystem: agents-supabase
tags: [supabase, supabase-architect, prr, sre-engagement, cross-ref-skills, anti-pitfall-A2]

requires:
  - phase: 36-skills-foundationais-sre
    provides: skill production-readiness-review (cap 32 livro Google SRE)
  - phase: 37-agents-sre
    provides: agent prr-conductor (executa PRR de fato)
  - phase: 35-suite-supabase-v18
    provides: agent supabase-architect (v1.8 com Observabilidade integrada)
provides:
  - patch v1.10 supabase-architect com seção "Production Readiness Review"
  - template de output extendido (## 9. Observabilidade + ## 10. PRR pré-production)
  - cross-refs ATIVOS para skill production-readiness-review + agent prr-conductor
  - 6 axes adaptados ao contexto Supabase (RLS, branch billing, Edge concurrent, RLS explain plan)
  - 3 engagement models documentados (Simple/Early/Frameworks)
affects:
  - phase 41 (gate prr-checklist-coverage vai validar PRR-REPORT.md)
  - todos consumers do supabase-architect que vão receber sugestão de PRR no plano

tech-stack:
  added: []
  patterns:
    - "Patch editorial: nova seção dedicada + template extension; frontmatter byte-preservado"
    - "Cross-ref Markdown ativo para skill (knowledge canônico) + agent (conductor que executa)"
    - "Tabela 6 axes adaptada ao contexto (não cópia genérica) — Supabase-specific (RLS isolamento, Spend Cap, branch billing, pgvector index, Edge concurrent)"

key-files:
  created: []
  modified:
    - kit/agents/supabase-architect.md (+49/-0)

key-decisions:
  - "Frontmatter preservado byte-a-byte (anti-pitfall A2): name, description, tools, color: blue inalterados"
  - "Inserir AMBAS as seções 9 (Observabilidade placeholder) e 10 (PRR pré-production) no template de output — seção 9 é placeholder dinâmico que o agent preenche com conteúdo do bloco 'Observabilidade integrada' existente"
  - "Tabela 6 axes adaptada ao contexto Supabase com exemplos concretos (não cópia genérica): single project Supabase = SPOF, branch billing fora do Spend Cap, pgvector index size, Edge Function 5xx storm, RLS explain plan sem seq scan"
  - "Cross-ref [prr-conductor](./prr-conductor.md) aparece 2× — uma no template (## 10) e uma no header da seção dedicada — máximo descoberta"
  - "Anti-patterns explícitos com 4 itens (auto-PRR, deploy-primeiro, pular axe, 'acreditamos que está pronto') — espelha skill production-readiness-review"

patterns-established:
  - "Patch v1.10 em agent v1.x existente: ADICIONAR seções (não modificar) + frontmatter intocado"
  - "Cross-ref Markdown literal (não slug): [name](../path/SKILL.md) ou [name](./agent.md) — descoberta via grep ativa"
  - "Template de output extension: novas seções entre últimas existentes e fechamento do bloco markdown"

requirements-completed:
  - INT-SB-V2-02

duration: 8min
completed: 2026-05-07
---

# Plan 04 — Patch supabase-architect (PRR pré-production) — Resumo

**Patch v1.10 do agent supabase-architect: nova seção 'Production Readiness Review' (cap 32 livro Google SRE) + extensão do template de output com '## 10. PRR pré-production' — frontmatter byte-preservado**

## Performance

- **Duração:** 8 min
- **Iniciado:** 2026-05-07T07:00:00Z
- **Concluído:** 2026-05-07T07:08:00Z
- **Tarefas:** 4 (T1 verificação, T2 template extension, T3 nova seção, T4 smoke)
- **Arquivos modificados:** 1 (`kit/agents/supabase-architect.md`)

## Realizações

- Nova seção `## Production Readiness Review` adicionada após `## Observabilidade integrada` (última seção do arquivo)
- Tabela 6 axes obrigatórios (System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance) adaptada ao contexto Supabase com exemplos concretos (RLS isolamento, Spend Cap, branch billing fora do cap, pgvector index size, Edge Function 5xx storm, RLS explain plan)
- 3 engagement models documentados (Simple PRR para internal/dogfood, Early Engagement default para Edge Functions user-facing, Frameworks/SRE Platform para múltiplos serviços)
- Bloco "Quando re-rodar PRR" + "Anti-patterns prevenidos" (4 itens) + frase canônica "PRR NÃO é one-shot"
- Template de output extendido com `## 9. Observabilidade` (placeholder dinâmico) + `## 10. PRR pré-production` entre `## 8. Próximos passos` e fim do bloco markdown
- Cross-refs Markdown ATIVOS: `[production-readiness-review](../skills/production-readiness-review/SKILL.md)` (skill cap 32) + `[prr-conductor](./prr-conductor.md)` (agent que executa) — 2× para máxima descoberta
- Frontmatter (`name`, `description`, `tools`, `color: blue`) preservado byte-a-byte (anti-pitfall A2)

## Commits das Tarefas

Patch atomicamente comitado:

1. **Plan 39-04 patch (T1+T2+T3+T4):** `d3eec5d` — patch(supabase-architect): adicionar PRR pre-production (39-04)

_Nota: Plan 39-04 é patch editorial coeso — todas as 4 tasks (verificação, template extension, nova seção, smoke) consolidadas em commit único pure-addition (+49/-0)._

## Arquivos Criados/Modificados

- `kit/agents/supabase-architect.md` (+49/-0) — adicionada seção `## Production Readiness Review` + extensão do template Markdown com `## 9. Observabilidade` e `## 10. PRR pré-production`

## Decisões Tomadas

- **Inserir AMBAS as seções 9 e 10 no template** — a referência v1.9 ao "Output adicionado: seção `## 9. Observabilidade`" no bloco Observabilidade integrada é prosa narrativa, não inserção literal no template Markdown. Plan 39-04 materializa as duas seções como placeholders no template para que o agent gere output consistente.
- **Cross-ref `[prr-conductor]` 2× (não 1×)** — uma no template `## 10. PRR pré-production` (output user-facing) e outra no header da seção dedicada `## Production Readiness Review` (system prompt do agent). Garante descoberta tanto pelo agent (na execução) quanto pelo user (no plano gerado).
- **Tabela 6 axes Supabase-specific (não cópia genérica)** — cada axe lista mecanismos concretos: System Architecture menciona "single project Supabase = SPOF — branches Pro mitigam"; Capacity Planning menciona "Spend Cap configurado, branch billing entendido (Pro), egress projetado, pgvector index size estimate"; Performance menciona "RLS policy explain plan (sem seq scan em filtro)". Anti cópia genérica do checklist do skill — adaptação ao domínio.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Smoke validations todas passaram:

- Frontmatter byte-idêntico (5 linhas, name/description/tools/color preservados)
- `## Production Readiness Review` count = 1
- Cross-refs ATIVOS: skill (1×) + agent prr-conductor (2×)
- 6 axes literais: cada um ≥ 2× (System Architecture=2, Instrumentation=2, Emergency Response=2, Capacity Planning=3, Change Management=2, Performance=2)
- 3 engagement models: cada um ≥ 2× (Simple, Early Engagement, Frameworks)
- `## 10. PRR pré-production` ≥ 1 (count=2: template + cross-ref no body)
- `## Observabilidade integrada` preservada (count=1)
- Anti-patterns: auto-PRR (2×) + "PRR NÃO é one-shot" (1×)
- Diff numstat: 49 insertions, 0 deletions (pure addition — nenhum byte do v1.8/v1.9 modificado)

## Problemas Encontrados

- Smoke sync test no plano (`npx kit-mcp sync claude-code`) usava sintaxe desatualizada (subcomando faltando) — corrigido manualmente com `node bin/cli.js sync install claude-code` que executou com sucesso (279 arquivos sincronizados, agent supabase-architect propagado para `.claude/agents/`). Sync produz stub com canonical reference (frontmatter completo + ponteiro para kit/) — comportamento esperado, não falha real.

## Configuração Manual Necessária

Nenhuma — patch puramente editorial em arquivo do kit.

## Prontidão para Próxima Fase

- Plan 39-04 fechado → próximo plan da Phase 39 (39-05 ou outro plan da onda 1)
- supabase-architect agora gera planos arquiteturais que **SEMPRE** sugerem PRR antes de production (cobre INT-SB-V2-02 integralmente)
- Phase 41 vai criar gate `prr-checklist-coverage` que valida PRR-REPORT.md gerado pelos consumers deste agent — handoff documentado

---
*Fase: 39-patches-em-observabilidade-e-supabase*
*Plan: 04 — patch supabase-architect (PRR pré-production)*
*Concluída: 2026-05-07*

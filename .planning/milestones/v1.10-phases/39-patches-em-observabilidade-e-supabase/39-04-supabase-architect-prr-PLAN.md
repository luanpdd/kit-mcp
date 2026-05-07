---
phase: 39
plan: 04
title: Patch supabase-architect — menção a PRR antes de production
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/supabase-architect.md
requirements: [INT-SB-V2-02]
status: ready
---

# Plan 04 — Patch `kit/agents/supabase-architect.md`

## Goal

Estender o agente `supabase-architect` (v1.8) para que **todo plano arquitetural sugira PRR (Production Readiness Review) antes de production**. O patch adiciona uma seção "Production Readiness Review" referenciando a skill `production-readiness-review` (v1.10 / Phase 36) e o agente `prr-conductor` (v1.10 / Phase 37); estende o template de output para incluir uma seção "## 10. PRR pré-production" no plano gerado. Frontmatter (`description`, `tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-SB-V2-02**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/agents/supabase-architect.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `name`, `description`, `tools` (`Read, Write, Bash, Grep, Glob, AskUserQuestion, mcp__supabase__list_tables, mcp__supabase__list_extensions`), `color: blue` preservados byte-a-byte
- **Cross-ref Markdown ATIVO** — `[production-readiness-review](../skills/production-readiness-review/SKILL.md)` + `[prr-conductor](./prr-conductor.md)`
- **Posicionamento canônico** — patch tem 2 pontos:
  1. Nova seção `## Production Readiness Review` inserida **após** `## Observabilidade integrada` e **antes** do final do arquivo (que termina com bloco "Validação ODD")
  2. Estensão do **template de output** (bloco markdown que começa em "Plano em formato Markdown estruturado:") adicionando "## 10. PRR pré-production" entre "## 8. Próximos passos" e final
- **Não modificar 7 axes/passos existentes (Step 0 — Step 7)** — toda lógica de design preservada
- **Não modificar bloco `## Observabilidade integrada`** — v1.9 já documenta tabelas obs.events + audit hooks + SLI views
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes do agent original

## Tasks

<task id="39-04-T1" name="Verificar estado e localizar âncoras de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (frontmatter + localizar `## Observabilidade integrada` + bloco template "Plano em formato Markdown estruturado:" + final do arquivo)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 30-100 — capturar 6 axes canônicos + 3 engagement models)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual (`name: supabase-architect`, `tools: Read, Write, Bash, Grep, Glob, AskUserQuestion, mcp__supabase__list_tables, mcp__supabase__list_extensions`, `color: blue`)
    2. Localizar template `Plano em formato Markdown estruturado:` (esperado bloco markdown grande com seções "## 1. Domínio" até "## 8. Próximos passos")
    3. Localizar âncora `## Observabilidade integrada` (esperada ~linha 156)
    4. Localizar **última linha** do arquivo (parágrafo "Validação ODD..." ~linha 167)
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado
    - Template Markdown localizado (com seções 1-8)
    - `## Observabilidade integrada` localizada
    - Skill `production-readiness-review` confirmada existir
  </acceptance_criteria>
</task>

<task id="39-04-T2" name="Estender template de output (## 10. PRR pré-production)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (foco no bloco template Markdown — especialmente final "## 8. Próximos passos" linhas ~141-145)
  </read_first>
  <action>
    Localizar dentro do bloco markdown template (que tem `\`\`\`` ao redor) a linha que diz `## 8. Próximos passos` seguida de bullets `\`/supabase migration\` para iniciar Wave 1.` etc.

    Adicionar após `## 8. Próximos passos` e suas 3 linhas de bullets, e **antes** do `\`\`\`` que fecha o bloco markdown template, as seguintes 2 novas seções:

    ```markdown
    ## 9. Observabilidade
    {tabela `obs.events` + audit triggers + SLI views — gerada pelo bloco "Observabilidade integrada"}

    ## 10. PRR pré-production
    Antes de aceitar tráfego real (≥ 1% de usuários), conduzir Production Readiness Review:
    - Invocar `/sre prr --service <nome>` ou `/prr --feature <descrição>` (cross-ref [prr-conductor](./prr-conductor.md))
    - 6 axes obrigatórios: System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance
    - Engagement model: Simple (serviços pequenos), Early Engagement (críticos), Frameworks (built on platform)
    - Gaps P0 = blocker (sem instrumentação básica, sem rollback, sem on-call); Gaps P1 = scheduled tasks
    - Reviewer ≠ time dev — par externo ou SRE conduz (anti auto-PRR)
    ```

    **IMPORTANTE**: A seção "## 9. Observabilidade" pode já existir como referência no bloco "## Observabilidade integrada" (linha "Output adicionado: seção `## 9. Observabilidade` no plano..."). Se já há essa referência, inserir apenas "## 10. PRR pré-production" como novo bullet/sub-seção do template. Se "## 9." NÃO está literalmente listado no template Markdown (apenas referenciado como output adicionado prosa), adicionar AMBAS as seções 9 e 10 no template.

    Verificar antes de gravar: o bloco `\`\`\`markdown` que encapsula o template termina com `\`\`\``. As novas seções devem estar ANTES desse `\`\`\``. A seção "## 9. Observabilidade" é placeholder de inserção dinâmica que o agent preenche; deve apenas referenciar que o conteúdo real vem do bloco "Observabilidade integrada" via `{...}` placeholder.
  </action>
  <acceptance_criteria>
    - Template Markdown ganhou seção `## 10. PRR pré-production` antes do fechamento do bloco
    - Seção menciona literal `/sre prr --service` ou `/prr --feature` (comando canônico v1.10)
    - Seção contém os 6 axes obrigatórios literalmente nominados
    - Seção contém os 3 engagement models (Simple, Early Engagement, Frameworks)
    - Seção menciona gap P0 = blocker / P1 = scheduled
    - Seção menciona regra "Reviewer ≠ time dev"
    - Cross-ref Markdown literal `[prr-conductor](./prr-conductor.md)` presente
    - Seção "## 8. Próximos passos" e suas 3 linhas preservadas (inalteradas em ordem)
  </acceptance_criteria>
</task>

<task id="39-04-T3" name="Adicionar nova seção ## Production Readiness Review">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (linhas 156-167 — bloco "## Observabilidade integrada" final + linha de fechamento)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** o bloco completo `## Observabilidade integrada` (que termina com parágrafo "Validação ODD..." sobre as 4 perguntas pré-PR), uma nova seção como **última seção** do arquivo:

    ```markdown
    ## Production Readiness Review

    > Cross-ref canônico: [production-readiness-review](../skills/production-readiness-review/SKILL.md) (cap 32 do livro Google SRE — Evolving SRE Engagement Model). Para conduzir o PRR de fato, delegar para [prr-conductor](./prr-conductor.md).

    Schema + RLS + Edge Functions Supabase **NÃO são production-ready** só por estarem corretos — production-readiness é evidence-based, com gate explícito em 6 axes. Este agent **SEMPRE** sugere PRR no plano (seção `## 10. PRR pré-production` do output) — sem exceção.

    ### 6 axes obrigatórios

    | Axe | O que verifica em contexto Supabase |
    |---|---|
    | **System Architecture** | Redundância (RLS isolamento por tenant; reverso de migrations testado), SPOFs mapeados (single project Supabase = SPOF — branches Pro mitigam), graceful degradation |
    | **Instrumentation / Metrics / Monitoring** | 4 golden signals em Edge Functions (cross-ref [supabase-edge-fn-writer](./supabase-edge-fn-writer.md)), `obs.events` populada, audit hooks ativos, SLI/SLO definidos por jornada crítica |
    | **Emergency Response** | Runbook de incident (RLS broken, schema corrupt, Edge Function 5xx storm), on-call rotation, postmortem template em `.planning/postmortems/` |
    | **Capacity Planning** | Spend Cap configurado, branch billing entendido (Pro), egress projetado, pgvector index size estimate, Edge concurrent invocations limite |
    | **Change Management** | Migrations declarative + reverso testado, RLS policies versionadas em git, Edge Function rollback strategy, supabase functions deploy --import-map idempotente |
    | **Performance** | Load test report (RPS sustentado), p99 latency baseline, RLS policy explain plan (sem seq scan em filtro), index coverage |

    ### 3 engagement models (escolher conforme criticidade)

    - **Simple PRR** — para serviços internos / dogfooding / staging-only. Checklist com signoff Eng Lead. Custo baixo, cobertura básica.
    - **Early Engagement** — para serviços tier-1 (production-bound, user-facing, paid tier). PRR conduzido por SRE/external com 6 axes review profundo. **Default para Edge Functions user-facing**.
    - **Frameworks / SRE Platform** — para múltiplos serviços built on top de plataforma comum (ex: framework interno que outros times usam). PRR uma vez por plataforma, depois auto-herança para serviços novos.

    ### Quando re-rodar PRR

    - Após mudança maior (rewrite, novo dependency externo, RPS 10×, nova RLS strategy)
    - Antes de aumentar tráfego cross-tier (free → paid → enterprise)
    - Re-run anual mesmo sem mudança (entropia operacional)

    > **PRR NÃO é one-shot** — statement "passou PRR uma vez em 2024" não é evidence em 2026.

    ### Anti-patterns prevenidos

    - Auto-PRR pelo time dev → SEMPRE par externo ou SRE conduz (eyes-on-code novos)
    - "Deploy primeiro, PRR depois" → SEMPRE PRR ANTES de aceitar tráfego real (≥ 1% users)
    - Pular axe (ex: ignorar Capacity Planning porque "feature é small") → SEMPRE 6 axes; pular 1 = aprovação inválida (lacuna oculta vira incident em 6 meses)
    - "Acreditamos que está pronto" → SEMPRE evidence-based (load test report, runbook URL, dashboard link)
    ```

    Posicionamento exato: depois da última linha do bloco `## Observabilidade integrada` (parágrafo sobre Validação ODD com as 4 perguntas pré-PR), com 1 linha em branco antes da nova heading.
  </action>
  <acceptance_criteria>
    - Heading `## Production Readiness Review` existe (count == 1)
    - Cross-refs Markdown literais `[production-readiness-review](../skills/production-readiness-review/SKILL.md)` E `[prr-conductor](./prr-conductor.md)` presentes
    - Tabela 6 axes presente (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) com adaptação Supabase-specific
    - 3 engagement models (Simple, Early Engagement, Frameworks) listados
    - Bloco "Quando re-rodar PRR" presente
    - Bloco "Anti-patterns prevenidos" presente com 4+ items
    - Frase "PRR NÃO é one-shot" presente
    - Heading `## Observabilidade integrada` preservada
  </acceptance_criteria>
</task>

<task id="39-04-T4" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (re-leitura completa)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO
    head -6 kit/agents/supabase-architect.md
    # Esperado:
    # ---
    # name: supabase-architect
    # description: Projeta schema + RLS + topologia realtime ANTES da implementação. Pergunta Free vs Pro upfront. Alerta sobre custo de branches abertas. NÃO escreve código.
    # tools: Read, Write, Bash, Grep, Glob, AskUserQuestion, mcp__supabase__list_tables, mcp__supabase__list_extensions
    # color: blue
    # ---

    # 2. Heading ## Production Readiness Review existe
    grep -c "^## Production Readiness Review" kit/agents/supabase-architect.md  # esperado: 1

    # 3. Cross-refs ATIVOS
    grep -c "\[production-readiness-review\](../skills/production-readiness-review/SKILL.md)" kit/agents/supabase-architect.md  # esperado: ≥1
    grep -c "\[prr-conductor\](./prr-conductor.md)" kit/agents/supabase-architect.md  # esperado: ≥1

    # 4. 6 axes literais
    grep -c "System Architecture" kit/agents/supabase-architect.md           # esperado: ≥1
    grep -c "Instrumentation" kit/agents/supabase-architect.md               # esperado: ≥1
    grep -c "Emergency Response" kit/agents/supabase-architect.md            # esperado: ≥1
    grep -c "Capacity Planning" kit/agents/supabase-architect.md             # esperado: ≥1
    grep -c "Change Management" kit/agents/supabase-architect.md             # esperado: ≥1
    grep -c "Performance" kit/agents/supabase-architect.md                   # esperado: ≥1

    # 5. 3 engagement models
    grep -c "Simple PRR\|Simple " kit/agents/supabase-architect.md           # esperado: ≥1
    grep -c "Early Engagement" kit/agents/supabase-architect.md              # esperado: ≥1
    grep -c "Frameworks.*Platform\|SRE Platform" kit/agents/supabase-architect.md  # esperado: ≥1

    # 6. Template ## 10. PRR pré-production
    grep -c "^## 10\. PRR pré-production\|## 10\. PRR" kit/agents/supabase-architect.md  # esperado: ≥1

    # 7. Headings preservadas
    grep -c "^## Observabilidade integrada" kit/agents/supabase-architect.md  # esperado: 1

    # 8. Diff puro de adição
    git diff --numstat kit/agents/supabase-architect.md
    # Esperado: insertions > 0; deletions ≤ 2

    # 9. Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/agents/supabase-architect.md" ] && grep -q "Production Readiness Review" "$TMP/.claude/agents/supabase-architect.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `head -6` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^## Production Readiness Review"` == 1
    - 2 cross-refs Markdown ativos presentes
    - 6 axes nominados ≥ 1× cada
    - 3 engagement models (Simple, Early, Frameworks) presentes
    - Template ganhou `## 10. PRR pré-production`
    - `## Observabilidade integrada` preservada
    - Smoke sync propaga
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico
- [ ] Template Markdown ganhou seção `## 10. PRR pré-production` (entre "## 8. Próximos passos" e fim do bloco)
- [ ] Nova seção `## Production Readiness Review` adicionada após `## Observabilidade integrada`
- [ ] 6 axes do PRR adaptados para contexto Supabase (tabela)
- [ ] 3 engagement models documentados (Simple, Early Engagement, Frameworks/SRE Platform)
- [ ] Quando re-rodar PRR explicitado
- [ ] Anti-patterns (auto-PRR, deploy primeiro PRR depois, pular axe, "acreditamos que está pronto") explícitos
- [ ] Cross-refs Markdown ativos (skill + agent)
- [ ] Smoke sync valida
- [ ] Cobre INT-SB-V2-02 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.8 (anti-pitfall A2)
2. Plano arquitetural sempre sugere PRR (não opcional)
3. 6 axes do PRR adaptados ao contexto Supabase (não cópia genérica — RLS isolamento, branch billing, Edge concurrent, RLS explain plan)
4. 3 engagement models para escolher conforme criticidade (Simple para internal; Early para tier-1 user-facing default)
5. Cross-refs ATIVOS para skill (knowledge canônico) + agent (conductor que executa)
6. Anti-pattern auto-PRR explicitamente bloqueado
7. PRR como gate ANTES de tráfego (não depois)
8. Smoke sync valida descoberta em `.claude/agents/`

## Notes

- **Patch editorial substancial** — adiciona ~80 linhas de seção dedicada + ~10 linhas no template
- v1.8 (`## Observabilidade integrada`) e v1.10 (`## Production Readiness Review`) coexistem: v1.8 cobre "como instrumentar"; v1.10 cobre "como verificar antes de production"
- Plano gerado pelo `supabase-architect` agora termina recomendando PRR — `prr-conductor` (Phase 37) executa de fato
- Phase 41 vai criar gate `prr-checklist-coverage` que verifica os 6 axes em PRR-REPORT.md gerado

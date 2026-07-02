---
phase: 39
plan: 05
title: Patch supabase-migration-writer — alerta sobre toil em scripts SQL repetitivos
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/supabase-migration-writer.md
requirements: [INT-SB-V2-03]
status: ready
---

# Plan 05 — Patch `kit/agents/supabase-migration-writer.md`

## Goal

Estender o agente `supabase-migration-writer` (v1.8) para que **scripts SQL repetitivos identifiquem-se como candidatos a toil** — rebuild de índices manuais, vacuums recorrentes, refresh manual de materialized views, dump+restore manual etc. são 6-critérios-canônicos toil e devem ser automatizados via `pg_cron`. Patch adiciona seção "Alerta toil" referenciando a skill `eliminating-toil` (v1.10 / Phase 36) e o agente `toil-auditor` (v1.10 / Phase 37). Frontmatter (`description`, `tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-SB-V2-03**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/agents/supabase-migration-writer.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `name`, `description`, `tools` (`Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__apply_migration`), `color: yellow` preservados byte-a-byte
- **Cross-ref Markdown ATIVO** — `[eliminating-toil](../skills/eliminating-toil/SKILL.md)` + `[toil-auditor](./toil-auditor.md)`
- **Posicionamento canônico** — patch é nova seção `## Alerta toil — automação via pg_cron` inserida **após** `## Observabilidade integrada` (que é o último bloco de v1.8) e como **última seção** do arquivo
- **Não modificar Steps existentes (0-6)** — toda lógica de geração de migration preservada
- **Não modificar bloco `## Observabilidade integrada`** — v1.8 já documenta migration_event + audit triggers
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes; usar code fences sql consistentes

## Tasks

<task id="39-05-T1" name="Verificar estado e localizar âncoras de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-migration-writer.md (frontmatter linhas 1-6 + localizar `## Observabilidade integrada` + última linha do arquivo)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 20-35 — capturar 6 critérios canônicos + regra ≤ 50%)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual (`name: supabase-migration-writer`, `tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__apply_migration`, `color: yellow`)
    2. Localizar âncora `## Observabilidade integrada` (esperada ~linha 158)
    3. Localizar **última linha** do arquivo (output adicionado seção/parágrafo)
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado
    - `## Observabilidade integrada` localizada
    - Skill `eliminating-toil` e agent `toil-auditor` confirmados existir
  </acceptance_criteria>
</task>

<task id="39-05-T2" name="Inserir nova seção ## Alerta toil — automação via pg_cron">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-migration-writer.md (foco em final do arquivo + bloco `## Observabilidade integrada` para entender padrão de seção integrada)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (6 critérios + decision tree)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** o bloco completo `## Observabilidade integrada` (que termina com parágrafo "Output adicionado: seção..."), uma nova seção como **última seção** do arquivo:

    ```markdown
    ## Alerta toil — automação via pg_cron

    > Cross-ref canônico: [eliminating-toil](../skills/eliminating-toil/SKILL.md) (cap 5 do livro Google SRE — Eliminating Toil). Para auditoria sistemática de toil em todo o repo, delegar para [toil-auditor](./toil-auditor.md).

    Migrations SQL executadas **manualmente em cadência regular** (rebuild índice, VACUUM, REFRESH MATERIALIZED VIEW, ANALYZE) são toil canônico — passam todos os 6 critérios: manual, repetitivo, automatizável, tático, sem valor durável, escala linear. Este agent **detecta padrões de toil** ao escrever migration e **alerta proativamente** sugerindo automação via `pg_cron`.

    ### 6 critérios — quando uma migration é toil-prone

    Migration descreve operação que será re-executada > 1× = toil-prone. Aplicar 6 critérios da skill `eliminating-toil`:

    | Critério | Pergunta | Sinal de toil |
    |---|---|---|
    | 1. Manual | Operador roda `psql` ou aplica migration "quando lembra"? | Sim |
    | 2. Repetitivo | Já foi executada 3+ vezes em milestones diferentes? | Sim |
    | 3. Automatizável | `pg_cron` consegue agendar sem julgamento humano? | Sim |
    | 4. Tático | Reage a sintoma (lentidão, bloat, stale view) sem planejar? | Sim |
    | 5. Sem valor durável | Não cria asset permanente — só "limpa" estado | Sim |
    | 6. Escala linear | Mais users / mais dados = mais frequência manual | Sim |

    Se TODOS os 6 = sim → **toil**. Bloquear migration manual recorrente; oferecer alternativa via `pg_cron`.

    ### Padrões SQL canônicos que SEMPRE disparam alerta toil

    | Operação manual | Por quê é toil | Automação canônica |
    |---|---|---|
    | `REINDEX TABLE x` recorrente (a cada N semanas) | Rebuild de bloat de índice é tático, sem valor durável, repetitivo | `select cron.schedule('reindex_x', '0 3 * * 0', $$reindex table x$$);` (semanal 3am) |
    | `VACUUM ANALYZE x` manual | autovacuum não está acompanhando — sintoma de tuning, não fix manual | Tunar `autovacuum_vacuum_scale_factor` para tabela específica + `pg_cron` se necessário |
    | `REFRESH MATERIALIZED VIEW x` manual | Stale view detectada por user reclamação ou alert | `select cron.schedule('refresh_x', '*/30 * * * * *', $$refresh materialized view concurrently x$$);` |
    | `ANALYZE` em tabela após bulk insert manual | Estatísticas desatualizadas após ETL — bem conhecido | Trigger AFTER INSERT/COPY com `analyze` no fim do batch, ou `pg_cron` pós-ETL |
    | `delete from logs where created_at < now() - interval '90d'` manual recorrente | Retention manual = toil clássico | `select cron.schedule('purge_logs', '0 4 * * *', $$delete from logs where ...$$);` |
    | `dump + restore` periódico para estatísticas / planos cache | Operação repetitiva sem valor permanente | `pg_cron` job ou `pg_stat_reset_*()` calls automatizadas |

    ### Snippet canônico — converter manual em pg_cron

    ```sql
    -- PT-BR: ANTES — toil (operador roda manualmente)
    -- $ psql -c 'reindex table heavy_table;'   ← repetir a cada 2 semanas

    -- PT-BR: DEPOIS — automação via pg_cron (necessita extension pg_cron habilitada)
    create extension if not exists pg_cron;

    select cron.schedule(
      'reindex_heavy_table_biweekly',
      '0 3 1,15 * *',                            -- 3am dias 1 e 15
      $$ reindex table public.heavy_table $$
    );

    -- PT-BR: monitor — falha em job pg_cron emite linha em cron.job_run_details
    -- alimentar alerta SLO se job falha 3+ vezes seguidas
    ```

    ### Quando NÃO automatizar (não é toil)

    - **Migration de schema (DDL one-shot)** — `create table`, `alter table add column` são project work, não toil. Não recorrentes.
    - **Backfill data único** — `update orders set status = ...` aplicado 1× para corrigir bug é grungy work, não toil.
    - **Rebuild que requer julgamento** — `reindex` que requer escolher hora baseada em load patterns variáveis, ou que precisa coordenação com release. Mantém manual mas documenta runbook.

    ### Output do agent — adicionado ao SQL gerado

    Quando o agent detecta que a migration descreve operação toil-prone (regex em DDL: `reindex|vacuum|refresh materialized|delete from .* interval`), adiciona comentário-alerta no header do arquivo SQL gerado:

    ```sql
    /*
      ⚠ TOIL ALERT — esta operação parece recorrente.
      
      Se será executada em cadência regular, considere automação via pg_cron:
        select cron.schedule('<job_name>', '<schedule>', $$ <sql> $$);
      
      Cross-ref: kit/skills/eliminating-toil/SKILL.md (6 critérios canônicos)
                 kit/agents/toil-auditor.md (audit sistemático para repo todo)
    */
    ```

    ### Anti-patterns prevenidos

    - "Roda quando der" runbook → SEMPRE pg_cron + monitoring de falha do job
    - `pg_cron` schedule mas sem alerta de falha → SEMPRE incluir SLO em `cron.job_run_details` (% sucesso 30d)
    - Automação parcial (script humano-iniciado) → ainda é toil (humano pressiona botão); preferir cron.schedule completo
    - Migration manual recorrente "porque é só uma vez por mês" → 12×/ano = toil, regra ≤ 50% se acumular vários "só um por mês"
    ```

    Posicionamento exato: depois da última linha do bloco `## Observabilidade integrada` (parágrafo final "Output adicionado: seção..."), com 1 linha em branco antes da nova heading. Esta nova seção é a ÚLTIMA do arquivo.
  </action>
  <acceptance_criteria>
    - Heading `## Alerta toil — automação via pg_cron` existe (count == 1)
    - Cross-refs Markdown literais `[eliminating-toil](../skills/eliminating-toil/SKILL.md)` E `[toil-auditor](./toil-auditor.md)` presentes
    - Tabela 6 critérios presente
    - Tabela "Padrões SQL canônicos que SEMPRE disparam alerta toil" com 5+ rows (REINDEX, VACUUM, REFRESH MV, ANALYZE, DELETE retention)
    - Snippet canônico `cron.schedule(` presente
    - Bloco "Quando NÃO automatizar" presente (3 categorias: DDL one-shot, backfill único, rebuild com julgamento)
    - Bloco "Output do agent — adicionado ao SQL gerado" com template `⚠ TOIL ALERT —`
    - Bloco "Anti-patterns prevenidos" com 4+ items
    - Heading `## Observabilidade integrada` preservada
  </acceptance_criteria>
</task>

<task id="39-05-T3" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-migration-writer.md (re-leitura completa)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO
    head -6 kit/agents/supabase-migration-writer.md
    # Esperado:
    # ---
    # name: supabase-migration-writer
    # description: Escreve migrations Supabase seguindo declarative schema + RLS obrigatório + style guide. Detecta layout schemas/ vs migrations/ no boot. MCP-first com fallback offline.
    # tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__apply_migration
    # color: yellow
    # ---

    # 2. Heading nova existe
    grep -c "^## Alerta toil" kit/agents/supabase-migration-writer.md  # esperado: 1

    # 3. Cross-refs ATIVOS
    grep -c "\[eliminating-toil\](../skills/eliminating-toil/SKILL.md)" kit/agents/supabase-migration-writer.md  # esperado: ≥1
    grep -c "\[toil-auditor\](./toil-auditor.md)" kit/agents/supabase-migration-writer.md  # esperado: ≥1

    # 4. pg_cron mencionado canônicamente
    grep -c "pg_cron\|cron\.schedule" kit/agents/supabase-migration-writer.md  # esperado: ≥3

    # 5. 6 critérios canônicos referenciados
    grep -c "Manual\|Repetitivo\|Automatizável\|Tático\|valor durável\|escala linear" kit/agents/supabase-migration-writer.md  # esperado: ≥4 matches diferentes

    # 6. Operações canônicas detectadas
    grep -ic "REINDEX" kit/agents/supabase-migration-writer.md            # esperado: ≥1
    grep -ic "VACUUM" kit/agents/supabase-migration-writer.md             # esperado: ≥1
    grep -ic "REFRESH MATERIALIZED" kit/agents/supabase-migration-writer.md  # esperado: ≥1

    # 7. Template TOIL ALERT
    grep -c "TOIL ALERT" kit/agents/supabase-migration-writer.md  # esperado: ≥1

    # 8. Headings preservadas
    grep -c "^## Observabilidade integrada" kit/agents/supabase-migration-writer.md  # esperado: 1

    # 9. Diff puro de adição
    git diff --numstat kit/agents/supabase-migration-writer.md
    # Esperado: insertions > 0; deletions == 0

    # 10. Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/agents/supabase-migration-writer.md" ] && grep -q "Alerta toil" "$TMP/.claude/agents/supabase-migration-writer.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `head -6` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^## Alerta toil"` == 1
    - 2 cross-refs Markdown ativos (eliminating-toil + toil-auditor)
    - `pg_cron` / `cron.schedule` mencionado ≥ 3×
    - 6 critérios canônicos presentes
    - REINDEX, VACUUM, REFRESH MATERIALIZED nominados
    - Template `TOIL ALERT` presente
    - Smoke sync propaga
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico
- [ ] Heading `## Alerta toil — automação via pg_cron` adicionada (após `## Observabilidade integrada`, última seção do arquivo)
- [ ] 6 critérios canônicos tabulados
- [ ] Padrões SQL toil-prone tabulados (REINDEX, VACUUM, REFRESH MV, ANALYZE, DELETE retention) — 5+ rows
- [ ] Snippet `cron.schedule(...)` canônico presente
- [ ] Bloco "Quando NÃO automatizar" diferencia toil de DDL one-shot, backfill único, rebuild com julgamento
- [ ] Template comentário SQL `⚠ TOIL ALERT —` para output do agent
- [ ] Anti-patterns explicit (manual recorrente, sem alerta job failure, automação parcial, "só uma vez por mês")
- [ ] Cross-refs Markdown ativos (skill + agent)
- [ ] Smoke sync valida
- [ ] Cobre INT-SB-V2-03 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.8 (anti-pitfall A2)
2. Migration writer detecta padrões SQL recorrentes (REINDEX/VACUUM/REFRESH MV) e ALERTA via comentário SQL
3. 6 critérios canônicos de toil tabulados — operador aplica e classifica
4. `pg_cron` como solução canônica de automação (com snippet pronto)
5. Distinção toil vs DDL one-shot vs backfill único vs grungy work explícita (não confundir)
6. Cross-refs ATIVOS para skill (knowledge canônico) + agent (audit sistemático)
7. Anti-patterns explícitos (manual recorrente, sem alerta, automação parcial)
8. Smoke sync valida descoberta em `.claude/agents/`

## Notes

- **Patch editorial substancial** — adiciona ~80-100 linhas de seção dedicada
- v1.8 (`## Observabilidade integrada`) cobre migration_event + audit triggers; v1.10 (`## Alerta toil`) cobre quando automatizar a próxima execução da migration
- Phase 40 (INT-FW-V2-03) integra `/auditar-marco` para invocar `/auditar-toil` automaticamente; este patch garante que migrations geradas durante o milestone já tenham alertas de toil quando aplicável
- Phase 41 vai criar gate `golden-signals-coverage` (não diretamente relacionado a este patch, mas linha consistente)

---
phase: 39
plan: 02
title: Patch omm-auditor — Capacidade 3 consulta toil-auditor
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/omm-auditor.md
requirements: [INT-OBS-02]
status: ready
---

# Plan 02 — Patch `kit/agents/omm-auditor.md`

## Goal

Estender o agente `omm-auditor` (v1.9) para que a **Capacidade 3 (Complexidade / Tech Debt)** consulte o agente `toil-auditor` (v1.10 / Phase 37) quando dispondo dos artefatos. Score OMM-3 passa a considerar **% de toil pelo time** como evidência objetiva de complexidade operacional. Frontmatter (`description`, `tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-OBS-02**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/agents/omm-auditor.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `description`, `tools` (`Read, Write, Bash, Grep, Glob, mcp__supabase__execute_sql`), `color` preservados byte-a-byte
- **Cross-ref Markdown ATIVO** — `[toil-auditor](./toil-auditor.md)` (relative link real)
- **Posicionamento canônico** — patch concentra-se em (a) Step 0 — coleta de evidências (adicionar leitura de TOIL-AUDIT.md se existir + invocação opcional de `toil-auditor`); (b) Step 1 — tabela "score por capacidade" com regra de scoring para Cap 3 incorporando % toil; (c) exemplo de OMM-REPORT.md (Capacidade 3 com sintoma "% toil pelo time")
- **Não alterar 5 capacidades canônicas** — modelo OMM permanece 5-capacidade; apenas Cap 3 ganha evidence specific
- **Sem alterar Steps 2-5** — Steps 0 e 1 são os pontos de patch; demais permanecem estáveis
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes da redação original

## Tasks

<task id="39-02-T1" name="Verificar estado e localizar âncoras de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (arquivo target — frontmatter linhas 1-6 + localizar Step 0 e Step 1)
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (linhas 1-30 — frontmatter + inputs esperados, para conhecer interface)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 1-30 — confirmar regra ≤ 50% canônica)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual: `name: omm-auditor` + `tools: Read, Write, Bash, Grep, Glob, mcp__supabase__execute_sql`
    2. Localizar âncora `### Step 0 — Coletar evidências` (esperada ~linha 31)
    3. Localizar âncora `### Step 1 — Score cada capacidade (1-5)` (esperada ~linha 67)
    4. Localizar exemplo `### Capacidade 1 — Resiliência (3, ↑)` no template do OMM-REPORT.md (esperada ~linha 134)
  </action>
  <acceptance_criteria>
    - Frontmatter atual confirmado byte-a-byte
    - Step 0, Step 1 e exemplo de Capacidade 3 localizados
    - Skill `eliminating-toil` e agent `toil-auditor` confirmados existir
  </acceptance_criteria>
</task>

<task id="39-02-T2" name="Patch Step 0 — coleta de evidências de toil">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (foco em Step 0, especificamente fim do bloco bash de evidências)
  </read_first>
  <action>
    Adicionar sub-bloco "**Capacidade 3 — Complexidade / Tech Debt:**" dentro do Step 0, **logo após o bloco** "**Capacidade 4 — Cadência:**" — mantém ordem 1, 4, 3 já presente apenas adiciona Cap 3 sem reorganizar:

    Use Edit para inserir, imediatamente antes da heading `### Step 1 — Score cada capacidade (1-5)`, o seguinte bloco:

    ```markdown
    **Capacidade 3 — Complexidade / Tech Debt (cross-ref [toil-auditor](./toil-auditor.md)):**

    Toil é evidência primária de complexidade operacional — quanto mais o time gasta em trabalho manual repetitivo, maior o tech debt operacional. Para alimentar score Cap 3 com evidência objetiva (não percepção), invoque `toil-auditor` antes de pontuar:

    ```bash
    # PT-BR: 1) Tentar reusar TOIL-AUDIT.md existente (output canônico de toil-auditor)
    if [ -f .planning/TOIL-AUDIT.md ]; then
      TOIL_AUDIT_EXISTS=1
    else
      TOIL_AUDIT_EXISTS=0
    fi

    # PT-BR: 2) Extrair % do tempo do time gasto em toil (se TOIL-AUDIT.md existir)
    # Toda TOIL-AUDIT.md tem linha "Toil estimado: X.X horas-pessoa/semana (Y% do tempo do time)"
    if [ "$TOIL_AUDIT_EXISTS" = "1" ]; then
      TOIL_PCT=$(grep -oE '[0-9]+(\.[0-9]+)?% do tempo do time' .planning/TOIL-AUDIT.md | head -1 | grep -oE '[0-9]+(\.[0-9]+)?')
    fi
    ```

    **Se TOIL-AUDIT.md NÃO existe** — invoque `toil-auditor` antes de pontuar Cap 3 (caller pode delegar via `Task(subagent_type="toil-auditor", prompt="Audit toil em <project_root>; team_size <N>; output em .planning/TOIL-AUDIT.md")`). O resultado alimenta scoring abaixo.

    **Se TOIL-AUDIT.md existe MAS data > 30d** — sinalize stale na seção "Sintomas observados" e prefira re-executar `toil-auditor`.

    ```

    Posicionamento exato: este bloco ENTRA antes da linha que diz `### Step 1 — Score cada capacidade (1-5)` (essa heading não muda).
  </action>
  <acceptance_criteria>
    - Bloco `**Capacidade 3 — Complexidade / Tech Debt (cross-ref [toil-auditor](./toil-auditor.md)):**` inserido em Step 0
    - Cross-ref Markdown literal `[toil-auditor](./toil-auditor.md)` presente
    - Bloco contém shell snippet que checa `.planning/TOIL-AUDIT.md`
    - Bloco menciona reuso (se existe) e invocação opcional via Task dispatch (se não existe)
    - Heading `### Step 1 — Score cada capacidade (1-5)` preservada (não tocada)
  </acceptance_criteria>
</task>

<task id="39-02-T3" name="Patch Step 1 — regra de scoring Cap 3 com toil">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (Step 1 completo — entender modelo 1-5 atual)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (regra ≤ 50% canônica)
  </read_first>
  <action>
    Adicionar, **dentro do Step 1** (após a tabela `1 = Initial...5 = Optimizing`), bloco específico para Cap 3:

    Use Edit para inserir, imediatamente antes da linha `Para cada score, citar 2-3 sintomas-chave concretos da skill `observability-maturity-model`.`, o seguinte bloco:

    ```markdown
    **Regra específica Cap 3 (Complexidade / Tech Debt) — incorpora % toil:**

    | Score | % toil pelo time | Sintoma operacional |
    |---|---|---|
    | 1 (Initial) | > 60% ou desconhecido | Time apaga incêndios; sem audit de toil; "tudo é urgente" |
    | 2 (Repeatable) | 50-60% | Toil reconhecido mas não auditado; "sabemos que tem mas não medimos" |
    | 3 (Defined) | 30-50% | TOIL-AUDIT.md existe; itens P0 endereçados; mas regra ≤ 50% no fio |
    | 4 (Managed) | 15-30% | Toil consistentemente sob 50%; automação rolling; cultura de "não fazer 3× sem script" |
    | 5 (Optimizing) | < 15% | Toil é exceção; novos features projetados com automação no design (anti-toil by-design) |

    **Regra absoluta**: Cap 3 score nunca é > 3 se TOIL-AUDIT.md ausente — sem evidência objetiva, defaultar a 2 (mesmo que sintomas qualitativos sugiram acima). Score 4-5 exige TOIL-AUDIT.md fresco (≤ 30d) com `% toil pelo time < 30%`.

    Para outros sintomas qualitativos da Cap 3 (skills observability instaladas, cobertura de runbooks, hero culture indicators), continue consultando a skill [`observability-maturity-model`](../skills/observability-maturity-model/SKILL.md).

    ```

    Posicionamento exato: este bloco ENTRA depois da tabela "1 = Initial..." e antes da linha "Para cada score, citar 2-3 sintomas...".
  </action>
  <acceptance_criteria>
    - Bloco `**Regra específica Cap 3 (Complexidade / Tech Debt) — incorpora % toil:**` presente em Step 1
    - Tabela markdown com 5 rows (Score 1-5) com 3 colunas (Score, % toil, Sintoma operacional)
    - Linha "Regra absoluta" presente proibindo score > 3 sem TOIL-AUDIT.md
    - Cross-ref `[observability-maturity-model](../skills/observability-maturity-model/SKILL.md)` preservado / presente
    - Bloco linha "Para cada score, citar 2-3 sintomas-chave..." preservada
  </acceptance_criteria>
</task>

<task id="39-02-T4" name="Patch exemplo OMM-REPORT.md (Capacidade 3)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (template OMM-REPORT.md, foco em "### Capacidade 1 — Resiliência (3, ↑)")
  </read_first>
  <action>
    No bloco template `### Step 4 — Gerar OMM-REPORT.md`, adicionar (dentro do exemplo de OMM-REPORT.md gerado), **após** a `### Capacidade 1 — Resiliência (3, ↑)` (e antes do `[... outras capacidades ...]`), um exemplo concreto de Capacidade 3:

    Use Edit para inserir, imediatamente antes da linha `[... outras capacidades ...]`, o seguinte:

    ```markdown
    ### Capacidade 3 — Complexidade / Tech Debt (3, ↑)

    **Doing well:**
    - TOIL-AUDIT.md gerado em 2026-05-06 (ver `.planning/TOIL-AUDIT.md`)
    - % toil pelo time = 38% (abaixo da regra ≤ 50%)
    - 4 itens P0 já automatizados desde milestone anterior (deploy manual, migration manual, log rotation, secret rotation)

    **Doing poorly:**
    - 6 itens P1 pendentes — agendados mas sem owner nomeado
    - Cap 3 ainda em score 3 (não 4) porque automação é reativa, não by-design — features novas adicionam toil que é eliminado depois

    **Action items derivados:**
    - **[Cap 3]** Adicionar gate "anti-toil-by-design" em fluxo `/discutir-fase` (P2)
    - **[Cap 3]** Designar owners para os 6 P1 da TOIL-AUDIT.md (P1)

    ```

    Posicionamento: dentro do bloco markdown que está dentro de `\`\`\`markdown` (template do OMM-REPORT.md exemplificado).
  </action>
  <acceptance_criteria>
    - Bloco `### Capacidade 3 — Complexidade / Tech Debt (3, ↑)` presente no exemplo OMM-REPORT.md
    - Bloco menciona literal `% toil pelo time` (sintoma derivado de TOIL-AUDIT.md)
    - Bloco cita `.planning/TOIL-AUDIT.md` como path canônico
    - Bloco contém regra ≤ 50% como benchmark
    - Linha `[... outras capacidades ...]` preservada (não removida)
  </acceptance_criteria>
</task>

<task id="39-02-T5" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/omm-auditor.md (re-leitura completa para confirmação)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO
    head -6 kit/agents/omm-auditor.md
    # Esperado:
    # ---
    # name: omm-auditor
    # description: Pontua projeto contra Observability Maturity Model (1-5 em 5 capacidades — resiliência, qualidade, complexidade, cadência, comportamento). Output OMM-REPORT.md acionável.
    # tools: Read, Write, Bash, Grep, Glob, mcp__supabase__execute_sql
    # color: purple
    # ---

    # 2. Cross-refs ATIVOS
    grep -c "\[toil-auditor\](./toil-auditor.md)" kit/agents/omm-auditor.md  # esperado: ≥1

    # 3. Capacidade 3 mencionada com toil em 3 contextos (Step 0, Step 1, exemplo OMM-REPORT)
    grep -c "Capacidade 3 — Complexidade / Tech Debt" kit/agents/omm-auditor.md  # esperado: ≥3

    # 4. Path canônico TOIL-AUDIT.md citado
    grep -c "\.planning/TOIL-AUDIT\.md" kit/agents/omm-auditor.md  # esperado: ≥2

    # 5. Regra ≤ 50% citada
    grep -E "(≤ ?50%|<= ?50%|50% do tempo|regra.*50)" kit/agents/omm-auditor.md  # esperado: ≥1 match

    # 6. Modelo 5-capacidades preservado
    grep -c "^| 5 |" kit/agents/omm-auditor.md  # esperado: ≥1 (tabela score por capacidade tem 5 rows)

    # 7. Diff puro de adição (zero linhas removidas em conteúdo existente)
    git diff --numstat kit/agents/omm-auditor.md
    # Esperado: insertions > 0, deletions == 0 (ou apenas linhas movidas se Edit reescreveu blocos)

    # 8. Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/agents/omm-auditor.md" ] && grep -q "toil-auditor" "$TMP/.claude/agents/omm-auditor.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `head -6` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "\[toil-auditor\](./toil-auditor.md)"` ≥ 1
    - `grep -c "Capacidade 3 — Complexidade / Tech Debt"` ≥ 3 (Step 0 cross-ref, Step 1 tabela, OMM-REPORT exemplo)
    - `.planning/TOIL-AUDIT.md` citado ≥ 2× (path canônico)
    - Regra "≤ 50%" presente
    - Smoke sync propaga patch e cross-ref para `.claude/agents/omm-auditor.md`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico (`description`, `tools`, `color` inalterados)
- [ ] Step 0 ganhou bloco `**Capacidade 3 — Complexidade / Tech Debt (cross-ref [toil-auditor](./toil-auditor.md))**` com shell snippet de check de TOIL-AUDIT.md
- [ ] Step 1 ganhou tabela 5-row scoring específica para Cap 3 incorporando % toil
- [ ] Exemplo OMM-REPORT.md ganhou bloco `### Capacidade 3 — Complexidade / Tech Debt (3, ↑)` com sintoma `% toil pelo time`
- [ ] Cross-ref Markdown literal `[toil-auditor](./toil-auditor.md)` presente
- [ ] Path canônico `.planning/TOIL-AUDIT.md` citado ≥ 2×
- [ ] Regra ≤ 50% explícita
- [ ] Modelo 5-capacidade preservado (tabela continua 5 rows)
- [ ] Smoke sync propaga
- [ ] Cobre INT-OBS-02 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.9 (anti-pitfall A2)
2. Capacidade 3 ganha evidence objetiva (% toil) — não mais só percepção
3. Cross-ref ATIVO `toil-auditor` em 1+ ponto — descoberta cross-agent
4. Regra "score > 3 exige TOIL-AUDIT.md fresco" — incentiva uso real do agent novo
5. Tabela scoring específica para Cap 3 (não substitui modelo geral; complementa)
6. Exemplo OMM-REPORT.md mostra como sintoma "% toil" aparece no relatório final
7. Modelo 5-capacidade canônico (resiliência, qualidade, complexidade, cadência, comportamento) preservado integralmente
8. Smoke sync valida descoberta em `.claude/agents/`

## Notes

- **Patch editorial puro** — sem mudança em frontmatter; mudanças concentradas em Step 0, Step 1 e exemplo final
- Tamanho esperado do patch: ~50-70 linhas adicionadas
- Loop fechado: `omm-auditor` → `toil-auditor` → `eliminating-toil` skill — descoberta natural via Markdown links
- Phase 40 (INT-FW-V2-03) integra `/auditar-marco` para invocar `/auditar-toil` automaticamente; este patch é pré-requisito para que a auditoria de marco use o resultado

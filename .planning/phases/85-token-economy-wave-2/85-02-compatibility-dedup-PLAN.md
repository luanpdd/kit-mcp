---
phase: 85-token-economy-wave-2
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - kit/COMPATIBILITY.md
  - kit/agents/omm-auditor.md
  - kit/agents/supabase-edge-fn-writer.md
  - kit/agents/prr-conductor.md
  - kit/agents/release-pipeline-auditor.md
  - kit/agents/load-shedding-instrumenter.md
  - kit/agents/cascading-failures-auditor.md
  - kit/agents/observability-coverage-auditor.md
  - kit/agents/ai-mutation-tester.md
  - kit/agents/shotgun-surgery-detector.md
  - kit/agents/storytelling-analyst.md
  - kit/agents/payload-capture-instrumenter.md
  - kit/agents/seam-finder.md
  - kit/agents/legacy-characterizer.md
  - kit/agents/refactor-safety-auditor.md
  - kit/agents/supabase-storage-implementer.md
  - kit/agents/supabase-migration-writer.md
  - kit/agents/supabase-architect.md
  - kit/agents/postmortem-writer.md
  - kit/agents/toil-auditor.md
  - kit/agents/golden-signals-instrumenter.md
  - kit/agents/burn-rate-forecaster.md
  - kit/agents/slo-engineer.md
  - kit/agents/supabase-auth-bootstrapper.md
  - kit/agents/supabase-realtime-implementer.md
  - kit/agents/supabase-rls-writer.md
  - kit/agents/incident-investigator.md
  - kit/agents/observability-instrumenter.md
  - kit/file-manifest.json
  - test/unit/compatibility-dedup.test.js
autonomous: true
requirements:
  - PERF-15-02

must_haves:
  truths:
    - "kit/COMPATIBILITY.md existe com tabela canônica completa (matriz por agent + tier)"
    - "Os 27 agents tiveram bloco `## Compatibilidade` substituído por linha única `**Compat:** ...` com link para COMPATIBILITY.md"
    - "grep -l '## Compatibilidade' kit/agents/*.md retorna 0 matches"
    - "kit/file-manifest.json regenerado pós-edição (zero mismatches; sync install ainda funciona)"
    - "Informação semântica preservada — agents Supabase MCP-dependent ainda comunicam tier Partial/Offline-only via linha + COMPATIBILITY.md"
  artifacts:
    - path: "kit/COMPATIBILITY.md"
      provides: "Matriz canônica IDE × agent com tier e capability per-agent"
      min_lines: 50
      contains: "| Agent | Claude Code |"
    - path: "kit/file-manifest.json"
      provides: "SHA256 atualizados para os 27 agents editados"
      contains: "agents/omm-auditor.md"
    - path: "test/unit/compatibility-dedup.test.js"
      provides: "Regression tests: zero `## Compatibilidade` em agents, COMPATIBILITY.md existe + lista 27 agents, manifest verify ok"
      min_lines: 60
  key_links:
    - from: "kit/agents/<each>.md"
      to: "kit/COMPATIBILITY.md"
      via: "linha **Compat:** com markdown link relativo ../COMPATIBILITY.md"
      pattern: "\\[COMPATIBILITY\\.md\\]\\(\\.\\./COMPATIBILITY\\.md\\)"
    - from: "kit/COMPATIBILITY.md"
      to: "27 entradas na matriz (uma por agent)"
      via: "tabela markdown lista cada agent name como row"
      pattern: "supabase-architect|omm-auditor|prr-conductor"
    - from: "kit/file-manifest.json"
      to: "Conteúdo on-disk dos 27 agents + COMPATIBILITY.md"
      via: "SHA256 batem (verifyManifest passes)"
      pattern: "EMANIFESTMISMATCH não disparado em sync install"
---

<objective>
Eliminar a duplicação da tabela `## Compatibilidade` (~6-8 linhas) repetida em 27 agents (~150-200 linhas duplicadas no kit). Extrair matriz canônica para `kit/COMPATIBILITY.md` único; cada agent ganha 1 linha de referência. Regenerar `kit/file-manifest.json` para que sync install (Phase 83 verifyManifest) continue passando.

Purpose: Sessions que carregam múltiplos agents (executor + planner + ui-researcher etc) economizam ~3.2k tokens (audit estimate). Single source of truth — atualização de tier de IDE futura toca 1 arquivo, não 27.

Output: 1 novo arquivo (`kit/COMPATIBILITY.md`), 27 agents editados (apenas o bloco `## Compatibilidade...` substituído), 1 manifest regenerado, 1 arquivo de teste novo. Suite passing.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/85-token-economy-wave-2/85-CONTEXT.md
@src/core/manifest-verify.js
@kit/file-manifest.json

<interfaces>
# Estrutura existente

## kit/file-manifest.json — schema atual
```json
{
  "version": "1.13.0",
  "timestamp": "ISO date",
  "files": {
    "agents/<name>.md": "<sha256-hex>",
    "commands/<name>.md": "<sha256-hex>",
    "skills/<name>/SKILL.md": "<sha256-hex>",
    ...
  }
}
```

## src/core/manifest-verify.js — comportamento (lê em syncTo via SEC-14-05)
- Lê `kit/file-manifest.json`
- Para cada `<rel, expectedSha256>` em `files`, computa sha256 do arquivo on-disk em `<kitRoot>/<rel>`
- Retorna `{ok:false, reason:'...mismatch...', mismatches:[...], missing:[...]}` se algo divergir
- `EMANIFESTMISMATCH` thrown em syncTo bloqueia sync install
- Bypass: `KIT_MCP_SKIP_MANIFEST_CHECK=1`

## Os 27 agents que têm `## Compatibilidade` (verificado via grep)
```
omm-auditor, supabase-edge-fn-writer, prr-conductor, release-pipeline-auditor,
load-shedding-instrumenter, cascading-failures-auditor, observability-coverage-auditor,
ai-mutation-tester, shotgun-surgery-detector, storytelling-analyst,
payload-capture-instrumenter, seam-finder, legacy-characterizer,
refactor-safety-auditor, supabase-storage-implementer, supabase-migration-writer,
supabase-architect, postmortem-writer, toil-auditor, golden-signals-instrumenter,
burn-rate-forecaster, slo-engineer, supabase-auth-bootstrapper,
supabase-realtime-implementer, supabase-rls-writer, incident-investigator,
observability-instrumenter
```

## Padrões de tier observados em samples (omm-auditor, supabase-architect, toil-auditor, supabase-edge-fn-writer)
- **Pattern A — Filesystem-only "Full em todos"** (ex: toil-auditor, seam-finder, storytelling-analyst, supabase-edge-fn-writer): 5 rows, todos `**Full**`, "Idem"
- **Pattern B — Supabase MCP-dependent (Full/Partial/Offline-only)** (ex: omm-auditor, supabase-architect, prr-conductor, slo-engineer, burn-rate-forecaster, incident-investigator): tabela com 3 tiers — "Claude Code (com Supabase MCP)" + "Cursor (com Supabase MCP)" Full, "Codex"+"Gemini CLI" Partial, "Windsurf, Antigravity, Copilot, Trae" Offline-only

A determinação A vs B per-agent precisa ser feita lendo o arquivo (Read na Task 2). Não assumir cego.

## Bloco a substituir — formato textual exato

Cabeçalho: linha começando com `## Compatibilidade`
Corpo: linha em branco + tabela markdown (`| IDE | Tier | Capability |\n|---|---|---|\n` + 5 linhas) + opcionalmente nota (linha começando com `**Nota:**` ou `**Modo offline fallback:**`)
Final: linha em branco antes do próximo `## ` heading

A substituição deve consumir TUDO do `## Compatibilidade` até (mas não incluindo) o próximo `## ` heading.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar kit/COMPATIBILITY.md canônico com matriz per-agent</name>
  <files>kit/COMPATIBILITY.md</files>
  <read_first>
    Para cada um dos 27 agents listados em `<interfaces>`, ler o bloco `## Compatibilidade` (Read com offset/limit ou Grep -A 12) para extrair o tier + capability per-IDE. Use Grep batch para eficiência — ex:

    ```
    Grep "^## Compatibilidade" path: kit/agents/<name>.md output_mode:content -A 12
    ```

    Para os 27 agents (lista exata em files_modified do frontmatter, sem incluir o último COMPATIBILITY.md/manifest/test).

    Classificar cada agent em **Pattern A** (5 rows todos Full, "Idem") ou **Pattern B** (Full/Partial/Offline-only com Supabase MCP gating). Confirmação: agents sem `(com Supabase MCP)` na primeira row da tabela = Pattern A; com = Pattern B.
  </read_first>
  <action>
    Criar `kit/COMPATIBILITY.md` com a estrutura abaixo. Esta é a tabela canônica única — nenhum agent precisa repetir tier rows.

    Estrutura exata do arquivo:

    ```markdown
    # Compatibilidade Agent × IDE

    > Source of truth para tier × capability de cada agent em cada IDE suportado.
    > Agents linkam para este arquivo via `**Compat:** ...` no header. Single source — atualize aqui, não em cada agent.

    ## Visão Geral por Pattern

    Os agents do kit caem em 2 patterns de compatibilidade:

    - **Pattern A — Filesystem-only:** análise puramente local (Read/Grep/Bash + git). Funciona idêntico em todos os IDEs (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae) — tier **Full** em todos.
    - **Pattern B — Supabase MCP-dependent:** precisa de queries live (`mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, advisors). Tier varia por suporte do IDE ao Supabase MCP:
      - **Full** em Claude Code + Cursor (com Supabase MCP instalado)
      - **Partial** em Codex + Gemini CLI (lê filesystem; user roda queries manualmente e cola)
      - **Offline-only** em Windsurf, Antigravity, Copilot, Trae (apenas estrutura artefatos; user faz queries manualmente)

    Modo offline fallback (Pattern B): agent declara `[MODO OFFLINE — sem live data]` no output e marca itens MCP-dependentes como `EVIDENCE_PENDING_MCP` para o user preencher.

    ## Matriz por Agent

    | Agent | Pattern | Claude Code | Cursor | Codex | Gemini CLI | Windsurf, Antigravity, Copilot, Trae | Capability resumida |
    |---|---|---|---|---|---|---|---|
    | <agent-1> | A/B | Full | Full | Full/Partial | Full/Partial | Full/Offline-only | <resumo de 1 linha> |
    | ... | | | | | | | |
    ```

    **Para preencher a matriz**, para cada um dos 27 agents identificados em read_first:
    - Coluna "Agent": nome do agent (ex: `supabase-architect`)
    - Coluna "Pattern": `A` ou `B` baseado na classificação
    - Colunas "Claude Code", "Cursor", "Codex", "Gemini CLI", "Windsurf, Antigravity, Copilot, Trae": preencher com `Full`, `Partial`, ou `Offline-only` baseado na tabela original do agent
    - Coluna "Capability resumida": síntese de 1 linha do "Capability" da tabela original do agent (preserve a substância — ex: para supabase-architect: "live tabelas/extensions; declarative schema antes de migrations")

    NOTA — POR QUÊ matriz horizontal e não 27 sub-sections:
    Matriz horizontal é grep-friendly (1 linha por agent), table-rendering em IDEs, e mais compacta. 27 sub-sections explodiriam o arquivo para ~300 linhas vs ~50.

    NOTA — POR QUÊ preservar Capability resumida:
    A "Nota" original de alguns agents (ex: supabase-edge-fn-writer "não usa mcp__supabase__* — Edge Functions são arquivos locais") carrega informação não capturada apenas pelo tier. Sintetizar em 1 frase mantém a justificativa do tier.

    NOTA — POR QUÊ não tirar a Pattern column:
    Pattern (A/B) é o atalho semântico — leitor humano vê "ah, A → Full em todos" sem olhar todas as 5 colunas. Preserva o resumo "filesystem-only" / "Supabase MCP-dependent" que estava nas notas dos agents originais.

    Ao final do arquivo, adicionar seção curta de troubleshooting:

    ```markdown
    ## Troubleshooting

    **Pattern B agent reportou tier diferente do que esta matriz declara?** Verifique:
    1. Supabase MCP está instalado? `kit install dry-run claude-code` mostra MCP servers configurados.
    2. IDE host suporta MCP? Cursor/Claude Code têm suporte first-class; outros via stdio bridge ou paste.
    3. Versão do Supabase MCP — alguns tools (advisors) requerem versão recente.

    **Quer adicionar um agent novo aqui?** Edite a matriz acima — uma row. Não duplicar info no header do agent. Footer de cada agent já linka pra cá via `**Compat:** ...`.
    ```
  </action>
  <verify>
    <automated>
      node -e "const fs=require('fs'); const c=fs.readFileSync('kit/COMPATIBILITY.md','utf8'); const agents=['omm-auditor','supabase-edge-fn-writer','prr-conductor','release-pipeline-auditor','load-shedding-instrumenter','cascading-failures-auditor','observability-coverage-auditor','ai-mutation-tester','shotgun-surgery-detector','storytelling-analyst','payload-capture-instrumenter','seam-finder','legacy-characterizer','refactor-safety-auditor','supabase-storage-implementer','supabase-migration-writer','supabase-architect','postmortem-writer','toil-auditor','golden-signals-instrumenter','burn-rate-forecaster','slo-engineer','supabase-auth-bootstrapper','supabase-realtime-implementer','supabase-rls-writer','incident-investigator','observability-instrumenter']; const missing=agents.filter(a=>!c.includes('| '+a+' |')); if(missing.length){console.error('missing in matrix:',missing); process.exit(1);} console.log('all 27 agents present in COMPATIBILITY.md');"
    </automated>
    Arquivo existe em `kit/COMPATIBILITY.md`; todos 27 nomes de agent aparecem como rows na matriz; estrutura markdown válida.
  </verify>
  <done>
    - `kit/COMPATIBILITY.md` existe com header, seção "Visão Geral por Pattern", matriz com 27 rows (uma por agent), seção Troubleshooting
    - Cada agent tem Pattern (A ou B), tier per-IDE preenchido (Full/Partial/Offline-only), e Capability resumida
    - Verify automated passa (script confirma presença dos 27 names)
  </done>
</task>

<task type="auto">
  <name>Task 2: Substituir bloco `## Compatibilidade` em cada um dos 27 agents</name>
  <files>kit/agents/omm-auditor.md, kit/agents/supabase-edge-fn-writer.md, kit/agents/prr-conductor.md, kit/agents/release-pipeline-auditor.md, kit/agents/load-shedding-instrumenter.md, kit/agents/cascading-failures-auditor.md, kit/agents/observability-coverage-auditor.md, kit/agents/ai-mutation-tester.md, kit/agents/shotgun-surgery-detector.md, kit/agents/storytelling-analyst.md, kit/agents/payload-capture-instrumenter.md, kit/agents/seam-finder.md, kit/agents/legacy-characterizer.md, kit/agents/refactor-safety-auditor.md, kit/agents/supabase-storage-implementer.md, kit/agents/supabase-migration-writer.md, kit/agents/supabase-architect.md, kit/agents/postmortem-writer.md, kit/agents/toil-auditor.md, kit/agents/golden-signals-instrumenter.md, kit/agents/burn-rate-forecaster.md, kit/agents/slo-engineer.md, kit/agents/supabase-auth-bootstrapper.md, kit/agents/supabase-realtime-implementer.md, kit/agents/supabase-rls-writer.md, kit/agents/incident-investigator.md, kit/agents/observability-instrumenter.md</files>
  <read_first>
    Reusar a classificação Pattern A/B feita na Task 1 (já leu cada agent). Se foi feito em outro contexto, repetir Grep para confirmar pattern de cada agent antes de editar.
  </read_first>
  <action>
    Para cada um dos 27 agents listados em `<files>`, usar a ferramenta `Edit` para substituir o bloco `## Compatibilidade ... <até próximo `## ` heading exclusive>` por uma única linha de referência baseada no Pattern.

    **Linha canônica para Pattern A (filesystem-only, Full em todos):**
    ```
    **Compat:** Full em todos os IDEs (filesystem-only). Veja [COMPATIBILITY.md](../COMPATIBILITY.md).

    ```

    **Linha canônica para Pattern B (Supabase MCP-dependent):**
    ```
    **Compat:** Full em Claude Code + Cursor (com Supabase MCP); Partial em Codex + Gemini CLI; Offline-only em Windsurf/Antigravity/Copilot/Trae. Veja [COMPATIBILITY.md](../COMPATIBILITY.md).

    ```

    **Procedimento de edição (por agent):**

    1. Ler o agent completo para identificar:
       - Linha exata onde começa `## Compatibilidade` (offset)
       - Linha exata do próximo heading `## ` (limit)
       - Conteúdo intermediário (a tabela + nota opcional) — será o `old_string`
    2. Pattern A vs B: confirmar lendo a primeira row da tabela. Se contiver "(com Supabase MCP)" → Pattern B; senão → Pattern A.
    3. Edit:
       - `old_string`: bloco completo iniciando em `## Compatibilidade\n\n` até linha em branco antes do próximo `## ` (inclusive a linha em branco final)
       - `new_string`: linha canônica (Pattern A ou B) + linha em branco

    **Exemplo de edição em `kit/agents/toil-auditor.md` (Pattern A — toda a tabela tem Full):**

    `old_string` (linhas 10-19 originais):
    ```
    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code | **Full** | Lê filesystem + git log + escreve `TOIL-AUDIT.md` |
    | Cursor | **Full** | Idem |
    | Codex | **Full** | Idem |
    | Gemini CLI | **Full** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Full** | Idem (só lê arquivos locais e roda git) |

    **Nota:** Este agente não usa `mcp__supabase__*` — análise é puramente filesystem + git history. Por isso "Full" em todos os IDEs.

    ```

    `new_string`:
    ```
    **Compat:** Full em todos os IDEs (filesystem-only). Veja [COMPATIBILITY.md](../COMPATIBILITY.md).

    ```

    **Exemplo de edição em `kit/agents/supabase-architect.md` (Pattern B):**

    `old_string` (linhas 10-19 originais — tabela com tiers variados):
    ```
    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code (com Supabase MCP) | **Full** | Pode listar tabelas/extensions live para detectar estado atual |
    | Cursor (com Supabase MCP) | **Full** | Idem |
    | Codex | **Partial** | Lê arquivos locais (`supabase/schemas/`, `supabase/migrations/`); sem live data |
    | Gemini CLI | **Partial** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Offline-only** | Apenas projeta plano em texto; user aplica manualmente |

    ```

    `new_string`:
    ```
    **Compat:** Full em Claude Code + Cursor (com Supabase MCP); Partial em Codex + Gemini CLI; Offline-only em Windsurf/Antigravity/Copilot/Trae. Veja [COMPATIBILITY.md](../COMPATIBILITY.md).

    ```

    NOTA — POR QUÊ NÃO regenerar arquivos inteiros:
    27 agents têm conteúdo único (frontmatter, role, instructions, output_style, etc). Regenerar perderia conteúdo. Edit cirúrgico do bloco específico preserva o resto. CONTEXT.md decision explícita: "Edição em massa: usar Edit em batch (não regenerar files inteiros)".

    NOTA — POR QUÊ preservar a "Nota" final separada:
    Algumas Notas têm informação substantiva (ex: supabase-edge-fn-writer "Edge Functions não dependem de live MCP" — explica POR QUÊ é Full em todos). Esse contexto vai para a coluna "Capability resumida" da matriz no COMPATIBILITY.md (Task 1) — info preservada lá. Footer de cada agent perde a nota mas ganha o link para o canonical.

    NOTA — POR QUÊ Pattern B linha não inclui Capability per-agent:
    Capability per-agent fica na matriz canônica em COMPATIBILITY.md. Footer do agent só comunica os 3 tiers — leitor que quer detalhe clica no link. Token economy é o objetivo do plano.

    **Cuidado especial:** alguns agents podem ter o bloco `## Compatibilidade` com nota multilinhas (ex: prr-conductor tem "**Modo offline fallback:**" longo). Garantir que o `old_string` cubra TUDO até o próximo `## ` heading. Verificar cada agent individualmente — não usar regex global cego.

    **Cuidado checkpoint humano (não-bloqueador):** se algum agent já foi reverse-synced para alguma IDE pelo user, o conteúdo divergente. Documentar no SUMMARY (não bloquear o plan).
  </action>
  <verify>
    <automated>
      node -e "const fs=require('fs'); const path=require('path'); const dir='kit/agents'; const agents=['omm-auditor','supabase-edge-fn-writer','prr-conductor','release-pipeline-auditor','load-shedding-instrumenter','cascading-failures-auditor','observability-coverage-auditor','ai-mutation-tester','shotgun-surgery-detector','storytelling-analyst','payload-capture-instrumenter','seam-finder','legacy-characterizer','refactor-safety-auditor','supabase-storage-implementer','supabase-migration-writer','supabase-architect','postmortem-writer','toil-auditor','golden-signals-instrumenter','burn-rate-forecaster','slo-engineer','supabase-auth-bootstrapper','supabase-realtime-implementer','supabase-rls-writer','incident-investigator','observability-instrumenter']; const fail=[]; for(const a of agents){const p=path.join(dir,a+'.md'); const c=fs.readFileSync(p,'utf8'); if(c.includes('## Compatibilidade')) fail.push(a+' still has heading'); if(!c.includes('**Compat:**')) fail.push(a+' missing **Compat:** line'); if(!c.includes('[COMPATIBILITY.md](../COMPATIBILITY.md)')) fail.push(a+' missing relative link');} if(fail.length){console.error('FAIL:',fail.join('; ')); process.exit(1);} console.log('all 27 agents updated');"
    </automated>
    Zero `## Compatibilidade` headings nos 27 agents; cada agent tem `**Compat:**` linha + link relativo `../COMPATIBILITY.md`.
  </verify>
  <done>
    - 27 agents editados — bloco `## Compatibilidade` substituído por linha `**Compat:** ...`
    - Cada agent tem markdown link relativo `[COMPATIBILITY.md](../COMPATIBILITY.md)`
    - Pattern A vs B determinado per-agent (ler primeira row da tabela original)
    - Frontmatter / role / instructions / output_style / sections subsequentes inalterados
    - Verify automated passa (zero `## Compatibilidade`, todos têm `**Compat:**` + link)
  </done>
</task>

<task type="auto">
  <name>Task 3: Regenerar kit/file-manifest.json + 3 regression tests</name>
  <files>kit/file-manifest.json, test/unit/compatibility-dedup.test.js</files>
  <read_first>
    Ler `src/core/manifest-verify.js` integral (já em contexto via @import). Confirmar schema do manifest (`{version, timestamp, files: {<rel>: <sha256>}}`) lendo `kit/file-manifest.json` linhas 1-5. Para o teste, ler `src/core/sync.js` linhas 22-40 (syncTo + verifyManifest call) para confirmar que verifyManifest é chamado em syncTo (manifest stale → EMANIFESTMISMATCH).
  </read_first>
  <action>
    **PARTE A — regenerar kit/file-manifest.json (inline node script):**

    Rodar via Bash tool (não criar `scripts/regen-manifest.js` — Phase 86 fará isso; CONTEXT explícito):

    ```bash
    node -e "
    const fs = require('node:fs');
    const path = require('node:path');
    const crypto = require('node:crypto');

    const KIT_ROOT = path.resolve('kit');
    const OUT = path.join(KIT_ROOT, 'file-manifest.json');

    // Read existing manifest to preserve version + reuse the file list (don't auto-discover —
    // manifest scope is intentionally curated; reverse-sync also produces files in kit/ that
    // should NOT be in the manifest).
    const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const files = {};
    for (const rel of Object.keys(existing.files)) {
      const abs = path.join(KIT_ROOT, rel);
      const buf = fs.readFileSync(abs);
      files[rel] = crypto.createHash('sha256').update(buf).digest('hex');
    }

    const out = {
      version: existing.version,         // preserva — Phase 86 cuida de bumps
      timestamp: new Date().toISOString(),
      files,
    };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('manifest regenerated: ' + Object.keys(files).length + ' entries');
    "
    ```

    NOTA — POR QUÊ preservar `version: existing.version`:
    Manifest version é semantic (atualizado intencionalmente em milestones). Auto-bumping aqui criaria drift sem PR review. Phase 86 vai criar `scripts/regen-manifest.js` com versionamento explícito; Phase 85 só atualiza hashes.

    NOTA — POR QUÊ preservar a lista existente em vez de auto-walk:
    Manifest scope é curado — reverse-sync produz arquivos em kit/ que não devem estar no manifest (não são canonical). Auto-walk capturaria essas. Iterar `Object.keys(existing.files)` re-hashes só o que já está no scope.

    NOTA — POR QUÊ não adicionar `kit/COMPATIBILITY.md` ao manifest:
    A lista de files no manifest atual está hardcoded no v1.13. Adicionar uma entry nova (`kit/COMPATIBILITY.md`) é mudança de scope que merece consideração explícita. CONTEXT pede regen, não scope expansion. Phase 86 (que cria `scripts/regen-manifest.js`) é o lugar canônico para auto-discover. Em Phase 85, COMPATIBILITY.md fica fora do manifest — ele é produzido a partir dos agents (informação derivada). Sync install ainda funciona porque verifyManifest só checa o que está NO manifest; arquivos adicionais em kit/ não bloqueiam.

    **Verificar regen funcionou:**
    ```bash
    node -e "
    const fs = require('node:fs');
    const path = require('node:path');
    const crypto = require('node:crypto');
    const m = JSON.parse(fs.readFileSync('kit/file-manifest.json', 'utf8'));
    let ok = 0, bad = [];
    for (const [rel, expected] of Object.entries(m.files)) {
      const abs = path.join('kit', rel);
      const buf = fs.readFileSync(abs);
      const actual = crypto.createHash('sha256').update(buf).digest('hex');
      if (actual === expected) ok++; else bad.push(rel + ' expected=' + expected.slice(0,8) + ' got=' + actual.slice(0,8));
    }
    if (bad.length) { console.error('MISMATCH:', bad); process.exit(1); }
    console.log('manifest verified: ' + ok + '/' + Object.keys(m.files).length + ' files match');
    "
    ```

    Espera: `manifest verified: N/N files match` (zero mismatches).

    **PARTE B — `test/unit/compatibility-dedup.test.js` (NOVO arquivo):**

    Criar com 3 regression tests:

    ```js
    // PERF-15-02: regression tests for compatibility dedup (Phase 85 Plan 02).
    // Validates that `## Compatibilidade` was removed from all 27 agents,
    // canonical kit/COMPATIBILITY.md exists with all agents listed, and
    // kit/file-manifest.json verifies cleanly post-edit.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import { verifyManifest } from '../../src/core/manifest-verify.js';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const REPO = path.resolve(__dirname, '..', '..');
    const KIT = path.join(REPO, 'kit');
    const AGENTS_DIR = path.join(KIT, 'agents');

    // The 27 agents that originally had `## Compatibilidade` blocks (verified via grep
    // in Phase 85 Plan 02 read_first). If this list drifts, the test will catch it.
    const DEDUPED_AGENTS = [
      'omm-auditor', 'supabase-edge-fn-writer', 'prr-conductor', 'release-pipeline-auditor',
      'load-shedding-instrumenter', 'cascading-failures-auditor', 'observability-coverage-auditor',
      'ai-mutation-tester', 'shotgun-surgery-detector', 'storytelling-analyst',
      'payload-capture-instrumenter', 'seam-finder', 'legacy-characterizer',
      'refactor-safety-auditor', 'supabase-storage-implementer', 'supabase-migration-writer',
      'supabase-architect', 'postmortem-writer', 'toil-auditor', 'golden-signals-instrumenter',
      'burn-rate-forecaster', 'slo-engineer', 'supabase-auth-bootstrapper',
      'supabase-realtime-implementer', 'supabase-rls-writer', 'incident-investigator',
      'observability-instrumenter',
    ];

    test('PERF-15-02: zero `## Compatibilidade` headings remain in any kit/agents/*.md', () => {
      const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
      const offenders = [];
      for (const f of files) {
        const content = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');
        if (/^## Compatibilidade$/m.test(content)) {
          offenders.push(f);
        }
      }
      assert.equal(offenders.length, 0, `agents still have '## Compatibilidade': ${offenders.join(', ')}`);
    });

    test('PERF-15-02: all 27 deduped agents have `**Compat:**` reference line + relative link to COMPATIBILITY.md', () => {
      const missing = [];
      const noLink = [];
      for (const name of DEDUPED_AGENTS) {
        const p = path.join(AGENTS_DIR, name + '.md');
        if (!fs.existsSync(p)) { missing.push(name + ' (file not found)'); continue; }
        const content = fs.readFileSync(p, 'utf8');
        if (!content.includes('**Compat:**')) missing.push(name);
        if (!content.includes('[COMPATIBILITY.md](../COMPATIBILITY.md)')) noLink.push(name);
      }
      assert.equal(missing.length, 0, `agents missing **Compat:** line: ${missing.join(', ')}`);
      assert.equal(noLink.length, 0, `agents missing relative link to COMPATIBILITY.md: ${noLink.join(', ')}`);
    });

    test('PERF-15-02: kit/COMPATIBILITY.md exists, lists all 27 agents in matrix, manifest verifies clean', async () => {
      const compatPath = path.join(KIT, 'COMPATIBILITY.md');
      assert.ok(fs.existsSync(compatPath), 'kit/COMPATIBILITY.md must exist');
      const compat = fs.readFileSync(compatPath, 'utf8');

      // Each of the 27 agents must appear as a row in the canonical matrix
      // (format: "| <name> |" — confirms inclusion regardless of column position).
      const missing = DEDUPED_AGENTS.filter(name => !compat.includes('| ' + name + ' |'));
      assert.equal(missing.length, 0, `agents missing from COMPATIBILITY.md matrix: ${missing.join(', ')}`);

      // Manifest must verify clean — Phase 83 verifyManifest is what blocks sync if stale.
      const r = await verifyManifest(KIT);
      assert.ok(r.ok, `verifyManifest failed: ${r.reason}\nmismatches: ${JSON.stringify(r.mismatches)}\nmissing: ${JSON.stringify(r.missing)}`);
    });
    ```

    NOTA — POR QUÊ regex `/^## Compatibilidade$/m` em vez de includes:
    Includes pegaria falso-positivos (ex: agent que mencionasse "## Compatibilidade" dentro de instruções/exemplo). Regex multiline com âncoras `^...$` confirma que é um heading real começando na linha.

    NOTA — POR QUÊ separar "agents missing line" de "agents missing link":
    Diagnóstico mais preciso quando algum agent passar pela substituição mas o link estiver errado (ex: typo `..//COMPATIBILITY.md`). Test failures comunicam exatamente o que está errado.

    NOTA — POR QUÊ não testar token reduction nesta phase:
    PERF-15-01 (Plan 01) cuida da measurement de payload list-* terse. PERF-15-02 é dedup do conteúdo dos agents — economy é em sessions que carregam múltiplos agents (não em listings). Medição cross-session token saving exigiria simular session loading (overengineered). A redução é estrutural e óbvia: 6-8 linhas por agent × 27 agents = ~150-200 linhas removidas, substituídas por 1 linha cada = ~27 linhas. Diff de bytes confirma a redução pós-merge se necessário.
  </action>
  <verify>
    <automated>
      node --test test/unit/compatibility-dedup.test.js
    </automated>
    3 testes passam: zero headings residuais, todos 27 com Compat+link, COMPATIBILITY.md lista todos + manifest verifies clean.
  </verify>
  <done>
    - `kit/file-manifest.json` regenerado — `version` preservado, `timestamp` atualizado, `files` com SHA256 frescos para os 27 agents editados
    - Inline node script (não criar `scripts/regen-manifest.js` — Phase 86)
    - Manifest auto-verifica clean (zero mismatches via `verifyManifest()` — script ad-hoc no comando de verify)
    - `test/unit/compatibility-dedup.test.js` existe com 3 testes
    - `node --test test/unit/compatibility-dedup.test.js` passa 3/3
    - Suite total continua passando (273 baseline + Plan 01 (4) + Plan 02 (3) = 280+ esperado, 0 fails)
  </done>
</task>

</tasks>

<verification>
**Final phase-level checks (Plan 2):**

1. **Zero `## Compatibilidade` headings:**
   ```
   Grep "^## Compatibilidade$" kit/agents/*.md
   ```
   Espera: 0 matches.

2. **Todos 27 agents têm Compat reference:**
   ```
   Grep "^\\*\\*Compat:\\*\\*" kit/agents/*.md
   ```
   Espera: ≥27 matches (1 por agent dedupado).

3. **COMPATIBILITY.md existe e tem matriz completa:**
   ```
   ls -la kit/COMPATIBILITY.md && grep -c "^| " kit/COMPATIBILITY.md
   ```
   Espera: arquivo existe; ≥28 linhas começando com `|` (1 header + 27 agent rows + separator).

4. **Manifest auto-verifica:**
   ```
   node -e "import('./src/core/manifest-verify.js').then(m => m.verifyManifest('kit')).then(r => { if(!r.ok){ console.error(r); process.exit(1);} console.log('manifest ok')})"
   ```
   Espera: `manifest ok`.

5. **Regression suite (Plan 02 isolado):**
   ```
   node --test test/unit/compatibility-dedup.test.js
   ```
   Espera: 3/3 pass.

6. **Sync install smoke (verifica que verifyManifest não bloqueia):**
   ```
   mkdir -p /tmp/kit-mcp-phase85-smoke && cd /tmp/kit-mcp-phase85-smoke && git init -q && node <repo>/bin/cli.js sync install claude-code --project-root /tmp/kit-mcp-phase85-smoke --mode reference --dry-run
   ```
   Espera: dry-run lista ops; sem `EMANIFESTMISMATCH` error.

7. **Suite full sem regressão:**
   ```
   node --test test/unit/*.test.js test/integration/*.test.js
   ```
   Espera: 273 baseline + 4 (Plan 01) + 3 (Plan 02) = 280+ pass, 0 fail.
</verification>

<success_criteria>
- `kit/COMPATIBILITY.md` é canonical: 27 agents listados em matriz, Pattern A/B explicado, troubleshooting opcional incluído
- `grep -l "## Compatibilidade" kit/agents/*.md | wc -l` retorna 0
- 27 agents têm `**Compat:** ... [COMPATIBILITY.md](../COMPATIBILITY.md)` linha única (Pattern A ou B baseado no tier original)
- `kit/file-manifest.json` tem timestamp recente + SHA256 frescos para os 27 agents editados
- `verifyManifest('kit')` retorna `{ok: true}` sem skip env (zero mismatches/missing)
- 3 regression tests em `test/unit/compatibility-dedup.test.js` passam
- `kit sync install --dry-run claude-code` funciona (verifyManifest não bloqueia)
- Suite total continua passando (280+ esperado, 0 fails)
- Informação semântica preservada: tier per-agent visível em COMPATIBILITY.md (matriz horizontal); link de cada agent para o canonical
- Stable API v1.0+ preservada (mudanças são content-only no kit; zero impact em src/)
</success_criteria>

<output>
After completion, create `.planning/phases/85-token-economy-wave-2/85-02-SUMMARY.md` documenting:
- Pattern A vs B classification per-agent (lista dos 27 com label)
- Estimativa de redução de bytes do kit/ (linhas removidas vs adicionadas)
- Manifest version preservada (a mudar em Phase 86 quando `scripts/regen-manifest.js` introduzir bumping pattern)
- Notas sobre reverse-sync drift (se algum agent já foi reverse-synced para uma IDE pelo user, o conteúdo divergente — não-bloqueador, user faz reverse-sync de novo)
- Edge cases descobertos durante a edição (ex: notas multilinhas inesperadas, agents sem nota final, etc)
</output>
</content>
</invoke>
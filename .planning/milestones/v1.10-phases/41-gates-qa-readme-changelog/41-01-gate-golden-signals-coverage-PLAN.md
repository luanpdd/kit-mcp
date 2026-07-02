---
phase: 41
plan: 01
title: Gate gates/golden-signals-coverage.md — verifica 4 golden signals em código tocado
wave: 1
depends_on: []
autonomous: true
files_modified:
  - gates/golden-signals-coverage.md
requirements: [QA-SRE-01]
status: ready
---

# Plan 01 — Criar `gates/golden-signals-coverage.md`

## Goal

Criar **gate bash 3.2-portable blocking pre-verify** que verifica se código de serviço/Edge Function tocado em uma fase contém os **4 golden signals** (Latency / Traffic / Errors / Saturation). O gate inspeciona arquivos `.ts` / `.js` / `.py` em `supabase/functions/**` e (quando declarado em `.planning/phases/<NN>-*/files-touched.txt`) outras paths, procurando por evidência regex `histogram\|counter\|gauge\|saturation` em pelo menos um match para cada um dos 4 sinais. Saída `PASS` quando todos os 4 sinais aparecem em pelo menos um arquivo tocado pela fase. Cobre **QA-SRE-01**.

## Files to modify

- `D:/projetos/opensource/mcp/gates/golden-signals-coverage.md` (NEW)

## Constraints (anti-pitfall reminders)

- **Bash 3.2-portable** — usar apenas builtins suportados em macOS default (`bash 3.2`); evitar `mapfile`, `readarray`, `[[ ... =~ ... ]]` com captures, `coproc`, `declare -A`, `${var,,}` (lower)
- **Frontmatter canônico** — exatamente `id`, `stage: pre-verify`, `blocking: true`, `description ≤ 200 chars` (anti-pitfall A2)
- **Exit codes** — `0 = PASS` (todos 4 signals presentes em código tocado OU fase não toca em código), `1 = FAIL` (faltando ≥ 1 signal). NUNCA exit codes 2-127 (gate-runner trata como exception, não como block)
- **Pular gracefully** — se fase não tem código tocado (fase só altera markdown / docs), gate **passa com mensagem INFO** (não falha — não há código a instrumentar)
- **Regex inclusive** — match `histogram` (Latency) OR `counter` (Traffic / Errors) OR `gauge` (Saturation) OR `saturation` em comentários é válido — gate é **coverage**, não conformance
- **Output formato** — primeira linha `PASS:`/`FAIL:`/`INFO:` para o gate-runner parsear corretamente
- **Runtime ≤ 5s** — gate não pode rodar testes, npm install, ou queries; só `find` + `grep` em filesystem

## Tasks

<task id="41-01-T1" name="Confirmar precedente bash 3.2-portable e estrutura canônica">
  <read_first>
    - D:/projetos/opensource/mcp/gates/obs-skills-frontmatter.md (linhas 1-66 — bash 3.2-portable pre-verify blocking)
    - D:/projetos/opensource/mcp/gates/obs-agents-mcp-supabase.md (linhas 1-87 — bash 3.2-portable com função helper)
    - D:/projetos/opensource/mcp/gates/sync-idempotent.md (linhas 1-63 — bash com TMPDIR + cleanup)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar pattern de frontmatter usado em `gates/obs-*.md`:
       ```yaml
       ---
       id: <kebab-id>
       stage: pre-verify
       blocking: true
       description: <≤ 200 chars>
       ---
       ```
    2. Confirmar formato `## Check\n\n```bash\n#!/usr/bin/env bash\nset -e\n...\n```` (code-fence bash sob H2 `## Check` é o que `gate-runner.js` extrai)
    3. Confirmar que primeira linha de output (após o code-fence) é `PASS:` ou `FAIL:` ou `INFO:` (gate-runner parseia primeira linha como verdict)
    4. Confirmar que ainda não existe `gates/golden-signals-coverage.md` (NEW file)
  </action>
  <acceptance_criteria>
    - Pattern de frontmatter confirmado (4 campos)
    - Pattern de code-fence `## Check\n\n```bash` confirmado
    - Arquivo `gates/golden-signals-coverage.md` ainda não existe
  </acceptance_criteria>
</task>

<task id="41-01-T2" name="Escrever gates/golden-signals-coverage.md">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/golden-signals-instrumenter.md (linhas 1-30 — confirmar termos canônicos: histogram, counter, gauge, saturation)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 1-30 — confirmar 4 signals)
  </read_first>
  <action>
    Usar Write para criar `D:/projetos/opensource/mcp/gates/golden-signals-coverage.md` com conteúdo:

    ```markdown
    ---
    id: golden-signals-coverage
    stage: pre-verify
    blocking: true
    description: Valida que código de serviço/Edge Function tocado em fase contém os 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter, Saturation=gauge). Skip se fase só toca markdown.
    ---

    # Golden signals coverage gate

    **When to run:** pre-verify (blocking — fase não verifica até cobertura completa).

    ## Check

    ```bash
    #!/usr/bin/env bash
    # PT-BR: validar que código de serviço/Edge Function tocado em fase tem 4 golden signals.
    # Estratégia: descobrir arquivos tocados (supabase/functions/** ou STATE.md current_phase code paths),
    # rodar grep por histogram/counter/gauge/saturation, contar matches por sinal.
    # Bash 3.2-portable (macOS default).
    set -e

    # PT-BR: identificar fase atual via STATE.md
    STATE_FILE=".planning/STATE.md"
    CURRENT_PHASE=""
    if [ -f "$STATE_FILE" ]; then
      CURRENT_PHASE=$(grep -E "^Fase:" "$STATE_FILE" 2>/dev/null | head -1 | sed -E 's/^Fase: *([0-9]+).*/\1/')
    fi

    # PT-BR: candidatos a arquivos de código tocados — escopo principal Supabase Edge + qualquer .ts/.js/.py
    # em paths declarados pela fase (heurística: supabase/functions/** SEMPRE inspecionado).
    CODE_FILES=""
    if [ -d "supabase/functions" ]; then
      CODE_FILES=$(find supabase/functions -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) 2>/dev/null)
    fi

    # PT-BR: também inspecionar lib/ e src/ se existirem (apps Node/Deno fora de Supabase)
    if [ -d "src" ]; then
      ADDITIONAL=$(find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" -o -name "*.py" \) 2>/dev/null)
      CODE_FILES="$CODE_FILES
$ADDITIONAL"
    fi
    if [ -d "lib" ]; then
      ADDITIONAL=$(find lib -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" -o -name "*.py" \) 2>/dev/null)
      CODE_FILES="$CODE_FILES
$ADDITIONAL"
    fi

    # PT-BR: filtrar linhas vazias
    CODE_FILES=$(echo "$CODE_FILES" | grep -v "^$" || true)

    # PT-BR: se fase não toca código (só markdown/docs), pular gate
    if [ -z "$CODE_FILES" ]; then
      echo "INFO: nenhum arquivo de código (.ts/.js/.py) encontrado em supabase/functions/** | src/** | lib/** — fase parece content-only. Gate skipped."
      exit 0
    fi

    # PT-BR: contar matches por signal
    LATENCY_HITS=0
    TRAFFIC_HITS=0
    ERRORS_HITS=0
    SATURATION_HITS=0

    # PT-BR: process file list line-by-line para portabilidade bash 3.2
    OLDIFS="$IFS"
    IFS='
'
    for f in $CODE_FILES; do
      [ -z "$f" ] && continue
      [ ! -f "$f" ] && continue

      # PT-BR: Latency = histogram (createHistogram, recordHistogram, histogram.record)
      if grep -qE "histogram|Histogram" "$f" 2>/dev/null; then
        LATENCY_HITS=$((LATENCY_HITS + 1))
      fi

      # PT-BR: Traffic + Errors = counter (Errors counter dimensionado por error.type)
      if grep -qE "counter|Counter|createCounter" "$f" 2>/dev/null; then
        TRAFFIC_HITS=$((TRAFFIC_HITS + 1))
        ERRORS_HITS=$((ERRORS_HITS + 1))
      fi

      # PT-BR: Saturation = gauge (createObservableGauge, gauge.record) ou string saturation
      if grep -qE "gauge|Gauge|saturation|Saturation" "$f" 2>/dev/null; then
        SATURATION_HITS=$((SATURATION_HITS + 1))
      fi
    done
    IFS="$OLDIFS"

    # PT-BR: gate passa se TODOS os 4 signals têm pelo menos 1 hit em algum arquivo de código
    MISSING=""
    [ "$LATENCY_HITS" -eq 0 ] && MISSING="$MISSING Latency(histogram)"
    [ "$TRAFFIC_HITS" -eq 0 ] && MISSING="$MISSING Traffic(counter)"
    [ "$ERRORS_HITS" -eq 0 ] && MISSING="$MISSING Errors(counter)"
    [ "$SATURATION_HITS" -eq 0 ] && MISSING="$MISSING Saturation(gauge)"

    if [ -z "$MISSING" ]; then
      echo "PASS: 4 golden signals cobertos em código (Latency=$LATENCY_HITS files / Traffic=$TRAFFIC_HITS / Errors=$ERRORS_HITS / Saturation=$SATURATION_HITS)"
      exit 0
    else
      echo "FAIL: golden signals ausentes em código tocado:$MISSING"
      echo "Sugestão: rodar /sre golden-signals <service> ou /golden-signals para gerar instrumentação OTel canônica."
      echo "Cross-ref: kit/skills/four-golden-signals/SKILL.md + kit/agents/golden-signals-instrumenter.md"
      exit 1
    fi
    ```

    ## Verdict

    - **passed** — todos 4 signals (Latency / Traffic / Errors / Saturation) presentes em pelo menos 1 arquivo de código no projeto
    - **passed (skip)** — projeto não tem código (apenas markdown / docs); gate não aplicável
    - **block** — pelo menos 1 signal ausente em código tocado pela fase

    ## Why

    O livro Google SRE (cap 6 — *Monitoring Distributed Systems*) define os **4 golden signals** como cobertura mínima universal de saúde operacional para serviços user-facing — Latency (histogram com percentis, success vs error separados), Traffic (counter por endpoint × method), Errors (counter por `error.type` enum 5-15 valores, NUNCA `error.message`), Saturation (gauge do recurso mais escasso identificado explicitamente).

    Sem esse gate, fases entregam Edge Functions / serviços sem instrumentação básica e dashboards crescem ad-hoc (CPU, memory, threads — *causes* não *symptoms*). Gate força padrão canônico: cada PR de código deve cobrir os 4 signals, ou explicar a ausência via skip (fase só altera markdown).

    Cross-ref agent canônico: [`golden-signals-instrumenter`](../kit/agents/golden-signals-instrumenter.md) (Phase 37 / AGCORE-SRE-01). Skill: [`four-golden-signals`](../kit/skills/four-golden-signals/SKILL.md) (Phase 36 / SKFD-SRE-02).

    ## REQ

    QA-SRE-01.

    ## Configuração

    Gate é **blocking** por default. Para tornar warn-only (durante adoption inicial em legado):

    ```bash
    node ./.claude/framework/bin/tools.cjs config-set workflow.golden_signals_coverage_warn true
    ```

    (Nota: implementação do toggle warn-only é deferida — gate atual lê apenas presença/ausência de regex, não consulta config.)
    ```

    Posicionamento do arquivo: novo arquivo em `D:/projetos/opensource/mcp/gates/golden-signals-coverage.md`. Nenhuma modificação em arquivos existentes.
  </action>
  <acceptance_criteria>
    - Arquivo `gates/golden-signals-coverage.md` criado
    - Frontmatter contém exatamente 4 campos: `id: golden-signals-coverage`, `stage: pre-verify`, `blocking: true`, `description: <≤ 200 chars>`
    - Bloco `## Check` com code-fence ` ```bash` presente
    - Script começa com `#!/usr/bin/env bash` e `set -e`
    - Script termina com exit codes 0 (PASS) ou 1 (FAIL); 0 sempre quando não há código (skip)
    - Regex coverage de cada signal explícita: `histogram|Histogram` (Latency), `counter|Counter|createCounter` (Traffic + Errors), `gauge|Gauge|saturation|Saturation` (Saturation)
    - Primeira linha de output é `PASS:`, `FAIL:`, ou `INFO:` (gate-runner format)
    - Cross-refs `four-golden-signals` skill + `golden-signals-instrumenter` agent presentes em "Why"
    - Rodapé `## REQ\n\nQA-SRE-01.` presente
    - Bash 3.2-portable: zero uso de `mapfile`/`readarray`/`[[ =~ ]]`/`declare -A`
  </acceptance_criteria>
</task>

<task id="41-01-T3" name="Smoke validation — gate roda em projeto kit-mcp e fixture sintético">
  <read_first>
    - D:/projetos/opensource/mcp/gates/golden-signals-coverage.md (re-leitura pós-write)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter shape
    head -8 gates/golden-signals-coverage.md
    # Esperado:
    # ---
    # id: golden-signals-coverage
    # stage: pre-verify
    # blocking: true
    # description: ...
    # ---

    # 2. Description ≤ 200 chars
    desc=$(grep -E "^description:" gates/golden-signals-coverage.md | head -1 | sed 's/description: //')
    echo "Description length: ${#desc}"  # esperado: ≤ 200

    # 3. Gate é discoverable via runner
    node bin/cli.js gates list 2>/dev/null | grep golden-signals-coverage
    # Esperado: 1 linha mostrando o gate

    # 4. Gate roda na codebase atual — kit-mcp não tem supabase/functions/ próprio (content-only),
    #    portanto deve passar com INFO: skip (nenhum código de serviço para instrumentar).
    node bin/cli.js gates run golden-signals-coverage --yes --json 2>&1 | tail -20
    # Esperado: verdict=passed, output começa com "INFO:" ou "PASS:"

    # 5. Smoke fixture sintético com gaps — fixture com .ts mas sem signals
    SYNTH=$(mktemp -d -t kit-gate-synth-XXXXXX)
    mkdir -p "$SYNTH/supabase/functions/example"
    cat > "$SYNTH/supabase/functions/example/index.ts" <<'TSEOF'
    // Fixture: Edge Function sem instrumentação
    Deno.serve(async (req) => {
      return new Response(JSON.stringify({ ok: true }));
    });
    TSEOF
    # Rodar gate naquele cwd
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/golden-signals-coverage.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "FAIL: golden signals ausentes em código tocado: Latency(histogram) Traffic(counter) Errors(counter) Saturation(gauge)"
    rm -rf "$SYNTH"

    # 6. Smoke fixture sintético com cobertura completa — fixture com 4 signals
    SYNTH2=$(mktemp -d -t kit-gate-synth-pass-XXXXXX)
    mkdir -p "$SYNTH2/supabase/functions/example"
    cat > "$SYNTH2/supabase/functions/example/index.ts" <<'TSEOF'
    import { metrics } from "@opentelemetry/api";
    const meter = metrics.getMeter('example');
    const latencyHistogram = meter.createHistogram('latency_ms');
    const trafficCounter = meter.createCounter('requests_total');
    const errorsCounter = meter.createCounter('errors_total');
    const saturationGauge = meter.createObservableGauge('saturation_pct');
    Deno.serve(async (req) => {
      const start = performance.now();
      trafficCounter.add(1, { endpoint: '/' });
      try {
        return new Response(JSON.stringify({ ok: true }));
      } catch (e) {
        errorsCounter.add(1, { 'error.type': 'unknown' });
        throw e;
      } finally {
        latencyHistogram.record(performance.now() - start);
      }
    });
    TSEOF
    (cd "$SYNTH2" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/golden-signals-coverage.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "PASS: 4 golden signals cobertos em código (Latency=1 files / Traffic=1 / Errors=1 / Saturation=1)"
    rm -rf "$SYNTH2"
    ```
  </action>
  <acceptance_criteria>
    - `head -8` mostra frontmatter shape correto (4 campos)
    - `description` length ≤ 200 chars
    - `gates list` discovers `golden-signals-coverage`
    - Gate executado na codebase atual retorna `passed` (kit-mcp não tem `supabase/functions/`, então skip via INFO)
    - Fixture sintético sem signals → `FAIL:` e exit code 1
    - Fixture sintético com 4 signals → `PASS:` e exit code 0
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Arquivo `gates/golden-signals-coverage.md` criado
- [ ] Frontmatter canônico (4 campos: `id`, `stage: pre-verify`, `blocking: true`, `description ≤ 200 chars`)
- [ ] `## Check` com code-fence bash 3.2-portable
- [ ] Script descobre `supabase/functions/**` + `src/**` + `lib/**`; pula gracefully se zero código
- [ ] 4 signals checados via regex (`histogram` / `counter` / `gauge|saturation`)
- [ ] Exit codes 0 (PASS / INFO skip) ou 1 (FAIL)
- [ ] Cross-refs `four-golden-signals` + `golden-signals-instrumenter` em "Why"
- [ ] Rodapé `QA-SRE-01` presente
- [ ] Smoke kit-mcp atual: `passed` (skip por content-only)
- [ ] Smoke fixture sem signals: `FAIL` exit 1
- [ ] Smoke fixture com 4 signals: `PASS` exit 0

## Must-haves (goal-backward)

1. Gate é blocking pre-verify — fase não verifica até cobertura completa OU skip aplicável
2. Bash 3.2-portable — gate roda em macOS default sem `mapfile`/`declare -A`
3. Skip gracefully em projetos content-only — não força instrumentação onde não há código
4. Detecta evidência de cada signal via regex inclusiva — não exige patterns OTel exatos (vendor-neutral)
5. Mensagem de FAIL aponta solução: `/sre golden-signals` ou `/golden-signals` (cross-ref command Phase 38)
6. Cross-refs ATIVOS para skill (`four-golden-signals`) + agent (`golden-signals-instrumenter`)
7. Discoverable via `gates list` (frontmatter parsing OK)

## Notes

- **Vendor-neutral** — gate aceita qualquer pattern com `histogram` / `counter` / `gauge` (OTel, Prometheus, StatsD, Borgmon-like). Livro Google SRE descreve Borgmon mas é proprietário; gate é genérico
- **Heurística file discovery** — gate inspeciona paths convencionais (`supabase/functions/`, `src/`, `lib/`); fases que tocam código fora desses paths não são validadas. Adoption futura pode acrescentar `.planning/phases/<NN>-*/files-touched.txt` parsing
- **Phase 37 / AGCORE-SRE-01** entrega o agent `golden-signals-instrumenter` que gera código satisfazendo este gate; chain canônico: usuário roda `/sre golden-signals <file>` antes de `/verificar-trabalho` para passar gate
- **Não checa qualidade da instrumentação** — gate detecta presença, não correção (i.e., não verifica `result=success|error` separado, error.type enum fechado, etc.). Isso fica para code review humano + skill `four-golden-signals` que documenta as regras

---
name: reconciliar
description: Reverifica o backlog de planos/fases no HEAD atual — reclassifica por drift de commit-stamp (DONE spot-check, TODO drift-check, IN PROGRESS stale, BLOCKED triagem). Emite relatório curto.
argument-hint: "[--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
---

<objective>
Reconciliar o **backlog de execução** (planos e fases com status conhecido) contra o **HEAD atual** do repositório, reclassificando cada item por **drift de commit-stamp**.

O problema: o backlog foi montado num SHA passado. Desde então o HEAD avançou — findings podem ter sido resolvidas incidentalmente, executores podem ter crashado, critérios já cumpridos podem nunca ter sido marcados. Sem reconciliar, você re-executa trabalho morto ou confia em status podre.

Este comando aplica a skill [`reconcile-execution-backlog`](../skills/reconcile-execution-backlog/SKILL.md): para cada item, compara `planned_at_sha` vs `HEAD`, decide a ação por status e refresca o stamp.

**Cria/Atualiza:**
- `.planning/RECONCILE-REPORT.md` — tabela por item (status novo, drift, ação) + contadores agregados

**Após:** o user tem um backlog **limpo** — só o que realmente sobra para executar, com SHAs frescos e findings rejeitadas removidas.
</objective>

<context>
**Argumentos:**
- `--output PATH` — caminho do relatório (default: `.planning/RECONCILE-REPORT.md`)

**Exemplos:**
```
/reconciliar                                         # reconcilia todo o backlog no HEAD atual
/reconciliar --output .planning/reconcile-2026.md    # output custom
```

**Pré-requisitos:**
- Repositório git com HEAD válido (`git rev-parse HEAD`)
- Backlog em `.planning/` com itens carregando status conhecido (DONE, TODO, IN PROGRESS, BLOCKED) e, idealmente, `planned_at_sha`
- Findings/critérios verificáveis por spot-check barato (grep/glob/test pontual)

**Quando este comando é o caminho:**
- O HEAD avançou muito desde que o backlog foi planejado (merge de main, hotfixes, trabalho paralelo)
- Você suspeita que findings já foram resolvidas "de graça" e não quer re-executá-las
- Um executor crashou no meio e deixou itens IN PROGRESS órfãos
- Antes de retomar execução autônoma — quer entrar com backlog confiável, não podre
</context>

<process>

## 1. Parsear argumentos e capturar HEAD

```bash
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')
[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/RECONCILE-REPORT.md"

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$HEAD_SHA" ]; then
  echo "ERROR: HEAD inválido — não é um repositório git ou sem commits."
  exit 1
fi

if [ ! -d ".planning" ]; then
  echo "ERROR: .planning/ não encontrado — nada para reconciliar."
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
echo "HEAD atual: $HEAD_SHA"
```

## 2. Inventariar o backlog

Carregue todo item de plano/fase com status conhecido. Para cada um, extraia:
- `id` (fase/plano)
- `status` ∈ {DONE, TODO, IN PROGRESS, BLOCKED}
- `planned_at_sha` (SHA em que foi planejado/verificado pela última vez) — se ausente, trate como drift forçado
- `finding` / critério de sucesso associado (o que precisa ser verdade no código)

```bash
# Localizar artefatos de backlog (PLAN.md, STATE.md, fases)
find .planning -type f \( -name 'PLAN.md' -o -name 'STATE.md' -o -path '*/phases/*' \) 2>/dev/null
```

Aplicar a skill [`reconcile-execution-backlog`](../skills/reconcile-execution-backlog/SKILL.md) para o protocolo de decisão.

## 3. Protocolo de reconciliação (por item, por status)

**DONE → spot-check barato + marca verificado**
- Confirme que os critérios ainda valem no HEAD atual via grep/glob/test pontual (não re-execução completa).
- Se passam → marca `verificado` e refresca `planned_at_sha = HEAD_SHA`.
- Se NÃO passam → regrediu: rebaixa para `TODO` e registra a regressão.

**TODO → drift-check (planned_at_sha vs HEAD)**
- Sem drift (`planned_at_sha == HEAD_SHA`) → mantém `TODO`, pronto para executar.
- Com drift → **re-verifique se a finding ainda existe** no HEAD atual:
  - Finding sumiu (resolvida incidentalmente por outro commit) → `REJECTED` (não executar).
  - Finding persiste → mantém `TODO` e **refresca o SHA** para o HEAD atual.

```bash
# drift-check de um item
if [ "$ITEM_SHA" != "$HEAD_SHA" ]; then
  echo "DRIFT: $ITEM_ID (planned@$ITEM_SHA → HEAD@$HEAD_SHA) — re-verificar finding"
fi
```

**IN PROGRESS stale → flag (executor provavelmente crashou)**
- Item travado em IN PROGRESS sem progresso recente: sinalize como `STALE`.
- Sugira: inspecionar working tree / último commit do item, decidir entre retomar ou resetar para `TODO`.

**BLOCKED → investiga e sugere reescrever ou rejeitar**
- Investigue a causa do bloqueio no HEAD atual.
- Se o bloqueio caiu (dep mergeada, decisão tomada) → sugira reescrever para `TODO`.
- Se o bloqueio é permanente / item obsoleto → sugira `REJECTED`.

## 4. Emitir relatório curto

Escreva `$OUTPUT_PATH` com:
- **Cabeçalho:** HEAD reconciliado contra + timestamp.
- **Tabela por item:** `id | status anterior | status novo | drift (sim/não) | ação`.
- **Contadores agregados** (resumo de uma linha):
  - **verificados** — DONE confirmados no HEAD
  - **refrescados** — TODO com SHA atualizado (finding persiste)
  - **rejeitados** — findings resolvidas incidentalmente OU bloqueios obsoletos
  - **prontos pra executar** — TODO sem drift / com SHA fresco e finding viva
  - **stale** — IN PROGRESS órfãos sinalizados

```
═══════════════════════════════════════════════════════════
 framework ► RECONCILIAR ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

HEAD reconciliado: ${HEAD_SHA}

| item | antes | depois | drift | ação |
|------|-------|--------|-------|------|
| ...  | ...   | ...    | ...   | ...  |

Resumo: N verificados · N refrescados · N rejeitados · N prontos · N stale
```

</process>

<success_criteria>
- [ ] `$ARGUMENTS` parseado (`--output` opcional, default sensível)
- [ ] HEAD capturado via `git rev-parse HEAD`; aborta se inválido
- [ ] Backlog inventariado com status + `planned_at_sha` por item
- [ ] DONE: spot-check barato; marca verificado ou rebaixa em regressão
- [ ] TODO: drift-check; finding sumida → REJECTED, finding viva → refresca SHA
- [ ] IN PROGRESS stale: sinalizado como STALE (executor crashado)
- [ ] BLOCKED: investigado; sugestão reescrever-para-TODO ou REJECTED
- [ ] Relatório curto com tabela por item + contadores agregados
- [ ] Contadores: verificados, refrescados, rejeitados, prontos pra executar, stale
- [ ] Cross-references com /executar-fase, /autonomo, /saude
</success_criteria>

## Cross-refs

- **Skill:** [`reconcile-execution-backlog`](../skills/reconcile-execution-backlog/SKILL.md) — protocolo de drift de commit-stamp e decisão por status.
- **/executar-fase** — consome o backlog reconciliado; rode /reconciliar antes para não re-executar findings mortas.
- **/autonomo** — execução autônoma multi-fase; reconciliar entre marcos evita confiar em status podre.
- **/saude** — diagnóstico de integridade do `.planning/`; complementar (estrutura vs drift de conteúdo).

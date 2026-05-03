<purpose>
Verificar o alcance do objetivo da fase por meio de análise regressiva de objetivos. Verificar se o código entrega o que a fase prometeu, não apenas se as tarefas foram concluídas.

Executado por um subagente de verificação spawnado a partir de execute-phase.md.
</purpose>

<core_principle>
**Conclusão de tarefa ≠ Alcance do objetivo**

Uma tarefa "criar componente de chat" pode ser marcada como concluída quando o componente é um placeholder. A tarefa foi feita — mas o objetivo "interface de chat funcional" não foi alcançado.

Verificação regressiva de objetivos:
1. O que deve ser VERDADEIRO para o objetivo ser alcançado?
2. O que deve EXISTIR para essas verdades se sustentarem?
3. O que deve estar CONECTADO para esses artefatos funcionarem?

Em seguida, verifique cada nível em relação ao código atual.
</core_principle>

<required_reading>
@./.claude/framework/references/verification-patterns.md
@./.claude/framework/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
Carregue o contexto da operação de fase:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extraia do JSON de init: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Em seguida, carregue os detalhes da fase e liste os planos/sumários:
```bash
node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null || true
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null || true
```

Extraia o **objetivo da fase** do ROADMAP.md (o resultado a verificar, não as tarefas) e os **requisitos** do REQUIREMENTS.md se existir.
</step>

<step name="establish_must_haves">
**Opção A: Must-haves no frontmatter do PLAN**

Use tools para extrair must_haves de cada PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node "./.claude/framework/bin/tools.cjs" frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Retorna JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Agregue todos os must_haves dos planos para verificação em nível de fase.

**Opção B: Usar Critérios de Sucesso do ROADMAP.md**

Se não houver must_haves no frontmatter (MUST_HAVES retorna erro ou vazio), verifique os Critérios de Sucesso:

```bash
PHASE_DATA=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${phase_number}" --raw)
```

Analise o array `success_criteria` da saída JSON. Se não vazio:
1. Use cada Critério de Sucesso diretamente como uma **verdade** (já escritos como comportamentos observáveis e testáveis)
2. Derive **artefatos** (caminhos de arquivo concretos para cada verdade)
3. Derive **key links** (conexões críticas onde stubs se escondem)
4. Documente os must-haves antes de prosseguir

Critérios de Sucesso do ROADMAP.md são o contrato — sobrepõem must_haves do nível do PLAN quando ambos existem.

**Opção C: Derivar do objetivo da fase (fallback)**

Se não houver must_haves no frontmatter E não houver Critérios de Sucesso no ROADMAP:
1. Declare o objetivo do ROADMAP.md
2. Derive **verdades** (3-7 comportamentos observáveis, cada um testável)
3. Derive **artefatos** (caminhos de arquivo concretos para cada verdade)
4. Derive **key links** (conexões críticas onde stubs se escondem)
5. Documente os must-haves derivados antes de prosseguir
</step>

<step name="verify_truths">
Para cada verdade observável, determine se o código a viabiliza.

**Status:** ✓ VERIFICADO (todos os artefatos de suporte passam) | ✗ FALHOU (artefato ausente/stub/desconectado) | ? INCERTO (precisa de humano)

Para cada verdade: identifique artefatos de suporte → verifique o status do artefato → verifique a conexão → determine o status da verdade.

**Exemplo:** Verdade "Usuário pode ver mensagens existentes" depende de Chat.tsx (renderiza), /api/chat GET (fornece), modelo Message (schema). Se Chat.tsx for um stub ou a API retornar [] codificado → FALHOU. Se tudo existe, é substantivo e conectado → VERIFICADO.
</step>

<step name="verify_artifacts">
Use tools para verificação de artefatos contra must_haves em cada PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node "./.claude/framework/bin/tools.cjs" verify artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Analise o resultado JSON: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Status do artefato a partir do resultado:**
- `exists=false` → AUSENTE
- `issues` não vazio → STUB (verifique issues por "Only N lines" ou "Missing pattern")
- `passed=true` → VERIFICADO (Níveis 1-2 passam)

**Nível 3 — Conectado (verificação manual para artefatos que passam nos Níveis 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTADO
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USADO
```
CONECTADO = importado E usado. ÓRFÃO = existe mas não importado/usado.

| Existe | Substantivo | Conectado | Status |
|--------|-------------|-----------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFICADO |
| ✓ | ✓ | ✗ | ⚠️ ÓRFÃO |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ AUSENTE |

**Verificação pontual de exportações (severidade AVISO):**

Para artefatos que passam no Nível 3, verifique pontualmente as exportações individuais:
- Extraia os símbolos exportados chave (funções, constantes, classes — pule tipos/interfaces)
- Para cada um, pesquise uso fora do arquivo que define
- Sinalize exportações com zero call sites externos como "exportado mas não utilizado"

Isso captura stores mortos como `setPlan()` que existem em um arquivo conectado mas nunca são chamados de fato. Reporte como AVISO — pode indicar conexão incompleta entre planos ou código sobrante de revisões de plano.
</step>

<step name="verify_wiring">
Use tools para verificação de key links contra must_haves em cada PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node "./.claude/framework/bin/tools.cjs" verify key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Analise o resultado JSON: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Status do link a partir do resultado:**
- `verified=true` → CONECTADO
- `verified=false` com "not found" → NÃO_CONECTADO
- `verified=false` com "Pattern not found" → PARCIAL

**Padrões fallback (se key_links não estiverem nos must_haves):**

| Padrão | Verificação | Status |
|--------|-------------|--------|
| Componente → API | chamada fetch/axios ao caminho da API, resposta usada (await/.then/setState) | CONECTADO / PARCIAL (chamada mas resposta não usada) / NÃO_CONECTADO |
| API → Banco de Dados | query Prisma/DB no modelo, resultado retornado via res.json() | CONECTADO / PARCIAL (query mas não retornado) / NÃO_CONECTADO |
| Formulário → Handler | onSubmit com implementação real (fetch/axios/mutate/dispatch), não console.log/vazio | CONECTADO / STUB (apenas log/vazio) / NÃO_CONECTADO |
| Estado → Render | variável useState aparece no JSX (`{stateVar}` ou `{stateVar.property}`) | CONECTADO / NÃO_CONECTADO |

Registre status e evidência para cada key link.
</step>

<step name="verify_requirements">
Se REQUIREMENTS.md existir:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null || true
```

Para cada requisito: analise a descrição → identifique verdades/artefatos de suporte → status: ✓ SATISFEITO / ✗ BLOQUEADO / ? PRECISA DE HUMANO.
</step>

<step name="scan_antipatterns">
Extraia arquivos modificados nesta fase do SUMMARY.md, escaneie cada um:

| Padrão | Busca | Severidade |
|--------|-------|------------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Aviso |
| Conteúdo placeholder | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Bloqueador |
| Retornos vazios | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Aviso |
| Funções apenas com log | Funções contendo apenas console.log | ⚠️ Aviso |

Categorize: 🛑 Bloqueador (impede o objetivo) | ⚠️ Aviso (incompleto) | ℹ️ Info (notável).
</step>

<step name="identify_human_verification">
**Sempre precisa de humano:** Aparência visual, conclusão de fluxo do usuário, comportamento em tempo real (WebSocket/SSE), integração com serviço externo, sensação de desempenho, clareza de mensagens de erro.

**Precisa de humano se incerto:** Conexão complexa que grep não consegue rastrear, comportamento dinâmico dependente de estado, casos extremos.

Formate cada um como: Nome do Teste → O que fazer → Resultado esperado → Por que não pode verificar programaticamente.
</step>

<step name="determine_status">
**passed:** Todas as verdades VERIFICADAS, todos os artefatos passam nos níveis 1-3, todos os key links CONECTADOS, sem anti-padrões bloqueadores.

**gaps_found:** Qualquer verdade FALHOU, artefato AUSENTE/STUB, key link NÃO_CONECTADO, ou bloqueador encontrado.

**human_needed:** Todas as verificações automatizadas passam, mas itens de verificação humana permanecem.

**Pontuação:** `verified_truths / total_truths`
</step>

<step name="generate_fix_plans">
Se gaps_found:

1. **Agrupar lacunas relacionadas:** Stub de API + componente desconectado → "Conectar frontend ao backend". Vários ausentes → "Completar implementação principal". Apenas conexão → "Conectar componentes existentes".

2. **Gerar plano por grupo:** Objetivo, 2-3 tarefas (arquivos/ação/verificar para cada), etapa de re-verificação. Mantenha focado: uma preocupação por plano.

3. **Ordenar por dependência:** Corrigir ausentes → corrigir stubs → corrigir conexões → verificar.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Preencha as seções do template: frontmatter (fase/timestamp/status/pontuação), alcance do objetivo, tabela de artefatos, tabela de conexões, cobertura de requisitos, anti-padrões, verificação humana, resumo de lacunas, planos de correção (se gaps_found), metadados.

Veja ./.claude/framework/templates/verification-report.md para o template completo.
</step>

<step name="return_to_orchestrator">
Retorne status (`passed` | `gaps_found` | `human_needed`), pontuação (N/M must-haves), caminho do relatório.

Se gaps_found: liste lacunas + nomes de planos de correção recomendados.
Se human_needed: liste itens que requerem teste humano.

O orquestrador roteia: `passed` → update_roadmap | `gaps_found` → criar/executar correções, re-verificar | `human_needed` → apresentar ao usuário.
</step>

</process>

<success_criteria>
- [ ] Must-haves estabelecidos (a partir do frontmatter ou derivados)
- [ ] Todas as verdades verificadas com status e evidência
- [ ] Todos os artefatos verificados nos três níveis
- [ ] Todos os key links verificados
- [ ] Cobertura de requisitos avaliada (se aplicável)
- [ ] Anti-padrões escaneados e categorizados
- [ ] Itens de verificação humana identificados
- [ ] Status geral determinado
- [ ] Planos de correção gerados (se gaps_found)
- [ ] VERIFICATION.md criado com relatório completo
- [ ] Resultados retornados ao orquestrador
</success_criteria>

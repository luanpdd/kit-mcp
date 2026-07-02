<purpose>
Auditar lacunas de validação Nyquist para uma fase concluída. Gerar testes ausentes. Atualizar VALIDATION.md.
</purpose>

<required_reading>
@./.claude/framework/references/ui-brand.md
</required_reading>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- nyquist-auditor — Valida cobertura de verificação
</available_agent_types>

<process>

## 0. Inicializar

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_AUDITOR=$(node "./.claude/framework/bin/tools.cjs" agent-skills nyquist-auditor 2>/dev/null)
```

Analise: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`.

```bash
AUDITOR_MODEL=$(node "./.claude/framework/bin/tools.cjs" resolve-model nyquist-auditor --raw)
NYQUIST_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.nyquist_validation --raw)
```

Se `NYQUIST_CFG` for `false`: encerre com "Validação Nyquist está desabilitada. Habilite via /configuracoes."

Exiba o banner: `framework > VALIDAR FASE {N}: {nome}`

## 1. Detectar Estado de Entrada

```bash
VALIDATION_FILE=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
```

- **Estado A** (`VALIDATION_FILE` não vazio): Auditar existente
- **Estado B** (`VALIDATION_FILE` vazio, `SUMMARY_FILES` não vazio): Reconstruir a partir dos artefatos
- **Estado C** (`SUMMARY_FILES` vazio): Encerre — "Fase {N} não executada. Execute /executar-fase {N} ${WS} primeiro."

## 2. Descoberta

### 2a. Ler Artefatos da Fase

Leia todos os arquivos PLAN e SUMMARY. Extraia: listas de tarefas, IDs de requisitos, arquivos-chave alterados, blocos de verificação.

### 2b. Construir Mapa de Requisito-para-Tarefa

Por tarefa: `{ task_id, plan_id, wave, requirement_ids, has_automated_command }`

### 2c. Detectar Infraestrutura de Testes

Estado A: Analise da tabela de Infraestrutura de Testes do VALIDATION.md existente.
Estado B: Varredura do sistema de arquivos:

```bash
find . -name "pytest.ini" -o -name "jest.config.*" -o -name "vitest.config.*" -o -name "pyproject.toml" 2>/dev/null | head -10
find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" \) -not -path "*/node_modules/*" 2>/dev/null | head -40
```

### 2d. Referência Cruzada

Associe cada requisito aos testes existentes por nome de arquivo, imports, descrições de teste. Registre: requisito → arquivo_de_teste → status.

## 3. Análise de Lacunas

Classifique cada requisito:

| Status | Critérios |
|--------|-----------|
| COVERED | Teste existe, direciona o comportamento, passa |
| PARTIAL | Teste existe, falhando ou incompleto |
| MISSING | Nenhum teste encontrado |

Construa: `{ task_id, requirement, gap_type, suggested_test_path, suggested_command }`

Sem lacunas → pule para o Passo 6, defina `nyquist_compliant: true`.

## 4. Apresentar Plano de Lacunas

Chame AskUserQuestion com a tabela de lacunas e opções:
1. "Corrigir todas as lacunas" → Passo 5
2. "Pular — marcar apenas manual" → adicionar em Manual-Only, Passo 6
3. "Cancelar" → encerrar

## 5. Spawnar nyquist-auditor

```
Task(
  prompt="Read ./.claude/agents/nyquist-auditor.md for instructions.\n\n" +
    "<files_to_read>{PLAN, SUMMARY, impl files, VALIDATION.md}</files_to_read>" +
    "<gaps>{gap list}</gaps>" +
    "<test_infrastructure>{framework, config, commands}</test_infrastructure>" +
    "<constraints>Never modify impl files. Max 3 debug iterations. Escalate impl bugs.</constraints>" +
    "${AGENT_SKILLS_AUDITOR}",
  subagent_type="nyquist-auditor",
  model="{AUDITOR_MODEL}",
  description="Fill validation gaps for Phase {N}"
)
```

Trate o retorno:
- `## GAPS FILLED` → registre testes + atualizações do mapa, Passo 6
- `## PARTIAL` → registre resolvidos, mova escalados para manual-only, Passo 6
- `## ESCALATE` → mova todos para manual-only, Passo 6

## 6. Gerar/Atualizar VALIDATION.md

**Estado B (criar):**
1. Leia o template de `./.claude/framework/templates/VALIDATION.md`
2. Preencha: frontmatter, Infraestrutura de Testes, Mapa Por-Tarefa, Manual-Only, Sign-Off
3. Escreva em `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`

**Estado A (atualizar):**
1. Atualize os status do Mapa Por-Tarefa, adicione escalados ao Manual-Only, atualize o frontmatter
2. Adicione trilha de auditoria:

```markdown
## Auditoria de Validação {data}
| Métrica | Contagem |
|---------|----------|
| Lacunas encontradas | {N} |
| Resolvidas | {M} |
| Escaladas | {K} |
```

## 7. Commit

```bash
git add {test_files}
git commit -m "test(phase-${PHASE}): add Nyquist validation tests"

node "./.claude/framework/bin/tools.cjs" commit "docs(phase-${PHASE}): add/update validation strategy"
```

## 8. Resultados + Roteamento

**Compatível:**
```
framework > FASE {N} É NYQUIST-COMPATÍVEL
Todos os requisitos têm verificação automatizada.
▶ Próximo: /auditar-marco ${WS}
```

**Parcial:**
```
framework > FASE {N} VALIDADA (PARCIAL)
{M} automatizados, {K} apenas manuais.
▶ Repetir: /validar-fase {N} ${WS}
```

Exiba lembrete de `/clear`.

</process>

<success_criteria>
- [ ] Config Nyquist verificado (encerrar se desabilitado)
- [ ] Estado de entrada detectado (A/B/C)
- [ ] Estado C encerra corretamente
- [ ] Arquivos PLAN/SUMMARY lidos, mapa de requisitos construído
- [ ] Infraestrutura de testes detectada
- [ ] Lacunas classificadas (COVERED/PARTIAL/MISSING)
- [ ] Gate do usuário com tabela de lacunas
- [ ] Auditor spawnado com contexto completo
- [ ] Todos os três formatos de retorno tratados
- [ ] VALIDATION.md criado ou atualizado
- [ ] Arquivos de teste commitados separadamente
- [ ] Resultados com roteamento apresentados
</success_criteria>

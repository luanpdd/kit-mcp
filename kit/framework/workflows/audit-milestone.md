<purpose>
Verificar se o milestone atingiu sua definição de pronto agregando verificações de fase, checando integração cross-fase e avaliando cobertura de requisitos. Lê arquivos VERIFICATION.md existentes (fases já verificadas durante execute-phase), agrega dívida técnica e lacunas adiadas, então cria agente verificador de integração para fiação cross-fase.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- integration-checker — Verifica integração cross-fase
</available_agent_types>

<process>

## 0. Inicializar Contexto do Milestone

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_CHECKER=$(node "./.claude/framework/bin/tools.cjs" agent-skills integration-checker 2>/dev/null)
```

Extrair do JSON de init: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `commit_docs`.

Resolver modelo do verificador de integração:
```bash
integration_checker_model=$(node "./.claude/framework/bin/tools.cjs" resolve-model integration-checker --raw)
```

## 1. Determinar Escopo do Milestone

```bash
# Obter fases no milestone (ordenadas numericamente, trata decimais)
node "./.claude/framework/bin/tools.cjs" phases list
```

- Analisar versão dos argumentos ou detectar atual do ROADMAP.md
- Identificar todos os diretórios de fase no escopo
- Extrair definição de pronto do milestone do ROADMAP.md
- Extrair requisitos mapeados para este milestone do REQUIREMENTS.md

## 2. Ler Todas as Verificações de Fase

Para cada diretório de fase, ler o VERIFICATION.md:

```bash
# Para cada fase, use find-phase para resolver o diretório (trata fases arquivadas)
PHASE_INFO=$(node "./.claude/framework/bin/tools.cjs" find-phase 01 --raw)
# Extrair diretório do JSON, então ler VERIFICATION.md daquele diretório
# Repetir para cada número de fase do ROADMAP.md
```

De cada VERIFICATION.md, extrair:
- **Status:** passed | gaps_found
- **Lacunas críticas:** (se houver — estas são bloqueadores)
- **Lacunas não críticas:** dívida técnica, itens adiados, avisos
- **Anti-padrões encontrados:** TODOs, stubs, placeholders
- **Cobertura de requisitos:** quais requisitos satisfeitos/bloqueados

Se uma fase não tiver VERIFICATION.md, sinalizar como "fase não verificada" — este é um bloqueador.

## 3. Criar Agente Verificador de Integração

Com contexto de fase coletado:

Extrair `MILESTONE_REQ_IDS` da tabela de rastreabilidade do REQUIREMENTS.md — todos os REQ-IDs atribuídos a fases neste milestone.

```
Task(
  prompt="Verificar integração cross-fase e fluxos E2E.

Fases: {phase_dirs}
Exportações de fase: {das SUMMARYs}
Rotas API: {rotas criadas}

Requisitos do Milestone:
{MILESTONE_REQ_IDS — listar cada REQ-ID com descrição e fase atribuída}

DEVE mapear cada achado de integração para IDs de requisito afetados onde aplicável.

Verificar fiação cross-fase e fluxos E2E de usuário.
${AGENT_SKILLS_CHECKER}",
  subagent_type="integration-checker",
  model="{integration_checker_model}"
)
```

## 4. Coletar Resultados

Combinar:
- Lacunas e dívida técnica em nível de fase (do passo 2)
- Relatório do verificador de integração (lacunas de fiação, fluxos quebrados)

## 5. Verificar Cobertura de Requisitos (Referência Cruzada de 3 Fontes)

DEVE cruzar três fontes independentes para cada requisito:

### 5a. Analisar Tabela de Rastreabilidade do REQUIREMENTS.md

Extrair todos os REQ-IDs mapeados para fases do milestone da tabela de rastreabilidade:
- ID do requisito, descrição, fase atribuída, status atual, estado de marcação (`[x]` vs `[ ]`)

### 5b. Analisar Tabelas de Requisitos do VERIFICATION.md de Fase

Para o VERIFICATION.md de cada fase, extrair a tabela de requisitos expandida:
- Requisito | Plano Fonte | Descrição | Status | Evidência
- Mapear cada entrada de volta ao seu REQ-ID

### 5c. Extrair Verificação Cruzada do Frontmatter do SUMMARY.md

Para o SUMMARY.md de cada fase, extrair `requirements-completed` do frontmatter YAML:
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  [ -e "$summary" ] || continue
  node "./.claude/framework/bin/tools.cjs" summary-extract "$summary" --fields requirements_completed --pick requirements_completed
done
```

### 5d. Matriz de Determinação de Status

Para cada REQ-ID, determinar status usando todas as três fontes:

| Status VERIFICATION.md | Frontmatter SUMMARY | REQUIREMENTS.md | → Status Final |
|------------------------|---------------------|-----------------|----------------|
| passed                 | listado             | `[x]`           | **satisfeito** |
| passed                 | listado             | `[ ]`           | **satisfeito** (atualizar checkbox) |
| passed                 | ausente             | qualquer        | **parcial** (verificar manualmente) |
| gaps_found             | qualquer            | qualquer        | **insatisfeito** |
| ausente                | listado             | qualquer        | **parcial** (lacuna de verificação) |
| ausente                | ausente             | qualquer        | **insatisfeito** |

### 5e. Portão de FALHA e Detecção de Órfãos

**OBRIGATÓRIO:** Qualquer requisito `insatisfeito` DEVE forçar o status `gaps_found` na auditoria do milestone.

**Detecção de órfãos:** Requisitos presentes na tabela de rastreabilidade do REQUIREMENTS.md mas ausentes de TODOS os arquivos VERIFICATION.md de fase DEVEM ser sinalizados como órfãos. Requisitos órfãos são tratados como `insatisfeitos` — foram atribuídos mas nunca verificados por nenhuma fase.

## 5.5. Descoberta de Conformidade Nyquist

Pular se `workflow.nyquist_validation` for explicitamente `false` (ausente = habilitado).

```bash
NYQUIST_CONFIG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.nyquist_validation --raw 2>/dev/null)
```

Se `false`: pular completamente.

Para cada diretório de fase, verificar `*-VALIDATION.md`. Se existir, analisar frontmatter (`nyquist_compliant`, `wave_0_complete`).

Classificar por fase:

| Status | Condição |
|--------|----------|
| CONFORME | `nyquist_compliant: true` e todas as tarefas verdes |
| PARCIAL | VALIDATION.md existe, `nyquist_compliant: false` ou vermelho/pendente |
| AUSENTE | Sem VALIDATION.md |

Adicionar ao YAML de auditoria: `nyquist: { compliant_phases, partial_phases, missing_phases, overall }`

Apenas descoberta — nunca chama `/validar-fase` automaticamente.

## 6. Agregar em v{versão}-MILESTONE-AUDIT.md

Criar `.planning/v{versão}-v{versão}-MILESTONE-AUDIT.md` com:

```yaml
---
milestone: {versão}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:  # Bloqueadores críticos
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      phase: "{fase atribuída}"
      claimed_by_plans: ["{arquivos de plano que referenciam este requisito}"]
      completed_by_plans: ["{arquivos de plano cujo SUMMARY o marca como completo}"]
      verification_status: "passed | gaps_found | missing | orphaned"
      evidence: "{evidência específica ou falta dela}"
  integration: [...]
  flows: [...]
tech_debt:  # Não crítico, adiado
  - phase: 01-auth
    items:
      - "TODO: adicionar rate limiting"
      - "Aviso: sem validação de força de senha"
  - phase: 03-dashboard
    items:
      - "Adiado: layout responsivo mobile"
---
```

Mais relatório markdown completo com tabelas para requisitos, fases, integração, dívida técnica.

**Valores de status:**
- `passed` — todos os requisitos atendidos, sem lacunas críticas, dívida técnica mínima
- `gaps_found` — bloqueadores críticos existem
- `tech_debt` — sem bloqueadores mas itens adiados acumulados precisam de revisão

## 7. Apresentar Resultados

Rotear por status (veja `<offer_next>`).

</process>

<offer_next>
Emitir este markdown diretamente (não como bloco de código). Rotear com base no status:

---

**Se passed:**

## ✓ Milestone {versão} — Auditoria Aprovada

**Pontuação:** {N}/{M} requisitos satisfeitos
**Relatório:** .planning/v{versão}-MILESTONE-AUDIT.md

Todos os requisitos cobertos. Integração cross-fase verificada. Fluxos E2E completos.

───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**Concluir milestone** — arquivar e taggear

/concluir-marco {versão}

<sub>/clear primeiro → janela de contexto fresca</sub>

───────────────────────────────────────────────────────────────

---

**Se gaps_found:**

## ⚠ Milestone {versão} — Lacunas Encontradas

**Pontuação:** {N}/{M} requisitos satisfeitos
**Relatório:** .planning/v{versão}-MILESTONE-AUDIT.md

### Requisitos Insatisfeitos

{Para cada requisito insatisfeito:}
- **{REQ-ID}: {descrição}** (Fase {X})
  - {motivo}

### Problemas Cross-Fase

{Para cada lacuna de integração:}
- **{de} → {para}:** {problema}

### Fluxos Quebrados

{Para cada lacuna de fluxo:}
- **{nome do fluxo}:** quebra em {etapa}

### Cobertura Nyquist

| Fase | VALIDATION.md | Conforme | Ação |
|------|---------------|----------|------|
| {fase} | existe/ausente | verdadeiro/falso/parcial | `/validar-fase {N}` |

Fases precisando de validação: execute `/validar-fase {N}` para cada fase sinalizada.

───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**Planejar fechamento de lacunas** — criar fases para completar o milestone

/planejar-lacunas

<sub>/clear primeiro → janela de contexto fresca</sub>

───────────────────────────────────────────────────────────────

**Também disponível:**
- cat .planning/v{versão}-MILESTONE-AUDIT.md — ver relatório completo
- /concluir-marco {versão} — prosseguir mesmo assim (aceitar dívida técnica)

───────────────────────────────────────────────────────────────

---

**Se tech_debt (sem bloqueadores mas dívida acumulada):**

## ⚡ Milestone {versão} — Revisão de Dívida Técnica

**Pontuação:** {N}/{M} requisitos satisfeitos
**Relatório:** .planning/v{versão}-MILESTONE-AUDIT.md

Todos os requisitos atendidos. Sem bloqueadores críticos. Dívida técnica acumulada precisa de revisão.

### Dívida Técnica por Fase

{Para cada fase com dívida:}
**Fase {X}: {nome}**
- {item 1}
- {item 2}

### Total: {N} itens em {M} fases

───────────────────────────────────────────────────────────────

## ▶ Opções

**A. Concluir milestone** — aceitar dívida, rastrear no backlog

/concluir-marco {versão}

**B. Planejar fase de limpeza** — resolver dívida antes de concluir

/planejar-lacunas

<sub>/clear primeiro → janela de contexto fresca</sub>

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] Escopo do milestone identificado
- [ ] Todos os arquivos VERIFICATION.md de fase lidos
- [ ] Frontmatter `requirements-completed` do SUMMARY.md extraído para cada fase
- [ ] Tabela de rastreabilidade do REQUIREMENTS.md analisada para todos os REQ-IDs do milestone
- [ ] Referência cruzada de 3 fontes concluída (VERIFICATION + SUMMARY + rastreabilidade)
- [ ] Requisitos órfãos detectados (na rastreabilidade mas ausentes de todos os VERIFICATIONs)
- [ ] Dívida técnica e lacunas adiadas agregadas
- [ ] Verificador de integração criado com IDs de requisitos do milestone
- [ ] v{versão}-MILESTONE-AUDIT.md criado com objetos de lacuna de requisitos estruturados
- [ ] Portão de FALHA aplicado — qualquer requisito insatisfeito força status gaps_found
- [ ] Conformidade Nyquist verificada para todas as fases do milestone (se habilitado)
- [ ] Fases com VALIDATION.md ausente sinalizadas com sugestão de validate-phase
- [ ] Resultados apresentados com próximos passos acionáveis
</success_criteria>

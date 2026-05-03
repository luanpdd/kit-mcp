# Workflow de Forense

Investigação post-mortem para workflows framework que falharam ou travaram. Analisa histórico git,
artefatos de `.planning/` e estado do sistema de arquivos para detectar anomalias e gerar um
relatório diagnóstico estruturado.

**Princípio:** Esta é uma investigação somente leitura. Não modifique arquivos do projeto.
Apenas escreva o relatório forense.

---

## Passo 1: Obter Descrição do Problema

```bash
PROBLEM="$ARGUMENTS"
```

Se `$ARGUMENTS` estiver vazio, perguntar ao usuário:
> "O que deu errado? Descreva o problema — ex: 'modo autônomo travou na fase 3',
> 'execute-phase falhou silenciosamente', 'custos parecem incomumente altos'."

Registrar a descrição do problema para o relatório.

## Passo 2: Coletar Evidências

Coletar dados de todas as fontes disponíveis. Fontes ausentes são aceitáveis — adapte ao que existe.

### 2a. Histórico Git

```bash
# Commits recentes (últimos 30)
git log --oneline -30

# Commits com timestamps para análise de lacunas
git log --format="%H %ai %s" -30

# Arquivos alterados em commits recentes (detectar edições repetidas)
git log --name-only --format="" -20 | sort | uniq -c | sort -rn | head -20

# Trabalho não commitado
git status --short
git diff --stat
```

Registrar:
- Timeline de commits (datas, mensagens, frequência)
- Arquivos mais editados (indicador potencial de loop preso)
- Mudanças não commitadas (indicador potencial de crash/interrupção)

### 2b. Estado de Planejamento

Ler estes arquivos se existirem:
- `.planning/STATE.md` — milestone atual, fase, progresso, bloqueios, última sessão
- `.planning/ROADMAP.md` — lista de fases com status
- `.planning/config.json` — configuração do workflow

Extrair:
- Fase atual e seu status
- Último ponto de parada de sessão registrado
- Quaisquer bloqueios ou flags

### 2c. Artefatos de Fase

Para cada diretório de fase em `.planning/phases/*/`:

```bash
ls .planning/phases/*/
```

Para cada fase, verificar quais artefatos existem:
- `{padded}-PLAN.md` ou `{padded}-PLAN-*.md` (planos de execução)
- `{padded}-SUMMARY.md` (resumo de conclusão)
- `{padded}-VERIFICATION.md` (verificação de qualidade)
- `{padded}-CONTEXT.md` (decisões de design)
- `{padded}-RESEARCH.md` (pesquisa pré-planejamento)

Rastrear: quais fases têm conjuntos de artefatos completos vs. lacunas.

### 2d. Relatórios de Sessão

Ler `.planning/reports/SESSION_REPORT.md` se existir — extrair resultados da última sessão,
trabalho concluído, estimativas de tokens.

### 2e. Estado de Worktree Git

```bash
git worktree list
```

Verificar worktrees órfãos (de agentes que crasharam).

## Passo 3: Detectar Anomalias

Avaliar as evidências coletadas contra estes padrões de anomalia:

### Detecção de Loop Preso

**Sinal:** Mesmo arquivo aparece em 3+ commits consecutivos em uma janela de tempo curta.

```bash
# Procurar arquivos commitados repetidamente em sequência
git log --name-only --format="---COMMIT---" -20
```

Analisar limites de commit. Se qualquer arquivo aparecer em 3+ commits consecutivos, sinalizar como:
- **Confiança ALTA** se as mensagens de commit forem similares (ex: "fix:", "fix:", "fix:" no mesmo arquivo)
- **Confiança MÉDIA** se o arquivo aparecer frequentemente mas as mensagens variem

### Detecção de Artefato Ausente

**Sinal:** Fase parece completa (tem commits, está no passado do roadmap) mas falta artefatos esperados.

Para cada fase que deve estar completa:
- PLAN.md ausente → etapa de planejamento foi pulada
- SUMMARY.md ausente → fase não foi encerrada corretamente
- VERIFICATION.md ausente → verificação de qualidade foi pulada

### Detecção de Trabalho Abandonado

**Sinal:** Grande lacuna entre o último commit e o momento atual, com STATE.md mostrando execução no meio.

```bash
# Tempo desde o último commit
git log -1 --format="%ai"
```

Se STATE.md mostrar uma fase ativa mas o último commit tiver mais de 2 horas de antigüidade e houver
mudanças não commitadas, sinalizar como potencial abandono ou crash.

### Detecção de Crash/Interrupção

**Sinal:** Mudanças não commitadas + STATE.md mostra execução no meio + worktrees órfãos.

Combinar:
- `git status` mostra arquivos modificados/staged
- STATE.md tem uma entrada de execução ativa
- `git worktree list` mostra worktrees além do principal

### Detecção de Deriva de Escopo

**Sinal:** Commits recentes tocam arquivos fora do escopo esperado da fase atual.

Ler o PLAN.md da fase atual para determinar caminhos de arquivo esperados. Comparar com
arquivos realmente modificados em commits recentes. Sinalizar qualquer arquivo que esteja claramente
fora do domínio da fase.

### Detecção de Regressão de Testes

**Sinal:** Mensagens de commit contendo "fix test", "revert" ou re-commits de arquivos de teste.

```bash
git log --oneline -20 | grep -iE "fix test|revert|broken|regression|fail"
```

## Passo 4: Gerar Relatório

Criar o diretório de forense se necessário:
```bash
mkdir -p .planning/forensics
```

Escrever em `.planning/forensics/report-$(date +%Y%m%d-%H%M%S).md`:

```markdown
# Relatório Forense

**Gerado:** {timestamp ISO}
**Problema:** {descrição do usuário}

---

## Resumo de Evidências

### Atividade Git
- **Último commit:** {data} — "{mensagem}"
- **Commits (últimos 30):** {contagem}
- **Intervalo de tempo:** {mais antigo} → {mais recente}
- **Mudanças não commitadas:** {sim/não — listar se sim}
- **Worktrees ativos:** {contagem — listar se >1}

### Estado de Planejamento
- **Milestone atual:** {versão ou "nenhum"}
- **Fase atual:** {número — nome — status}
- **Última sessão:** {stopped_at do STATE.md}
- **Bloqueios:** {quaisquer flags do STATE.md}

### Completude de Artefatos
| Fase | PLAN | CONTEXT | RESEARCH | SUMMARY | VERIFICATION |
|------|------|---------|----------|---------|-------------|
{para cada fase: nome | ✅/❌ por artefato}

## Anomalias Detectadas

### {Tipo de Anomalia} — {Confiança: ALTA/MÉDIA/BAIXA}
**Evidência:** {commits específicos, arquivos ou dados de estado}
**Interpretação:** {o que isso provavelmente significa}

{repetir para cada anomalia encontrada}

## Hipótese de Causa Raiz

Com base nas evidências acima, a explicação mais provável é:

{hipótese de 1-3 frases fundamentada nas anomalias}

## Ações Recomendadas

1. {Passo de remediação específico e acionável}
2. {Outro passo se aplicável}
3. {Comando de recuperação se aplicável — ex: `/retomar-trabalho`, `/executar-fase N`}

---

*Relatório gerado por `/forense`. Todos os caminhos redirecionados para portabilidade.*
```

**Regras de redação:**
- Substituir caminhos absolutos por caminhos relativos (remover prefixo `$HOME`)
- Remover quaisquer chaves de API, tokens ou credenciais encontrados na saída do git diff
- Truncar diffs grandes para as primeiras 50 linhas

## Passo 5: Apresentar Relatório

Exibir o relatório forense completo inline.

## Passo 6: Oferecer Investigação Interativa

> "Relatório salvo em `.planning/forensics/report-{timestamp}.md`.
>
> Posso aprofundar em qualquer descoberta. Quer que eu:
> - Rastreie uma anomalia específica até sua causa raiz?
> - Leia arquivos específicos referenciados nas evidências?
> - Verifique se um problema semelhante foi relatado antes?"

Se o usuário fizer perguntas de acompanhamento, responda a partir das evidências já coletadas.
Ler arquivos adicionais apenas se especificamente necessário.

## Passo 7: Oferecer Criação de Issue

Se anomalias acionáveis foram encontradas (confiança ALTA ou MÉDIA):

> "Quer que eu crie uma issue no GitHub para isso? Formatará as descobertas e redirecionará caminhos."

Se confirmado:
```bash
# Verificar se o label "bug" existe antes de usar
BUG_LABEL=$(gh label list --search "bug" --json name -q '.[0].name' 2>/dev/null)
LABEL_FLAG=""
if [ -n "$BUG_LABEL" ]; then
  LABEL_FLAG="--label bug"
fi

gh issue create \
  --title "bug: {descrição concisa da anomalia}" \
  $LABEL_FLAG \
  --body "{descobertas formatadas do relatório}"
```

## Passo 8: Atualizar STATE.md

```bash
tools.cjs state record-session \
  --stopped-at "Forensic investigation complete" \
  --resume-file ".planning/forensics/report-{timestamp}.md"
```

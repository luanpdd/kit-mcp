<purpose>
Revisão cruzada entre IAs — invoca CLIs externas de IA para revisar planos de fase de forma independente.
Cada CLI recebe o mesmo prompt (contexto de PROJECT.md, planos de fase, requisitos) e
produz feedback estruturado. Os resultados são combinados em REVIEWS.md para o planejador
incorporar via flag --reviews.

Implementa revisão adversarial: diferentes modelos de IA captam diferentes pontos cegos.
Um plano que sobrevive à revisão de 2-3 sistemas de IA independentes é mais robusto.
</purpose>

<process>

<step name="detect_clis">
Verifique quais CLIs de IA estão disponíveis no sistema:

```bash
# Verificar cada CLI
command -v claude >/dev/null 2>&1 && echo "claude:available" || echo "claude:missing"
command -v codex >/dev/null 2>&1 && echo "codex:available" || echo "codex:missing"
```

Analise as flags de `$ARGUMENTS`:
- `--claude` → incluir Claude
- `--codex` → incluir Codex
- `--all` → incluir todos disponíveis
- Sem flags → incluir todos disponíveis

Se nenhuma CLI disponível:
```
Nenhuma CLI de IA externa encontrada. Instale pelo menos uma:
- codex: https://github.com/openai/codex
- claude: https://github.com/anthropics/claude-code

Depois execute /revisar novamente.
```
Encerre.

Se apenas uma CLI é o runtime atual (ex.: executando dentro do Claude), pule-a para a revisão
para garantir independência. Pelo menos uma CLI DIFERENTE deve estar disponível.
</step>

<step name="gather_context">
Colete os artefatos da fase para o prompt de revisão:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Leia do init: `phase_dir`, `phase_number`, `padded_phase`.

Depois leia:
1. `.planning/PROJECT.md` (primeiras 80 linhas — contexto do projeto)
2. Seção da fase em `.planning/ROADMAP.md`
3. Todos os arquivos `*-PLAN.md` no diretório da fase
4. `*-CONTEXT.md` se presente (decisões do usuário)
5. `*-RESEARCH.md` se presente (pesquisa de domínio)
6. `.planning/REQUIREMENTS.md` (requisitos que esta fase endereça)
</step>

<step name="build_prompt">
Construa um prompt de revisão estruturado:

```markdown
# Cross-AI Plan Review Request

You are reviewing implementation plans for a software project phase.
Provide structured feedback on plan quality, completeness, and risks.

## Project Context
{first 80 lines of PROJECT.md}

## Phase {N}: {phase name}
### Roadmap Section
{roadmap phase section}

### Requirements Addressed
{requirements for this phase}

### User Decisions (CONTEXT.md)
{context if present}

### Research Findings
{research if present}

### Plans to Review
{all PLAN.md contents}

## Review Instructions

Analyze each plan and provide:

1. **Summary** — One-paragraph assessment
2. **Strengths** — What's well-designed (bullet points)
3. **Concerns** — Potential issues, gaps, risks (bullet points with severity: HIGH/MEDIUM/LOW)
4. **Suggestions** — Specific improvements (bullet points)
5. **Risk Assessment** — Overall risk level (LOW/MEDIUM/HIGH) with justification

Focus on:
- Missing edge cases or error handling
- Dependency ordering issues
- Scope creep or over-engineering
- Security considerations
- Performance implications
- Whether the plans actually achieve the phase goals

Output your review in markdown format.
```

Escreva em um arquivo temporário: `/tmp/review-prompt-{phase}.md`
</step>

<step name="invoke_reviewers">
Para cada CLI selecionada, invoque em sequência (não em paralelo — evitar limites de taxa):

**Claude (sessão separada):**
```bash
claude -p "$(cat /tmp/review-prompt-{phase}.md)" --no-input 2>/dev/null > /tmp/review-claude-{phase}.md
```

**Codex:**
```bash
codex exec --skip-git-repo-check "$(cat /tmp/review-prompt-{phase}.md)" 2>/dev/null > /tmp/review-codex-{phase}.md
```

Se uma CLI falhar, registre o erro e continue com as CLIs restantes.

Exiba o progresso:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► REVISÃO CRUZADA ENTRE IAs — Fase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Revisando com {CLI}... concluído ✓
◆ Revisando com {CLI}... concluído ✓
```
</step>

<step name="write_reviews">
Combine todas as respostas de revisão em `{phase_dir}/{padded_phase}-REVIEWS.md`:

```markdown
---
phase: {N}
reviewers: [claude, codex]
reviewed_at: {timestamp ISO}
plans_reviewed: [{lista de arquivos PLAN.md}]
---

# Revisão Cruzada Entre IAs — Fase {N}

## Revisão Claude

{conteúdo da revisão claude}

---

## Revisão Codex

{conteúdo da revisão codex}

---

## Resumo de Consenso

{sintetize preocupações comuns entre todos os revisores}

### Pontos Fortes Consensuais
{pontos fortes mencionados por 2+ revisores}

### Preocupações Consensuais
{preocupações levantadas por 2+ revisores — prioridade mais alta}

### Visões Divergentes
{onde os revisores discordaram — vale investigar}
```

Commit:
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: revisão cruzada entre IAs para fase {N}" --files {phase_dir}/{padded_phase}-REVIEWS.md
```
</step>

<step name="present_results">
Exiba o resumo:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► REVISÃO CONCLUÍDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fase {N} revisada por {contagem} sistemas de IA.

Preocupações consensuais:
{top 3 preocupações compartilhadas}

Revisão completa: {padded_phase}-REVIEWS.md

Para incorporar o feedback no planejamento:
  /planejar-fase {N} --reviews
```

Limpe os arquivos temporários.
</step>

</process>

<success_criteria>
- [ ] Pelo menos uma CLI externa invocada com sucesso
- [ ] REVIEWS.md escrito com feedback estruturado
- [ ] Resumo de consenso sintetizado de múltiplos revisores
- [ ] Arquivos temporários limpos
- [ ] Usuário sabe como usar o feedback (/planejar-fase --reviews)
</success_criteria>

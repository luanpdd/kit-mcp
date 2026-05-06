---
type: prompt
name: forense
description: Investigação post-mortem de workflows framework com falha — analisa histórico git, artefatos e estado para diagnosticar o que deu errado
argument-hint: "[descrição do problema]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
Investigar o que deu errado durante a execução de um workflow framework. Analisa histórico git, artefatos `.planning/` e estado do sistema de arquivos para detectar anomalias e gerar um relatório diagnóstico estruturado.

Propósito: Diagnosticar workflows com falha ou travados para que o usuário possa entender a causa raiz e tomar ação corretiva.
Saída: Relatório forense salvo em `.planning/forensics/`, apresentado inline, com criação opcional de issue.
</objective>

<execution_context>
@./.claude/framework/workflows/forensics.md
</execution_context>

<context>
**Fontes de dados:**
- `git log` (commits recentes, padrões, lacunas de tempo)
- `git status` / `git diff` (trabalho não commitado, conflitos)
- `.planning/STATE.md` (posição atual, histórico de sessão)
- `.planning/ROADMAP.md` (escopo e progresso das fases)
- `.planning/phases/*/` (PLAN.md, SUMMARY.md, VERIFICATION.md, CONTEXT.md)
- `.planning/reports/SESSION_REPORT.md` (resultados da última sessão)

**Entrada do usuário:**
- Descrição do problema: $ARGUMENTS (opcional — perguntará se não fornecido)
</context>

<process>
Ler e executar o workflow forensics de @./.claude/framework/workflows/forensics.md do início ao fim.
</process>

<success_criteria>
- Evidências coletadas de todas as fontes de dados disponíveis
- Pelo menos 4 tipos de anomalia verificados (loop travado, artefatos ausentes, trabalho abandonado, crash/interrupção)
- Relatório forense estruturado escrito em `.planning/forensics/report-{timestamp}.md`
- Relatório apresentado inline com descobertas, anomalias e recomendações
- Investigação interativa oferecida para análise mais profunda
- Criação de issue no GitHub oferecida se existirem descobertas acionáveis
</success_criteria>

<critical_rules>
- **Investigação somente leitura:** Não modificar arquivos fonte do projeto durante forense. Apenas escrever o relatório forense e atualizar rastreamento de sessão no STATE.md.
- **Redigir dados sensíveis:** Remover caminhos absolutos, chaves de API, tokens de relatórios e issues.
- **Fundamentar descobertas em evidências:** Toda anomalia deve citar commits, arquivos ou dados de estado específicos.
- **Sem especulação sem evidência:** Se os dados forem insuficientes, diga isso — não fabrique causas raiz.
</critical_rules>

<observability_integration>
**Integração com Core Analysis Loop (v1.9):**

Forense usa skill [`core-analysis-loop`](../skills/core-analysis-loop/SKILL.md) — método científico iterativo (sintoma → hipótese de dados → validação → próxima iteração) em vez de inspeção ad hoc.

Cada anomalia detectada vira hipótese com query de validação:

| Tipo de anomalia | Hipótese formada | Query de validação |
|---|---|---|
| Loop travado | "phase X stuck há Yh" | `git log --since="Yh ago" --grep=phase` para confirmar zero commits |
| Artefatos ausentes | "PLAN.md ausente em phase X" | `ls .planning/phases/X-*/X-PLAN-*.md` |
| Trabalho abandonado | "branch sem merge nem commit recente" | `git log -1 <branch>` + `git status` |
| Crash/interrupção | "executor falhou em meio a fase" | grep no STATE.md por "in_progress" sem update recente |

**Skill consultada explicitamente:** abrir o arquivo `kit/skills/core-analysis-loop/SKILL.md` para padrão "documentação da trilha (formato canônico)" — o relatório forense em `.planning/forensics/report-<ts>.md` segue esse formato com cada hipótese tendo "Query / Resultado / Status (VALIDATED / REFUTED / INCONCLUSIVE)".

**REQ:** INT-FW-06.
</observability_integration>
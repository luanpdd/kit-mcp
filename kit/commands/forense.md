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
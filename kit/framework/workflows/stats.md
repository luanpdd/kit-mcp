<purpose>
Exibe estatísticas abrangentes do projeto incluindo fases, planos, requisitos, métricas git e linha do tempo.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="gather_stats">
Colete estatísticas do projeto:

```bash
STATS=$(node "./.claude/framework/bin/tools.cjs" stats json)
if [[ "$STATS" == @file:* ]]; then STATS=$(cat "${STATS#@file:}"); fi
```

Extraia campos do JSON: `milestone_version`, `milestone_name`, `phases`, `phases_completed`, `phases_total`, `total_plans`, `total_summaries`, `percent`, `plan_percent`, `requirements_total`, `requirements_complete`, `git_commits`, `git_first_commit_date`, `last_activity`.
</step>

<step name="present_stats">
Apresente ao usuário com este formato:

```
# 📊 Estatísticas do Projeto — {milestone_version} {milestone_name}

## Progresso
[████████░░] X/Y fases (Z%)

## Planos
X/Y planos concluídos (Z%)

## Fases
| Fase | Nome | Planos | Concluídos | Status |
|------|------|--------|------------|--------|
| ...  | ...  | ...    | ...        | ...    |

## Requisitos
✅ X/Y requisitos concluídos

## Git
- **Commits:** N
- **Iniciado em:** AAAA-MM-DD
- **Última atividade:** AAAA-MM-DD

## Linha do Tempo
- **Idade do projeto:** N dias
```

Se nenhum diretório `.planning/` existir, informe ao usuário para executar `/novo-projeto` primeiro.
</step>

</process>

<success_criteria>
- [ ] Estatísticas coletadas do estado do projeto
- [ ] Resultados formatados claramente
- [ ] Exibidos ao usuário
</success_criteria>

<purpose>
Gerar um documento de resumo pós-sessão capturando o trabalho realizado, resultados alcançados e uso estimado de recursos. Escreve SESSION_REPORT.md em .planning/reports/ para revisão humana e compartilhamento com stakeholders.
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="gather_session_data">
Coletar dados da sessão das fontes disponíveis:

1. **STATE.md** — fase atual, milestone, progresso, bloqueadores, decisões
2. **Log do Git** — commits feitos durante esta sessão (últimas 24h ou desde o último relatório)
3. **Arquivos de Plano/Summary** — planos executados, summaries escritos
4. **ROADMAP.md** — contexto do milestone e objetivos de fase

```bash
# Obter commits recentes (últimas 24 horas)
git log --oneline --since="24 hours ago" --no-merges 2>/dev/null || echo "Sem commits recentes"

# Contar arquivos alterados
git diff --stat HEAD~10 HEAD 2>/dev/null | tail -1 || echo "Nenhum diff disponível"
```

Ler `.planning/STATE.md` para obter:
- Milestone e fase atuais
- Percentual de progresso
- Bloqueadores ativos
- Decisões recentes

Ler `.planning/ROADMAP.md` para obter nome e objetivos do milestone.

Verificar relatórios existentes:
```bash
ls -la .planning/reports/SESSION_REPORT*.md 2>/dev/null || echo "Sem relatórios anteriores"
```
</step>

<step name="estimate_usage">
Estimar uso de tokens a partir de sinais observáveis:

- A contagem de chamadas de ferramenta não está diretamente disponível, então estimar a partir de atividade do git e operações de arquivo
- Nota: Esta é uma **estimativa** — contagens exatas de tokens requerem instrumentação em nível de API não disponível para hooks

Heurísticas de estimativa:
- Cada commit ≈ 1 ciclo de plano (pesquisa + plano + execução + verificação)
- Cada arquivo de plano ≈ 2.000-5.000 tokens de contexto do agente
- Cada arquivo de summary ≈ 1.000-2.000 tokens gerados
- Criações de subagente multiplicam por ~1,5x por tipo de agente usado
</step>

<step name="generate_report">
Criar o diretório e arquivo do relatório:

```bash
mkdir -p .planning/reports
```

Escrever `.planning/reports/SESSION_REPORT.md` (ou `.planning/reports/AAAAMMDD-session-report.md` se relatórios anteriores existirem):

```markdown
# Relatório de Sessão framework

**Gerado:** [timestamp]
**Projeto:** [do título do PROJECT.md ou nome do diretório]
**Milestone:** [N] — [nome do milestone do ROADMAP.md]

---

## Resumo da Sessão

**Duração:** [estimada do primeiro ao último timestamp de commit, ou "Sessão única"]
**Progresso da Fase:** [do STATE.md]
**Planos Executados:** [contagem de summaries escritos nesta sessão]
**Commits Feitos:** [contagem do git log]

## Trabalho Realizado

### Fases Tocadas
[Listar fases trabalhadas com breve descrição do que foi feito]

### Resultados-Chave
[Lista de entregáveis concretos: arquivos criados, funcionalidades implementadas, bugs corrigidos]

### Decisões Tomadas
[Da tabela de decisões do STATE.md, se alguma foi adicionada nesta sessão]

## Arquivos Alterados

[Resumo de arquivos modificados, criados, deletados — do git diff stat]

## Bloqueadores e Itens em Aberto

[Bloqueadores ativos do STATE.md]
[Quaisquer itens TODO criados durante a sessão]

## Uso Estimado de Recursos

| Métrica | Estimativa |
|---------|------------|
| Commits | [N] |
| Arquivos alterados | [N] |
| Planos executados | [N] |
| Subagentes criados | [estimado] |

> **Nota:** Estimativas de tokens e custo requerem instrumentação em nível de API.
> Essas métricas refletem apenas a atividade de sessão observável.

---

*Gerado por `/relatorio-sessao`*
```
</step>

<step name="display_result">
Mostrar ao usuário:

```
## Relatório de Sessão Gerado

📄 `.planning/reports/[nome-do-arquivo].md`

### Destaques
- **Commits:** [N]
- **Arquivos alterados:** [N]
- **Progresso da fase:** [X]%
- **Planos executados:** [N]
```

Se este for o primeiro relatório, mencionar:
```
💡 Execute `/relatorio-sessao` no final de cada sessão para construir um histórico de atividade do projeto.
```
</step>

</process>

<success_criteria>
- [ ] Dados da sessão coletados do STATE.md, git log e arquivos de plano
- [ ] Relatório escrito em .planning/reports/
- [ ] Relatório inclui resumo do trabalho, resultados e alterações de arquivos
- [ ] Nome do arquivo inclui data para evitar sobrescritas
- [ ] Resumo do resultado exibido ao usuário
</success_criteria>

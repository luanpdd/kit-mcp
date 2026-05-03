<purpose>

Arquivar diretórios de fase acumulados de milestones concluídos em `.planning/milestones/v{X.Y}-phases/`. Identifica quais fases pertencem a cada milestone concluído, mostra um resumo de simulação e move os diretórios após confirmação.

</purpose>

<required_reading>

1. `.planning/MILESTONES.md`
2. Listagem do diretório `.planning/milestones/`
3. Listagem do diretório `.planning/phases/`

</required_reading>

<process>

<step name="identify_completed_milestones">

Leia `.planning/MILESTONES.md` para identificar milestones concluídos e suas versões.

```bash
cat .planning/MILESTONES.md
```

Extrair cada versão de milestone (ex: v1.0, v1.1, v2.0).

Verificar quais diretórios de arquivo de milestone já existem:

```bash
ls -d .planning/milestones/v*-phases 2>/dev/null || true
```

Filtrar para milestones que NÃO têm ainda um diretório de arquivo `-phases`.

Se todos os milestones já tiverem arquivos de fase:

```
Todos os milestones concluídos já têm diretórios de fase arquivados. Nada para limpar.
```

Parar aqui.

</step>

<step name="determine_phase_membership">

Para cada milestone concluído sem arquivo `-phases`, leia o snapshot de ROADMAP arquivado para determinar quais fases pertencem a ele:

```bash
cat .planning/milestones/v{X.Y}-ROADMAP.md
```

Extrair números e nomes de fase do roadmap arquivado (ex: Fase 1: Foundation, Fase 2: Auth).

Verificar quais desses diretórios de fase ainda existem em `.planning/phases/`:

```bash
ls -d .planning/phases/*/ 2>/dev/null || true
```

Corresponder diretórios de fase à associação de milestone. Incluir apenas diretórios que ainda existem em `.planning/phases/`.

</step>

<step name="show_dry_run">

Apresentar um resumo de simulação para cada milestone:

```
## Resumo de Limpeza

### v{X.Y} — {Nome do Milestone}
Estes diretórios de fase serão arquivados:
- 01-foundation/
- 02-auth/
- 03-core-features/

Destino: .planning/milestones/v{X.Y}-phases/

### v{X.Z} — {Nome do Milestone}
Estes diretórios de fase serão arquivados:
- 04-security/
- 05-hardening/

Destino: .planning/milestones/v{X.Z}-phases/
```

Se nenhum diretório de fase permanecer para arquivar (todos já movidos ou deletados):

```
Nenhum diretório de fase encontrado para arquivar. As fases podem ter sido removidas ou arquivadas anteriormente.
```

Parar aqui.

AskUserQuestion: "Prosseguir com o arquivamento?" com opções: "Sim — arquivar fases listadas" | "Cancelar"

Se "Cancelar": Parar.

</step>

<step name="archive_phases">

Para cada milestone, mover diretórios de fase:

```bash
mkdir -p .planning/milestones/v{X.Y}-phases
```

Para cada diretório de fase pertencente a este milestone:

```bash
mv .planning/phases/{dir} .planning/milestones/v{X.Y}-phases/
```

Repetir para todos os milestones no conjunto de limpeza.

</step>

<step name="commit">

Commitar as mudanças:

```bash
node "./.claude/framework/bin/tools.cjs" commit "chore: archive phase directories from completed milestones" --files .planning/milestones/ .planning/phases/
```

</step>

<step name="report">

```
Arquivado:
{Para cada milestone}
- v{X.Y}: {N} diretórios de fase → .planning/milestones/v{X.Y}-phases/

.planning/phases/ limpo.
```

</step>

</process>

<success_criteria>

- [ ] Todos os milestones concluídos sem arquivos de fase existentes identificados
- [ ] Associação de fase determinada a partir de snapshots de ROADMAP arquivados
- [ ] Resumo de simulação mostrado e confirmado pelo usuário
- [ ] Diretórios de fase movidos para `.planning/milestones/v{X.Y}-phases/`
- [ ] Mudanças commitadas

</success_criteria>

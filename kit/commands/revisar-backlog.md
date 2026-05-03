---
name: revisar-backlog
description: Revisa e promove itens do backlog para o milestone ativo
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Revisar todos os itens de backlog 999.x e opcionalmente promovê-los para a sequência do milestone ativo ou remover entradas obsoletas.
</objective>

<process>

1. **Listar itens do backlog:**
   ```bash
   ls -d .planning/phases/999* 2>/dev/null || echo "Nenhum item de backlog encontrado"
   ```

2. **Ler ROADMAP.md** e extrair todas as entradas de fase 999.x:
   ```bash
   cat .planning/ROADMAP.md
   ```
   Mostrar cada item do backlog com sua descrição, qualquer contexto acumulado (CONTEXT.md, RESEARCH.md) e data de criação.

3. **Apresentar a lista ao usuário** via AskUserQuestion:
   - Para cada item do backlog, mostrar: número da fase, descrição, artefatos acumulados
   - Opções por item: **Promover** (mover para ativo), **Manter** (deixar no backlog), **Remover** (deletar)

4. **Para itens a PROMOVER:**
   - Encontrar o próximo número de fase sequencial no milestone ativo
   - Renomear o diretório de `999.x-slug` para `{novo_num}-slug`:
     ```bash
     NEW_NUM=$(node "./.claude/framework/bin/tools.cjs" phase add "${DESCRIPTION}" --raw)
     ```
   - Mover artefatos acumulados para o novo diretório de fase
   - Atualizar ROADMAP.md: mover entrada da seção `## Backlog` para a lista de fases ativas
   - Remover marcador `(BACKLOG)`
   - Adicionar campo `**Depends on:**` apropriado

5. **Para itens a REMOVER:**
   - Deletar o diretório da fase
   - Remover a entrada da seção `## Backlog` do ROADMAP.md

6. **Commitar alterações:**
   ```bash
   node "./.claude/framework/bin/tools.cjs" commit "docs: revisar backlog — promovidos N, removidos M" --files .planning/ROADMAP.md
   ```

7. **Relatório resumo:**
   ```
   ## Revisão de Backlog Concluída

   Promovidos: {lista de itens promovidos com novos números de fase}
   Mantidos: {lista de itens que permanecem no backlog}
   Removidos: {lista de itens deletados}
   ```

</process>

---
name: adicionar-backlog
description: Adiciona uma ideia ao estacionamento de backlog (numeração 999.x)
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Adicionar um item de backlog ao roadmap usando a numeração 999.x. Itens de backlog são
ideias não sequenciadas que não estão prontas para planejamento ativo — ficam fora
da sequência normal de fases e acumulam contexto ao longo do tempo.
</objective>

<process>

1. **Ler ROADMAP.md** para encontrar entradas de backlog existentes:
   ```bash
   cat .planning/ROADMAP.md
   ```

2. **Encontrar o próximo número de backlog:**
   ```bash
   NEXT=$(node "./.claude/framework/bin/tools.cjs" phase next-decimal 999 --raw)
   ```
   Se não existirem fases 999.x, começar em 999.1.

3. **Criar o diretório da fase:**
   ```bash
   SLUG=$(node "./.claude/framework/bin/tools.cjs" generate-slug "$ARGUMENTS")
   mkdir -p ".planning/phases/${NEXT}-${SLUG}"
   touch ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

4. **Adicionar ao ROADMAP.md** em uma seção `## Backlog`. Se a seção não existir, criar ao final:

   ```markdown
   ## Backlog

   ### Fase {NEXT}: {descrição} (BACKLOG)

   **Objetivo:** [Capturado para planejamento futuro]
   **Requisitos:** A definir
   **Planos:** 0 planos

   Planos:
   - [ ] A definir (promover com /revisar-backlog quando pronto)
   ```

5. **Commit:**
   ```bash
   node "./.claude/framework/bin/tools.cjs" commit "docs: adicionar item de backlog ${NEXT} — ${ARGUMENTS}" --files .planning/ROADMAP.md ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

6. **Reportar:**
   ```
   ## 📋 Item de Backlog Adicionado

   Fase {NEXT}: {descrição}
   Diretório: .planning/phases/{NEXT}-{slug}/

   Este item está no estacionamento de backlog.
   Use /discutir-fase {NEXT} para explorá-lo melhor.
   Use /revisar-backlog para promover itens ao milestone ativo.
   ```

</process>

<notes>
- A numeração 999.x mantém itens de backlog fora da sequência de fases ativas
- Diretórios de fase são criados imediatamente, então /discutir-fase e /planejar-fase funcionam neles
- Sem campo `Depends on:` — itens de backlog são não sequenciados por definição
- Numeração esparsa é aceitável (999.1, 999.3) — sempre usa next-decimal
</notes>

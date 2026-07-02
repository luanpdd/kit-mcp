<purpose>
Captura uma ideia prospectiva como um arquivo de semente estruturado com condições de ativação.
As sementes se apresentam automaticamente durante /novo-marco quando as condições de ativação
correspondem ao escopo do novo marco.

Sementes superam itens adiados porque:
- Preservam POR QUE a ideia é importante (não apenas O QUE)
- Definem QUANDO apresentar (condições de ativação, não varredura manual)
- Rastreiam trilhas de evidências (referências de código, decisões relacionadas)
- Se apresentam automaticamente no momento certo via varredura de novo-marco
</purpose>

<process>

<step name="parse_idea">
Analise `$ARGUMENTS` para o resumo da ideia.

Se vazio, pergunte:
```
Qual é a ideia? (uma frase)
```

Armazene como `$IDEA`.
</step>

<step name="create_seed_dir">
```bash
mkdir -p .planning/seeds
```
</step>

<step name="gather_context">
Faça perguntas focadas para construir uma semente completa:

```
AskUserQuestion(
  header: "Gatilho",
  question: "Quando esta ideia deve se apresentar? (ex.: 'quando adicionarmos contas de usuário', 'na próxima versão principal', 'quando desempenho se tornar prioridade')",
  options: []  // texto livre
)
```

Armazene como `$TRIGGER`.

```
AskUserQuestion(
  header: "Por quê",
  question: "Por que isso é importante? Que problema resolve ou que oportunidade cria?",
  options: []
)
```

Armazene como `$WHY`.

```
AskUserQuestion(
  header: "Escopo",
  question: "Qual o tamanho disso? (estimativa aproximada)",
  options: [
    { label: "Pequeno", description: "Algumas horas — pode ser uma tarefa rápida" },
    { label: "Médio", description: "Uma fase ou duas — precisa de planejamento" },
    { label: "Grande", description: "Um marco completo — esforço significativo" }
  ]
)
```

Armazene como `$SCOPE`.
</step>

<step name="collect_breadcrumbs">
Pesquise no codebase referências relevantes:

```bash
# Encontrar arquivos relacionados às palavras-chave da ideia
grep -rl "$KEYWORD" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | head -10
```

Verifique também:
- STATE.md atual para decisões relacionadas
- ROADMAP.md para fases relacionadas
- todos/ para ideias capturadas relacionadas

Armazene os caminhos de arquivo relevantes como `$BREADCRUMBS`.
</step>

<step name="generate_seed_id">
```bash
# Encontrar o próximo número de semente
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

Gere um slug a partir do resumo da ideia.
</step>

<step name="write_seed">
Escreva `.planning/seeds/SEED-{PADDED}-{slug}.md`:

```markdown
---
id: SEED-{PADDED}
status: dormant
planted: {data ISO}
planted_during: {marco/fase atual do STATE.md}
trigger_when: {$TRIGGER}
scope: {$SCOPE}
---

# SEED-{PADDED}: {$IDEA}

## Por Que Isso Importa

{$WHY}

## Quando Apresentar

**Gatilho:** {$TRIGGER}

Esta semente deve ser apresentada durante `/novo-marco` quando o escopo
do marco corresponder a qualquer uma destas condições:
- {condição de ativação 1}
- {condição de ativação 2}

## Estimativa de Escopo

**{$SCOPE}** — {elaboração baseada na escolha de escopo}

## Trilhas de Evidências

Código e decisões relacionados encontrados no codebase atual:

{lista de $BREADCRUMBS com caminhos de arquivo}

## Notas

{qualquer contexto adicional da sessão atual}
```
</step>

<step name="commit_seed">
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: plantar semente — {$IDEA}" --files .planning/seeds/SEED-{PADDED}-{slug}.md
```
</step>

<step name="confirm">
```
✅ Semente plantada: SEED-{PADDED}

"{$IDEA}"
Gatilho: {$TRIGGER}
Escopo: {$SCOPE}
Arquivo: .planning/seeds/SEED-{PADDED}-{slug}.md

Esta semente se apresentará automaticamente quando você executar /novo-marco
e o escopo do marco corresponder à condição de ativação.
```
</step>

</process>

<success_criteria>
- [ ] Arquivo de semente criado em .planning/seeds/
- [ ] Frontmatter inclui status, gatilho, escopo
- [ ] Trilhas de evidências coletadas do codebase
- [ ] Commitado no git
- [ ] Usuário visualiza confirmação com informações do gatilho
</success_criteria>

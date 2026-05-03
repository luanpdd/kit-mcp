# Template CLAUDE.md

Template para `CLAUDE.md` na raiz do projeto — gerado automaticamente por `tools generate-claude-md`.

Contém 6 seções delimitadas por marcadores. Cada seção é atualizável independentemente.
O subcomando `generate-claude-md` gerencia 5 seções (project, stack, conventions, architecture, workflow enforcement).
A seção de perfil é gerenciada exclusivamente por `generate-claude-profile`.

---

## Templates de Seção

### Seção Project
```
<!-- framework:project-start source:PROJECT.md -->
## Project

{{project_content}}
<!-- framework:project-end -->
```

**Texto de fallback:**
```
Project not yet initialized. Run /novo-projeto to set up.
```

### Seção Stack
```
<!-- framework:stack-start source:STACK.md -->
## Technology Stack

{{stack_content}}
<!-- framework:stack-end -->
```

**Texto de fallback:**
```
Technology stack not yet documented. Will populate after codebase mapping or first phase.
```

### Seção Conventions
```
<!-- framework:conventions-start source:CONVENTIONS.md -->
## Conventions

{{conventions_content}}
<!-- framework:conventions-end -->
```

**Texto de fallback:**
```
Conventions not yet established. Will populate as patterns emerge during development.
```

### Seção Architecture
```
<!-- framework:architecture-start source:ARCHITECTURE.md -->
## Architecture

{{architecture_content}}
<!-- framework:architecture-end -->
```

**Texto de fallback:**
```
Architecture not yet mapped. Follow existing patterns found in the codebase.
```

### Seção Workflow Enforcement
```
<!-- framework:workflow-start source:framework defaults -->
## framework Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a framework command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/quick` for small fixes, doc updates, and ad-hoc tasks
- `/debug` for investigation and bug fixing
- `/executar-fase` for planned phase work

Do not make direct repo edits outside a framework workflow unless the user explicitly asks to bypass it.
<!-- framework:workflow-end -->
```

### Seção Profile (Apenas Placeholder)
```
<!-- framework:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.
<!-- framework:profile-end -->
```

**Nota:** Esta seção NÃO é gerenciada por `generate-claude-md`. É gerenciada exclusivamente
por `generate-claude-profile`. O placeholder acima é usado apenas ao criar um novo
arquivo CLAUDE.md quando ainda não existe seção de perfil.

---

## Ordem das Seções

1. **Project** — Identidade e propósito (o que é este projeto)
2. **Stack** — Escolhas de tecnologia (quais ferramentas são usadas)
3. **Conventions** — Padrões de código e regras (como o código é escrito)
4. **Architecture** — Estrutura do sistema (como os componentes se encaixam)
5. **Workflow Enforcement** — Pontos de entrada framework padrão para trabalho que altera arquivos
6. **Profile** — Preferências comportamentais do desenvolvedor (como interagir)

## Formato dos Marcadores

- Início: `<!-- framework:{name}-start source:{file} -->`
- Fim: `<!-- framework:{name}-end -->`
- Atributo source permite atualizações direcionadas quando arquivos fonte mudam
- Correspondência parcial no marcador de início (sem `-->` de fechamento) para detecção

## Comportamento de Fallback

Quando um arquivo fonte está faltando, o texto de fallback fornece orientação acionável para o Claude:
- Orienta o comportamento do Claude na ausência de dados
- Não são avisos de "faltando" ou placeholders
- Cada fallback diz ao Claude o que fazer, não apenas o que está ausente

# Your kit lives here

This `kit/` folder is the canonical source of your personal collection of
agents, slash-commands and skills. `kit-mcp` reads from here and projects
into every supported IDE.

## Layout

```
kit/
├── agents/                 one .md per sub-agent
│   └── <name>.md
├── commands/               one .md per slash-command
│   └── <name>.md
└── skills/                 one folder per skill, containing SKILL.md
    └── <name>/
        ├── SKILL.md
        └── references/     optional reference docs
```

## File format

Every file uses YAML frontmatter for metadata + Markdown body for the prompt:

```markdown
---
name: my-agent
description: One-sentence description of what this agent does and when to use it.
tools: Read, Write, Bash    # optional, agents only
color: blue                 # optional, agents only
---

The body of the agent prompt goes here. This is what the LLM sees when
the agent is spawned. Keep it focused, give clear instructions, list
constraints.
```

## Three example items ship in this folder

- `agents/example-reviewer.md` — minimal sub-agent template
- `commands/example-greeting.md` — minimal slash-command template
- `skills/example-skill/SKILL.md` — minimal skill template

Replace them with your own. Or, if you keep your kit elsewhere, point
kit-mcp at it:

```bash
kit kit list-agents --kit-root /path/to/your/kit
kit sync install claude-code --kit-root /path/to/your/kit --project-root .
```

Or set `KIT_MCP_KIT_ROOT` env var to make it the default for the session.

## Suíte DDIA Foundations (v1.22)

8ª suíte do kit, derivada de *Designing Data-Intensive Applications* (Martin Kleppmann, O'Reilly 2017). Cobre capítulos 4, 5, 6, 7, 8, 9, 11.

**Convenção nova:** A partir de v1.22, todos os artefatos novos (skills, agents, commands) usam **PT-BR descritivo** para nome de arquivo/identificador. Termos técnicos canônicos (CDC, RLS, MVCC, write skew, fencing token) preservados em descrições/conteúdo.

**Skills (7):**
- `evolucao-schema-compativel` (Ch 4) — backward/forward compat, padrão 3-passos
- `consistencia-leitura-replica` (Ch 5) — read-after-write, monotonic reads, prefix
- `tenant-quente-mitigacao` (Ch 6) — Justin Bieber problem + 5 estratégias
- `postgres-isolamento-concorrencia` (Ch 7) — 6 race conditions, isolation levels
- `armadilhas-sistemas-distribuidos` (Ch 8) — clock skew, fencing tokens, GC pause
- `escolha-modelo-consistencia` (Ch 9) — linearizable vs causal vs eventual
- `streams-eventos-cdc` (Ch 11) — CDC, event sourcing, exactly-once

**Agents (3):**
- `auditor-consistencia-isolamento` — detecta 6 anti-patterns de race condition
- `detector-tenant-quente` — detecta hot tenants via Supabase logs
- `validador-evolucao-schema` — pré-validação de migration arriscada

**Comando:** `/dados-distribuidos [auditar-consistencia | auditar-tenant-quente | validar-evolucao-schema | implementar-cdc]`

**Glossário compartilhado:** `_shared-dados-distribuidos/glossary.md` (PT-BR↔EN, 60+ termos)

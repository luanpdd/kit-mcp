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

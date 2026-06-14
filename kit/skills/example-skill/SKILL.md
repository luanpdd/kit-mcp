---
name: example-skill
cost_tier: leve
description: Template de skill de exemplo — demonstra como skills funcionam e onde criar a sua em kit/skills/. Use quando o usuário perguntar sobre skills ou pedir uma demo.
---

# Example skill

This is the SKILL.md of an example skill. Skills are lightweight expertise
packs that an LLM loads when its description matches the user's intent.

## When to use

The frontmatter `description` is what triggers a skill. Be specific about
*when* to use it, not just *what* it does.

Example trigger phrases:
- "show me an example skill"
- "how do skills work"
- "demo the skill loading"

## What this skill does

When loaded, this skill instructs the LLM to:

1. Acknowledge that the example skill loaded.
2. Explain in one sentence what skills are.
3. Point the user at `kit/skills/<name>/SKILL.md` so they know where to author their own.

## References

Optional `references/` folder next to this file can hold longer docs the LLM
loads only when needed (saves context window). For example:

```
kit/skills/example-skill/
├── SKILL.md         (this file — always loaded when triggered)
└── references/
    ├── advanced-usage.md
    └── api-reference.md
```

Replace this whole folder with your own skill when ready.

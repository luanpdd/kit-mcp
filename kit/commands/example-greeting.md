---
name: example-greeting
description: Example slash-command template. Replace with your own. Greets the user and shows what kit-mcp can do.
argument-hint: "[name]"
allowed-tools:
  - Bash
---

# /example-greeting

Greet the user (by name if provided) and print a one-line summary of what
kit-mcp does.

## Process

1. Parse `$ARGUMENTS` for an optional name.
2. Print:
   ```
   Hello <name>! kit-mcp is ready.
   <one-line summary of the kit's purpose>
   ```
3. Optionally, run `kit kit list-agents | head -3` so the user sees what's
   available.

## Notes

This is a minimal template. Real commands typically:
- Read STATE.md or other artifacts
- Spawn sub-agents via `Task(subagent_type=...)`
- Update files and commit
- Route to a downstream command

See the kit-mcp README for command authoring patterns.

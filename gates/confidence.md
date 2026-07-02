---
id: confidence
stage: pre-plan
blocking: false
description: After discovery, gate on the discovery confidence level before planning.
---

# Confidence gate

**When to run:** end of `discovery-phase` workflow, before handing off to `plan-phase`.

## Inputs

- `DISCOVERY.md` of the current phase (must contain `confidence: low | medium | high`)

## Verdict

- **passed (high)** — proceed silently
- **warn (medium)** — log "discovery completed with medium confidence" and proceed
- **block (low)**  — present options to the user:
  - "Aprofundar" — run discovery deeper
  - "Prosseguir mesmo assim" — accept and plan with caveats noted
  - "Pausar" — exit workflow

## Notes

Low-confidence discovery is a smell. It usually means the chosen library is too new,
the integration surface is poorly documented, or the requirements are still vague.
Forcing this gate prevents planning on shaky ground.

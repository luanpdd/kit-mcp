---
name: revisar
description: Solicita revisão entre IAs de planos de fase a partir de CLIs externas
argument-hint: "--phase N [--gemini] [--claude] [--codex] [--all]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
Invoca CLIs externas de IA (Gemini, Claude, Codex) para revisar planos de fase de forma independente.
Produz um REVIEWS.md estruturado com feedback por revisor que pode ser incorporado de volta ao
planejamento via /planejar-fase --reviews.

**Fluxo:** Detectar CLIs → Construir prompt de revisão → Invocar cada CLI → Coletar respostas → Escrever REVIEWS.md
</objective>

<execution_context>
@./.claude/framework/workflows/review.md
</execution_context>

<context>
Número da fase: extraído de $ARGUMENTS (obrigatório)

**Flags:**
- `--gemini` — Incluir revisão do Gemini CLI
- `--claude` — Incluir revisão do Claude CLI (usa sessão separada)
- `--codex` — Incluir revisão do Codex CLI
- `--all` — Incluir todos os CLIs disponíveis
</context>

<process>
Execute o workflow review de @./.claude/framework/workflows/review.md do início ao fim.
</process>

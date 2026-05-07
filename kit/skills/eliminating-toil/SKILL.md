---
name: eliminating-toil
description: Use ao identificar/eliminar toil — 6 critérios canônicos (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50%, automação como invariante.
---

# SRE — Eliminating Toil

## Quando usar

LLM carrega esta skill ao auditar tarefas operacionais, classificar trabalho como toil/non-toil, ou propor automação. Trigger phrases:

- "toil", "trabalho operacional"
- "eliminar toil", "reduzir toil"
- "≤ 50% toil", "regra 50%"
- "automation", "automatizar tarefa repetitiva"
- "isso é toil ou overhead?"
- "Google SRE cap 5"
- "TOIL-AUDIT"

## Regras absolutas

- **Toil tem 6 critérios canônicos** — uma tarefa É toil se TODOS os 6 valem: (1) **Manual** — humano executa cada vez; (2) **Repetitivo** — você já fez isso 3+ vezes; (3) **Automatizável** — script/cron resolve sem julgamento humano; (4) **Tático** — reage a evento, não planeja; (5) **Sem valor durável** — não cria asset permanente; (6) **Escala linear** — mais users = mais trabalho. Se QUALQUER um dos 6 = não, NÃO é toil (é overhead ou grungy work).
- **Regra ≤ 50%** — SRE não pode gastar mais que 50% do tempo em toil; restante é engineering (automação, capacity planning, instrumentation, postmortems). Se medindo > 50% por 1+ trimestre, é red flag — peça ajuda à liderança.
- **Toil ≠ overhead** — reuniões, RH, planejamento de quarter, performance review são **overhead** — necessários, não-elimináveis, NÃO contam para a regra ≤ 50%. Confundir overhead com toil = sub-medir.
- **Toil ≠ grungy work** — refactor de código legado, security cleanup, DB rebuild para reduzir bloat são **grungy work** — necessários, têm valor durável, são engineering trabalho. NÃO contam como toil.
- **Automação é o objetivo, não o meio** — automatizar parcialmente (humano clica botão A, depois B, depois C) ainda é toil. Automação completa (cron + script + alert se falhar) elimina toil. Meias-medidas perpetuam.
- **Toil tax cresce com produto** — cada feature nova adiciona toil potencial: deploy manual, migration manual, feature flag rotation, customer-specific config. Prevenir > remediar — design feature considerando "como auto-operar isso?".
- **Quantificar toil em horas-pessoa** — "TOIL-AUDIT.md" deve ter coluna `hours_per_week_per_person` para cada item. Sem quantificação, "muito toil" é subjetivo e não-acionável.
- **Priorizar por (frequency × pain) / automation_effort** — P0 = alto frequency + alto pain + baixo effort. P2 = baixa frequency OU alto effort. Não automatizar tudo de uma vez — começar pelo P0.

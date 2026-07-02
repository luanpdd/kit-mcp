# Template de Prompt do Subagente Planejador

Template para spawnar o agente planner. O agente contém toda a expertise de planejamento — este template fornece apenas o contexto de planejamento.

---

## Template

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
@.planning/STATE.md

**Roadmap:**
@.planning/ROADMAP.md

**Requirements (if exists):**
@.planning/REQUIREMENTS.md

**Phase Context (if exists):**
@.planning/phases/{phase_dir}/{phase_num}-CONTEXT.md

**Research (if exists):**
@.planning/phases/{phase_dir}/{phase_num}-RESEARCH.md

**Gap Closure (if --gaps mode):**
@.planning/phases/{phase_dir}/{phase_num}-VERIFICATION.md
@.planning/phases/{phase_dir}/{phase_num}-UAT.md

</planning_context>

<downstream_consumer>
Output consumed by /executar-fase
Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

---

## Placeholders

| Placeholder | Fonte | Exemplo |
|-------------|-------|---------|
| `{phase_number}` | Do roadmap/argumentos | `5` ou `2.1` |
| `{phase_dir}` | Nome do diretório da fase | `05-user-profiles` |
| `{phase}` | Prefixo da fase | `05` |
| `{standard \| gap_closure}` | Flag de modo | `standard` |

---

## Uso

**A partir de /planejar-fase (modo padrão):**
```python
Task(
  prompt=filled_template,
  subagent_type="planner",
  description="Plan Phase {phase}"
)
```

**A partir de /planejar-fase --gaps (modo gap closure):**
```python
Task(
  prompt=filled_template,  # with mode: gap_closure
  subagent_type="planner",
  description="Plan gaps for Phase {phase}"
)
```

---

## Continuação

Para checkpoints, spawnar novo agente com:

```markdown
<objective>
Continue planning for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Phase directory: @.planning/phases/{phase_dir}/
Existing plans: @.planning/phases/{phase_dir}/*-PLAN.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
Continue: {standard | gap_closure}
</mode>
```

---

**Nota:** Metodologia de planejamento, decomposição de tarefas, análise de dependências, atribuição de waves, detecção de TDD e derivação goal-backward estão incorporados no agente planner. Este template apenas passa contexto.

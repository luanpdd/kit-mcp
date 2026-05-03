# Template de Prompt do Subagente de Debug

Template para spawnar o agente debugger. O agente contém toda a expertise de debug — este template fornece apenas o contexto do problema.

---

## Template

```markdown
<objective>
Investigate issue: {issue_id}

**Summary:** {issue_summary}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: {true_or_false}
goal: {find_root_cause_only | find_and_fix}
</mode>

<debug_file>
Create: .planning/debug/{slug}.md
</debug_file>
```

---

## Placeholders

| Placeholder | Fonte | Exemplo |
|-------------|-------|---------|
| `{issue_id}` | Atribuído pelo orquestrador | `auth-screen-dark` |
| `{issue_summary}` | Descrição do usuário | `Auth screen is too dark` |
| `{expected}` | Dos sintomas | `See logo clearly` |
| `{actual}` | Dos sintomas | `Screen is dark` |
| `{errors}` | Dos sintomas | `None in console` |
| `{reproduction}` | Dos sintomas | `Open /auth page` |
| `{timeline}` | Dos sintomas | `After recent deploy` |
| `{goal}` | Orquestrador define | `find_and_fix` |
| `{slug}` | Gerado | `auth-screen-dark` |

---

## Uso

**A partir de /debug:**
```python
Task(
  prompt=filled_template,
  subagent_type="debugger",
  description="Debug {slug}"
)
```

**A partir de diagnose-issues (UAT):**
```python
Task(prompt=template, subagent_type="debugger", description="Debug UAT-001")
```

---

## Continuação

Para checkpoints, spawnar novo agente com:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: @.planning/debug/{slug}.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: {goal}
</mode>
```

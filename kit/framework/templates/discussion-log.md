# Template de Log de Discussão

Template para `.planning/phases/XX-name/{phase_num}-DISCUSSION-LOG.md` — trilha de auditoria das sessões de Q&A do discuss-phase.

**Propósito:** Trilha de auditoria de software para tomada de decisão. Captura todas as opções consideradas, não apenas a selecionada. Separado do CONTEXT.md que é o artefato de implementação consumido por agentes downstream.

**NÃO para consumo por LLM.** Este arquivo nunca deve ser referenciado em blocos `<files_to_read>` ou prompts de agentes.

## Formato

```markdown
# Fase [X]: [Nome] - Log de Discussão

> **Apenas trilha de auditoria.** Não usar como entrada para agentes de planejamento, pesquisa ou execução.
> Decisões estão capturadas no CONTEXT.md — este log preserva as alternativas consideradas.

**Data:** [data ISO]
**Fase:** [número da fase]-[nome da fase]
**Áreas discutidas:** [lista separada por vírgulas]

---

## [Nome da Área 1]

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| [Opção 1] | [Breve descrição] | |
| [Opção 2] | [Breve descrição] | ✓ |
| [Opção 3] | [Breve descrição] | |

**Escolha do usuário:** [Opção selecionada ou resposta de texto livre literal]
**Notas:** [Quaisquer esclarecimentos ou justificativas fornecidos durante a discussão]

---

## [Nome da Área 2]

...

---

## A Critério do Claude

[Áreas delegadas ao julgamento do Claude — listar o que foi diferido e por quê]

## Ideias Diferidas

[Ideias mencionadas mas fora do escopo desta fase]

---

*Fase: XX-nome*
*Log de discussão gerado: [data]*
```

## Regras

- Gerado automaticamente ao final de toda sessão do discuss-phase
- Inclui TODAS as opções consideradas, não apenas a selecionada
- Inclui notas e esclarecimentos em formato livre do usuário
- Claramente marcado como apenas-auditoria, não um artefato de implementação
- NÃO interfere com a geração do CONTEXT.md ou comportamento de agentes downstream
- Comitado junto com CONTEXT.md no mesmo commit git

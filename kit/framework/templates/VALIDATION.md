---
phase: {N}
slug: {phase-slug}
status: draft
nyquist_compliant: false
wave_0_complete: false
created: {date}
---

# Fase {N} — Estratégia de Validação

> Contrato de validação por fase para amostragem de feedback durante a execução.

---

## Infraestrutura de Testes

| Propriedade | Valor |
|-------------|-------|
| **Framework** | {pytest 7.x / jest 29.x / vitest / go test / outro} |
| **Arquivo de config** | {caminho ou "nenhum — Wave 0 instala"} |
| **Comando de execução rápida** | `{comando rápido}` |
| **Comando de suite completa** | `{comando completo}` |
| **Tempo estimado** | ~{N} segundos |

---

## Taxa de Amostragem

- **Após cada commit de tarefa:** Execute `{comando de execução rápida}`
- **Após cada wave do plano:** Execute `{comando de suite completa}`
- **Antes de `/verificar-trabalho`:** Suite completa deve estar verde
- **Latência máxima de feedback:** {N} segundos

---

## Mapa de Verificação Por Tarefa

| ID da Tarefa | Plano | Wave | Requisito | Tipo de Teste | Comando Automatizado | Arquivo Existe | Status |
|--------------|-------|------|-----------|---------------|---------------------|----------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | unit | `{comando}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requisitos do Wave 0

- [ ] `{tests/test_file.py}` — stubs para REQ-{XX}
- [ ] `{tests/conftest.py}` — fixtures compartilhadas
- [ ] `{framework install}` — se nenhum framework detectado

*Se nenhum: "Infraestrutura existente cobre todos os requisitos da fase."*

---

## Verificações Somente Manuais

| Comportamento | Requisito | Por que Manual | Instruções de Teste |
|---------------|-----------|----------------|---------------------|
| {comportamento} | REQ-{XX} | {motivo} | {passos} |

*Se nenhum: "Todos os comportamentos da fase têm verificação automatizada."*

---

## Aprovação de Validação

- [ ] Todas as tarefas têm verify `<automated>` ou dependências Wave 0
- [ ] Continuidade de amostragem: sem 3 tarefas consecutivas sem verificação automatizada
- [ ] Wave 0 cobre todas as referências MISSING
- [ ] Sem flags de modo watch
- [ ] Latência de feedback < {N}s
- [ ] `nyquist_compliant: true` definido no frontmatter

**Aprovação:** {pending / approved YYYY-MM-DD}

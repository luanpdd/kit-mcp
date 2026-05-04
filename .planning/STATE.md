# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Milestone ativo

**Nenhum.** Último milestone concluído: **v1.2.0** (arquivado em `.planning/milestones/v1.2.0/`, ver `MILESTONE-AUDIT.md`).

## Próximo passo

Cut da v1.2.0 está pendente de **user action**:

```bash
git tag -a v1.2.0 -m "v1.2.0 — GUI sidecar de acompanhamento"
git push origin main --tags
# publish.yml workflow auto-cria GitHub Release
npm publish --otp <code>
```

Após cut, próximo ciclo:
- `/novo-marco "v1.3 — tema"` — abre o ciclo questionamento → requisitos → roadmap

Sugestões pra v1.3 (do MILESTONE-AUDIT.md):
- Aggregation multi-projeto numa janela
- Token-based auth via lockfile (multi-user / dev container)
- "CLI awkwardness do double-`kit`" (backlog macro persistido)
- Eventos expandidos + keyboard shortcuts + copy-to-clipboard

## Bloqueadores

(nenhum)

## Todos pendentes

(vazio — captura via `/adicionar-tarefa` ou `/nota`)

## Histórico

- v1.0.0 — concluído 2026-05-03 (`.planning/milestones/v1.0.0/`)
- v1.1.0 — concluído 2026-05-03 (`.planning/milestones/v1.1.0/`)
- v1.2.0 — concluído 2026-05-04 (`.planning/milestones/v1.2.0/`); cut pendente de user action

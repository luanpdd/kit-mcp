---
state_version: 1.0
milestone: v1.45.0
milestone_name: "Comando /base — registro canonico PROJETOS.md"
status: "ENTRE MILESTONES — v1.45.0 shipped em 2026-07-01 (npm @luanpdd/kit-mcp). Última fase de framework: 172 (Cost Tracking Suite, v1.37.0), concluída em 2026-06-05. Releases v1.38.0→v1.45.0 saíram por PR direto, fora do fluxo de fases. Próximo passo: escolher direção em .planning/DIRECTION.md (DIR-01/DIR-02 são P0)."
last_updated: "2026-07-01T00:00:00.000Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_milestones: 5
  completed_milestones: 5
  current_phase: 172
  current_milestone: "entre milestones — v1.45.0 shipped; próximo a definir (.planning/DIRECTION.md)"
---

# STATE.md

## Posição Atual

- **Posição:** entre milestones — nenhuma fase ativa.
- **Versão atual do produto:** v1.45.0 (publicada em 2026-07-01; tag `v1.45.0`).
- **Último milestone concluído:** v1.45.0 — Comando `/base` (gestão do registro canônico
  `PROJETOS.md`), shipped 2026-07-01 (inclui o patch v1.44.1 de housekeeping, mesma data).
- **Última fase de framework concluída:** 172 — Cost Tracking Suite (v1.37.0), concluída em
  2026-06-05 (5 milestones M1-M5, Gates A-D verdes).
- **Próximo passo:** escolher direção em [DIRECTION.md](DIRECTION.md) (gerado em 2026-07-01 —
  DIR-01 "higiene de release single-source" e DIR-02 "dogfooding .planning/" são P0;
  DIR-03/DIR-04/DIR-05 P1; DIR-06 P2).
- **Última atividade:** 2026-07-01 — reconcile DIR-02: STATE/ROADMAP/MILESTONES atualizados
  para a realidade v1.45.0.

## Como o produto chegou a v1.45.0 (decisão registrada)

A fase 172 (Cost Tracking Suite) fechou o fluxo de fases em 2026-06-05 com a release v1.37.0.
As releases **v1.38.0 → v1.45.0** (2026-06-13 → 2026-07-01) foram entregues por **PR direto,
fora do fluxo de fases do framework** — não existem diretórios `.planning/phases/` correspondentes.
Fica registrado como decisão consciente: trabalho pontual (Antigravity, Content Packs,
cost-awareness, absorção shadcn/improve, `/base`) priorizou velocidade de entrega; o próximo
milestone formal volta ao fluxo de fases a partir de `.planning/DIRECTION.md`.

Registro 1-linha-por-release em [MILESTONES.md](MILESTONES.md); detalhe canônico em
`CHANGELOG.md` (nota: v1.42.0 e v1.43.0 existem como git tags sem entry no CHANGELOG —
temas reconstruídos do git log em MILESTONES.md).

## Snapshot do produto em 2026-07-01

- Versão npm: 1.45.0 — 86 agents · 98 commands · 103 skills · 24 gates · 6 packs ·
  1 workflow embarcado (fonte: DIRECTION.md, recon de 2026-07-01).
- Cost tracking (desde v1.37): 5 MCP tools `cost-*` + CLI `kit cost` + statusline; a tool
  `cost-phase` correlaciona fases via `.planning/phases/<id>-*/` + este arquivo
  (`src/core/cost/aggregate-phase.js`).
- Drift de release conhecido (tratado em DIR-01): `kit/framework/VERSION` 1.44.0 vs
  `package.json` 1.45.0; 6× `pack.json` presos em 1.39.0.

## Nota de compatibilidade (cost-phase)

`src/core/cost/aggregate-phase.js` lê este arquivo procurando o token `completed_at:` próximo
à menção do número da fase para inferir `ended_at` e `correlation_confidence`. Este STATE
deliberadamente **não** declara esse token: o parser usa matching frouxo por substring/regex
(débito documentado para v1.37.1) e um valor global aqui misattribuiria janelas de fases
antigas cujos números aparecem dentro de strings de versão (p.ex. fase 45 vs "v1.45.0").
A janela da fase 172 segue inferível por SPEC.md mtime + git log (confidence medium) —
mesmo comportamento do STATE anterior, que também não declarava o token.

# Requisitos: kit-mcp v1.10 SRE Engagement

**Definidos:** 2026-05-06
**Valor Central:** Equipar usuários do kit-mcp com expertise canônica em SRE (Site Reliability Engineering) derivada do livro do Google (2016), complementando a Suíte Observabilidade v1.9 (SLOs/burn-rate/OMM) com práticas de engagement de produção — Production Readiness Review, Four Golden Signals, Postmortem blameless, Toil elimination, Risk management — aproveitada de forma profunda pela Suíte Supabase (v1.8) para que cada Edge Function/serviço nasça SRE-ready.

**Material-fonte:** *Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016, ISBN 978-1-491-92912-4). Caps prioritários: 3 (Embracing Risk), 4 (SLOs), 5 (Eliminating Toil), 6 (Monitoring Distributed Systems / Four Golden Signals), 15 (Postmortem Culture), 32 (Evolving SRE Engagement Model / PRR). Mapa cap → artefato em `.planning/PROJECT.md`.

## Requisitos v1

Cada requisito mapeia para exatamente uma fase do roadmap. Convenção REQ-ID: `[CATEGORIA]-[NN]`.

### Glossário SRE (GLOS)

- [ ] **GLOS-01**: Skill `_shared-sre/glossary.md` define vocabulário canônico bilíngue (PT-BR↔EN) — SLI, SLO, SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals, latency, traffic, errors, saturation, risk continuum, MTTR, MTBF
- [ ] **GLOS-02**: Glossário lista comandos canônicos (templates de postmortem, checklist PRR, queries SLI standardized) consultáveis pelos agentes
- [ ] **GLOS-03**: Glossário declara anti-patterns explícitos (alert fatigue, hero culture, SLO 99.99%+, fixed-window error budget, blame culture, mean-only latency, monitoring causes não symptoms)

### Skills Foundationais SRE (SKFD)

- [ ] **SKFD-SRE-01**: Skill `sre-risk-management` documenta risk continuum (cap 3), 99.99% wisdom (user em 99% smartphone não distingue 99.99% vs 99.999%), error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more"
- [ ] **SKFD-SRE-02**: Skill `four-golden-signals` documenta Latency + Traffic + Errors + Saturation (cap 6), black-box vs white-box monitoring, distinção de latência success vs error, percentis vs mean (long tail), histograms com bucketing exponencial
- [ ] **SKFD-SRE-03**: Skill `eliminating-toil` documenta definição canônica de toil (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50% (cap 5), padrões de automação, distinção toil vs overhead vs grungy work
- [ ] **SKFD-SRE-04**: Skill `blameless-postmortems` documenta template canônico (incident impact, root causes, contributing factors, action items), cultura blameless (cap 15), "no postmortem left unreviewed", Wheel of Misfortune para training
- [ ] **SKFD-SRE-05**: Skill `production-readiness-review` documenta checklist PRR (cap 32) — 6 axes: System architecture, Instrumentation/Metrics/Monitoring, Emergency response, Capacity planning, Change management, Performance — com 3 modelos: Simple PRR, Early Engagement, Frameworks/SRE Platform

### Agentes Core (AGCORE)

- [ ] **AGCORE-SRE-01**: Agente `golden-signals-instrumenter` — especialização de `observability-instrumenter` (v1.9) — recebe código de serviço/Edge Function e retorna patches OTel com os 4 golden signals (Latency: histogram bucketed; Traffic: counter; Errors: counter por error.type; Saturation: gauge resource-specific)
- [ ] **AGCORE-SRE-02**: Agente `toil-auditor` — analisa repo + git log + scripts shell + comandos manuais documentados em README/runbooks para identificar toil; retorna `TOIL-AUDIT.md` listando candidatos a automação com priorização P0/P1/P2 e esforço estimado
- [ ] **AGCORE-SRE-03**: Agente `postmortem-writer` — recebe investigation_id de `incident-investigator` (v1.9) ou descrição de incident; gera postmortem blameless seguindo template canônico (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline) em `.planning/postmortems/<id>.md`
- [ ] **AGCORE-SRE-04**: Agente `prr-conductor` — conduz Production Readiness Review para serviço/feature; lê schema (Supabase MCP), Edge Functions code, SLOs definidos (`.planning/slos/`), audit logs; produz `PRR-REPORT.md` scored em 6 axes com gaps e action items priorizados

### Comandos (CMD)

- [ ] **CMD-SRE-01**: Comando `/golden-signals` — invoca `golden-signals-instrumenter` para um serviço/Edge Function/fase; gera `GOLDEN-SIGNALS.md` por target com instrumentação OTel pronta
- [ ] **CMD-SRE-02**: Comando `/auditar-toil` — invoca `toil-auditor`; gera `TOIL-AUDIT.md` na raiz do `.planning/`
- [ ] **CMD-SRE-03**: Comando `/postmortem` — invoca `postmortem-writer`; suporta flag `--from-investigation <id>` (continuar de investigation v1.9) ou `--incident "<descrição>"` (postmortem standalone)
- [ ] **CMD-SRE-04**: Comando `/prr` — invoca `prr-conductor` para serviço/feature; usa flag `--service <name>` ou `--feature <description>`; gera `PRR-REPORT.md`
- [ ] **CMD-SRE-05**: Comando `/risk-budget` — exibe state atual de error budget vs risk continuum, citando SLOs definidos em v1.9 (lê `.planning/slos/`); aplica skill `sre-risk-management`
- [ ] **CMD-SRE-06**: Comando orquestrador `/sre [subcomando]` — análogo a `/supabase` (v1.8) e `/observabilidade` (v1.9); dispatch via `Task(subagent_type=...)` com sinônimos PT/EN para os 5 comandos acima

### Integração Suíte Observabilidade v1.9 (INT-OBS)

- [ ] **INT-OBS-01**: Skill `event-based-slos` (v1.9) ganha bloco "Risk continuum" cross-referenciando `sre-risk-management`; explica que target SLO é escolha explícita no continuum risk × innovation, não meta arbitrária
- [ ] **INT-OBS-02**: Agente `omm-auditor` (v1.9) consulta `toil-auditor` para Capacidade 3 (Complexidade/Tech Debt); score OMM-3 considera % de tempo em toil pelo time

### Integração Suíte Supabase v1.8 (INT-SB-V2)

- [ ] **INT-SB-V2-01**: `supabase-edge-fn-writer` ganha seção "Four Golden Signals" — template canônico de Edge Function inclui histogram de latência, counter de tráfego, counter de erros por error.type, gauge de saturação (memory/CPU/connection pool)
- [ ] **INT-SB-V2-02**: `supabase-architect` ganha menção a PRR — plano arquitetural sugere PRR antes de production; cross-ref para `production-readiness-review`
- [ ] **INT-SB-V2-03**: `supabase-migration-writer` ganha alerta sobre toil — scripts SQL repetitivos (ex: rebuild de índices manuais, vacuums recorrentes) são candidatos a automação via pg_cron; cross-ref para `eliminating-toil`
- [ ] **INT-SB-V2-04**: `supabase-storage-implementer` ganha saturation signal — uploads emitem gauge de bucket size + counter de quota near-exhaustion; cross-ref para `four-golden-signals`

### Integração Fluxo Framework (INT-FW-V2)

- [ ] **INT-FW-V2-01**: Comando `/forense` ganha bloco que sugere chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause; bloco `<sre_integration>` documenta o fluxo
- [ ] **INT-FW-V2-02**: Comando `/concluir-marco` ganha gate PRR opcional — workflow.complete_milestone_prr_gate=true exige PRR-REPORT.md com status passed para features production-bound antes de arquivar
- [ ] **INT-FW-V2-03**: Comando `/auditar-marco` invoca `/auditar-toil` automaticamente quando workflow.audit_milestone_toil=true; resultado alimenta scoring OMM Capacidade 3

### Qualidade e Audit (QA)

- [ ] **QA-SRE-01**: Audit gate `golden-signals-coverage` — verifica que código de serviço/Edge Function tocado em fase tem os 4 golden signals presentes em frontmatter `tools` ou em código (regex sobre `histogram\|counter\|gauge\|saturation`)
- [ ] **QA-SRE-02**: Audit gate `postmortem-template-required` — em `/concluir-marco`, bloqueia se houve incident registrado em `.planning/investigations/` sem `.planning/postmortems/` correspondente
- [ ] **QA-SRE-03**: Audit gate `prr-checklist-coverage` — verifica que PRR-REPORT.md cobre os 6 axes do PRR (não pode pular nenhum)
- [ ] **QA-SRE-04**: README ganha seção "SRE Engagement (v1.10)" listando 6 skills + 4 agents + 6 commands + 3 gates com exemplo de uso end-to-end
- [ ] **QA-SRE-05**: CHANGELOG ganha entrada v1.10.0 documentando: Camada SRE Engagement (6 skills, 4 agentes, 6 comandos), 3 audit gates novos, integração com Suíte Observabilidade v1.9 + Suíte Supabase v1.8

## Requisitos v2

Diferidos para milestone futuro.

### SRE Avançado

- **SRE-ADV-01**: Skill `cascading-failures` (cap 22) — patterns para drop traffic, restart, degraded modes, eliminate batch load
- **SRE-ADV-02**: Skill `release-engineering` (cap 8) — push-on-green, hermetic builds, configuration as code
- **SRE-ADV-03**: Agente `incident-commander` — conduz emergency response usando IRP (Incident Response Plan) de cap 14
- **SRE-ADV-04**: Skill `disaster-recovery-testing` — DiRT (Disaster Recovery Testing), Wheel of Misfortune avançado

### Tooling

- **SRE-TOOL-01**: Comando `/wheel-of-misfortune` — disaster role-playing exercise para training de novos engineers
- **SRE-TOOL-02**: Hook PostToolUse que detecta toil patterns e sugere automação inline durante `/executar-fase`

## Fora do Escopo

| Funcionalidade | Motivo |
|----------------|--------|
| Implementar binário tipo "Borgmon" próprio | Vendor-neutral; usar OTel + backend de escolha (livro descreve Borgmon mas é proprietário Google) |
| Replicar tooling Google interno (Outalator, Escalator) | Out-of-scope — kit é content-only, não plataforma de paging |
| Distributed consensus systems (cap 23) | Implementação concreta de Paxos/Raft fora do escopo do kit (pode entrar como skill referencial em v2.0+) |
| Capacity planning algorítmico (cap 18) | Deferido para v2.0+ — exige modelagem específica do projeto user |
| BCP/DR planning detalhado | Pode virar skill em v2.0+; v1.10 menciona mas não detalha |
| Dependências circulares com livro Observability Engineering | v1.9 (Observability Engineering — O'Reilly 2022) já cobriu SLI/SLO event-based, burn-rate, OMM. v1.10 ADICIONA risk + golden signals + toil + postmortem + PRR sem duplicar |

## Rastreabilidade

Vazia inicialmente. Preenchida pelo roadmapper.

| Requisito | Fase | Status |
|-----------|------|--------|
| GLOS-01 | 36 | Pending |
| GLOS-02 | 36 | Pending |
| GLOS-03 | 36 | Pending |
| SKFD-SRE-01 | 36 | Pending |
| SKFD-SRE-02 | 36 | Pending |
| SKFD-SRE-03 | 36 | Pending |
| SKFD-SRE-04 | 36 | Pending |
| SKFD-SRE-05 | 36 | Pending |
| AGCORE-SRE-01 | 37 | Pending |
| AGCORE-SRE-02 | 37 | Pending |
| AGCORE-SRE-03 | 37 | Pending |
| AGCORE-SRE-04 | 37 | Pending |
| CMD-SRE-01 | 38 | Pending |
| CMD-SRE-02 | 38 | Pending |
| CMD-SRE-03 | 38 | Pending |
| CMD-SRE-04 | 38 | Pending |
| CMD-SRE-05 | 38 | Pending |
| CMD-SRE-06 | 38 | Pending |
| INT-OBS-01 | 39 | Pending |
| INT-OBS-02 | 39 | Pending |
| INT-SB-V2-01 | 39 | Pending |
| INT-SB-V2-02 | 39 | Pending |
| INT-SB-V2-03 | 39 | Pending |
| INT-SB-V2-04 | 39 | Pending |
| INT-FW-V2-01 | 40 | Pending |
| INT-FW-V2-02 | 40 | Pending |
| INT-FW-V2-03 | 40 | Pending |
| QA-SRE-01 | 41 | Pending |
| QA-SRE-02 | 41 | Pending |
| QA-SRE-03 | 41 | Pending |
| QA-SRE-04 | 41 | Pending |
| QA-SRE-05 | 41 | Pending |

**Cobertura:**
- Requisitos v1: 32 total
- Mapeados para fases: 32
- Não mapeados: 0 ✓

---
*Requisitos definidos: 2026-05-06*
*Última atualização: 2026-05-06 após definição inicial do milestone v1.10*

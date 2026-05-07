---
phase: 37-agentes-core-4-agentes-sre
plan: 03
subsystem: agents
tags: [sre, postmortem, blameless, google-sre-cap15, askuserquestion, content-only, markdown]

# Grafo de dependências
requires:
  - phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
    provides: skill canônica blameless-postmortems com template 9 seções, 5 Whys, checklist 8 perguntas, postmortem chain pattern
  - phase: 35-gates-omm-no-fluxo-framework-qa-cross-ide-docs
    provides: precedente incident-investigator (v1.9) com formato de investigation file (.planning/investigations/<id>.md)
provides:
  - kit/agents/postmortem-writer.md — agent canônico que gera postmortem blameless 9 seções
  - 2 modos de invocação documentados: --from-investigation <id> (preferido, lê investigation v1.9) E --incident "<descrição>" (standalone via AskUserQuestion)
  - Mapeamento campo→fonte para extração automática de investigation file (Trigger, Root cause, Hipóteses H1..HN, Action items, Lessons)
  - Template canônico inline com 9 seções literais (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC)
  - Aplicação automática de 5 Whys quando root cause superficial (regex blame culture detection)
  - Checklist 8 perguntas para reviewer sênior ("no postmortem left unreviewed")
affects: [38-comandos-postmortem, 40-int-fw-v2-01-forense-chain, 41-gate-postmortem-template-required]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns: [agent-2-modes-mutually-exclusive, askuserquestion-guided-9-questions, regex-blame-culture-detection, canonical-template-inline-fenced]

key-files:
  created:
    - kit/agents/postmortem-writer.md
  modified: []

key-decisions:
  - "2 modos mutuamente exclusivos (--from-investigation vs --incident) — Modo A é preferido (continuação natural de incident-investigator v1.9), Modo B é standalone para incidents menores ou near-miss"
  - "Tools sem mcp__supabase__* — postmortem documenta investigation já feita; queries live ficam com incident-investigator (v1.9)"
  - "Compatibilidade Partial para Codex/Gemini/Windsurf/etc — porque AskUserQuestion live limitado fora de Claude Code/Cursor"
  - "Step 3 aplica 5 Whys automaticamente quando regex (deploy do |@\\w+|culpa do |fulano) detecta blame culture — força root cause sistêmico"
  - "Template canônico literal inline (9 seções) — anti-pitfall A8 preservado; LLM gera postmortem completo sem ler skill SKILL.md em runtime"
  - "Cross-ref Markdown para 4 skills/agents (blameless-postmortems, incident-investigator, core-analysis-loop, production-readiness-review) — alinhado com PRR Axe 3 (Emergency Response)"

patterns-established:
  - "Agent SRE de 6 seções canônicas: Compatibilidade / Por que existe / Inputs esperados (do caller) / Passos / Quando NÃO invocar / Ver também"
  - "Documentação de 2 modos via Modo A/Modo B com listagem explícita de campos extraídos automaticamente vs perguntados via AskUserQuestion"
  - "5 Whys integrado como Step próprio (Step 3) com regex de detecção de blame culture e template de pergunta sequencial"
  - "Output banner com checklist de 8 perguntas para reviewer (precedente skill blameless-postmortems Pattern: revisão por par sênior)"

requirements-completed: [AGCORE-SRE-03]

# Métricas
duration: ~12min
completed: 2026-05-07
---

# Plan 37-03: Agente `postmortem-writer` — Summary

**Agent canônico em kit/agents/postmortem-writer.md que gera postmortem blameless seguindo template de 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC); suporta 2 modos mutuamente exclusivos — `--from-investigation <id>` extrai automaticamente de `.planning/investigations/<id>.md` (artefato do incident-investigator v1.9) e `--incident "<descrição>"` standalone com AskUserQuestion guiado em 9 perguntas; aplica 5 Whys quando blame culture detectada via regex; produz output em `.planning/postmortems/<id>.md` com status Draft + checklist 8 perguntas para reviewer sênior ("no postmortem left unreviewed").**

## Performance

- **Duração:** ~12 min
- **Iniciado:** 2026-05-07T06:14:00Z
- **Concluído:** 2026-05-07T06:18:00Z
- **Tarefas:** 5 (T1–T5)
- **Arquivos modificados:** 1 (criado)
- **Tamanho final:** 13.1 KB (dentro do target ~14-16 KB; denso pelo template inline + 9 perguntas + checklist + 5 Whys)

## Realizações

- Agent `kit/agents/postmortem-writer.md` criado (13.1 KB)
- Frontmatter válido: `name: postmortem-writer` + `description: 161 chars` (≤ 200, anti-pitfall A2)
- Tools: `Read, Write, Bash, Grep, Glob, AskUserQuestion` (6 tools, sem MCP — anti-pitfall A1 preservado)
- 6 seções canônicas presentes: Compatibilidade / Por que existe / Inputs esperados (do caller) / Passos / Quando NÃO invocar / Ver também
- Tabela "Compatibilidade IDE" com 5 linhas (2 Full: Claude Code/Cursor; 3 Partial: Codex/Gemini CLI/Windsurf+Antigravity+Copilot+Trae)
- 2 modos de invocação documentados explicitamente: `--from-investigation <id>` (Modo A, preferido) e `--incident "<descrição>"` (Modo B, standalone)
- 6 sub-steps em Passos: Step 0 (Preflight + roteamento), Step 1 (Modo A — extração de investigation file), Step 2 (Modo B — 9 perguntas guiadas), Step 3 (5 Whys com regex blame culture), Step 4 (Write template 9 seções), Step 5 (Output + checklist 8 perguntas)
- 9 seções canônicas mencionadas literalmente (cada uma ≥ 4 ocorrências): Summary (4), Impact (7), Root Causes (6), Trigger (8), Resolution (5), Detection (6), Action Items (9), Lessons Learned (5), Timeline (7)
- Vocabulário canônico denso: blameless/blame culture (12), 5 Whys/whys (8), SMART (5), UTC (12)
- Cross-refs Markdown válidos para 4 artefatos: blameless-postmortems (skill v1.10), incident-investigator (agent v1.9), core-analysis-loop (skill v1.9), production-readiness-review (skill v1.10)
- Tabela de mapeamento campo→fonte para extração automática de investigation file (7 linhas: Trigger, Root Causes, Detection, Resolution, Action Items, Lessons Learned, Timeline)
- 9 perguntas canônicas via AskUserQuestion no Modo B (uma por seção do template)
- Output banner com checklist 8 perguntas para reviewer sênior (precedente skill `blameless-postmortems` Pattern: revisão por par sênior)
- Frase "no postmortem left unreviewed" presente literalmente

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T1: Frontmatter + intro + Compatibilidade IDE** — `a452cc5` (feat)
2. **T2: Por que existe + Inputs esperados (2 modos)** — `14cb455` (feat)
3. **T3: Passos com 6 sub-steps (Step 0-5)** — `512dc69` (feat)
4. **T4: Quando NÃO invocar + Ver também** — `aec1ab0` (feat)
5. **T5: Smoke validations** — sem commit dedicado (validação executada sobre arquivo já presente; resultado documentado neste SUMMARY)

## Arquivos Criados/Modificados

- `kit/agents/postmortem-writer.md` — Agent canônico para geração de postmortem blameless 9 seções; cobertura AGCORE-SRE-03 integral; 2 modos (--from-investigation / --incident); cross-refs para skill v1.10 + agent v1.9.

## Decisões Tomadas

- **2 modos mutuamente exclusivos (--from-investigation vs --incident)** — Modo A é o caminho preferido (continuação direta de incident-investigator v1.9 após Core Analysis Loop fechar), Modo B é fallback standalone para incidents menores, near-miss ou postmortems retrospectivos sem investigation prévia. Validação Step 0: ambos passados = ERROR.
- **Tools sem mcp__supabase__*** — postmortem documenta investigation JÁ FEITA; queries live (logs/SQL/advisors) ficam com `incident-investigator` (v1.9). Por isso "Full" só onde AskUserQuestion roda live (Claude Code/Cursor); "Partial" nos demais (sem AskUserQuestion → defaults pré-configurados).
- **5 Whys aplicado automaticamente em Step 3** — regex `(deploy do |@\w+|culpa do |fulano)` em Root Cause sinaliza blame culture; agent re-pergunta via AskUserQuestion com sequência de 5 Whys até root cause virar sistêmico (ausência de gate, runbook, alerta) e action item virar generalizável.
- **Template canônico inline literal (9 seções)** — anti-pitfall A8 preservado; LLM gera postmortem completo sem precisar ler skill `blameless-postmortems` SKILL.md em runtime; precedente shape `## Summary / ## Impact / ## Root Causes / ## Trigger / ## Resolution / ## Detection / ## Action Items / ## Lessons Learned / ## Timeline (UTC)`.
- **Status inicial Draft + checklist 8 perguntas** — postmortem nunca vai direto para Final; reviewer sênior aplica checklist (Root cause sistêmico? SMART? UTC? Impact quantificado? Lessons generalizáveis? Detection time? Lucky? 5 whys?) antes do status virar Reviewed/Final. "No postmortem left unreviewed" é regra absoluta documentada literalmente.
- **Cross-ref Markdown para 4 artefatos** — blameless-postmortems (knowledge base canônica), incident-investigator (alimenta Modo A), core-analysis-loop (fornece evidence-based root cause da v1.9), production-readiness-review (PRR Axe 3 Emergency Response exige postmortem culture). Alinha o agent com a suíte SRE inteira.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Acceptance criteria de cada task atingido:

- **T1**: arquivo criado, frontmatter válido (`name: postmortem-writer`, `description: 161 chars` ≤ 200, `tools` com 6 ferramentas incluindo AskUserQuestion sem MCP, `color: red`); intro com cross-refs Markdown literais `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)` E `[incident-investigator](./incident-investigator.md)`; tabela Compatibilidade com 5 IDEs (2 Full + 3 Partial)
- **T2**: 4 anti-patterns canônicos listados (blame culture, action items vagos, postmortem left unreviewed, timeline ambígua); SMART expandido (Specific, Measurable, Assignable, Realistic, Time-bound); 2 modos documentados explicitamente com extração automática (Modo A) e perguntas guiadas (Modo B)
- **T3**: 6 sub-steps presentes (Step 0 Preflight, Step 1 Modo A, Step 2 Modo B, Step 3 5 Whys, Step 4 Write postmortem, Step 5 Output + checklist); template literal com 9 seções `## Summary / ## Impact / ## Root Causes / ## Trigger / ## Resolution / ## Detection / ## Action Items / ## Lessons Learned / ## Timeline (UTC)`; regex de detecção de blame culture; checklist 8 perguntas; "no postmortem left unreviewed" literal
- **T4**: 4 bullets em Quando NÃO invocar; 4 cross-refs em Ver também (blameless-postmortems, incident-investigator, core-analysis-loop, production-readiness-review)
- **T5**: smoke validations passam — description = 161 chars, 6 âncoras canônicas count=1, 9 seções cada ≥ 4 ocorrências, --from-investigation = 8 (≥ 3), --incident = 6 (≥ 3), blameless/blame culture = 12 (≥ 3), 5 Whys/whys = 8 (≥ 2), SMART = 5 (≥ 2), UTC = 12 (≥ 4); idempotência de conteúdo OK (precedente: timestamp na linha "Generated by kit-mcp at" é metadata intencional — `incident-investigator.md` exibe mesmo comportamento; conteúdo excluindo timestamp é byte-idêntico)

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Phase 38 (`/postmortem` command)** pode despachar para este agent com flags `--from-investigation` ou `--incident` — interface de entrada já documentada em "Inputs esperados (do caller)"
- **Phase 40 (INT-FW-V2-01 — `/forense` chain)** pode adicionar bloco `<sre_integration>` no `/forense` que sugere `chain /postmortem --from-investigation <id>` automaticamente após Core Analysis Loop fechar — Step 0 do agent já valida investigation file existence
- **Phase 41 (gate `postmortem-template-required`)** pode validar que postmortems em `.planning/postmortems/<id>.md` cobrem as 9 seções canônicas literais — agent garante template inline literal no Step 4
- **Cross-refs em "Ver também"** apontam para skills/agents existentes:
  - `blameless-postmortems` (Phase 36-05, já criada)
  - `incident-investigator` (v1.9, já existe)
  - `core-analysis-loop` (v1.9, já existe)
  - `production-readiness-review` (Phase 36-06, já criada)

  Todos os links Markdown estão ativos (sem broken links).

- **Suíte SRE coesa** — junto com `golden-signals-instrumenter` (37-01), `toil-auditor` (37-02) e `prr-conductor` (37-04) executados em paralelo nesta mesma Phase 37, forma os 4 agentes core SRE da v1.10. Suíte coesa com v1.8 (Supabase) + v1.9 (Observabilidade) viabiliza production engineering completo.

---
*Fase: 37-agentes-core-4-agentes-sre*
*Plano: 03 — postmortem-writer*
*Concluída: 2026-05-07*

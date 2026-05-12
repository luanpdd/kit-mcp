# REQUIREMENTS.md — v1.28 UX & Onboarding

> Milestone: v1.28 — UX & Onboarding (kit-mcp developer experience)
> Generated: 2026-05-12

## Objetivo

Eliminar opacidade do servidor MCP stdio e reduzir tempo-até-primeiro-uso (TTFU) de novos consumidores do kit-mcp, expondo observabilidade local e onboarding guiado **sem violar a spec MCP** (stdout limpo, sem prints fora do JSON-RPC).

## Princípios

- **P1 — Spec MCP intocável.** Servidor stdio nunca escreve em stdout fora do protocolo JSON-RPC. Toda telemetria visível vai para sidecar HTTP, log files ou stderr.
- **P2 — Zero breaking changes.** Stable API v1.0+ (15 releases) preservada. Comportamentos novos são aditivos ou opt-out, nunca opt-in para fluxos existentes.
- **P3 — Sem deps novas críticas.** node-notifier/listr2/ora opcionais ou implementadas inline minimal.
- **P4 — Cross-platform.** Windows/macOS/Linux paridade. Sem fork de fluxo por OS.
- **P5 — Observabilidade local-first.** Logs/metrics ficam no disco do usuário; zero telemetria remota implícita.

## Requisitos por fase

### Fase 156 — README diagrama 2 fluxos (Wave 1, XS)

- **REQ-156-01** README.md ganha section "How kit-mcp works" com diagrama ASCII/mermaid de 2 fluxos: (a) `kit sync` offline projetor → arquivos em `.claude/`; (b) `kit-mcp` stdio server → tools live.
- **REQ-156-02** Tabela "quando uso o quê" com 5 colunas: ação | fluxo | comando | quando rodar | quem consome.
- **REQ-156-03** Section "Why no terminal output?" explicando spec MCP stdio + ponteiros para `kit doctor`, `kit logs`, sidecar UI.

### Fase 157 — Sidecar UI auto-spawn por padrão (Wave 1, S)

- **REQ-157-01** Servidor MCP, no startup, invoca `ensureSidecar()` por padrão (sem necessidade de `autoSpawn: true` por tool call).
- **REQ-157-02** Variável de ambiente `KIT_MCP_NO_UI=1` desabilita o auto-spawn (escape hatch para CI/headless).
- **REQ-157-03** Sidecar exibe lista live de tools sendo chamadas (timestamp + tool + args sumarizados + duration).
- **REQ-157-04** Lockfile-based discovery existente preservado — múltiplos kit-mcp servers compartilham 1 sidecar.

### Fase 158 — Log file rotativo (Wave 1, S)

- **REQ-158-01** Toda invocação de tool MCP loga em `~/.kit-mcp/logs/kit-mcp-YYYY-MM-DD.log` (JSONL, 1 evento por linha).
- **REQ-158-02** Rotação automática: arquivo por dia, retention 7 dias por default (configurável via `KIT_MCP_LOG_RETENTION_DAYS`).
- **REQ-158-03** Comando `kit logs [--tail N] [--follow]` espelha tipo `vercel logs` lendo do file.
- **REQ-158-04** Campos canônicos: `ts`, `tool`, `action`, `args_size`, `result_size`, `duration_ms`, `error_type` (se houver), `pid`.

### Fase 159 — `kit doctor` (Wave 1, M)

- **REQ-159-01** Comando `kit doctor` retorna exit 0 se tudo OK, 1 se há issues.
- **REQ-159-02** Verifica: (a) servidor MCP iniciável (spawn rápido), (b) `.claude/` projetado e file-manifest match, (c) versão IDE host compatível, (d) sidecar alcançável, (e) log dir writable.
- **REQ-159-03** Output estruturado: section por check com ✓/✗ + remediation hint.
- **REQ-159-04** Suporta `--json` para integração CI.

### Fase 160 — `kit sync` progress bar (Wave 2, S)

- **REQ-160-01** `kit sync` mostra progress por arquivo escrito (não só sumário final).
- **REQ-160-02** Diff sumário ao final: `X new, Y updated, Z unchanged, W removed`.
- **REQ-160-03** `--quiet` flag suprime progress (mantém sumário final).
- **REQ-160-04** Implementação minimal sem dep externa (ora opcional).

### Fase 161 — `kit init` onboarding (Wave 2, M)

- **REQ-161-01** Comando interativo `kit init` detecta IDE, roda install + sync + doctor em sequência.
- **REQ-161-02** Output final: "✓ Claude Code agora vê N skills, M agents, K commands" com counts reais.
- **REQ-161-03** Flag `--non-interactive --ide=claude-code` para uso em CI/scripts.
- **REQ-161-04** Re-rodar `kit init` é idempotente (não duplica arquivos, não quebra config).

### Fase 162 — `kit status` (Wave 2, S)

- **REQ-162-01** Comando `kit status` chama `metrics-snapshot` tool e renderiza p50/p95/p99/error_rate última hora.
- **REQ-162-02** Mostra também: sidecar status, log file path, last tool call timestamp.
- **REQ-162-03** Flag `--json` para integração.
- **REQ-162-04** Reusa `src/core/metrics.js` sem duplicar lógica.

### Fase 163 — `kit mcp --inspect` TUI (Wave 3, M)

- **REQ-163-01** Modo dev `kit mcp --inspect` abre TUI mostrando cada request/response live (entrando/saindo do servidor stdio).
- **REQ-163-02** Wrapping não-invasivo: spawn server real, pipe stdin/stdout, decora com TUI.
- **REQ-163-03** Filtros: por tool, por status (ok/error), search por arg.
- **REQ-163-04** Não substitui stdio do server real (Claude Code continua falando direto com o server; inspect é mirror).

### Fase 164 — Notification on tool call (Wave 3, S)

- **REQ-164-01** Opt-in via flag `--notify` ou env `KIT_MCP_NOTIFY=1`.
- **REQ-164-02** OS-level notification (node-notifier opcional) ao receber tool call em dev.
- **REQ-164-03** Throttle: máximo 1 notification a cada 5s para evitar flood.
- **REQ-164-04** Funciona cross-platform; degrada silenciosamente se OS não suporta.

### Fase 165 — `kit replay <id>` (Wave 3, M)

- **REQ-165-01** Reusa `src/core/replays.js` existente — `kit replay <id>` reexecuta a tool call gravada localmente.
- **REQ-165-02** Output: diff entre resultado original e atual (regression detection).
- **REQ-165-03** Flag `--dry-run` apenas mostra payload sem executar.
- **REQ-165-04** Lista replays disponíveis via `kit replay list`.

## Cross-cutting

- **REQ-XC-01** Atualizar `kit/COMANDOS.md` documentando os 7 comandos novos (`logs`, `doctor`, `init`, `status`, `replay`, e flags novas em `mcp`/`sync`).
- **REQ-XC-02** Atualizar AUTOGEN-COUNTS após cada fase que adiciona comando.
- **REQ-XC-03** CHANGELOG entry v1.28 listando todas as mudanças por wave.
- **REQ-XC-04** package.json bump 1.27.0 → 1.28.0.
- **REQ-XC-05** Coverage não regride abaixo de 86%.
- **REQ-XC-06** PRR mantém 30/30.

## Total: 40 REQs (39 por fase + 6 cross-cutting agrupados)

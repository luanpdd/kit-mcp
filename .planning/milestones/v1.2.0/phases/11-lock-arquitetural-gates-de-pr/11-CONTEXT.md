# Phase 11: Lock arquitetural & gates de PR - Contexto

**Coletado:** 2026-05-04
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (fase de infraestrutura pura — sem comportamento user-facing)

<domain>
## Limite da Fase

Lock formal das decisões trade-off do milestone v1.2 em ADR (`.planning/decisions.md`) + threat model em rascunho (`docs/sidecar-security.md`) + ativação de 2 gates de CI no GitHub Actions:
1. **Audit gate stdout** — falha PR se `console.log` ou `process.stdout.write` aparecer em qualquer arquivo dentro de `src/ui/` (mesmo que o diretório ainda não exista — o gate fica armado pra falhar imediatamente quando o código vier).
2. **Audit gate dep size** — falha PR se árvore total de runtime deps cresce >+1 vs v1.1.0 baseline (5 deps).

Sem código de runtime. Sem mudanças em `src/`, `kit/`, `bin/`, `lib/`. Apenas docs + workflow YAML.

REQs cobertos pela fase: **SEC-04** (audit gate console.log), **DOC-03** (rascunho do threat model — final fica na Fase 18).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de infraestrutura pura.

Decisões já fechadas em sessão anterior (`/novo-marco`) e que vão ser registradas no ADR:
- Porta sidecar: range **7100-7199** com auto-fallback
- Lockfile: `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock` via `fs.openSync('wx')`
- Idle shutdown: **30min default**, flag `--idle-ms` (`0` = nunca)
- `kit ui start`: **foreground default**; `--detach` parqueado pra v1.3
- `--auto-spawn` MCP: aplicado em **sync, reverse-sync, gates run** apenas
- Sem auth no v1.2 (mitigado por bind 127.0.0.1 + Host/Origin check + CSP + path scrubbing)
- +1 dep máxima: `open@11`

### Localização dos arquivos
- ADR: `.planning/decisions.md` (alinhado ao framework — `.planning/` é diretório de planejamento já familiar; criar diretório `docs/adrs/` separado seria overhead)
- Threat model: `docs/sidecar-security.md` (alinhado a `docs/` que é onde ficam docs públicas do repo)
- CI gates: `.github/workflows/ci.yml` (estender o workflow existente — não criar novo)

### Estilo dos gates de CI
- Implementar como steps dentro do job de CI já existente (não criar novo job)
- Mensagem de erro humana, indicando o REQ violado e o como corrigir
- Falhar com `exit 1` explícito, não com `set -e` invisível

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `.github/workflows/ci.yml` (existe, baseline de v1.0/v1.1) — onde os gates novos vão como steps adicionais
- `.planning/PROJECT.md` (referência de princípios de produto, restrições)
- `.planning/REQUIREMENTS.md` (referência dos 56 REQs)
- `.planning/research/SUMMARY.md` (síntese da pesquisa, fonte das decisões a registrar)
- `package.json` (baseline de deps a registrar no gate de tamanho)

### Padrões Estabelecidos
- Workflow CI já roda matrix Ubuntu/macOS/Windows × Node 20/22 — gates novos rodam dentro desse mesmo job
- Mensagens de erro humanas já são padrão (UI v1.1 reforçou isso)
- Commits seguem `node "./.claude/framework/bin/tools.cjs" commit "msg" --files ...`

### Pontos de Integração
- `.github/workflows/ci.yml` recebe 2 steps novos
- `.planning/decisions.md` é arquivo novo
- `docs/sidecar-security.md` é arquivo novo

</code_context>

<specifics>
## Ideias Específicas

- ADR estilo "Architecture Decision Record" formal (Status, Context, Decision, Consequences) por decisão registrada — ou um doc consolidado dividido por seções? Deixar planner escolher; consolidado é mais fácil de manter pra projeto pequeno.
- Threat model deve enumerar: (1) trust boundary (localhost only), (2) ataques mitigados (DNS rebinding, path leak, stdout poisoning), (3) trade-offs aceitos (sem auth, sem TLS), (4) v1.3+ improvements possíveis (token-based auth via lockfile).
- Audit gate console.log usa `git grep` ou `grep -r` simples — `rg` não é assumido como instalado em todos os runners.
- Audit gate de dep growth usa `npm ls --prod --json | jq` ou parse manual — `npm pack --dry-run` lista files, não conta deps.

</specifics>

<deferred>
## Ideias Adiadas

- Configurar Dependabot pra `chokidar` e `@modelcontextprotocol/sdk` — backlog macro do PROJECT.md, fora do escopo da Fase 11.
- ADR formal por decisão (pasta `docs/adrs/<NNNN>-titulo.md` estilo Substrate/Spotify) — overhead pra projeto pequeno; consolidado em `.planning/decisions.md` é o pragmático aqui.
- Audit gate de path leak (procurar paths absolutos em payloads) — adiado pra Fase 18 quando código existir pra testar.

</deferred>

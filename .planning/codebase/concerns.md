# Codebase Concerns — kit-mcp v1.12.1

**Analysis Date:** 2026-05-09
**Repo:** `D:\projetos\opensource\mcp` (`@luanpdd/kit-mcp`)
**Scope:** Foco `concerns` (riscos, débito técnico, supply chain, publishing, hooks, breaking change, cross-IDE, kit content quality, race conditions, abandoned code).

---

## Tech Debt

**Stale MCP server version string:**
- Issue: `createServer` declara `version: '0.1.0'` enquanto `package.json` está em `1.12.1`. Telemetria/logs no IDE-side reportam versão errada do server, dificultando suporte cross-version.
- Files: `src/mcp-server/index.js:265`
- Impact: Bugs reportados por usuários virão com versão fantasma `0.1.0`; impossibilita correlação a release notes.
- Fix approach: Ler `version` do `package.json` em runtime (`createRequire(import.meta.url)('../../package.json').version`) ou injetar via build.

**CHANGELOG ausente para v1.11 e v1.12:**
- Issue: `CHANGELOG.md` salta de `[1.10.0] - 2026-05-07` direto para `[Unreleased]`. Não há entrada `## [1.11.0]`, `## [1.12.0]`, nem `## [1.12.1]`. Tags v1.11.0/v1.12.0/v1.12.1 já foram publicadas (commits `2df9b09`, `28ec439`, `b00738f`).
- Files: `CHANGELOG.md:7-9` (gap), `.github/workflows/publish.yml:60-77` (extrai notas via awk)
- Impact: GitHub Releases para v1.11/v1.12 cairam no fallback "Release v$VERSION." — usuários não veem o que mudou. Quebra a auditoria SemVer/Keep-a-Changelog declarada em CHANGELOG header.
- Fix approach: Backfill entries para v1.11.0, v1.12.0, v1.12.1 antes de qualquer release futuro; adicionar gate em CI que falhe se `## [<version>]` não existir em CHANGELOG quando `package.json` muda versão.

**TODO/FIXME concentrados em conteúdo (37 arquivos, 63 ocorrências):**
- Issue: `src/` está limpo (zero TODO/FIXME), mas `kit/` tem 63 marcadores em 37 arquivos — agents (`executor.md` 2, `verifier.md` 4, `codebase-mapper.md` 2, `nyquist-auditor.md` 2), workflows (`discuss-phase.md` 4, `verification-patterns.md` 5, `audit-milestone.md` 3), e templates (`concerns.md`, `summary.md`).
- Files: `kit/skills/legacy-sprout-wrap-techniques/SKILL.md` (5), `kit/framework/references/verification-patterns.md` (5), `kit/agents/verifier.md` (4)
- Impact: Conteúdo entregue ao usuário final contém placeholders que LLMs vão tratar como instrução real ("TODO: handle X").
- Fix approach: Triagem 63→0; converter placeholders em prosa explícita ou exemplos completos; adicionar gate `kit-no-todo` rejeitando TODO/FIXME em `kit/`.

**Smoketest leftover commitado:**
- Issue: Diretório `.smoketest-watch/` existe no repo (ignored em `.gitignore` ✓) mas presente no working tree desde 2026-05-03; sintoma de teardown incompleto em integration test.
- Files: `D:\projetos\opensource\mcp\.smoketest-watch\` (29 arquivos)
- Impact: Confunde leitura inicial; risco de commits acidentais se `.gitignore` mudar.
- Fix approach: Remover; adicionar `try/finally` em integration test que cria a pasta (provavelmente `test/integration/cli-roundtrip.test.js`).

---

## Supply Chain Risks

**4 CVEs ativas em runtime deps (1 high + 3 moderate):**
- Issue: `npm audit --omit=dev` reporta `fast-uri ≤3.1.1` (high — path traversal + host confusion), `hono ≤4.12.17` (moderate — CSS injection, JWT NumericDate, cache leak), `ip-address ≤10.1.0` (moderate — XSS), `express-rate-limit 8.0.1-8.5.0` (depende de ip-address vulnerável). TODAS herdadas de `@modelcontextprotocol/sdk@1.29.0`.
- Files: `package-lock.json` (transitivas), `node_modules/{fast-uri,hono,ip-address,express-rate-limit}`
- Impact: Gate CI `npm audit --audit-level=high` (`.github/workflows/ci.yml:55-68`) deveria falhar mas v1.12.1 publicou — provavelmente CI rodou ANTES de advisory ser publicado, ou cache npm. Re-run de CI em main HOJE quebra o pipeline.
- Fix approach: Curto-prazo bumper `@modelcontextprotocol/sdk` para versão fix (≥1.29.x patched); médio-prazo monitorar npm advisory feed em CI semanal além do PR-time check.

**Express + cors são deps transitivas pesadas e não usadas:**
- Issue: `node_modules/express` (5.x) e `node_modules/cors` instalados via `@modelcontextprotocol/sdk` (`package-lock.json:377-381`), porém zero `import express|cors` em `src/`. SDK do MCP traz Express + Hono + cors + express-rate-limit + ajv mesmo quando só usamos `StdioServerTransport`.
- Files: `package-lock.json:367-385`, `src/mcp-server/index.js:11-13` (só usa stdio)
- Impact: Tarball publicado é ~1.1MB / ~3.4MB unpacked / 380 arquivos — boa parte do `node_modules` instalado pelo usuário final é dead code do SDK. Atualmente OK porque `node_modules` não vai no tarball (`files` allowlist), mas alarga superfície de CVE drasticamente (vide acima — 3/4 vulns são de deps que o código não usa).
- Fix approach: Issue upstream em `@modelcontextprotocol/sdk` pedindo modularização (stdio-only entry point sem Express/Hono); enquanto isso, considerar `--omit=optional` se SDK declarar; ou avaliar fork minimalista.

**Lockfile bem fixado mas 132 deps transitivas:**
- Issue: `package-lock.json` tem 132 entradas `"version":` para 6 deps diretas. Razão de inflação ~22x. `engines: node >=20` declarado em `package.json`.
- Files: `package.json:50-57` (6 deps diretas), `package-lock.json` (132 versões)
- Impact: Cada release renova superfície de CVE; `npm ci` é determinístico (✓) mas `npm install` em projeto downstream pode escolher versões mais novas com vulns futuras.
- Fix approach: Adicionar `npm-shrinkwrap.json` para travar deps mesmo em distribuição binária; documentar política `npm ci` em CONTRIBUTING; considerar `dependabot` para alertas semanais.

---

## Publishing Risks (npm)

**Tarball auditado e clean (sem secrets):**
- Status: `npm pack --dry-run --json` mostra 380 arquivos / 1.1MB / 3.4MB unpacked, distribuídos em 8 top-level paths declarados no `files` allowlist (`bin/`, `gates/`, `kit/`, `src/`, `CHANGELOG.md`, `LICENSE`, `README.md`, `package.json`).
- Files: `package.json:13-21` (allowlist), `.npmignore` (belt-and-braces, exclui `.planning/`, `.claude/`, `test/`, `node_modules/`)
- Mitigação: `.gitignore` exclui `.env`/`.env.local`; nenhum `.env` encontrado em árvore; CI gate `audit — npm pack includes UI assets` valida arquivos críticos.

**Kit é content-heavy — 270 markdowns (~470KB)**
- Issue: `kit/agents` 47 + `kit/commands` 87 + `kit/skills` 49 + `kit/framework` 134 = 317 arquivos; `kit/agents/planner.md` 897 linhas; total tarball cresce 5-15% por release.
- Files: `kit/agents/planner.md`, `kit/agents/debugger.md` (778), `kit/framework/workflows/new-project.md` (1159 linhas), `kit/skills/_shared-sre/glossary.md` (712)
- Impact: Conteúdo é premissa do produto (sync para 8 IDEs), mas crescimento sem governança eleva token cost para usuários downstream. v1.7 já compactou alguns (`discuss-phase.md` -22%).
- Fix approach: Adicionar gate `agent-max-lines` (warn em >500, fail em >1000); mover prosa duplicada para `_shared-*/glossary.md` referenciado por link relativo; auditar trimestralmente.

---

## Hook Safety

**Race condition v1.12.1 — recém-corrigida, mas padrão arriscado persiste:**
- Issue: 7 hooks (`sidecar-tool-publisher`, `workflow-guard`, `prompt-guard`, `context-monitor`, `post-apply-migration`, `statusline`, `check-update`) usam o mesmo padrão: `setTimeout(() => process.exit(0), <ms>)` + `process.stdin.on('end', ...)` + `process.exit(0)` espalhado. v1.12.1 corrigiu APENAS `sidecar-tool-publisher.js` (commit `56b327f` — "process.exit before TCP flush dropped events"). Outros 6 hooks ainda chamam `process.exit(0)` imediatamente após I/O assíncrono.
- Files: `kit/hooks/sidecar-tool-publisher.js:77` (corrigido — `publish().then(() => process.exit(0))`); `kit/hooks/post-apply-migration.js:115` (suspeito); `kit/hooks/context-monitor.js:111,154` (suspeito).
- Impact: Hooks que escrevem em rede ou fazem I/O com Supabase MCP / fs.appendFile podem perder eventos silenciosamente. `KIT_MCP_HOOK_DEBUG=1` é única observability.
- Fix approach: Auditar cada hook — para qualquer chamada `process.exit(0)` precedida de side-effect assíncrono, encadear via `.then()` ou `await`; adicionar test de integração spawnando hook real e verificando side-effect chegou.

**Hook lockfile scan amplo:**
- Issue: `sidecar-tool-publisher.js:scanAnyRunningSidecar()` lê TODOS `kit-mcp-ui-*.lock` em `os.tmpdir()` quando o `projectRoot` não bate; envia evento ao primeiro vivo (`kill(pid, 0)` OK). Em multi-projeto isto pode publicar evento do projeto-A para sidecar do projeto-B.
- Files: `kit/hooks/sidecar-tool-publisher.js:100-117`
- Impact: Cross-project event leak — tool calls do projeto X aparecem na UI do projeto Y se ambos sidecars estão up.
- Fix approach: No fallback, escolher lock cujo `projectRoot` salvo (já está em lockfile, `lockfile.js:50-58` grava `pid/port/version`) bata por prefix-match case-insensitive antes de healthz; ou recusar fallback (zero vazamento, falha visível).

---

## Breaking Change Risk

**3 majors em 3 dias sem migration guides:**
- Issue: v1.10.0 (2026-05-07) → v1.11.0 (2026-05-08) → v1.12.0 (2026-05-08) → v1.12.1 (2026-05-08). 207 commits desde 2026-05-06. Zero seções "Migration" ou "Breaking changes" em CHANGELOG (gap reforçado por entries faltando para v1.11/v1.12 — vide Tech Debt acima). 157 commits nos últimos 2 dias.
- Files: `CHANGELOG.md:7` (`[Unreleased]` vazio), git log `2df9b09..b00738f`
- Impact: Usuários do `npx -y @luanpdd/kit-mcp` recebem novas suites (Legacy, SRE Resilience) sem aviso prévio; prompts/agents podem mudar de comportamento entre runs. Stable API claim em CHANGELOG (`v1.0.0`, linha 686) afirma "breaking → 2.0.0", mas conteúdo de skills/agents NÃO é parte da Stable API e muda silenciosamente.
- Fix approach: Adicionar README seção "What's content vs what's API"; CHANGELOG section "Conteúdo modificado" listando skills renomeadas/agents com novo prompt; gate `kit-content-stability` que diff-a kit/ entre tags e exige checklist humano se delta >10%.

---

## Cross-IDE Compatibility

**Lógica de divergence centralizada em registry.js — robusto, mas frágil em capabilities skewed:**
- Issue: `src/core/registry.js` declara 8 IDEs com matriz de capabilities (rules/agents/commands/skills/framework/hooks/mcpConfig). 4 IDEs (codex, gemini-cli, copilot, antigravity) NÃO suportam `commands`. 1 (codex) NÃO suporta `agents`. 3 (codex, gemini-cli, trae) NÃO suportam `framework/hooks`. `sync.js` itera capabilities silenciosamente (`if (target.commands)`). Quando user instala kit no codex e expecta `/discutir-fase`, comando some sem aviso.
- Files: `src/core/registry.js:16-90`, `src/core/sync.js:21-103`
- Impact: UX silenciosamente degradada por IDE. CLI smoke (`ci.yml:127-130`) só testa Claude Code path completo — codex/gemini/copilot rodam apenas como `sync targets` listing.
- Fix approach: Adicionar warning verboso em `kit sync install <target>` listando capabilities NÃO suportadas; gate `cross-ide-coverage` rodando smoke-roundtrip em ≥3 IDEs por release.

**MCP config strategies divergem (merge-mcpServers-json vs append-toml-snippet):**
- Issue: `mcpConfig.strategy` tem 2 valores (`merge-mcpServers-json` para 5 IDEs, `append-toml-snippet` para codex). Lógica deve estar em `mcp-server/install.js` (`Grep` confirma). Codex usa TOML (`~/.codex/config.toml`), risco de duplicação ao re-installar.
- Files: `src/core/registry.js:25-26,42-46,53-55,70-72`, `src/mcp-server/install.js`
- Impact: Re-install em codex pode acumular entries TOML duplicadas (sem `seen` check robusto). Outros 5 IDEs JSON tem deep-merge.
- Fix approach: Test `install --force` em fixture TOML pré-poluído; idempotência checagem.

---

## Kit Content Quality

**Agents enormes (>500 linhas, >700 linhas, 1 com 897):**
- Issue: 9 agents passam de 500 linhas; topo é `kit/agents/planner.md` (897), `debugger.md` (778), `codebase-mapper.md` (774), `verifier.md` (734). Workflows são piores: `new-project.md` (1159), `autonomous.md` (891), `execute-phase.md` (838). Cada execução de agent injeta o arquivo todo no contexto LLM.
- Files: `kit/agents/planner.md`, `kit/framework/workflows/new-project.md`
- Impact: Token cost por invocação alto; risco de "lost in the middle" em LLMs (instruções no meio do prompt ignoradas); v1.7 PERF-S1 (`stubsOnly: true`) só lê 4KB de frontmatter para sync, mas no IDE-runtime o arquivo completo é injetado.
- Fix approach: Decompor agents grandes em referências `_shared-*/` + agent file enxuto; adicionar gate `agent-max-lines` (warn 500, error 1000).

**Padrão estrutural inconsistente entre agents:**
- Issue: 47 agents — alguns com tabela `## Compatibilidade` (declarada em v1.8/v1.10 changelog como obrigatória), outros sem. Nem todos têm `<output_style>` block. Nem todos declaram `tools:` no frontmatter.
- Files: `kit/agents/planner.md` (tem tools, sem Compatibilidade aparente em primeiras 15 linhas), demais não verificados
- Impact: Conteúdo de produto inconsistente; LLMs em IDEs diferentes percebem capacidades misturadas.
- Fix approach: Gate `agent-frontmatter-required` listando 5-7 campos obrigatórios; rodar em PR.

---

## Race Conditions / File Locks

**Chokidar watcher + sync writer concorrência:**
- Issue: `src/core/watch.js` usa `chokidar.watch(kitRoot)` com `awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }` e debounce 300ms (`watch.js:36-58`). Se user salva múltiplos arquivos em <300ms, debounce coalesce para 1 sync; mas se sync demora mais que próximo trigger, dois `syncTo()` podem rodar em paralelo escrevendo MESMO destino. `syncTo` faz `fs.writeFile` direto sem temp-file-rename atomic.
- Files: `src/core/watch.js:43-58`, `src/core/sync.js:89-100`
- Impact: Em IDE como Claude Desktop que faz polling agressivo nos arquivos `.claude/agents/*.md`, pode capturar arquivo half-written.
- Fix approach: Substituir `fs.writeFile(out, content)` por `fs.writeFile(out + '.tmp', content) + fs.rename(out + '.tmp', out)` (atomic on POSIX, atômico-ish em Windows); adicionar mutex/queue em watch para serializar resync.

**Lockfile reclaim TOCTOU mitigado mas três layers profundos:**
- Issue: `acquireLockOrReclaim` (`src/ui/lockfile.js:148-187`) tem 3 tentativas aninhadas de probar staleness para fechar window TOCTOU. Bem documentado (REQ SEC-01) mas complexidade torna debug difícil em race genuína.
- Files: `src/ui/lockfile.js:148-187`
- Mitigação: Test "OPS-04: 2 concurrent publishers" cobre cenário (vide `docs/sidecar-security.md:122`).

---

## Abandoned Code

**Status: limpo.**
- Verificação: cada arquivo em `src/core/` (sync, kit, registry, gates, gate-runner, watch, reverse-sync, failures, reflect, replays, ui) tem `import` correspondente em `src/cli/index.js`, `src/mcp-server/index.js` ou outro core file. `src/ui/*` todos importados pelo server / wrapper / auto-spawn pipeline.
- Sem código órfão detectado em `src/`. Toda dependência é alcançável a partir de `bin/{cli,mcp,ui}.js`.

---

## TOP 10 Concerns Ranked (severity × likelihood)

| # | Concern | Severity | Likelihood | Mitigação 1-frase |
|---|---|---|---|---|
| 1 | **4 CVEs ativas em runtime deps (1 high + 3 mod) via `@modelcontextprotocol/sdk@1.29.0`** | High | High | Bumpear SDK para versão patched; CI gate `audit-level=high` deveria estar quebrando agora. |
| 2 | **CHANGELOG vazio para v1.11/v1.12.x — release notes do GitHub no fallback** | High | High | Backfill 3 entries; gate `changelog-required-on-version-bump` em CI. |
| 3 | **6 hooks ainda têm `process.exit` antes de I/O drain (race fix v1.12.1 cobriu só 1)** | High | Medium | Auditoria multi-hook; encadear `process.exit` via `.then()` em todos os 7 hooks. |
| 4 | **3 majors em 3 dias sem migration guide; 207 commits em 6 dias** | High | Medium | Section "Conteúdo modificado" no CHANGELOG; freeze de 1 semana antes de v1.13. |
| 5 | **MCP server reporta `version: '0.1.0'` (stale string)** | Medium | High | Ler version do `package.json` em runtime via `createRequire`. |
| 6 | **Sync writer não atomic (`fs.writeFile` direto) + chokidar debounce 300ms — corrupção possível** | Medium | Medium | `writeFile(.tmp) → rename` atomic; mutex no debounce trigger. |
| 7 | **Hook `sidecar-tool-publisher.js` faz fallback cross-project — vazamento de eventos entre projetos** | Medium | Medium | Match prefix de `projectRoot` salvo em lockfile antes de aceitar fallback. |
| 8 | **Cross-IDE: 4 dos 8 IDEs não têm `commands`; UX degrada silente** | Medium | Medium | Warning verboso em `sync install`; gate smoke roundtrip ≥3 IDEs. |
| 9 | **Agents enormes (planner 897, workflows 1159 linhas) — token-cost + lost-in-middle** | Medium | Medium | Gate `agent-max-lines` (warn 500, error 1000); decompor para `_shared-*/`. |
| 10 | **63 TODO/FIXME em 37 arquivos `kit/` — placeholders viram instrução real para LLM** | Low | High | Triagem 63→0; gate `kit-no-todo` rejeitando TODO em conteúdo entregue. |

---

*Concerns audit: 2026-05-09*

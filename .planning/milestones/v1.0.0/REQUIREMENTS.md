# REQUIREMENTS.md — v1.0.0 "Estabilização para 1.0"

> Escopo congelado em 2026-05-03. REQ-IDs são imutáveis após esta gravação.

## REQ-001 — Test runner nativo configurado

**Descrição:** O projeto tem um runner de testes funcional baseado em `node:test` (zero dependências adicionais), invocável via `npm test` e rodável no CI.

**Aceitação:**
- `package.json` tem script `test` que executa `node --test test/**/*.test.js`
- Existe pelo menos um teste passando em `test/`
- Comando `npm test` retorna exit 0 quando os testes passam, exit 1 quando falham
- README documenta a invocação em "Smoke tests" → renomear para "Tests"

## REQ-002 — Cobertura unit dos módulos core

**Descrição:** Os 5 módulos críticos do `src/core/` têm tests unit cobrindo as funções públicas e os caminhos de erro previstos.

**Aceitação:**
- `test/kit.test.js` — `splitFrontmatter`, `parseLooseYaml`, `firstNonEmptyLine`, `listKit` (com fixture `test/fixtures/sample-kit/`), `searchKit`, `findItem`
- `test/sync.test.js` — `syncTo` em modos `reference`/`copy`/`mirror-tree`, `removeFrom` com e sem marker, `walkTree`
- `test/reverse-sync.test.js` — `detectReverse` para arquivos diferentes/iguais/ausentes, `applyReverse` com estratégias `skip`/`overwrite`/`merge`/`rename`
- `test/gate-runner.test.js` — `runGate` com gate shell passando/falhando, gate manual, gate sem `## Check`
- `test/registry.test.js` — `listTargets` retorna 8 IDEs com capabilities corretas, `getTarget` lança em ID desconhecido
- Total ≥ 30 asserts somados; rodam em < 5s

## REQ-003 — Cobertura integration end-to-end via CLI

**Descrição:** Existe um teste integration que invoca o CLI real (não importa diretamente as funções) contra um diretório temporário, validando o ciclo `sync install → edit → reverse-sync apply → sync remove`.

**Aceitação:**
- `test/integration/cli-roundtrip.test.js` faz spawn de `node bin/cli.js …` e checa stdout/stderr e arquivos resultantes
- Cobre: install (com framework/hooks), edit em `.claude/agents/` e `.claude/framework/`, reverse-sync detect+apply, remove (preserva user files)
- Roda em < 10s

## REQ-004 — CI roda os tests unit e integration

**Descrição:** O job `smoke` do CI passa a executar `npm test` antes dos smoke tests existentes. Falhas no test runner falham o CI.

**Aceitação:**
- `.github/workflows/ci.yml` tem step "Tests" antes de "CLI smoke"
- Job continua rodando em Ubuntu/macOS/Windows × Node 20/22 — todas as 6 combinações têm que passar
- Tempo total do job não excede 90s na pior combinação

## REQ-005 — Reverse-sync detecta edits em framework/hooks

**Descrição:** `kit reverse-sync detect <ide>` lista arquivos modificados em `.claude/framework/` e `.claude/hooks/` que diferem do canônico em `kit/framework/` e `kit/hooks/`.

**Aceitação:**
- `detectReverse` em `src/core/reverse-sync.js` walk-a recursivamente o tree mirror-tree do target IDE e compara cada arquivo com o canônico em `kit/<source>/`
- Arquivos com mesmo conteúdo são ignorados; arquivos diferentes aparecem no resultado com `kind: 'framework'` ou `kind: 'hooks'`
- O marker `.kit-mcp-managed` é ignorado (nunca aparece como candidato)
- Test unit cobre o caso

## REQ-006 — Reverse-sync apply para framework/hooks

**Descrição:** `kit reverse-sync apply <ide> --strategy overwrite` aceita as categorias framework e hooks e copia o conteúdo editado de volta para o canônico.

**Aceitação:**
- Strategy `overwrite` funciona pra framework/hooks (sobrescreve `kit/<source>/<rel>` com `<projectRoot>/<targetPath>/<rel>`)
- Strategy `skip` (default) só lista, não escreve
- Strategy `merge` cai pra `overwrite` em framework/hooks com aviso (não há frontmatter pra preservar)
- Strategy `rename` escreve em `kit/<source>/<rel>.from-<ide>` preservando o original
- `--only framework/<rel>` filtra um arquivo específico
- Test integration cobre todas as estratégias

## REQ-007 — MCP tool reverse-sync atualizada

**Descrição:** A tool `reverse-sync` exposta via MCP aceita as novas categorias sem mudança no schema visível ao consumer (categorias são derivadas do registry, não enumeradas no input).

**Aceitação:**
- `mcp__kit__reverse-sync` com `action: 'detect'` retorna candidatos incluindo framework/hooks quando relevante
- `action: 'apply'` aceita `only: ["framework/workflows/new-milestone.md"]` e respeita
- README atualizado na seção "MCP usage" com exemplo

## REQ-008 — Bug: descrição do skill `inserir-fase` corrigida

**Descrição:** O parser de frontmatter em `kit.js` para de capturar `<!-- kit-mcp:reference -->` como `description` quando o canônico tem linha em branco entre frontmatter e o resto.

**Aceitação:**
- `kit.js:firstNonEmptyLine` pula linhas que começam com `<!--` (HTML/markdown comment)
- O autocomplete de skills mostra "Insere trabalho urgente como fase decimal (ex: 72.1) entre fases existentes" como descrição de `inserir-fase`
- Test unit em `test/kit.test.js` com fixture cobrindo: frontmatter ausente + body começando com STUB_MARKER deve usar a primeira linha não-comentário não-cabeçalho

## REQ-009 — Dependabot ativo

**Descrição:** GitHub Dependabot abre PRs semanais agrupando updates do ecossistema npm.

**Aceitação:**
- `.github/dependabot.yml` define um update group "npm" com schedule weekly
- Pacotes monitorados: `@modelcontextprotocol/sdk`, `commander`, `chokidar`
- Updates de minor/patch agrupados em um PR; major em PRs separados

## REQ-010 — GitHub Release object pra v0.5.0

**Descrição:** A página `/releases` no GitHub mostra `v0.5.0 — mirror-tree sync for framework and hooks` como Latest, substituindo a `v0.2.0 — cleanup` atual.

**Aceitação:**
- `gh release create v0.5.0 --notes-from-tag --latest` executado e bem-sucedido
- Página de releases mostra v0.5.0 com badge "Latest"
- Notas extraídas do CHANGELOG da entrada `[0.5.0]` (sem o frontmatter de outras versões)

## REQ-011 — publish.yml cria Release object automaticamente

**Descrição:** A partir do v1.0.0, todo tag `v*` pushed dispara também a criação do GitHub Release object com notas do CHANGELOG.

**Aceitação:**
- `.github/workflows/publish.yml` ganha step `gh release create` após `npm publish` bem-sucedido
- Release inclui as notas do CHANGELOG da versão correspondente (extraídas com awk/sed/script)
- Cada release a partir da 1.0.0 aparece automaticamente em /releases com flag --latest

## REQ-012 — Cut da v1.0.0

**Descrição:** Após REQ-001 a REQ-011 estarem fechados, fazer o release formal de 1.0.0 com nota de "stable API commitment".

**Aceitação:**
- CHANGELOG entry `[1.0.0] - YYYY-MM-DD` com seção "Stable API" listando os módulos com compromisso de retro-compat: registry table format, MCP tool action signatures, CLI subcommand surface
- `package.json` em 1.0.0
- Tag `v1.0.0` pushed
- Release object criado pelo workflow novo (REQ-011) — fecha o ciclo
- npm view mostra `1.0.0` como latest

---

## Não-objetivos (explicitamente fora deste milestone)

- HTTP transport para IDEs sem stdio
- Documentation site
- Forensics reflect com diff visual
- `kit gates run --all`
- `kit sync watch` exposto via MCP
- Bootstrap real do PROJECT.md (`novo-projeto` adaptado pra repo existente)

Esses ficam pra v1.1+.

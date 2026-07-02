# MILESTONE-AUDIT — v1.0.0 "Estabilização para 1.0"

**Data de conclusão:** 2026-05-03
**Tag git:** `v1.0.0`
**Commit final:** `0a26a3b release: 1.0.0 — first stable, see CHANGELOG[1.0.0]`
**npm:** [`@luanpdd/kit-mcp@1.0.0`](https://www.npmjs.com/package/@luanpdd/kit-mcp/v/1.0.0)
**GitHub Release:** https://github.com/luanpdd/kit-mcp/releases/tag/v1.0.0

## Cobertura — 12/12 REQs entregues ✅

| REQ | Descrição | Status | Evidência |
|---|---|---|---|
| 001 | Test runner nativo configurado | ✅ | `package.json` scripts; `test/run.mjs` |
| 002 | Cobertura unit dos módulos core | ✅ | 37 unit tests em `test/unit/` (kit, sync, reverse-sync, gates, registry) |
| 003 | Cobertura integration end-to-end via CLI | ✅ | 5 integration tests em `test/integration/cli-roundtrip.test.js` |
| 004 | CI roda os tests unit e integration | ✅ | `.github/workflows/ci.yml` ganha 2 steps; verde 6/6 |
| 005 | Reverse-sync detecta edits em framework/hooks | ✅ | `scanMirrorTree` + `walkRel` em `src/core/reverse-sync.js` |
| 006 | Reverse-sync apply para framework/hooks | ✅ | `applyMirrorTreeOne` cobre skip/overwrite/merge/rename |
| 007 | MCP tool reverse-sync atualizada | ✅ | Handler delega via getTarget — sem mudança de schema necessária |
| 008 | Parser frontmatter corrigido (`inserir-fase`) | ✅ | 3 fixes coordenados: stub reorder + firstNonEmptyLine + YAML quoting de 8 commands |
| 009 | Dependabot ativo | ✅ | `.github/dependabot.yml` (npm + github-actions weekly) |
| 010 | GitHub Release object pra v0.5.0 | ✅ | `gh release create v0.5.0 --latest` executado |
| 011 | publish.yml cria Release object automaticamente | ✅ | Step `Create GitHub Release` adicionado; testado no próprio v1.0.0 |
| 012 | Cut da v1.0.0 | ✅ | npm publicou; GH Release marcou Latest |

## Métricas

| Métrica | v0.5.0 (entrada) | v1.0.0 (saída) | Δ |
|---|---|---|---|
| Tests automatizados | 0 | 42 (37 unit + 5 integration) | +42 |
| CI steps por job | Install + Smoke + MCP boot (3) | Install + Tests-unit + Tests-integ + Smoke + MCP boot + Mirror-tree-safety (6) | +3 |
| CI tempo médio | ~25s | ~45s | +20s |
| Reverse-sync kinds suportadas | 3 (agents, commands, skills) | 5 (+ framework, hooks) | +2 |
| Commands com argument-hint quotada | 17/26 | 26/26 | +9 |
| GitHub Releases automatizadas | 0 | toda tag `v*` | ∞ |
| Pacotes npm publicados | 6 | 7 (+ 1.0.0) | +1 |

## Não-objetivos — confirmados fora de escopo

Conforme REQUIREMENTS.md, ficaram para v1.1+:

- HTTP transport para IDEs sem stdio MCP
- Documentation site
- Forensics reflect com diff visual
- `kit gates run --all`
- `kit sync watch` exposto via MCP
- Bootstrap real do PROJECT.md (`novo-projeto` adaptado para repo existente)

## Decisões arquiteturais relevantes

1. **Mirror-tree como capability primitive** — em vez de hardcodar framework/hooks no sync, generalizamos com `mode: 'mirror-tree'` no registry. Adicionar uma 7ª/8ª capability futura é uma entrada na tabela.
2. **`.kit-mcp-managed` marker como contrato** — files vs directory ownership. Marker presente = a gente possui. Sem marker = user owns. `sync remove` respeita estritamente.
3. **`node:test` em vez de Vitest/Jest** — preserva o princípio "zero build step, deps mínimas". Custou um shim (`test/run.mjs`) por incompatibilidade Node 20 vs 21+ no glob, aceitável.
4. **Stable API listada explicitamente** — em vez de "tudo é estável" (perigoso) ou "nada é estável" (não cumpre o ponto de cortar 1.0), enumera os 6 contratos. Não-listados são experimentais até promoção.

## Dívidas técnicas registradas (pra v1.1+)

- **Skills bundled da Anthropic Cowork** ainda não restauradas. Decisão consciente em v0.3.0 — usuário não quer redistribuir conteúdo de terceiros. Podemos adicionar suporte a "external skills via npm peer dep" se virar prioridade.
- **`reverse-sync` para `framework/hooks` não tem `merge` real** — degenera pra overwrite porque esses arquivos não têm frontmatter. Se um dia framework files ganharem metadados YAML, vale revisitar.
- **Test fixture é minimal** — só 1 de cada kind. Edge cases (frontmatter malformado, nomes com unicode, paths longos no Windows) não cobertos. Adicionar sob demanda quando regressões aparecerem.
- **`publish.yml` cria Release sempre como Latest** — se um dia precisar shipar patch numa branch antiga (1.0.x enquanto 2.0 já existe), `--latest` está errado. Ajustar quando o problema for real.

## Lessons learned

1. **CI cobertura tem zona cega óbvia ignorada por meses.** O `DEFAULT_KIT_ROOT` da v0.4.0 vazou porque CI só testava CLI — boot do MCP server não era exercitado. Boot smoke virou step novo em v0.4.1. **Padrão:** todo entry point binário tem que ter um boot test.

2. **Stub format é interface pública subestimada.** A reorder de `renderReference` (mover `<!-- kit-mcp:reference -->` pro fim) era visualmente trivial mas resolveu um bug visível em IDE third-party (Claude Desktop) que ninguém conseguiria diagnosticar sem ter as duas pontas.

3. **YAML strict é contagioso.** Um único command com `argument-hint: <description>` não-quotada no frontmatter envenenou o parser do Claude Desktop pro listing inteiro. **Padrão:** lint o frontmatter antes de aceitar contributions.

4. **node --test glob é Node 21+, não Node 20.** Documentado em changelog Node mas pego só no CI. **Padrão:** sempre testar a feature na versão MAIS BAIXA suportada antes de assumir cross-version.

## Próximo milestone

A definir. Sugestões registradas em `MILESTONES.md` na seção "Backlog macro".

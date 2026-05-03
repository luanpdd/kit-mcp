# MILESTONE-AUDIT — v1.1.0 "Feedback visual no terminal"

**Data de conclusão:** 2026-05-03
**Tag git:** `v1.1.0`
**Commit final:** `d14f0b9 release: 1.1.0 — visual feedback in the terminal`
**npm:** [`@luanpdd/kit-mcp@1.1.0`](https://www.npmjs.com/package/@luanpdd/kit-mcp/v/1.1.0)
**GitHub Release:** https://github.com/luanpdd/kit-mcp/releases/tag/v1.1.0 (Latest, criada automaticamente pelo workflow novo de v1.0)

## Cobertura — 10/10 REQs entregues ✅

| REQ | Descrição | Status | Evidência |
|---|---|---|---|
| 001 | Camada UI primitiva (`src/core/ui.js`) | ✅ | 167 LOC com c, icons, spinner, progress, select, confirm, summary |
| 002 | Output humano padrão, `--json` opt-in | ✅ | `src/cli/render.js` + flag global; `out()` wrapper escolhe |
| 003 | Progress bar em ops longas | ✅ | `onProgress` callback em `syncTo`/`applyReverse`; `withProgress` no CLI |
| 004 | Spinner em ops curtas opacas | ✅ | `withSpinner` em `kit list-*`, `sync targets` |
| 005 | Selector interativo em `install write` | ✅ | `pickTarget()` em `src/cli/index.js`; cobre `install write` e `sync install` |
| 006 | Diff preview + confirmação em `install write` | ✅ | Sempre faz dry-run, mostra preview, confirm() obrigatório (--yes/--json bypass) |
| 007 | Summary panel padronizado | ✅ | `summary()` integrado em renderSyncInstall, renderSyncRemove, renderInstallResult |
| 008 | Tests dos primitivos UI | ✅ | 6 unit tests em `test/unit/ui.test.js` cobrindo summary + NO_COLOR + icons |
| 009 | README e CHANGELOG atualizados | ✅ | CLI reference seção atualizada; CHANGELOG `[1.1.0]` enumera 4 fases |
| 010 | Cut da v1.1.0 | ✅ | npm publicou; GH Release Latest auto-criada |

## Métricas

| Métrica | v1.0.0 (entrada) | v1.1.0 (saída) | Δ |
|---|---|---|---|
| Tests automatizados | 42 (37 unit + 5 integ) | 58 (49 unit + 9 integ) | +16 |
| Runtime deps | 3 | 5 | +2 (picocolors, @inquirer/prompts) |
| Linhas de código novas | — | ~700+ | (ui.js + render.js + tests) |
| Default CLI output | JSON | colored human + summary | mudança aditiva (--json preserva) |
| CI tempo médio | ~45s | ~50s | +5s |

## Não-objetivos — confirmados parqueados

Conforme REQUIREMENTS.md, ficaram para v1.2.0:

- **Janela GUI/sidecar paralela** rodando junto da IDE (Claude Code etc) — escopo separado e bem maior
- **TUI complexa** tipo lazygit/htop multi-pane — fora do escopo terminal-feedback
- **i18n** do output (PT/EN automático) — eventual milestone de adoção
- **Mudanças no protocolo MCP** — server continua JSON-RPC silencioso

## Decisões arquiteturais relevantes

1. **`src/core/ui.js` como módulo único de primitivos** — em vez de espalhar color/spinner/progress por vários arquivos, centralizamos. Trade-off: arquivo maior (~167 LOC), mas API consistente e fácil de testar.
2. **Animações para stderr, dados para stdout** — preserva a possibilidade de `kit ... | jq` (mesmo sem `--json`, stdout ainda contém só dados). `--json` adiciona o requisito de stdout 100% limpo.
3. **Selector cai pra erro descritivo em non-TTY**, não fallback silencioso — programmatic users que esquecem `--target` sabem na hora, não ficam aguardando prompt invisível.
4. **`install write` agora SEMPRE preview + confirm** — proteção contra mudanças inesperadas na config do IDE. `--yes` ou `--json` bypassa para CI.
5. **Estimativa de progress total fixa em 300** (sync install) — overestimate intencional. Bar vai de 0 ao real total e para; nunca aponta 105%. Trade-off: barra parece "rápida demais" no fim. Aceitável.

## Dívidas técnicas registradas (pra v1.2+)

- **Preview do `install write` é JSON cru** — quando o `~/.claude.json` é grande (centenas de mcpServers), a preview vira parede de texto. Vale renderizar só o diff (linhas adicionadas/removidas) ao invés de full JSON.
- **`pickTarget()` não suporta filtros** — todos os 8 IDEs sempre listados em `install write`, mesmo os que o usuário não quer ver. Vale aceitar `--include` / `--exclude` flags ou config.
- **Progress label em mirror-tree mostra apenas filename** — em `framework/templates/codebase/architecture.md`, vê só `architecture.md`. Vale incluir o subdir pra contexto.
- **`forensics collect/summarize` não tem progress** apesar de iterar sobre arquivos — escopo deferido pra v1.2 quando virar gargalo real.
- **Spinner não trata SIGINT graciosamente** — Ctrl+C deixa cursor numa posição estranha. Adicionar handler.

## Lessons learned

1. **Default switch é breaking change socioeconômica, não SemVer.** Mudar default de JSON pra humano não quebra nenhum contrato de API listado, mas QUEBRA usuários que pipam `kit | jq` em scripts. Documentação proativa do migration path foi crítica — uma linha no CHANGELOG cobrindo o caso conforta o early adopter.

2. **`@inquirer/prompts` é modular e isso importa.** Importar `select` e `confirm` separadamente puxa só ~50KB ao invés dos ~500KB do pacote inteiro. Tree-shaking não é automático em CommonJS — é necessário deliberadamente.

3. **Estimativa de total no progress bar pode ser conservadora.** Subestimar = bar trava em 100% no final. Superestimar = bar parece rápida. Preferimos rápido, especialmente porque o summary panel imediato após dá a sensação real de conclusão.

4. **Color disable via env var é universalmente esperado.** `NO_COLOR=1` funcionou de primeira em todas as plataformas/CI. Não precisamos reinventar nada.

## Próximo milestone

Sugestão: **v1.2.0 — GUI sidecar de acompanhamento** (escopo registrado nos não-objetivos da v1.1). Janela leve rodando em paralelo ao IDE mostrando processos kit-mcp ao vivo. Decisão a ser tomada: Electron? Tauri? Web localhost?

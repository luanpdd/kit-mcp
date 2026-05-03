# REQUIREMENTS.md — v1.1.0 "Feedback visual no terminal"

> Escopo congelado em 2026-05-03. REQ-IDs imutáveis após gravação.

## REQ-001 — Camada UI primitiva (`src/core/ui.js`)

**Descrição:** Existe um módulo único que centraliza os primitivos visuais usados pelo CLI: cores, ícones (✓ ✗ ⚠ ⠋), spinner, progress bar, select interativo, confirm prompt, summary panel.

**Aceitação:**
- `src/core/ui.js` exporta: `c` (color helpers wrapping picocolors), `icons`, `spinner({ text }) → { update, stop, succeed, fail }`, `progress({ total, label }) → { tick, finish }`, `select({ message, choices }) → Promise<value>`, `confirm({ message, default? }) → Promise<bool>`, `summary({ rows, total })`.
- Cada primitivo respeita `process.stdout.isTTY`: em pipe/CI, spinner e progress degradam pra mensagens estáticas (`Synced…done` ao invés de spinner animado).
- Respeita `NO_COLOR` env var (desliga cores) e `FORCE_COLOR=1` (força mesmo em pipe).
- Deps adicionadas: `picocolors` (~3KB, zero subdeps) e `@inquirer/prompts` (importação só de `select`/`confirm`).

## REQ-002 — Output humano padrão, `--json` opt-in

**Descrição:** Todo comando do CLI passa a renderizar resultado em formato humano colorido como default. A flag global `--json` preserva o comportamento atual (JSON pro stdout, machine-readable).

**Aceitação:**
- Flag `--json` registrada globalmente em `bin/cli.js` (Commander option).
- Comandos com fork no rendering: `kit list-agents/list-commands/list-skills/get/search`, `sync targets/status/install/remove`, `reverse-sync detect/apply`, `gates list/get/for-stage/run`, `forensics collect/summarize/list-replays`, `install targets/dry-run/write`.
- Em modo humano: tabela ou lista com cores e ícones; em modo JSON: stdout 100% válido JSON (nada mais).
- `process.stdout.isTTY === false` AND nenhuma `--json` explícita ainda usa humano (não auto-switch pra JSON em pipe — o usuário decide). Documentar isso no README.
- Test integration confirma: `kit list-agents --json | jq .` parses; `kit list-agents` (no --json) tem ANSI codes.

## REQ-003 — Progress bar em operações longas

**Descrição:** Operações que tocam ≥10 arquivos ou ≥1s mostram barra de progresso com percentual e label do que está sendo processado.

**Aceitação:**
- `syncTo` em `src/core/sync.js` aceita `onProgress({ phase, current, total, label })` callback opcional. Emite eventos: phase=`'rules'|'agents'|'commands'|'skills'|'framework'|'hooks'`.
- `applyReverse` aceita callback similar (emite por candidato aplicado).
- `collectFailures` em `src/core/failures.js` emite (emite por arquivo/diretório scaneado).
- CLI wire: cada subcomando que invoca essas funções passa um callback que atualiza um `progress()` da UI.
- Em `--json` mode: callback é no-op (não polui stdout).
- Em non-TTY sem `--json`: imprime status text linear (`Copying framework/workflows/new-milestone.md…`).

## REQ-004 — Spinner em operações curtas opacas

**Descrição:** Operações que terminam em <1s mas têm latência perceptível (boot, network, IO de listagem) mostram spinner com texto descritivo enquanto processam.

**Aceitação:**
- `bin/cli.js` envolve subcomandos com `spinner({ text: 'Loading kit...' })` quando apropriado: `sync targets`, `install targets`, `kit list-*`, `kit search`.
- Spinner sobrescreve com `succeed(text)` ou `fail(error.message)` ao terminar.
- Em non-TTY: imprime `· Loading kit...` antes e `✓ Loaded 19 agents, 60 commands` depois (sem animação).
- Spinner não é usado em `--json` mode.

## REQ-005 — Selector interativo em `install write` quando target ausente

**Descrição:** Quando `kit install write` é invocado sem `--target`, abre selector com seta-up/seta-down listando os 8 IDEs com label legível e o path de destino. Idem para `sync install`.

**Aceitação:**
- `install write` (sem `--target`) chama `select({ message: 'Where to register kit-mcp?', choices: [...] })` e usa o valor escolhido.
- `sync install` (sem `--target`) idem.
- Em non-TTY ou com stdin fechado: erro claro pedindo `--target` explicitamente.
- Em `--json` mode: sem prompt; exige `--target`, sai com erro descritivo se ausente.
- Choices populadas via `listTargets()` do registry.

## REQ-006 — Diff preview + confirmação em `install write`

**Descrição:** `install write` deixa de escrever imediatamente. Mostra o trecho JSON/TOML que vai ser inserido na config do IDE alvo, pede `y/N`, escreve só após `y`. Flag `--yes` pula o prompt (compatibilidade com CI).

**Aceitação:**
- `install write` exibe um bloco visual mostrando: caminho do arquivo de destino, JSON/TOML do servidor a ser adicionado, e o estado anterior (key existia? estava com config diferente?).
- Confirma com `confirm({ message: 'Apply these changes?', default: false })`.
- Resposta não → exit 0 com `Aborted by user`. Sim → escreve.
- `--yes` ou `--json` mode pula confirm.
- Test integration cobre: with `--yes` aplica; sem `--yes` em non-TTY falha com mensagem útil.

## REQ-007 — Summary panel padronizado ao final de cada comando

**Descrição:** Cada subcomando humano termina com painel resumindo o que foi feito, métricas relevantes, e local do output.

**Aceitação:**
- `summary({ title, rows: [['Label', count, status?]], total })` renderiza:
  ```
  ✓ {title}
  
    {Label}    {count} ✓
    ...
  
    Total: {total} · {hint}
  ```
- Aplicado em: `sync install` (linhas por capability), `sync remove` (linhas por kind removido), `reverse-sync apply` (linhas por strategy resultante), `install write` (linha do escopo + path), `forensics collect/summarize` (linhas por agent).
- Cores: contagens em verde quando >0, dim quando 0; falhas em vermelho.

## REQ-008 — Tests dos primitivos UI

**Descrição:** Os primitivos de `src/core/ui.js` que são determinísticos (formatação de summary, color disable via NO_COLOR, render de progress estático em non-TTY) têm cobertura unit.

**Aceitação:**
- `test/unit/ui.test.js` cobre:
  - `summary({ rows, total })` snapshot ANSI-stripped
  - `c.green(text)` retorna texto sem ANSI quando `NO_COLOR=1` setado
  - `progress` em mode estático (TTY=false) emite linhas ao invés de updating in-place
  - `select` rejeita com mensagem útil quando stdin não é TTY
- Tests integration cobrem: `kit list-agents | grep 'sample-agent'` funciona (no human mode); `kit list-agents --json | jq` parses.

## REQ-009 — README e CHANGELOG atualizados

**Descrição:** README mostra os novos visuais (em texto formatado se asciinema for muito) e documenta `--json` flag. CHANGELOG `[1.1.0]` lista mudanças aditivas.

**Aceitação:**
- README: nova seção "Visual feedback" com exemplo do summary panel + spinner + selector. Seção "CLI reference" tem nota explicando `--json` global flag e que default mudou pra human.
- README: package.json deps section ganha menção a `picocolors` e `@inquirer/prompts`.
- CHANGELOG `[1.1.0]` enumera as 6 features novas + nenhuma breaking change.
- Migração: programas que parsavam JSON do stdout precisam adicionar `--json` flag explícita (1 linha de mudança). README/CHANGELOG documenta isso claramente.

## REQ-010 — Cut da v1.1.0

**Descrição:** Após REQ-001 a REQ-009 fechados, fazer release formal de 1.1.0 via fluxo `npm version minor → push --follow-tags` que dispara o publish.yml + auto GH Release (já existente desde 1.0).

**Aceitação:**
- CHANGELOG `[1.1.0]` populado.
- `package.json` em `1.1.0`.
- Tag `v1.1.0` pushed.
- Release object criado pelo workflow automaticamente, marcado Latest.
- `npm view @luanpdd/kit-mcp version` retorna `1.1.0`.
- Smoke test global: `npm install -g @luanpdd/kit-mcp@latest && kit list-agents` mostra output colorido com summary.

---

## Não-objetivos (explicitamente fora deste milestone)

- **Janela GUI/sidecar paralela** rodando junto da IDE (Claude Code etc) — fica pra **v1.2.0**.
- **TUI complexa** tipo lazygit/htop multi-pane — fora de escopo.
- **i18n** do output (PT/EN automático) — eventual milestone de adoção.
- **Mudanças no protocolo MCP** — server continua JSON-RPC silencioso, só CLI ganha UI.
- **Animações/icons unicode customizados** — usar set padrão minimalista.

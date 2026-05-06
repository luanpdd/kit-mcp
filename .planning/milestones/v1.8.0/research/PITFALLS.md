# Pesquisa de Armadilhas — kit-mcp v1.8 Suíte Supabase

**Domínio:** Pacote de skills/agents Supabase distribuído via kit-mcp para LLMs (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae) que constroem apps Supabase reais para devs.
**Pesquisado:** 2026-05-06
**Confiança:** HIGH (web research em fontes oficiais Supabase 2026, GitHub issues abertas no `supabase/cli`, análise da codebase kit-mcp em `D:\projetos\opensource\mcp\src\core\sync.js` e `registry.js`, histórico de 24+ fases em `MILESTONES.md`).

> **Escopo dual.** Este documento cataloga DUAS classes de pitfalls:
> - **A — Packaging (este milestone)**: erros que podemos cometer ao construir a suíte como kit content (drift kit/ ↔ .claude/, deps budget, agents recursivos, tests para markdown).
> - **B — Supabase (que skills/agents devem prevenir)**: erros que devs Supabase reais cometem em 2026 e NÃO estão cobertos nos 7 guias-fonte do user — cada um vira "anti-pattern" embutido em uma skill/agent específico.
>
> Cada armadilha mapeia para (a) a fase do roadmap v1.8 que a previne e (b) o critério anti-pitfall que aquela fase deve incluir como verificação.

---

## PARTE A — Pitfalls de PACKAGING (este milestone)

### A1. Drift entre `kit/` canonical e `.claude/` stubs após adicionar 14+ items

**O que dá errado:**
A suíte adiciona 8 skills + 6 agents + 1 command ao `kit/`, totalizando 15 novos items. Se um colaborador (ou nós mesmos no fim da sprint, com pressa) editar `.claude/agents/supabase-rls-writer.md` direto em vez de `kit/agents/supabase-rls-writer.md`, na próxima rodada de `kit sync claude-code` o stub é regenerado e a edição local é PERDIDA SILENCIOSAMENTE — o stub sobrescreve sem warning porque tem o `STUB_MARKER` (`<!-- kit-mcp:reference -->`) na primeira linha que autoriza overwrite (`src/core/sync.js:17`).

**Por que acontece:**
- Devs com IDE aberta (Cursor, Claude Code) vêem `.claude/agents/foo.md` e editam ali — é o caminho que o autocomplete do editor sugere primeiro.
- O stub renderizado tem placeholder de description que parece "real conteúdo" — não é óbvio que é gerado.
- Nada no fluxo `git diff` chama atenção: o stub mudou em `.claude/`, parece commit normal.
- Existe precedente real: o bug "Skill da `inserir-fase` com description quebrada" no backlog macro (mostra `<!-- kit-mcp:reference -->` em vez do real description) já é sintoma de drift de parsing.

**Como evitar:**
- **Preflight gate na fase de release**: `kit gates run` deve incluir uma verificação que compila a hash do conteúdo de cada `.claude/<cat>/<name>.md` esperado a partir de `kit/<cat>/<name>.md` e bloqueia commit se houver divergência inesperada (ou seja, content de `.claude/` que não vem do kit canonical).
- **Header de stub anti-edit explícito**: além do `<!-- kit-mcp:reference -->`, adicionar a primeira linha visível **em PT-BR** algo como `> Não edite este arquivo. Edite kit/agents/supabase-rls-writer.md.` (já existe na lib, mas reforçar com referência absoluta full-path).
- **CI test específico**: smoke test em `test/integration/sync-supabase.test.mjs` que: (a) executa `kit sync claude-code`, (b) edita `.claude/agents/supabase-rls-writer.md` localmente (alterar uma linha), (c) executa `kit sync claude-code` de novo, (d) confirma que a edição foi sobrescrita E que o resultado tem o conteúdo do `kit/`.
- **Pre-commit hook opcional** que detecta edições em `.claude/agents/supabase-*.md` quando `kit/agents/supabase-*.md` não foi tocado no mesmo commit.

**Sinais de alerta:**
- PR introduz mudança em `.claude/agents/supabase-*.md` mas não toca em `kit/agents/supabase-*.md`.
- Rodar `kit sync claude-code` localmente "altera" 14 arquivos quando deveria ser idempotente.
- Issue de usuário "agente sumiu" depois de `npx @luanpdd/kit-mcp@latest sync install`.

**Fase para abordar:**
**Fase 25 (lock arquitetural + naming convention)** — definir convenção e adicionar gate; **Fase 32 (release hardening)** — smoke test cross-platform que valida idempotência de sync após edit.

---

### A2. CLAUDE.md regenerado fica longo demais (CLAUDE.md já tem 10.4 KB com 60 commands + 19 agents)

**O que dá errado:**
A suíte adiciona 6 agents + 1 command + 8 skills à listagem auto-gerada de `CLAUDE.md`. O arquivo cresce ~25-30% (de 10.4 KB para ~13-13.5 KB estimado). Em IDEs que carregam CLAUDE.md sempre (Claude Code, Cursor com `rules/`), isso vira tokens fixos por sessão — o tradeoff que v1.6/v1.7 atacaram (lazy-load + workflows compactados, "CLAUDE.md gerado 10→8.5 KB -19%" segundo MILESTONES.md) é desfeito.

**Por que acontece:**
- Cada agent/skill/command adicionado ao kit gera uma linha "**name** — description" em CLAUDE.md automaticamente.
- Descriptions de agents Supabase tendem a ser longas (frontmatter description é usado como "matcher" para LLM decidir invocar — inflate é tentador).
- Não existe modo "categoria" para agrupar 6 agents Supabase + 8 skills Supabase em uma seção condensada.

**Como evitar:**
- **Description budget por agent/skill**: máximo de 200 caracteres na description do frontmatter para items Supabase. Gate no CI (`gates/budget-description.mjs` novo) que reprova items > 200 chars.
- **Agrupamento por prefixo `supabase-`**: na geração de CLAUDE.md, items prefixados com `supabase-` vão para uma sub-seção `## Supabase Suite (carregar quando o usuário menciona supabase, postgres, RLS, edge function, realtime)` em vez de virar 14 linhas individuais no nível raiz. Isso muda `src/core/kit.js` (renderização) — mas é compatível com Stable API.
- **Documentar a meta**: roadmap v1.8 deve declarar que o crescimento de CLAUDE.md target é ≤ +2 KB (i.e., ≤ 12.5 KB total), não ≤ +30%.
- **Verificar lazy-load opção**: a v1.6 introduziu lazy-load de CLAUDE.md gerado — confirmar que a flag funciona em todas IDEs alvo, não só Claude Code (Cursor pode estar carregando eager).

**Sinais de alerta:**
- `wc -c CLAUDE.md` > 13 KB após sync.
- Tokens de boot de sessão Claude Code/Cursor sobem detectavelmente (medir antes/depois com fixture de session report).
- Usuário relata "respostas estão mais lentas" após upgrade para v1.8.

**Fase para abordar:**
**Fase 25** — declarar budget; **Fase 26-28** (escrita de skills) — enforcement por description-budget gate; **Fase 31 (audit pre-release)** — medir crescimento real de CLAUDE.md.

---

### A3. Skills com referências cross-skill quebram em sync stub-only mode (v1.7)

**O que dá errado:**
v1.7.0 introduziu `stubsOnly` mode em `listKit` (`src/core/sync.js:33` — `stubsOnly: mode === 'reference'`) que lê só frontmatter, NÃO o body. Skill `supabase-rls-policies` referencia internamente `supabase-database-functions` no body (`Para SECURITY DEFINER, ver supabase-database-functions/SKILL.md`). Em stub-only mode, esse texto NUNCA é exposto ao LLM via stub — o stub aponta para `kit/skills/supabase-rls-policies/SKILL.md` mas em IDEs que NÃO seguem links (Codex, Gemini single-file mode), a referência é dead-end.

**Por que acontece:**
- v1.7 perf optim assumia que descriptions de frontmatter são suficientes pra "dispatch" de skill — funciona pra skills standalone.
- Suíte Supabase tem dependência semântica entre skills (RLS depende de Database Functions; Migrations depende de Declarative Schema; Realtime depende de RLS).
- Codex/Gemini renderizam para `AGENTS.md`/`GEMINI.md` em modo `single` (registry.js linhas 39 e 48) — não há "follow link" para o canonical.

**Como evitar:**
- **Skills auto-contidas**: cada SKILL.md da suíte deve ser executável SEM ler outra skill. Cross-references viram "ver também" no fim, não dependências mid-content. Audit: cada skill responde a um workflow Supabase completo (criar policy + index, gerar migration + apply).
- **Inline crítico em `references/`**: pattern do exemplo `kit/skills/example-skill/references/` (templates já documenta) — extrair o que é "compartilhado entre skills Supabase" para `kit/skills/_shared-supabase/` e cada SKILL.md inclui (não link, INCLUI) o trecho via `<inline-from path="..." />` resolvido em sync time. Padrão precisa ser implementado em `src/core/sync.js`.
- **Stub-only mode test específico**: `test/integration/sync-stubs-supabase.test.mjs` valida que após `kit sync codex` (modo single, target sem follow-link), o `AGENTS.md` resultante contém todo o conteúdo essencial de cada skill Supabase, não só descriptions.
- **Documentar trade-off no PROJECT.md**: skills Supabase optam por full-content em targets `single`-mode, aceita +N KB no `AGENTS.md`/`GEMINI.md`. Stub mode permanece em `multi`-mode IDEs.

**Sinais de alerta:**
- Usuário Codex relata "agente menciona supabase-database-functions mas não sei o que é" — sintoma de link dead-end.
- `cat AGENTS.md | grep "ver supabase-"` retorna referências que não existem inline.
- Skill description aparece mas o content do SKILL.md nunca é carregado em algum target.

**Fase para abordar:**
**Fase 25** — declarar regra "skills auto-contidas" como REQ duro; **Fase 26 (primeira skill)** — testar em todos 8 targets e validar que content chega; **Fase 31** — auditoria final cross-IDE.

---

### A4. Agents Supabase em IDEs sem MCP server Supabase = fail silencioso

**O que dá errado:**
Os agents da suíte (`supabase-architect`, `supabase-migration-writer`, `supabase-rls-writer`, etc) declaram tools `mcp__0a712001-...__execute_sql` no frontmatter (precedente `schema-checker.md:4`). Quando carregados em uma IDE/projeto que NÃO tem o Supabase MCP server registrado, o agent é invocado mas a tool não existe. O comportamento varia:
- Claude Code: erro "tool not available" — feedback claro mas dev confuso.
- Cursor: pode ignorar silenciosamente e seguir com bash/SQL local.
- Codex: agent não é descoberto pra invocar (não suporta agents).
- Gemini CLI / Windsurf / Antigravity / Copilot / Trae: comportamento variado, em geral degradação silenciosa.

O dev não sabe se o agent fez algo, se falhou, ou se simulou.

**Por que acontece:**
- O kit-mcp não registra o Supabase MCP server — assume que o usuário já tem (registrado em `~/.claude.json`, `~/.cursor/mcp.json`, `~/.codex/config.toml`, etc).
- A discoverability "instale o Supabase MCP server" não é descoberta automaticamente quando o usuário invoca a suíte.
- O hash `0a712001-6cbb-44ef-a5f4-a24ea40894fa` no nome da tool é projeto-específico (UUID Supabase do user — visto em `schema-checker.md`); não funciona em outros projetos.

**Como evitar:**
- **Preflight check no agent**: cada agent Supabase, no Step 0, valida: (a) o tool `mcp__supabase__*` está disponível? Senão, aborta com mensagem amarela "Você precisa registrar o Supabase MCP em sua IDE (instruções em supabase-architect/references/mcp-setup.md)".
- **Fallback degraded mode**: se MCP indisponível, agent oferece o output como SQL bruto (printa migrations/policies para cópia manual) em vez de aplicar. NUNCA finge sucesso.
- **Tool name canonicalization**: substituir hash `0a712001-...` por nome canônico `supabase` (ou `mcp__supabase__execute_sql`) — o user já configurou seu MCP com nome próprio. Documentar no top de cada agent: "Este agent assume MCP server Supabase registrado como `supabase`. Renomeie a referência se seu setup for diferente."
- **Setup skill**: adicionar `kit/skills/supabase-setup/SKILL.md` com (a) como instalar Supabase CLI, (b) como registrar MCP server na IDE atual, (c) como obter project_id. É a primeira coisa que o `supabase-architect` invoca se preflight falha.
- **Cross-IDE test**: smoke test que carrega cada IDE supported (mock-able via configurações) e valida que a invocação de um agent Supabase sem MCP retorna mensagem útil em ≥ 6/8 targets.

**Sinais de alerta:**
- Agent supabase invocado mas o resultado é texto vago "sugiro a seguinte migration..." sem aplicar nem confirmar.
- Logs de erro silenciados em sessões de IDE não-Claude Code.
- Issue de usuário "supabase-rls-writer não fez nada".

**Fase para abordar:**
**Fase 25** — REQ "preflight check obrigatório em todo agent supabase-*"; **Fase 27 (primeiros agents)** — implementar o preflight; **Fase 30 (cross-IDE validation)** — testar em ≥ 4 IDEs reais.

---

### A5. Naming colisão com `schema-checker` existente (já no kit)

**O que dá errado:**
O kit já tem `schema-checker` como agent (visto em `kit/agents/schema-checker.md`). Adicionar `supabase-architect` que também valida schema cria sobreposição: qual o LLM invoca? Confusão de domínio resulta em fluxos divergentes — `schema-checker` valida ANTES de aplicar (pré-migration), `supabase-architect` projeta schema ANTES de escrever migration. Ambos tocam Postgres+Supabase.

**Por que acontece:**
- Frontmatter `description` de ambos menciona Supabase + schema. LLM matcher escolhe baseado em closeness semântica — pode dar ambíguo.
- Tools overlap: ambos usam `mcp__0a712001-...__execute_sql` e `mcp__0a712001-...__list_tables`.
- Ordem de invocação correta é `supabase-architect` → `supabase-migration-writer` → `schema-checker` → apply, mas nada no kit força essa ordem.

**Como evitar:**
- **Cláusula de "quando NÃO invocar"** explícita em cada agent supabase-* e em schema-checker. Schema-checker continua sendo "validador pré-migration" (entrada: SQL + project_id, saída: GO/NO-GO). supabase-architect é "designer pré-migration" (entrada: domain spec, saída: schema SQL files). Disjuntos por contrato de input.
- **Comando `/supabase` orquestrador**: o slash-command roteia explicitamente — `/supabase migration` invoca migration-writer, `/supabase schema` é arquiteto, `/supabase check` é schema-checker. Remove ambiguidade do LLM matcher.
- **Renomear frontmatter description**: schema-checker existing description menciona "valida foreign keys, colunas e tabelas referenciadas em uma migration SQL ANTES de aplicá-la". Reforçar: "Use APÓS gerar a migration, ANTES de apply_migration." vs supabase-architect: "Use ANTES de gerar a migration, na fase de design."
- **Dedicar uma seção em CLAUDE.md** (parte do agrupamento de A2) que documenta ordem canônica: design → write → check → apply. Visual flowchart inline.

**Sinais de alerta:**
- LLM invoca `schema-checker` no design phase (não há SQL para checar ainda) e o agent retorna sem nada útil.
- Usuário pergunta "qual eu uso?".
- Dois agents respondem em ondas (paralelo) gerando saídas conflitantes.

**Fase para abordar:**
**Fase 25 (naming + overlap audit)** — formalizar contrato de input/output disjunto; **Fase 32 (final docs)** — fluxograma na README + CLAUDE.md.

---

### A6. Workflows declarative-schema → db diff → apply migration precisam de hooks customizados — risco de quebrar em IDEs sem suporte a hooks

**O que dá errado:**
O fluxo Supabase canônico (declarative schema) é: (1) editar `supabase/schemas/*.sql`, (2) `supabase db diff -f <name>` gera migration, (3) `supabase db push` aplica. Para automatizar isso via agents do kit, é tentador adicionar um hook PostToolUse `supabase-post-diff.js` que roda após cada `db diff` para auto-rodar `schema-checker`. Mas hooks são `mode: mirror-tree` (registry.js: `hooks: { path: '.claude/hooks/', mode: 'mirror-tree', source: 'hooks' }`) — só Claude Code tem `hooks` capability no registry. **Outras 7 IDEs não suportam hooks** — a automação não roda lá; usuário Cursor/Codex/Gemini não tem o gate.

**Por que acontece:**
- Hooks do framework foram desenhados para Claude Code (precedente: `kit/hooks/post-apply-migration.js` referenciado em MILESTONES.md v1.4.0 e `sidecar-tool-publisher.js` v1.6).
- Devs de outras IDEs ficam com fluxo "manual" — provável que pulem o schema-checker porque é uma etapa a mais.
- Inconsistência cross-IDE: feature critica de segurança (validar antes de apply em produção) só funciona em uma IDE.

**Como evitar:**
- **Não usar hooks como gate único**: schema-checker invocação deve ser parte do contrato do `supabase-migration-writer` (last step interno do agent), não dependente de hook. Quem invocar o writer ganha o check de graça em qualquer IDE.
- **Hook é "extra polish" não "gate"**: o hook `supabase-post-diff.js` (se criado) só faz trace/log de eventos para sidecar UI; nunca bloqueia.
- **Fallback CLI command**: `/supabase check <migration>` invoca schema-checker manualmente — disponível em IDEs com slash-command capability (Claude Code, Cursor sim; Codex/Gemini não). Para os sem slash-command, agent `supabase-migration-writer` SEMPRE invoca schema-checker como sub-step.
- **Cross-IDE coverage matrix**: documentar em `.claude/framework/references/supabase-workflow-by-ide.md` qual fluxo funciona em qual IDE (Claude Code: full; Cursor: full menos hook; Codex: agent-driven; etc).

**Sinais de alerta:**
- Bug report "migration aplicada com erro de FK" de usuário Cursor — sintoma do schema-checker não ter sido chamado.
- Issue "como faço o schema check no Codex?".

**Fase para abordar:**
**Fase 25** — REQ "schema-check é parte do agent, não do hook"; **Fase 27 (migration-writer)** — implementar embutido; **Fase 30 (cross-IDE)** — matriz documentada.

---

### A7. Tests para conteúdo Markdown — como validar que skill X realmente ensina o que diz ensinar?

**O que dá errado:**
Skills são markdown. Code coverage é zero. Como saber se `supabase-rls-policies` realmente ensina a usar `(select auth.uid())` em vez de `auth.uid()` direto, quando a alternativa "ensina sutilmente errado" passaria em todos os tests da v1.7 (que só checam frontmatter + presença de arquivos)? Sem teste semântico, qualquer dev (ou Claude futuro) pode editar a skill e quebrar a expertise sem fail.

**Por que acontece:**
- Tests existentes do kit-mcp são structurals: arquivo existe, frontmatter parseável, sync funciona.
- Conteúdo "técnico correto" não é testável por unit test trivial.
- Tentação: pular testes ("é só markdown") — mas é o coração do entregável.

**Como evitar:**
- **Audit gate "must-include strings"**: cada skill da suíte declara em metadata interno (no frontmatter custom field `must_include: ["select auth.uid()", "create index", "for select"]`) lista de phrases obrigatórias. Gate `gates/skill-must-include.mjs` faz `grep -c <phrase> <file>` para cada e reprova se ausente. Detecta degradação sem testar semântica completa.
- **Audit gate "must-NOT-include strings"**: lista negativa — `auth.uid() = user_id` (sem select wrapper) é red flag em uma skill que ensina performance. Gate reprova.
- **Snapshot fixture cruzado**: para cada skill, ter `fixtures/<skill>/example-task.md` com a tarefa "criar policy de SELECT em tabela X" e `fixtures/<skill>/expected-output.md` com a SQL esperada. Test integration: invoca o LLM (mock-em-CI ou skip-em-CI mas roda em pre-release) com a skill carregada, compara output com expected (allow fuzzy match em SQL com normalização).
- **Real-Supabase smoke (manual, pre-release)**: 1× por release, pega 3 das skills "core" (RLS, Migrations, Edge Functions) e roda o workflow end-to-end em uma branch real do Supabase. Documenta resultado no CHANGELOG.

**Sinais de alerta:**
- Skill alterada num PR mas não há diff em fixtures/audit gate output.
- `must-include` test passa mas `must-NOT-include` falha (skill agora contém anti-pattern).
- Skill aprovada manualmente sem alguém rodar o snippet.

**Fase para abordar:**
**Fase 25 (test infra)** — desenhar gates `must-include` e `must-NOT-include`; **Fase 26-29 (escrita)** — cada skill declara seus must/must-not; **Fase 31 (audit)** — smoke real em Supabase branch.

---

### A8. Sync stub-only mode (v1.7 perf optim) — perde body de skill = perde a expertise

**O que dá errado:**
Stub-only mode é a otimização default desde v1.7. Para skills da suíte, isso é inadequado: o body de `supabase-rls-policies/SKILL.md` é justamente a expertise (regra do `(select)`, regra do indexing, exemplos). Se em IDE multi-target (Claude Code, Cursor) o stub aponta para `kit/skills/.../SKILL.md`, mas em IDE single-target (Codex `AGENTS.md`, Gemini `GEMINI.md`), o resolver inline o full-body — diferente da suposição "stubs everywhere".

**Por que acontece:**
- v1.7 PERF-S1 mediu speedup em listKit cold (1.79×) — métrica é throughput de listagem, não cobertura de conteúdo entregue.
- Para agents/commands de meta-trabalho do framework (planner, executor), descriptions de frontmatter SÃO suficientes — a invocação carrega o body inline na hora.
- Para skills de domínio (Supabase), o body precisa estar visível ao LLM no carregamento da sessão (Claude Code: no momento do match) ou inline (Codex: tudo em AGENTS.md ou nada).

**Como evitar:**
- **Categoria "skill_full_content" no kit**: declarar no frontmatter `mode: full` (ou top-level config em `kit/skills/_config.json`) que `supabase-*` skills NÃO participam de stub-only mode em targets `single`. Para targets `multi-dir`, stub permanece (LLM segue link).
- **Concretamente**: alterar `src/core/sync.js` para que `stubsOnly` respeite um override per-skill. Mantém stub default (perf preservado pra 90% dos skills) e força full-content nos críticos.
- **Documentar trade-off**: PROJECT.md adiciona "Skills Supabase aumentam o tamanho de AGENTS.md/GEMINI.md em ~X KB cada — esperado e necessário para que LLMs nessas IDEs tenham acesso à expertise."
- **Medir**: antes/depois de sync, o `wc -c AGENTS.md` deve crescer ~Y KB e isso é acceptance criterion da fase de release.

**Sinais de alerta:**
- Codex usuário "fala que sabe RLS" mas dá conselho errado (= não tem o body).
- `grep "select auth.uid()" AGENTS.md` retorna zero matches após sync.
- Skill loading benchmark mostra speedup mantido em meta-skills mas overhead +X% em supabase-* — esperado.

**Fase para abordar:**
**Fase 25** — decidir override mechanism; **Fase 26 (primeira skill)** — implementar e medir; **Fase 31** — confirmar AGENTS.md crescimento dentro do budget declarado.

---

### A9. Deps budget de 6 pacotes já está no limite — qualquer dep nova quebra o gate

**O que dá errado:**
package.json tem 6 deps (alinhado com MILESTONES.md v1.2.0: "1 dep nova: open@11. Única; budget atingido em 6/6"). Se durante a implementação da suíte alguém pensar "vamos usar `pg` para validar SQL" ou "vamos usar `js-yaml` para parsing custom de skill metadata", o gate `deps-budget` falha.

**Por que acontece:**
- Tentação de "reusar lib existente" para parsing/SQL/yaml — devs hábito de npm.
- Não óbvio para colaboradores novos que o budget é hard-cap.
- A própria mensagem do gate (mencionada como "synced com count real" em v1.6) precisa ser checada se ainda funciona.

**Como evitar:**
- **REQ pré-implementação**: roadmap declara "+0 deps. Toda parsing/validation usa Node builtins ou implementação inline (<50 LOC cada)". Reforça PROJECT.md "Pacote pequeno, dependências mínimas".
- **Smoke gate test**: `gates/deps-budget.mjs` rodar em CI a cada PR, com mensagem clara. Já é o caso (v1.6) mas reverificar.
- **Implementations inline para casos comuns**:
  - SQL parsing leve (extrair `CREATE TABLE`, `REFERENCES`): regex top-level (~30 LOC) — precedente em `schema-checker.md` step 2.
  - YAML/JSON5: nada além de `JSON.parse` + frontmatter já existente (kit-mcp já parseia frontmatter sem dep extra).
  - SQL formatting / pretty-print: identation manual via String.prototype.replace.

**Sinais de alerta:**
- PR adiciona linha em `package.json` em `dependencies`.
- CI gate `deps-budget` em vermelho.
- Comentário de PR "vamos só adicionar essa libzinha…".

**Fase para abordar:**
**Fase 25** — REQ explícito; **toda fase de escrita (26-31)** — gate ativo no CI.

---

### A10. Agents Supabase em loop recursivo — supabase-architect chama supabase-migration-writer chama supabase-architect

**O que dá errado:**
A orquestração natural Supabase é "design schema → escrever migration → checar → aplicar". Tentação: `supabase-architect` invoca `supabase-migration-writer` no fim ("aqui está o schema, peça à migration-writer para gerar SQL"). Migration-writer percebe gap no design e re-invoca architect ("preciso definir a constraint X"). Loop. Em IDEs com sub-agent dispatch (Claude Code suporta via Task tool, Cursor não), pode causar:
- Stack overflow lógico.
- Custo: cada invocação é uma chamada de LLM full.
- Inconsistência: cada round adiciona suposições não validadas.

**Por que acontece:**
- Cada agent quer ser "completo" e dispara o próximo da cadeia.
- Não há "orchestrator-only invocation" rule.
- Precedente `schema-checker.md` é bem comportado (recebe input do caller, retorna veredito) — outros agents podem não seguir esse padrão.

**Como evitar:**
- **Regra "agents Supabase NÃO invocam outros agents Supabase"**: invocação de cadeia é responsabilidade do **command `/supabase`** (orquestrador) ou do orchestrator humano (LLM principal). Cada agent é "função pura" — recebe input, retorna output, sem chamar peers.
- **Audit gate**: `gates/agent-no-recursive-dispatch.mjs` faz `grep -c "Task\|invoke.*supabase-" kit/agents/supabase-*.md` e reprova se um agent supabase-* menciona invocação de outro como ação (não como "veja também").
- **Documentar fluxo**: o slash-command `/supabase` (kit/commands/supabase.md) é o único orquestrador. Ele recebe subcomando (`schema|migration|rls|edge|realtime|auth|check`) e dispatcha o agent correto sequencialmente. Se precisa multi-passo, o command coordena, não os agents.
- **Tests**: integration test que invoca cada agent isolado, valida output, e confirma que o agent NÃO tentou invocar peer.

**Sinais de alerta:**
- Sessão de Claude Code consome 50k tokens só "discutindo" entre supabase-architect e supabase-migration-writer.
- Output final é circular (architect repete o input do migration-writer).
- Test de unit "agent sozinho" falha porque tenta dispatch.

**Fase para abordar:**
**Fase 25** — REQ "agents são função pura, command é orquestrador"; **Fase 27 (agents)** — gate ativo; **Fase 28 (command /supabase)** — orquestração explícita.

---

### A11. Idioma misto na suíte — frontmatter description em PT-BR mas conteúdo técnico em EN da fonte oficial

**O que dá errado:**
Os 7 guias-fonte do user são em EN (docs Supabase oficial). Tradução literal para PT-BR perde nuances ("policy enforcement order" vira "ordem de aplicação de policy"... que tipo? FOR SELECT?). Tradução mista (description PT-BR, body PT-BR mas SQL examples + termos técnicos em EN tipo "JWT", "claim", "service_role") fica inconsistente. Sintoma: LLM matcher descobre skill por description PT-BR, mas conteúdo é EN, gera output em mix bizarro pro dev.

**Por que acontece:**
- Decisão "Conteúdo em PT-BR (alinhado com o resto do kit)" do PROJECT.md.
- Realidade: termos técnicos Supabase não traduzidos consistentemente em comunidade (RLS = RLS, mas "policy" = "política"? "row" = "linha"?).
- Tentação de copy-paste do guia EN para o body, traduzindo só intro.

**Como evitar:**
- **Glossário canonical**: `kit/skills/_glossary-supabase.md` com termos chave Supabase em PT-BR + EN (Row Level Security → "controle de acesso por linha (RLS)"). Cada skill referencia via link no header.
- **Regra de tradução**: PT-BR para narrativa e instruções ao LLM; EN para nomes de tools/funções/SQL ("execute SELECT", não "execute SELECIONAR"). Code blocks SQL ficam EN puros.
- **Fixture de validação de tradução**: cada skill tem 2-3 frases-chave traduzidas que o audit verifica (`grep -c "controle de acesso por linha" supabase-rls-policies/SKILL.md > 0`).
- **Spot-check humano**: pre-release, ler o output do LLM com cada skill em sessão real e checar coherence.

**Sinais de alerta:**
- Skill mistura "use o command UPDATE para atualizar a policy" (anglicismo).
- LLM responde em PT-BR ao usuário mas comenta SQL em PT-BR (`-- SELECIONAR todos os usuários`).
- Reviews "isso não soa natural".

**Fase para abordar:**
**Fase 25** — criar glossário; **Fase 26-29 (escrita)** — todos seguem o glossário; **Fase 31 (audit)** — spot-check qualidade.

---

### A12. Hash de tool MCP (`mcp__0a712001-...`) é projeto-específico, não distribui

**O que dá errado:**
`schema-checker.md` declara tools `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql`. Esse UUID é o ID do projeto Supabase **do user**. Distribuído via `@luanpdd/kit-mcp@1.8.0`, esse hash é fixo e inválido para qualquer outro user. Resultado: agent pa nuvem em `npm install`.

**Por que acontece:**
- O kit-mcp foi originalmente o "kit pessoal do user" — IDs próprios eram OK.
- A v1.8 promove a suíte como "produto" para outros devs — pessoalidade vira liability.
- O hash já está em produção em `schema-checker.md` (não é regression nova; é tech debt herdado).

**Como evitar:**
- **Substituir por nome canonical configurável**: `mcp__supabase__execute_sql` (assume nome `supabase` no `mcp.json` do user). Documentar isso.
- **Setup skill**: `supabase-setup` (já mencionado em A4) instrui o usuário a registrar o MCP server com nome `supabase` na primeira execução.
- **Variável de configuração**: alternativa, env var `KIT_SUPABASE_MCP_NAME` (default `supabase`) que agents usam para construir o nome da tool dinamicamente. Mas: tools no frontmatter são literais; não suporta interpolação. Solução pragmática: doc + nome canônico fixo.
- **Audit gate `gates/no-personal-uuid.mjs`**: reprova frontmatter de qualquer agent que contenha um UUID na string `tools` (regex `[0-9a-f]{8}-[0-9a-f]{4}-...`).
- **Migrate schema-checker existente**: rebatizar `mcp__0a712001-...` para `mcp__supabase__*` na v1.8 (breaking interno; documentar no CHANGELOG).

**Sinais de alerta:**
- `kit list-agents` em projeto novo de outro user; agent supabase falha em primeira invocação.
- Discord/issue "instalei kit-mcp e o agent supabase quebra".

**Fase para abordar:**
**Fase 25** — REQ "nomes canônicos de tools, sem UUIDs"; **Fase 32 (release)** — audit gate + migration de schema-checker existente.

---

## PARTE B — Pitfalls do SUPABASE (que skills/agents devem prevenir)

> Não cobertos nos 7 guias-fonte do user (Realtime, Auth SSR, Edge Functions, Declarative Schema, RLS, DB Functions, Migrations, Postgres Style). Cada um vira anti-pattern explícito embutido na skill/agent responsável.

### B1. Cost gotcha — Realtime Peak Connections quota explode com WebSockets sem desconexão

**Sintoma:** Bill mensal sobe inexplicado mesmo com poucos usuários ativos. Dashboard Supabase mostra "Realtime Peak Connections" em 5000+ quando o app tem 200 usuários reais.

**Causa raiz:** `$0.00 base + $10/1000 peak connections beyond plan quota` ([Supabase Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)). Cada `supabase.channel(...)` aberto que NÃO é fechado em unmount/cleanup permanece como conexão ativa. SPA users abrindo várias abas, hot-reload em dev, ou navegação SSR sem cleanup acumulam centenas de conexões fantasmas. Peak é o pior momento do mês — single bad deploy basta.

**Prevenção:**
- Em `supabase-realtime`: REGRA "toda chamada `supabase.channel()` PRECISA ter `supabase.removeChannel(channel)` em cleanup (`useEffect return`, `onDestroy`, page navigation). Padrão React/Vue/Svelte com snippets explícitos."
- Anti-pattern documentado: "channel created in module scope without cleanup" — explicit "DO NOT" code block.
- Em `supabase-realtime-implementer` (agent): preflight valida que o caller já tem cleanup pattern; senão, recusa gerar e retorna instrução para refatorar primeiro.

**Skill/agent responsável:** `supabase-realtime` (skill) + `supabase-realtime-implementer` (agent).

---

### B2. Free tier — Projeto pausa após 7 dias inativos, perde acesso silenciosamente

**Sintoma:** Dev volta de férias, abre app de side-project, request 503 ou hangs. Dashboard Supabase mostra "Project paused due to inactivity". Reativação manual demora minutos (ou horas — issue [#37453](https://github.com/supabase/supabase/issues/37453) "resuming project taking a long time").

**Causa raiz:** [Free Plan policy](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a): aplicações com baixa atividade em 7 dias rolling são pausadas. Critério "atividade" não 100% claro — alguns relatos sugerem que mesmo health checks externos não contam se não tocam DB de fato. Restorable em 90 dias após pause; depois disso, projeto vai a zero.

**Prevenção:**
- Em `supabase-setup` (skill): WARNING destacado "Free Plan tem auto-pause em 7 dias. Para projetos hobby/portfolio, configure cron externo (GitHub Action gratuita) que toca `select count(*) from auth.users` semanalmente — heartbeat real ao DB."
- Snippet de GitHub Action pronta para copy-paste, executando 1× por semana.
- Em `supabase-architect` (agent): pergunta upfront "este é projeto Free ou Pro?". Se Free, adiciona warning final "Lembre-se: configure heartbeat. Setup file `.github/workflows/supabase-keepalive.yml` foi criado."

**Skill/agent responsável:** `supabase-setup` (nova skill, A4) + `supabase-architect` (agent).

---

### B3. Migration drift — `db reset` em prod = catástrofe; declarative schema vs migrations conflict

**Sintoma:** Dev edita `supabase/schemas/users.sql`, roda `supabase db diff -f update`, gera migration. Aplicar em staging ok. Em prod, falha porque migration anterior já tinha alterado `users` de forma que diff não captura ([cli/issues/3974](https://github.com/supabase/cli/issues/3974) "db diff with declarative schemas misses auth triggers, realtime publications, and schema privileges").

**Causa raiz:** Declarative schema gera diff comparando "estado declarado" vs "estado local". Se prod divergiu (hotfix manual via dashboard, migration de outro dev mergeada), o diff é INCORRETO. `supabase db reset` apaga local DB e reaplica migrations do zero — fatal em prod (perda total de dados).

**Prevenção:**
- Em `supabase-declarative-schema`: WARNING absoluto "NUNCA rode `supabase db reset` em prod. NUNCA aplique migration gerada por `db diff` sem antes (a) puxar `db pull` de prod, (b) revisar diff manualmente, (c) testar em branch."
- Workflow obrigatório: pull from prod → edit schema → diff → review SQL diff manually → apply em branch → smoke test → merge.
- Em `supabase-migration-writer` (agent): step 0 obrigatório: `supabase db pull` antes de qualquer `db diff`. Se há mudanças não commitadas vindas do pull, ABORT e instrui usuário a sincronizar primeiro.
- Conhecer issues conhecidas: auth triggers, realtime publications, schema privileges NÃO são capturados por db diff. Skill lista explicitamente "se você modificou X, Y, Z, escreva migration manual."

**Skill/agent responsável:** `supabase-declarative-schema` (skill) + `supabase-migrations` (skill) + `supabase-migration-writer` (agent).

---

### B4. RLS performance trap — `auth.uid()` direto em policy + sem index = query 1000× mais lenta

**Sintoma:** Tabela com 100k rows. Query `select * from posts where user_id = auth.uid()` que rodava em 50ms passa a 5s+. EXPLAIN ANALYZE mostra "Filter: (user_id = auth.uid())" ao longo de scan completo.

**Causa raiz:** [docs Supabase RLS performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv): `auth.uid()` é function call. Sem `(select)` wrapper, Postgres avalia 100k vezes. Sem index em `user_id`, scan completo. Combo: 100k function calls + sequential scan = 100× degradation real (até 1000× em casos extremos com joins).

**Prevenção:**
- Em `supabase-rls-policies`: REGRA #1 absoluta "USE `(select auth.uid())` SEMPRE em policy expressions. Wrapper subquery permite Postgres cachear initPlan."
- REGRA #2 "Toda coluna usada em policy WHERE clause precisa de index. Padrão: `create index <table>_<col>_idx on <table> using btree (<col>);`"
- Anti-pattern explícito (DO NOT) com EXPLAIN ANALYZE dos dois cases lado-a-lado.
- Em `supabase-rls-writer` (agent): SEMPRE gera (a) policy com `(select auth.uid())`, (b) `CREATE INDEX` correspondente em mesma migration. Output dual.
- Em `supabase-rls-policies`: separa policies por operação (`for select`, `for insert`, `for update`, `for delete`) em vez de `for all` — performance + clarity. Anti-pattern: `for all using (...)`.

**Skill/agent responsável:** `supabase-rls-policies` (skill) + `supabase-rls-writer` (agent).

---

### B5. Auth gotcha — `user_metadata` em RLS policy = bypass authorization (CRITICAL security)

**Sintoma:** App tem feature gate "is_premium" que checa `auth.jwt() -> 'user_metadata' ->> 'plan' = 'premium'`. Usuário usa supabase-js no console: `await supabase.auth.updateUser({ data: { plan: 'premium' } })`. Acabou de ganhar premium grátis. Nenhum log, nenhum alert.

**Causa raiz:** [docs Supabase auth managing](https://supabase.com/docs/guides/auth/managing-user-data) + [splinter linter rule](https://supabase.github.io/splinter/0015_rls_references_user_metadata/): `user_metadata` é editável pelo usuário via `auth.updateUser()`. `app_metadata` NÃO é (only service_role pode alterar). Documentação Supabase tinha exemplo errado por anos ([issue #20997](https://github.com/supabase/supabase/issues/20997)).

**Prevenção:**
- Em `supabase-auth-ssr` + `supabase-rls-policies`: WARNING absoluto "**NUNCA use `user_metadata` em RLS policies para autorização.** Use `app_metadata` exclusivamente."
- Anti-pattern explícito + exploit chain documentada (passo a passo do que o usuário consegue fazer).
- Para storage de claims user-controlled (preferences, theme, language): user_metadata OK.
- Para roles, plans, permissions, team membership: app_metadata only.
- Em `supabase-rls-writer` (agent): scan policy SQL para `user_metadata` references. Se encontrar em context não-cosmético, ABORT com erro vermelho e explica o exploit.

**Skill/agent responsável:** `supabase-auth-ssr` (skill) + `supabase-rls-policies` (skill) + `supabase-rls-writer` (agent).

---

### B6. Auth gotcha — service_role key em client-side = banco inteiro exposto

**Sintoma:** App em produção. Atacante abre devtools, encontra `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` em variável JS bundle. Faz `select * from auth.users` direto, dump completo. Empresa descobre 6 meses depois via breach notification.

**Causa raiz:** [docs API keys](https://supabase.com/docs/guides/getting-started/api-keys) + [GitGuardian remediation](https://www.gitguardian.com/remediation/supabase-service-role-jwt): `service_role` bypassa RLS por design. Confusão fácil com `anon` key (também JWT, nomes parecidos). Um typo em `NEXT_PUBLIC_*` (Next.js convenção: prefixo expõe pro browser) = catastrophe. Tooling como Lovable/v0/Cursor já fizeram esse mistake em produção real ([Lovable case 2026](https://gptsters.com/fix/lovable/service-role-key-exposed)).

**Prevenção:**
- Em `supabase-auth-ssr`: REGRA absoluta "**`service_role` NUNCA em client. NUNCA em variável `NEXT_PUBLIC_*`. NUNCA em `.env.local` lido pelo browser. APENAS em server-side env (`SUPABASE_SERVICE_ROLE_KEY` sem prefixo).**"
- Audit grep em projeto: detectar `NEXT_PUBLIC_*SERVICE*` ou `service_role.*window` ou similares.
- Em `supabase-auth-bootstrapper` (agent): scan `.env*` files do projeto, alerta amarelo se detecta misnaming. Cria `.env.example` correto.
- Documentar key rotation flow se exposed: rotacionar via dashboard, audit logs, cleanup downstream.
- WARNING sobre `anon` key também: ela respeita RLS mas se RLS estiver mal configurada, vira leak vector.

**Skill/agent responsável:** `supabase-auth-ssr` (skill) + `supabase-auth-bootstrapper` (agent) + `supabase-setup` (skill).

---

### B7. SECURITY DEFINER sem `search_path` = SQL injection vector

**Sintoma:** Função `public.calculate_user_stats()` declarada `SECURITY DEFINER`. Atacante cria tabela `public.users` na sua schema e injeta. Função executada pela owner (postgres role com superuser equiv) lê a tabela do atacante. Privilege escalation completo.

**Causa raiz:** [docs database advisors lint 0011](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0011_function_search_path_mutable): `SECURITY DEFINER` runs com permissions do owner, ignora RLS. Sem `search_path` explícito, Postgres resolve names via search_path do invoker, que pode ser modificado.

**Prevenção:**
- Em `supabase-database-functions`: REGRA absoluta "Toda função `SECURITY DEFINER` PRECISA ter `SET search_path = ''` (vazio) E qualifica TODAS as referências com schema (`public.users`, não `users`)."
- Anti-pattern explícito: function sem search_path → vulnerable. Function com `SET search_path = public` → ainda vulnerable se atacante tem write em public. Function com `SET search_path = ''` + qualified names → secure.
- Default-secure: prefer `SECURITY INVOKER` (default) sempre que possível.
- Em `supabase-database-functions` + `supabase-migration-writer`: gates check toda function declaration. Se `SECURITY DEFINER` sem `SET search_path = ''` + qualified names → ABORT.
- Lint advisor `0011_function_search_path_mutable` deve ser parte do workflow `/supabase check`.

**Skill/agent responsável:** `supabase-database-functions` (skill) + `supabase-migration-writer` (agent).

---

### B8. Branch databases — preview branches NÃO cobertas pelo Spend Cap

**Sintoma:** Time tem spend cap de $50/mês. Cria 4 preview branches por PR durante sprint. PRs ficam abertas 2 semanas. Bill final: $200+ ($0.01344/h × 24h × 14d × 4 branches = ~$18, somado a egress/storage por branch). Spend cap NÃO bloqueia.

**Causa raiz:** [Supabase Branching docs](https://supabase.com/docs/guides/platform/manage-your-usage/branching) + [pricing 2026](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance): "Branches are not covered by the Spend Cap." Compute, PITR, IPv4, replicas, drains, e várias outras lines billam mesmo com cap on. Persistent branches (vs preview) não pausam — billam 24/7 até deleted.

**Prevenção:**
- Em `supabase-migrations` + `supabase-architect`: WARNING "Preview branches custam ~$10/mês cada se ficarem abertas. Persistent branches NUNCA pausam — verifique uso semanal."
- Workflow recomendado: `supabase branches delete <branch>` automaticamente ao merge/close de PR. GitHub Action template.
- Em `supabase-architect` (agent): se detecta uso de branching no projeto, alerta sobre cost + recomenda workflow de cleanup.
- Anti-pattern: criar persistent branch para "staging" e esquecer (pais charge mensal).

**Skill/agent responsável:** `supabase-migrations` (skill) + `supabase-architect` (agent).

---

### B9. Edge Functions cold start — função grande + npm:imports = 1-3s latency primeira request

**Sintoma:** Webhook handler (Stripe, GitHub) deployado como Edge Function. Hits ocasionais (1× por hora). Cada hit demora 2-3s antes de retornar 200. Stripe webhook timeout (5s) mata alguns. Reentrega = duplicado processing.

**Causa raiz:** [docs Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture): cold start típico ~400ms median, mas escala com:
- Tamanho do bundle (cada `npm:` import puxa pacote inteiro do CDN ESZip).
- Quantidade de functions deployed (cada uma é instance separada).
- Region distance.

`EdgeRuntime.waitUntil` ajuda em fire-and-forget mas NÃO reduz cold start.

**Prevenção:**
- Em `supabase-edge-functions`: REGRA "minimize bundle size. Imports `npm:` cuidadosamente — cada um pesa." Lista de packages "evitar" (lodash full, heavy SDKs) com alternativas (`jsr:@std/datetime` em vez de moment).
- Pattern recomendado: poucos functions grandes (combinar related logic) > muitas functions pequenas.
- WARNING sobre webhook timeouts: para Stripe (5s), GitHub (10s), use `EdgeRuntime.waitUntil` para ack rápido + processamento async.
- Em `supabase-edge-fn-writer` (agent): mede bundle size estimado antes de deploy. Se > X KB, alerta + sugere split.

**Skill/agent responsável:** `supabase-edge-functions` (skill) + `supabase-edge-fn-writer` (agent).

---

### B10. Storage — bucket marcado public por engano = listing aberto + bypass

**Sintoma:** Dev cria bucket `user-avatars` no dashboard, marca "Public" para servir imagens fácil. Atacante descobre via DNS lookup do projeto + listagem `https://<project>.supabase.co/storage/v1/object/list/user-avatars` — vê todos os avatares de todos os usuários, incluindo avatares de admin com IDs sequenciais que vazam structure.

**Causa raiz:** [docs storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) + [discussion #6458](https://github.com/orgs/supabase/discussions/6458): bucket "Public" significa GET de OBJECT URL sem auth. Mas LIST endpoint pode estar aberto. Combinado com IDs previsíveis = enum attack.

**Prevenção:**
- Em `supabase-edge-functions` + nova `supabase-storage` (sub-skill ou seção): REGRA "Public buckets só para conteúdo realmente público (logos, marketing assets). Para user content (avatars, uploads): private bucket + signed URLs com expiração curta."
- Anti-pattern: "marquei public porque era mais fácil". Documentar exploit step-by-step.
- Em `supabase-architect`: ao designar storage layout, pergunta tipo de conteúdo. Se "user-uploaded" → private mandatory.
- Bonus pitfall: image transformations billam mesmo em public bucket — atacante pode requisitar `?transform=...` em loop e gerar bill ([discussion #3564](https://github.com/orgs/supabase/discussions/3564)).

**Skill/agent responsável:** `supabase-architect` (agent) + nova section `supabase-storage` (em skill `supabase-edge-functions` ou skill própria).

---

### B11. pgvector — extension NOT enabled, ivfflat vs hnsw escolha errada, dim mismatch silencioso

**Sintoma 1:** `create extension vector` falha com "extension not available" — devs no plan errado.
**Sintoma 2:** Inserts de embeddings 1536-dim funcionam. Index criado com dim=512 (typo). Queries retornam zero results, sem erro.
**Sintoma 3:** Tabela com 10k embeddings + ivfflat index. Após 100k inserts, queries 100× mais lentas que esperado.

**Causa raiz:**
- Free plan permite vector extension; mas algumas regions/features podem não. Verificar.
- pgvector NÃO valida dim no insert vs index — type `vector(1536)` aceita qualquer length se index é em outra column ou dim diferente.
- ivfflat tem "centroids" calculados no momento do create — não se atualiza. HNSW se atualiza durante writes ([docs hnsw vs ivfflat](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)).
- Limite hard de 2000 dims em ambos; > 2000 precisa `halfvec` type.

**Prevenção:**
- Skill nova ou seção em `supabase-database-functions` + `supabase-migrations`: "pgvector setup checklist": (a) `create extension if not exists vector;`, (b) coluna sempre `vector(N)` com N explícito, (c) **HNSW preferred over ivfflat para data que cresce**, (d) dim do index DEVE bater com dim de inserts (audit query).
- Default decision matrix: dataset estável + memory-constrained → ivfflat. Dataset crescendo + recall importa → hnsw.
- Em `supabase-architect`: ao designar feature de embeddings/AI, valida plan + region + extension availability + escolha de index.

**Skill/agent responsável:** Nova `supabase-pgvector` skill (recomendado) ou seção em `supabase-database-functions` + `supabase-architect`.

---

### B12. Type generation — `supabase gen types` drift, ordering inconsistente em CI

**Sintoma:** Dev roda `supabase gen types typescript --local > types.ts`. CI build fail com "git diff shows uncommitted changes in types.ts" mesmo dev tendo committed. Re-run local: types diferentes a cada vez ([cli/issue #3900](https://github.com/supabase/cli/issues/3900) "TypeScript type generation produces inconsistent field ordering").

**Causa raiz:** Bug conhecido no CLI 2026: campo ordering depende de hash interno não-determinístico. Cada run gera ordem diferente para mesma schema. Em monorepos, ainda pior — cache do npm/pnpm pode reusar types antigo.

**Prevenção:**
- Em `supabase-migrations` + nova section em skill: WORKAROUND documentado:
  - Sort campos manualmente após gen (regex script ou prettier custom).
  - Run gen command com flag de sort (se vier — track issue).
  - CI: ignorar field-order diff temporariamente; comparar só presence de fields. Custom script.
- Em `supabase-architect` ou `supabase-migration-writer`: gera types junto da migration, commit junto. Não separar.
- Path em monorepo: regenerate types em workspace que owns Supabase client; export como package; outros workspaces consomem export, não regenerate.

**Skill/agent responsável:** `supabase-migrations` (skill) + `supabase-migration-writer` (agent).

---

### B13. Refresh token race condition em Next.js + multiple layouts

**Sintoma:** App Next.js v16 com `@supabase/ssr`. Páginas falham intermitentemente com "AuthApiError: Invalid Refresh Token: Already Used". User reload → fix. Acontece mais sob load.

**Causa raiz:** [issue ssr/68](https://github.com/supabase/ssr/issues/68) + [discussion 26791](https://github.com/orgs/supabase/discussions/26791): se serverClient é usado em múltiplos layouts (root layout + nested layout) na mesma request, ambos tentam refresh token simultâneo. Refresh token é single-use → segundo falha. Race amplified em RSC streaming.

**Prevenção:**
- Em `supabase-auth-ssr`: REGRA "serverClient em UM ÚNICO ponto da request lifecycle. Compartilhe via React.cache() ou middleware. NÃO crie cliente em cada layout/page independentemente."
- Pattern: middleware faz session refresh + sets cookies; layouts usam serverClient só para ler (não trigger refresh).
- Anti-pattern explícito: createServerClient em root layout E também em nested layout = race.
- Em `supabase-auth-bootstrapper` (agent): scaffolding cria SINGLE serverClient factory + middleware + helper helpers que reusam.

**Skill/agent responsável:** `supabase-auth-ssr` (skill) + `supabase-auth-bootstrapper` (agent).

---

### B14. Storage egress bill spike — uncached egress 3× mais caro que cached, easily missed

**Sintoma:** Bill mensal do Supabase normal. Mês X: $400 unexplained. Dashboard mostra Storage Egress 5TB com $0.09/GB.

**Causa raiz:** [Supabase egress docs 2026](https://supabase.com/docs/guides/storage/serving/bandwidth): cached egress (CDN hit) = $0.03/GB. Uncached = $0.09/GB. Diferença 3×. Sem CDN ou com Cache-Control wrong, todo egress é uncached. Image transformation bypassa cache se transformações são variadas (different `?width=...` query strings).

**Prevenção:**
- Em `supabase-edge-functions` (ou `supabase-storage`): REGRA "Habilite Smart CDN. Use `cacheControl: '3600'` ou maior em uploads. Padronize transformações (não permita `?width=arbitrário` no client; use sizes pré-definidos para que CDN cache hit)."
- Anti-pattern: `Cache-Control: no-cache` em uploads "porque pode mudar" — cada hit é uncached.
- Pattern: invalidate via versioning no path (`/avatars/v2/<id>.png`) em vez de no-cache.
- `supabase-architect`: ao designar feature de upload/serving, default Smart CDN ON.

**Skill/agent responsável:** `supabase-architect` (agent) + skill nova ou section.

---

## Padrões de Dívida Técnica (packaging-side)

| Atalho | Benefício Imediato | Custo a Longo Prazo | Quando É Aceitável |
|--------|--------------------|---------------------|--------------------|
| Copy-paste de guide EN para SKILL.md sem traduzir code blocks | Faster authoring (~40%) | Inconsistência idioma; LLM gera output mix-língua | Code blocks SQL: aceitável (manter EN). Narrativa em EN: nunca. |
| Inline UUID `mcp__0a712001-...` em frontmatter | Funciona no projeto do user | Quebra para qualquer outro consumer do kit | Nunca após v1.8 ship. Schema-checker existente é tech debt herdada. |
| Hooks só para Claude Code (skip multi-IDE) | Implementação 1 plataforma só | Workflow degraded em Cursor/Codex/Gemini | Quando hook é "polish" (analytics, log) — never quando é "gate" (validação). |
| Skill com cross-references mid-content | Modular, DRY entre skills | Quebra em targets `single` + stub-only mode | Em "ver também" no fim, nunca como dep semântica. |
| Adicionar dep nova "só para parsing X" | -50 LOC implementação | Quebra deps budget 6/6 | Nunca durante v1.8. Repensar arquitetura. |
| Frontmatter description longa (> 200 chars) explicativa | LLM matcher mais preciso | CLAUDE.md infla rapidamente | Nunca > 200 chars; se precisa explicar mais, usa primeira section do body. |
| Skill body < 50 linhas (ultra-concisa) | Loading rápido | Usuário não consegue invocar workflow completo | Se sub-skill complementa outra skill: aceitável. Standalone: mínimo 100 linhas substantivas. |
| Reutilizar `schema-checker` em todo agent supabase-* | DRY, single source of truth | Recursive dispatch, agents não auto-contidos | Quando schema-checker é INVOKED PELO command (não pelo agent) é OK. |

## Armadilhas de Integração (cross-IDE)

| IDE | Erro Comum | Abordagem Correta |
|-----|------------|-------------------|
| Codex (`AGENTS.md` single) | Stub-only sync = LLM perde body de skill supabase | `mode: full` override per-skill em supabase-* (A8) |
| Gemini CLI (`GEMINI.md` single) | Idem Codex | Idem |
| Cursor (`.cursor/agents/` multi) | Hooks não rodam → schema-check skipped | Schema-check embutido no agent, não no hook (A6) |
| Codex (sem agents capability) | Agent supabase invocado vira nada | Slash-command `/supabase` é fallback (mas Codex tampouco suporta) → docs explícitos |
| Antigravity / Trae / Copilot | Capabilities parciais — pode faltar agents OU skills OU commands | Matriz documentada de funcionalidade por IDE |
| Claude Code | Hooks funcionam → tentação de gate em hook | Resistir; gate sempre em agent/command. Hook = analytics. |

## Armadilhas de Performance (do PACKAGING)

| Armadilha | Sintomas | Prevenção | Quando Quebra |
|-----------|----------|-----------|---------------|
| CLAUDE.md > 13 KB | Boot lento, tokens fixos altos por sessão | Description budget 200 chars + grouping `## Supabase Suite` | Após 5+ items adicionados sem agrupamento |
| Sync com 14 items full-content em todos targets | `kit sync` 5× mais lento | `mode: full` ONLY para targets `single`; stub para `multi` (A8) | A partir de 8 skills supabase |
| listKit cache invalidate frequente | Toda invocação re-lê arquivos | TTL cache 30s (já existe v1.6); audit que supabase-* não invalida | Nunca, se respeitarmos cache |
| AGENTS.md > 80 KB | Codex pode truncar | Smart inclusion: skills supabase em sub-AGENTS.md? Ou size limit por sync target | A partir de 10+ skills full-content |

## Erros de Segurança (do CONTEÚDO entregue aos devs Supabase)

| Erro | Risco | Prevenção |
|------|-------|-----------|
| RLS com `user_metadata` claim (B5) | Privilege escalation arbitrário | Skill warning + agent ABORT se detecta (gate) |
| service_role em client (B6) | DB inteiro exposto | Audit `.env*` no agent, gate `NEXT_PUBLIC_*SERVICE*` |
| SECURITY DEFINER sem search_path (B7) | SQL injection / privilege escalation | Skill regra absoluta + `0011` lint integration |
| Public bucket com IDs previsíveis (B10) | Enum attack, image transform billing exploit | Skill default-private; signed URLs |
| Free tier project paused = downtime (B2) | Lost data window 90d, support delays | Heartbeat workflow + WARNING em setup skill |

## Armadilhas de UX (do agent/skill produzir output utilizável)

| Armadilha | Impacto no Usuário | Melhor Abordagem |
|-----------|-------------------|------------------|
| Agent retorna SQL "limpa" mas sem validação | Dev copia, aplica em prod, quebra | Agent SEMPRE invoca schema-checker ou estado equivalente antes de "GO" |
| Skill mostra exemplo de schema mas user precisa adaptar nomes manualmente | Frustration; skill "não funciona pro meu caso" | Skill + agent: agent recebe domain spec do user e gera nomes específicos |
| Output em modo "dump" (300 linhas SQL de uma vez) | Dev não entende, copia tudo, quebra | Agent quebra por arquivo; explica cada bloco; pergunta confirmação entre seções |
| Mensagem de erro "MCP tool not available" genérica | Dev não sabe se é setup, plano, ou bug | Mensagem explícita: "Você precisa registrar Supabase MCP em <IDE>. Veja `supabase-setup` skill." |
| Inconsistência entre saída do agent e o que o doc Supabase 2026 atual recomenda | Dev confia no agent, mas é outdated | Skill/agent linka para fonte oficial sempre; review semestral; CHANGELOG menciona drift |

## Checklist "Parece Pronto Mas Não Está"

- [ ] **CLAUDE.md gerado:** verificou que < 13 KB pós-suíte? Crescimento ≤ +2 KB?
- [ ] **AGENTS.md / GEMINI.md (single targets):** body de cada supabase-* skill está inline? `grep "select auth.uid()"` retorna match?
- [ ] **Cross-IDE smoke:** sync executado em ≥ 4 IDEs (Claude Code, Cursor, Codex, Gemini); agent supabase-rls-writer testado em cada?
- [ ] **No personal UUIDs:** `grep -r "0a712001\|[0-9a-f]{8}-[0-9a-f]{4}-" kit/agents/` retorna zero?
- [ ] **Deps budget:** `npm ls --depth=0` mostra exatamente 6 deps; CI gate green?
- [ ] **Description budget:** todo frontmatter de supabase-* < 200 chars? Audit script roda?
- [ ] **Stub mode:** stubs-only sync de supabase-* em multi-target IDE não perde expertise (validar 1 case)?
- [ ] **Schema-checker integration:** cada `supabase-migration-writer` invoca schema-checker como sub-step (não como hook)?
- [ ] **Setup skill exists:** `kit/skills/supabase-setup/SKILL.md` cobre install Supabase CLI + register MCP server por IDE?
- [ ] **Glossário PT-BR:** `kit/skills/_glossary-supabase.md` existe + cada skill referencia?
- [ ] **Anti-pattern explicit:** cada skill tem section `## Anti-padrões (NÃO FAÇA)` com pelo menos 2 examples?
- [ ] **Real-world smoke (manual pre-release):** rodou workflow RLS + Migration + Edge Fn em uma branch Supabase real?
- [ ] **Heartbeat warning:** Free tier mention em `supabase-setup` ou first-run experience?
- [ ] **Cost warnings:** Realtime Peak Connections + Branch billing + Egress mentioned no `supabase-architect`?
- [ ] **Recursive dispatch zero:** `grep -c "Task\|invoke supabase-" kit/agents/supabase-*` retorna zero (gate)?

## Estratégias de Recuperação

| Armadilha | Custo de Recuperação | Passos de Recuperação |
|-----------|----------------------|----------------------|
| Drift kit/ ↔ .claude/ descoberto pós-release (A1) | LOW | `kit reverse-sync` + manual reconciliation; CHANGELOG note; gate adicionado para próximo |
| CLAUDE.md inflado (A2) | LOW | Re-render com grouping; bump patch |
| Stub-only mode perdeu body em Codex (A8) | MEDIUM | Hotfix release com `mode: full` per-skill; users re-sync |
| Personal UUID em produção (A12) | MEDIUM | Patch release + migration guide para users; CHANGELOG warning |
| Agent supabase em loop recursivo (A10) | HIGH | Detected cedo no testing — não deveria escapar; se escapar, refactor agent + remove dispatches; bump minor |
| Skill ensina anti-pattern (B4-B7 prevention failed) | HIGH | Hotfix; CHANGELOG security advisory; user might need to audit production |
| Free tier user perde projeto após pause (B2 prevention failed) | HIGH (irrecuperável após 90d) | Não há recovery — only prevention. Skill setup precisa ser STRONG. |

## Mapeamento de Armadilhas por Fase (input para roadmapper)

| Armadilha | Fase de Prevenção | Verificação |
|-----------|-------------------|-------------|
| A1 — Drift kit/ ↔ .claude/ | Fase 25 (lock arch) + Fase 32 (release) | Smoke test idempotência sync |
| A2 — CLAUDE.md size | Fase 25 (budget) + Fase 31 (audit) | `wc -c CLAUDE.md` < 13 KB |
| A3 — Cross-skill refs broken | Fase 25 (auto-contido) + Fase 26 (1ª skill) | grep cross-refs == 0; AGENTS.md inline test |
| A4 — Agent sem MCP fail silencioso | Fase 25 (preflight REQ) + Fase 27 (1º agent) | Test sem MCP retorna mensagem clara |
| A5 — Naming overlap schema-checker | Fase 25 (contract) + Fase 32 (docs) | Disjoint inputs documented |
| A6 — Hooks cross-IDE | Fase 25 + Fase 27 | Schema-check embutido em agent |
| A7 — Test markdown semântica | Fase 25 (gate design) + Fase 26-29 (per-skill) | must-include + must-NOT-include gates |
| A8 — Stub-only mode | Fase 25 (override) + Fase 31 (measure) | AGENTS.md grep keywords |
| A9 — Deps budget | Toda fase (gate ativo) | CI green em deps-budget |
| A10 — Recursive dispatch | Fase 25 + Fase 27 (audit) + Fase 28 (cmd) | `grep "Task" kit/agents/supabase-*` == 0 |
| A11 — Idioma misto | Fase 25 (glossário) + 26-29 | Spot-check humano + grep traduções |
| A12 — Personal UUID | Fase 25 + Fase 32 (migrate schema-checker) | `grep -E "[0-9a-f]{8}-[0-9a-f]{4}"` == 0 |
| B1 — Realtime cleanup leak | Fase 26 (skill realtime) + Fase 27 (agent realtime) | snippet cleanup obrigatório |
| B2 — Free tier pause | Fase 26 (setup skill) + Fase 27 (architect) | Heartbeat workflow template |
| B3 — Migration drift | Fase 26 (skill declarative + migrations) + Fase 27 (migration-writer) | Step 0 = `db pull` mandatory |
| B4 — RLS performance | Fase 26 (skill rls) + Fase 27 (rls-writer) | gen produces (select) wrapper + index |
| B5 — user_metadata em RLS | Fase 26 (skill rls + auth) + Fase 27 (rls-writer) | Scan + ABORT se user_metadata em policy |
| B6 — service_role client-side | Fase 26 (skill auth) + Fase 27 (auth-bootstrapper) | Audit env files + warning `NEXT_PUBLIC_*` |
| B7 — SECURITY DEFINER no search_path | Fase 26 (skill db-functions) + Fase 27 (migration-writer) | gate: function + DEFINER → require search_path = '' |
| B8 — Branch billing | Fase 26 (skill migrations) + Fase 27 (architect) | warning + cleanup workflow template |
| B9 — Edge Fn cold start | Fase 26 (skill edge-functions) + Fase 27 (edge-fn-writer) | bundle size warning |
| B10 — Public bucket leak | Fase 26 (storage section) + Fase 27 (architect) | Default-private; signed URLs |
| B11 — pgvector setup | Fase 26 (db-functions ou skill nova pgvector) + Fase 27 (architect) | extension check + dim audit |
| B12 — Type gen drift | Fase 26 (migrations skill) + Fase 27 (migration-writer) | Custom sort script |
| B13 — Auth refresh race | Fase 26 (auth-ssr skill) + Fase 27 (auth-bootstrapper) | Single serverClient factory pattern |
| B14 — Storage egress | Fase 26 (storage section) + Fase 27 (architect) | Smart CDN default ON |

## Fontes

### Primárias (HIGH — Supabase oficial 2026)
- [Realtime Limits](https://supabase.com/docs/guides/realtime/limits) + [Pricing](https://supabase.com/docs/guides/realtime/pricing) + [Concurrent Peak Connections quota](https://supabase.com/docs/guides/troubleshooting/realtime-concurrent-peak-connections-quota-jdDqcp) — B1
- [Pausing Pro/Free Projects](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a) + [GitHub issue #37453](https://github.com/supabase/supabase/issues/37453) "resuming project taking a long time" — B2
- [Declarative database schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas) + [cli/issue #3974 db diff misses entities](https://github.com/supabase/cli/issues/3974) + [cli/issue #3483 incorrect order](https://github.com/supabase/cli/issues/3483) + [cli/issue #4027 broken JOIN views](https://github.com/supabase/cli/issues/4027) — B3
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) + [discussion #14576](https://github.com/orgs/supabase/discussions/14576) — B4
- [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data) + [splinter linter 0015](https://supabase.github.io/splinter/0015_rls_references_user_metadata/) + [issue #20997 docs example wrong](https://github.com/supabase/supabase/issues/20997) — B5
- [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys) + [GitGuardian remediation](https://www.gitguardian.com/remediation/supabase-service-role-jwt) + [Lovable case 2026](https://gptsters.com/fix/lovable/service-role-key-exposed) — B6
- [Database Advisors lint 0011_function_search_path_mutable](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0011_function_search_path_mutable) + [discussion #23170](https://github.com/orgs/supabase/discussions/23170) — B7
- [Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching) + [Supabase Pricing 2026 (metacto)](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance) — B8
- [Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture) + [Wall clock time limit](https://supabase.com/docs/guides/troubleshooting/edge-function-wall-clock-time-limit-reached-Nk38bW) — B9
- [Storage buckets fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) + [discussion #6458 public vs signedURL](https://github.com/orgs/supabase/discussions/6458) + [discussion #3564 abuse signed url](https://github.com/orgs/supabase/discussions/3564) — B10
- [pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) + [HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes) + [pgvector/issue #461 dim limits](https://github.com/pgvector/pgvector/issues/461) — B11
- [Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) + [cli/issue #3900 inconsistent ordering](https://github.com/supabase/cli/issues/3900) — B12
- [Auth Advanced guide SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide) + [ssr/issue #68 race condition](https://github.com/supabase/ssr/issues/68) + [discussion 26791 AuthSessionMissingError](https://github.com/orgs/supabase/discussions/26791) — B13
- [Egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress) + [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn) — B14

### Secundárias (MEDIUM — codebase + history kit-mcp)
- `D:\projetos\opensource\mcp\src\core\registry.js` — TARGETS table com capabilities por IDE
- `D:\projetos\opensource\mcp\src\core\sync.js` — STUB_MARKER, stubsOnly mode
- `D:\projetos\opensource\mcp\kit\agents\schema-checker.md` — precedente, contém UUID pessoal
- `D:\projetos\opensource\mcp\.planning\MILESTONES.md` — histórico v1.6/v1.7 perf optims
- `D:\projetos\opensource\mcp\.planning\PROJECT.md` — milestone v1.8 specification
- `D:\projetos\opensource\mcp\CLAUDE.md` (10.4 KB atual)
- `D:\projetos\opensource\mcp\package.json` — deps 6/6 budget atual

### Inferidas (HIGH — análise composta)
- Combinação registry capabilities × suite content × Stable API constraint = matriz de pitfalls A1-A12
- Combinação user-facing skills × LLM matcher × multi-IDE → pitfalls de cross-IDE A4, A6, A8

---
*Pesquisa de armadilhas para: kit-mcp v1.8 Suíte Supabase como kit content*
*Pesquisado: 2026-05-06*
*Pronto para roadmap: sim — 12 pitfalls de packaging (A) + 14 pitfalls Supabase (B), todos mapeados a fase + verificação acionável*

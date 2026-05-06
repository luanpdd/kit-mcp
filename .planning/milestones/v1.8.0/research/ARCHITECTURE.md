# Pesquisa de Arquitetura — v1.8 Suíte Supabase

**Domínio:** Empacotamento de kit content (skills/agents/commands) cross-IDE para domínio Supabase
**Pesquisado:** 2026-05-06
**Confiança:** HIGH (precedente direto no kit, registry estável, v1.7 acabou de fechar)

---

## Resumo Executivo

v1.8 é o **primeiro milestone "content-only"** do kit-mcp — não toca CLI, MCP, registry ou sidecar. Apenas adiciona 8 SKILL.md + 6 agent.md + 1 command.md sob `kit/`. O risco arquitetural não está em "como construir" (a infraestrutura existe e está validada desde v1.0); está em **escolhas de naming, agrupamento e cross-reference que vão se replicar centenas de vezes no futuro** (auth-suite, stripe-suite, vercel-suite). Esta pesquisa fixa essas convenções agora para evitar refatoração depois.

**Princípio organizador:** *Aditivo, plano, descobrível.* Manter a forma `kit/<kind>/<flat-name>.md` que o `registry.js` já entende, prefixar para clusterizar visualmente, e usar links Markdown relativos para cross-reference em vez de inventar uma sintaxe nova.

---

## Visão Geral do Sistema (estado pós-v1.8)

```
┌────────────────────────────────────────────────────────────────────┐
│                        Canonical Source (kit/)                      │
├────────────────────────────────────────────────────────────────────┤
│  kit/skills/                    kit/agents/             kit/commands/ │
│  ├── example-skill/             ├── schema-checker.md   ├── supabase.md ◄novo │
│  ├── supabase-realtime/  ◄novo  ├── supabase-architect.md ◄novo               │
│  ├── supabase-auth-ssr/  ◄novo  ├── supabase-migration-writer.md ◄novo        │
│  ├── supabase-edge-functions/◄  ├── supabase-rls-writer.md ◄novo              │
│  ├── supabase-declarative-schema/◄ supabase-edge-fn-writer.md ◄novo           │
│  ├── supabase-rls-policies/   ◄ ├── supabase-realtime-implementer.md◄         │
│  ├── supabase-database-functions/◄ supabase-auth-bootstrapper.md ◄novo        │
│  ├── supabase-migrations/    ◄  └── (24 outros agents pré-existentes)         │
│  └── supabase-postgres-style/◄                                                 │
└────────────┬───────────────────────────────────────────────────────┘
             │
             │ listKit() lê → buildAggregatedRules() agrega → renderItem() projeta
             ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Sync Targets (registry.js TARGETS)               │
├──────────────┬──────────────┬─────────────┬────────────┬───────────┤
│ Claude Code  │ Cursor       │ Codex       │ Gemini CLI │ Outros    │
│ (full+MCP)   │ (no skills)  │ (no agents) │ (no agents)│ (variado) │
└──────────────┴──────────────┴─────────────┴────────────┴───────────┘
```

**O que NÃO muda em v1.8:** registry.js, sync.js, kit.js, listKit/listSkills, generateClaudeMd via buildAggregatedRules. Toda mecânica está estável desde v1.0.

**O que muda em v1.8:** apenas conteúdo `.md` em `kit/`. Zero código novo.

---

## Decisões de Arquitetura

### Decisão 1 — Estrutura de skills (flat dirs com prefixo)

**Recomendação:** Manter o padrão atual `kit/skills/<flat-name>/SKILL.md`, **uma diretório por skill no nível raiz**, prefixada com `supabase-`. Não criar subárvore `kit/skills/supabase/realtime/`.

**Estrutura final:**
```
kit/skills/
├── example-skill/SKILL.md        (existente)
├── supabase-realtime/SKILL.md    ◄ novo
├── supabase-auth-ssr/SKILL.md    ◄ novo
├── supabase-edge-functions/SKILL.md
├── supabase-declarative-schema/SKILL.md
├── supabase-rls-policies/SKILL.md
├── supabase-database-functions/SKILL.md
├── supabase-migrations/SKILL.md
└── supabase-postgres-style/SKILL.md
```

**Justificativa:**
- **Precedente no código.** `src/core/kit.js:111-145` (`readSkillsDir`) varre **uma única vez** o diretório `kit/skills/` com `e.isDirectory()` e usa `e.name` como o slug. Aceitar subárvores forçaria recursão e mudaria o output de `listKit()`. Custo de arquitetura para zero benefício de runtime.
- **Precedente nos targets.** `registry.js:23` declara `skills: { path: '.claude/skills/', mode: 'multi-dir' }`. O modo `multi-dir` espera "uma pasta por skill". Subárvores quebrariam a projeção 1:1 que `sync.js:64-69` faz hoje. Cada IDE também espera flat (cursor/codex/gemini docs todos esperam um nível).
- **Discoverability.** O frontmatter `description` é o gatilho da skill (Claude carrega quando match). Importar a skill correta depende do nome aparecer na lista, não da hierarquia. Subárvore esconde.

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Flat com prefixo `supabase-*`** (recomendada) | Compatível com kit.js + registry.js sem mudança; discoverable; CLAUDE.md já agrupa visualmente porque alfabético | Cluster de 8 itens "supabase-*" no listing | **Escolhida** |
| **B. Subárvore `skills/supabase/realtime/`** | Hierárquico visualmente | Quebra `readSkillsDir`; quebra mode `multi-dir` em todos os 7 targets; força refatoração de `sync.js` | Rejeitada — mudança de infraestrutura para benefício estético |
| **C. Sigla curta `sb-*`** | Cluster mais discreto | Quebra com convenção do projeto (PROJECT.md já fixa `supabase-*`); ambíguo (sb = supabase? scaleway? styled-bundle?) | Rejeitada |

**Trade-off explícito:** verbosidade dos nomes (`supabase-database-functions/` é longo) vs descoberta sem ambiguidade. Verbosidade vence — esses nomes são lidos pelos LLMs (que não pagam custo cognitivo por chars) e listados em IDE pickers (onde "sb-fns" seria misterioso).

**Impacto em consumers:**
- Em IDEs com skills (Claude Code, Codex, Gemini, Copilot, Windsurf, Antigravity): vê 8 skills novas no skills picker, sem ambiguidade.
- Em IDEs sem skills (Cursor, Trae): nada, `sync.js:63` já pula via `if (target.skills)`.

---

### Decisão 2 — Tools dos agents Supabase (MCP-first com graceful fallback)

**Recomendação:** Os 6 novos agents declaram **tools genéricos universais como base** (Read, Write, Edit, Bash, Grep, Glob) e **tools `mcp__supabase__*` como opcionais quando presentes**. Seguir o precedente de `schema-checker.md` mas refinado: o agent **abre verificando se o MCP Supabase está disponível** e degrada graciosamente se não estiver.

**Padrão de frontmatter:**
```yaml
---
name: supabase-rls-writer
description: Gera RLS policies com indexing recomendado e validação opcional via Supabase MCP. ...
tools: Read, Write, Edit, Bash, Grep, Glob, mcp__supabase__list_tables, mcp__supabase__execute_sql, mcp__supabase__apply_migration
color: green
---
```

**Padrão de corpo (primeira seção):**
```markdown
## Detecção de capabilities

Se o caller anexou `project_id` Supabase E as tools `mcp__supabase__*` estão disponíveis:
→ modo "live" — você valida policies contra schema real antes de retornar.

Se `project_id` ausente OU tools MCP indisponíveis (você está rodando em IDE sem MCP):
→ modo "offline" — você gera o SQL com base nas convenções do guia + skill `supabase-rls-policies` carregada. Avisa no output: "Modo offline — não validei contra schema real".
```

**Justificativa:**
- **Precedente.** `schema-checker.md` já declara `mcp__0a712001-...__execute_sql` e `mcp__0a712001-...__list_tables` no frontmatter. Mas o tool ID atual está hardcoded com um project ID pessoal — os 6 novos agents devem usar **tool IDs genéricos `mcp__supabase__*`** (ver lista em "Decisão 2.b") porque kit-mcp distribui para outros usuários cujos project IDs serão diferentes.
- **Cross-IDE realidade.** Apenas Claude Code e Cursor têm suporte nativo a MCP no momento de v1.8. Codex/Gemini/Windsurf têm suporte parcial via config files que kit-mcp já gerencia (ver `mcpConfig` em registry.js). Copilot e Trae não têm. Forçar dependência MCP excluiria 3+ IDEs.
- **Idempotência.** Modo offline produz texto SQL — o usuário pode aplicar manualmente (`supabase db push`). Modo live produz texto SQL + diff contra produção. O segundo é estritamente melhor, mas o primeiro nunca está errado.

**Decisão 2.b — Tool IDs canônicos a usar:**

Usar os nomes oficiais do servidor Supabase MCP community ([referência](https://supabase.com/docs/guides/getting-started/mcp)). Mapear por agent:

| Agent | Tools MCP Supabase relevantes |
|-------|-------------------------------|
| `supabase-architect` | `list_tables`, `list_extensions`, `get_advisors`, `search_docs` |
| `supabase-migration-writer` | `list_tables`, `list_migrations`, `apply_migration`, `execute_sql` |
| `supabase-rls-writer` | `list_tables`, `execute_sql`, `apply_migration` |
| `supabase-edge-fn-writer` | `list_edge_functions`, `get_edge_function`, `deploy_edge_function` |
| `supabase-realtime-implementer` | `list_tables`, `execute_sql`, `apply_migration` |
| `supabase-auth-bootstrapper` | `get_project_url`, `get_publishable_keys`, `generate_typescript_types` |

**NÃO usar** o tool prefix com project_id como em `schema-checker.md` (`mcp__0a712001-...`). Em v1.8, **considerar atualizar `schema-checker.md`** também para usar o prefix canônico `mcp__supabase__*` — é uma melhoria oportunística (zero ambiguidade, funciona para qualquer projeto Supabase). Marcar como sub-tarefa não-bloqueante.

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. MCP-first com fallback offline** (recomendada) | Funciona em qualquer IDE; melhor experiência onde MCP existe; não bloqueia | Cada agent tem branch `if MCP available` no início | **Escolhida** |
| **B. MCP-only — exigir Supabase MCP** | Agents mais simples (uma branch só) | Quebra em Cursor/Codex/Gemini/Copilot/Trae sem MCP Supabase configurado; alguns só configuram Supabase MCP em sessões específicas | Rejeitada — exclui 60%+ dos targets |
| **C. Offline-only — nunca usar MCP** | Universal; agents 100% portáveis | Desperdiça a vantagem real do MCP (validar contra produção); regride o que `schema-checker.md` já entrega | Rejeitada — é regressão |

**Trade-off explícito:** verbosidade do agent (sempre tem branch online/offline) vs cobertura. Verbosidade vence — cada agent ganha ~10 linhas, ganha 4 IDEs.

**Impacto em consumers:**
- **Claude Code com Supabase MCP configurado:** modo live, melhor experiência.
- **Claude Code sem Supabase MCP:** modo offline, usuário recebe SQL e aplica manualmente. Output marca `MODO_OFFLINE` claramente.
- **Cursor (suporta MCP):** funciona se Cursor + Supabase MCP estão conectados.
- **Codex/Gemini com Supabase MCP em config.toml/settings.json:** funciona — kit-mcp já gerencia esses configs via `mcpConfig.userPath`.
- **Copilot/Trae:** sempre modo offline.

---

### Decisão 3 — Comando `/supabase` com subcomandos (espelha `/fluxos-trabalho`)

**Recomendação:** Implementar `/supabase` como **um único arquivo `kit/commands/supabase.md`** que faz dispatch para os 6 agents via `Task(subagent_type="...")`. Espelha o padrão de `/fluxos-trabalho` (que dispatcha para subcomandos do binário `tools.cjs`) mas adaptado para dispatch de **agentes** (mais próximo de `/depurar`).

**Subcomandos:**

| Subcomando | Agent invocado | Sinônimos aceitos |
|------------|----------------|-------------------|
| `arquiteto` | `supabase-architect` | `architect`, `design`, `plan` |
| `migration` | `supabase-migration-writer` | `migrar`, `migrations` |
| `rls` | `supabase-rls-writer` | `policies`, `permissoes` |
| `edge` | `supabase-edge-fn-writer` | `edge-fn`, `funcao`, `deno` |
| `realtime` | `supabase-realtime-implementer` | `rt`, `canal` |
| `auth` | `supabase-auth-bootstrapper` | `ssr`, `nextjs-auth` |

**Frontmatter:**
```yaml
---
name: supabase
description: Suíte de assistência Supabase. Subcomandos: arquiteto, migration, rls, edge, realtime, auth. Use /supabase <subcomando> "descrição da tarefa".
argument-hint: "<subcomando> [descrição]"
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---
```

**Estrutura interna (espelha `/fluxos-trabalho` + `/depurar`):**
```markdown
<process>

## Passo 1: Analisar Subcomando

Extrair o primeiro token de $ARGUMENTS. Se ausente OU "ajuda", listar subcomandos e exemplos.

## Passo 2: Roteamento

(tabela com sinônimos)

Se subcomando não bate, perguntar via AskUserQuestion com as opções.

## Passo 3: Detectar contexto Supabase

```bash
test -f supabase/config.toml && project_id=$(grep '^project_id' supabase/config.toml | head -1 | cut -d'"' -f2)
test -f .env && grep -q SUPABASE_PROJECT_ID .env && project_id=$(grep '^SUPABASE_PROJECT_ID=' .env | cut -d= -f2)
```

Passar para o agent como contexto opcional.

## Passo 4: Invocar Agent

Task(
  prompt="<objective>...$tarefa...</objective><supabase_context>project_id=$project_id</supabase_context>",
  subagent_type="<agent escolhido>",
  description="<subcomando>: <primeiros 50 chars da tarefa>"
)
```

**Justificativa:**
- **Precedente direto.** `/fluxos-trabalho` (kit/commands/fluxos-trabalho.md) demonstra subcomandos com tabela de roteamento + dispatch a executar. `/depurar` (kit/commands/depurar.md) demonstra dispatch para agente via `Task(subagent_type=...)`. v1.8 combina os dois padrões.
- **Single command.** Comandos slash são todos top-level no Claude Code (`/<name>`). Inserir `/supabase-arquiteto`, `/supabase-rls`, etc. polui o `/help` com 6 entradas. `/supabase <sub>` é uma entrada só.
- **Discoverability.** Usuário digita `/supabase` e vê os subcomandos no help. Em `/help` global, aparece `supabase` uma vez.
- **Sinônimos.** Aceitar `arquiteto` (PT-BR) e `architect` (EN) reduz fricção. Padrão alinhado com PROJECT.md (kit é PT-BR mas reconhece termos EN comuns).

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Único `/supabase <sub>` com dispatch** (recomendada) | Uma entrada em `/help`; precedente em `/fluxos-trabalho`+`/depurar`; subcomandos extensíveis | Levemente mais complexo de descobrir o subcomando certo (mas help resolve) | **Escolhida** |
| **B. Seis comandos `/supabase-arquiteto`, `/supabase-rls`, etc** | Cada um direto, sem step de dispatch | Polui `/help` com 6 entradas; inconsistente com padrão de subcomandos do kit (`/fluxos-trabalho`, `/fio`, `/nota`) | Rejeitada |
| **C. `/sb` curto como entry, depois subcomando** | Menos teclado | `/sb` é ambíguo (storage bucket? sql block?); rompe legibilidade do `/help` | Rejeitada |

**Trade-off explícito:** discoverability dos subcomandos vs poluição do `/help`. Subcomandos vencem porque (1) `/supabase` sem args lista os subs, (2) `/help` mostra uma linha em vez de seis.

**Impacto em consumers:**
- IDEs com commands (Claude Code apenas — ver registry.js): vê `/supabase` no slash menu. Resto dos IDEs não tem commands suportados (registry.js linhas 32 e seguintes mostram `commands: null` para Cursor, Codex, Gemini, Copilot, Antigravity, Trae).
- **Cursor/Codex/Gemini/Copilot/Trae sem commands:** o usuário invoca o agent diretamente (`@supabase-architect "design schema"` ou via picker). O command `/supabase` é "açúcar" sobre os agents — não é o único caminho.
- Documentar no SKILL.md / agent.md que **agents também são utilizáveis sem o command** (importante para os 5 IDEs sem suporte a commands).

---

### Decisão 4 — Cross-references entre skills/agents (Markdown link relativo, não @-syntax)

**Recomendação:** Cross-references vão como **links Markdown relativos para o caminho dentro de `kit/`**, não @-includes. Ex: o agent `supabase-migration-writer` referencia a skill assim:

```markdown
Para regras de RLS (auth.uid(), USING, WITH CHECK, indexing), consulte
[supabase-rls-policies](../skills/supabase-rls-policies/SKILL.md).

Para naming/style/lowercase de SQL, consulte
[supabase-postgres-style](../skills/supabase-postgres-style/SKILL.md).
```

E **não**:

```markdown
@./.claude/skills/supabase-rls-policies/SKILL.md  ← NÃO USAR
```

**Justificativa:**
- **Precedente do framework.** O `@-include` (ex: `@./.claude/framework/workflows/do.md` em `fazer.md:32`) é usado para **carregar o conteúdo no contexto do prompt** — comportamento específico do Claude Code para "puxar este arquivo inline na hora da execução". É correto para arquivos de framework grandes (workflows, references) que SEMPRE são carregados quando o command roda.
- **Skills são lazy.** Toda a graça das skills é o mecanismo de gating por descrição: o LLM só carrega `supabase-rls-policies/SKILL.md` quando a description bate com a intenção. Forçar `@-include` derrotaria o lazy-loading e inflaria todo agent que menciona RLS.
- **Markdown link funciona.** O LLM lendo o agent.md vê o link e, se julgar necessário, **invoca a skill correspondente** (skills são acionadas pelo description, não pelo link). O link existe principalmente para humans navegando o repo + para o LLM saber onde procurar se quiser puxar o conteúdo manualmente via Read.
- **Stub stability.** `sync.js:213-237` (`renderReference`) gera stubs com link relativo `[\`${rel}\`](${rel})` — usa exatamente o mesmo padrão. Cross-refs internas usar a mesma convenção mantém o repo consistente.

**Padrão dentro do agent:**
```markdown
## Skills relacionadas (consulte conforme necessário)

- [supabase-rls-policies](../skills/supabase-rls-policies/SKILL.md) — políticas RLS
- [supabase-postgres-style](../skills/supabase-postgres-style/SKILL.md) — naming/lowercase/snake_case
- [supabase-migrations](../skills/supabase-migrations/SKILL.md) — naming de arquivos + estrutura
```

**Caveat de path em sync:** quando sync espelha para `.claude/agents/<agent>.md`, o link relativo `../skills/<skill>/SKILL.md` aponta para `.claude/skills/<skill>/SKILL.md` — coincidência feliz: a estrutura `kit/agents,skills,commands` projeta para `.claude/agents,skills,commands` em todos os targets que suportam ambos. Para targets sem suporte a skills (Cursor, Trae), o link aponta para um arquivo inexistente, mas:
- Não quebra o agent (link morto é apenas um link morto, o agent ainda funciona).
- Pode-se documentar no agent: "Skill X só está disponível em Claude Code, Codex, Gemini, Copilot, Windsurf, Antigravity. Em Cursor/Trae, leia o conteúdo equivalente em [link absoluto pro GitHub]."

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Markdown link relativo** (recomendada) | Mesmo padrão do stub renderer; navegável no GitHub; LLM-friendly; lazy-load preservado | Link pode ser morto em targets sem skills suportadas | **Escolhida** |
| **B. @-include explícito** | Conteúdo da skill aparece in-context | Quebra lazy-loading; infla agent.md; `@./.claude/skills/X/SKILL.md` falha em IDE não-Claude (sintaxe específica) | Rejeitada |
| **C. Inline (copiar conteúdo)** | Sem dependência | Drift imediato; viola single-source-of-truth (princípio 1 de PROJECT.md) | Rejeitada |
| **D. Frontmatter `related_skills:`** | Metadata estruturado | Não há leitor — `kit.js:162-187` parser ignora chaves não-conhecidas; nada do framework usa hoje | Rejeitada — overhead sem benefício |

**Trade-off explícito:** discoverability passiva (link, depende do LLM ir buscar) vs forçar inclusão. Link vence porque skills são opt-in por design.

---

### Decisão 5 — Onde os agents escrevem outputs (declarative-first com pergunta no boot)

**Recomendação:** Os agents Supabase escrevem em **layouts canônicos do Supabase CLI**, com um passo inicial de detecção que pergunta ao user **uma vez por sessão** caso o layout não esteja claro:

| Agent | Output destino padrão |
|-------|------------------------|
| `supabase-migration-writer` | `supabase/migrations/<YYYYMMDDHHmmss>_<slug>.sql` |
| `supabase-rls-writer` | **Declarative-first:** `supabase/schemas/<table_or_topic>.sql` se `supabase/schemas/` existe; caso contrário, novo arquivo de migration |
| `supabase-edge-fn-writer` | `supabase/functions/<fn_name>/index.ts` (+ deno.json se necessário) |
| `supabase-realtime-implementer` | mistura — schema/migration parts em `supabase/schemas/` ou migrations; client code onde o user pedir (ex: `app/realtime/<file>.ts`) |
| `supabase-auth-bootstrapper` | mistura — config em `supabase/config.toml`; client code em `lib/supabase/{client,server,middleware}.ts` (Next.js v16 padrão) |
| `supabase-architect` | **Não escreve código de produção.** Escreve um plano em `.planning/phases/<N>/SUPABASE-DESIGN.md` (se em fluxo de fase) OU em `supabase/.architect/<slug>.md` (se em fluxo livre) |

**Procedimento de detecção (compartilhado por todos):**

```markdown
## Detecção de layout

1. Verifica se existe `supabase/schemas/` (declarative schema layout)
2. Verifica se existe `supabase/migrations/` (migration-first layout)
3. Verifica se existe `supabase/config.toml` (qualquer layout Supabase)

Se ambíguo OU nenhum existe:
→ AskUserQuestion: "Onde devo escrever os arquivos? (1) supabase/migrations/ — migration-first; (2) supabase/schemas/ — declarative; (3) outro caminho que você define"
→ Persistir resposta em `.planning/state.json` para próximas invocações da sessão.
```

**Justificativa:**
- **Precedente Supabase oficial.** Migrations vão em `supabase/migrations/` com nome `YYYYMMDDHHmmss_*.sql` — ditado pelo CLI Supabase, não negociável. Skills `supabase-migrations` e `supabase-declarative-schema` codificam isso.
- **Declarative-first quando possível.** Skill `supabase-declarative-schema` defende: schemas em `supabase/schemas/` + `db diff` gera migration. RLS em declarative é mais robusto (sem drift). Mas nem todo projeto adotou declarative — alguns ainda usam migration-first.
- **Não criar diretório fora de Supabase convention.** Resistir tentação de inventar `kit-supabase/output/` — agents devem ser **bons cidadãos** do projeto Supabase do user.
- **Architect escreve plano, não código.** `supabase-architect` é um pensador, não um escritor. Output dele alimenta os outros 5 agents. Vai pra `.planning/phases/<N>/SUPABASE-DESIGN.md` (se há fase ativa) ou pra `supabase/.architect/` (subdir invisível para humans, igual `.cursor/`, `.claude/`).

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Layout-detect + AskUserQuestion fallback** (recomendada) | Funciona em qualquer projeto Supabase; respeita declarative quando existe; user pode override | Step extra na primeira invocação | **Escolhida** |
| **B. Sempre escrever em `supabase/migrations/`** | Nunca falha; CLI Supabase sempre aceita | Ignora declarative existente; user perde benefícios de declarative | Rejeitada |
| **C. Sempre perguntar antes de cada escrita** | Máxima segurança | Fricção alta; user vai irritar depois da 3ª pergunta | Rejeitada |
| **D. Output em `kit-output/` separado** | Não toca projeto do user | Não-padrão; user tem que copiar manualmente | Rejeitada — desfaz valor do agent |

**Trade-off explícito:** automação (escrever direto) vs segurança (perguntar). Automação com detecção vence: **detectar layout é cheap (3 file existence checks)**, perguntar só quando ambíguo.

**Impacto em consumers:**
- Projeto recém-iniciado com `supabase init` rodado: detecta `supabase/migrations/`, escreve direto.
- Projeto com declarative adotado: detecta `supabase/schemas/`, escreve declarative quando faz sentido (RLS), migrations para data ops (insert/update).
- Projeto totalmente novo sem Supabase init: AskUserQuestion sugere `supabase init` primeiro.

---

### Decisão 6 — Naming flat com prefixo `supabase-` (recapitulado e cross-cutting)

**Recomendação:** Todas as skills usam prefixo `supabase-*` (8 itens). Todos os agents também (6 itens). Comando único `/supabase`. Total de 14 nomes começando com `supabase-`.

**Esta decisão é cross-cutting** — afeta Decisões 1, 3, 8. Já justificada em Decisão 1, mas fixada explicitamente aqui para evitar drift quando outras suítes vierem.

**Padrão para futuras suítes (precedent que estamos criando):**

| Suíte futura hipotética | Pattern |
|--------------------------|---------|
| Stripe payments suite | `stripe-checkout`, `stripe-webhooks`, `stripe-subscriptions` (skills) + `stripe-implementer`, `stripe-debugger` (agents) + `/stripe` (command) |
| Vercel deploy suite | `vercel-routing`, `vercel-edge`, etc. + `/vercel` |
| Auth0 suite | `auth0-flows`, etc. + `/auth0` |

**Regra:** se a "suite" tem ≥3 itens, ganha prefixo. Se tem 1-2, fica solto (ex: `schema-checker.md` é o único agent ligado a Postgres ops e não precisa de prefixo).

**Limite hard:** se chegarmos a 25+ itens com mesmo prefixo (improvável), revisitar Decisão 1 (subárvore vs flat). Por ora, 14 é totalmente confortável.

**Justificativa:**
- **Precedente cross-comando.** PROJECT.md fixa os 8 nomes de skills com `supabase-*` explicitamente. Manter.
- **Visualmente clusterizado.** Em `CLAUDE.md` gerado por `buildAggregatedRules` (sync.js:268-290), a lista é alfabética. Os 14 itens `supabase-*` aparecem juntos automaticamente. **Sem categoria custom necessária** (ver Decisão 8).
- **Auto-tab-complete amigável.** Em IDEs com filename autocomplete, digitar `supabase-` filtra a lista para 14 itens — descoberta natural.

---

### Decisão 7 — Sync targets sem MCP (graceful degradation explícita)

**Recomendação:** Cada SKILL.md e cada agent.md inclui uma seção **"Compatibilidade"** no topo declarando IDEs onde funciona com 100% de capacidade vs IDEs onde funciona com capacidade reduzida.

**Padrão de seção:**

```markdown
## Compatibilidade

| IDE | Status | Modo |
|-----|--------|------|
| Claude Code | full | live (MCP Supabase) ou offline |
| Cursor | full (se Supabase MCP configurado) | live ou offline |
| Codex | partial | offline (MCP Supabase em config.toml suportado) |
| Gemini CLI | partial | offline |
| Windsurf | partial | offline |
| Copilot, Trae, Antigravity | offline-only | sem MCP — gera SQL/código, user aplica manualmente |

Em modo offline, o agent gera o SQL/código baseado em convenções e nas skills carregadas; não valida contra o schema real. User executa o output manualmente (`supabase db push`, `npx supabase functions deploy`, etc).
```

**Justificativa:**
- **Honestidade > silêncio.** É melhor o user saber upfront que `supabase-rls-writer` em Trae não vai validar contra produção do que descobrir após copiar SQL e ter falha em apply.
- **Não bloquear.** Bloquear (recusar invocação) seria mais drástico do que necessário — modo offline produz output útil. A skill `supabase-rls-policies` ensina o pattern; o agent gera o SQL aplicando o pattern. Validação é melhoria, não pré-requisito.
- **Documentação concentrada.** Em vez de espalhar caveats por toda a skill/agent, uma tabela única no topo. LLM lê primeiro, user lê primeiro.

**Implementação técnica:** zero código novo. Apenas convenção textual nos arquivos `.md`. `sync.js` projeta como qualquer outro conteúdo.

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Tabela compatibilidade no topo** (recomendada) | Transparente; uma vez por arquivo; não toca código | Adiciona ~10 linhas por skill/agent | **Escolhida** |
| **B. Bloquear em IDEs sem MCP** | Falha rápido | Quebra UX em 5 dos 8 targets; viola "kit-mcp distribui para qualquer IDE" | Rejeitada |
| **C. Frontmatter `requires_mcp: supabase`** | Estruturado | Sem leitor — `listKit` não usa; nenhum IDE consome essa flag | Rejeitada |
| **D. Silêncio (não documentar)** | Skills ficam mais curtas | User descobre na hora errada | Rejeitada |

**Trade-off explícito:** verbosidade do skill/agent (10 linhas extras) vs clareza para user. Verbosidade vence trivialmente — o conteúdo é informacional e acionável.

**Impacto em consumers:**
- IDEs full-MCP: usuários mal notam a tabela.
- IDEs offline-only: usuários veem "modo offline — você aplica manualmente" e ajustam expectativa.

---

### Decisão 8 — CLAUDE.md generation (sem mudança de código, agrupamento implícito)

**Recomendação:** **Não modificar `buildAggregatedRules` em `sync.js`.** Os 14 itens `supabase-*` aparecem clusterizados automaticamente porque a lista é alfabética e o prefixo agrupa.

**O que aparece em CLAUDE.md (auto-gerado em qualquer target com `rules.mode: 'single'`):**

```markdown
# Personal kit
> Auto-gen. Edit `kit/`; rerun `kit sync <target>`.

## Agents
- ...
- **schema-checker** — Valida foreign keys, colunas e tabelas referenc...
- **supabase-architect** — Projeta schema + RLS + topologia realtime...
- **supabase-auth-bootstrapper** — Bootstrap Next.js v16 com Supabase Auth (SSR)
- **supabase-edge-fn-writer** — Escreve Deno Edge Functions
- **supabase-migration-writer** — Escreve migrations seguindo declarative...
- **supabase-realtime-implementer** — Configura canais (client + DB triggers...
- **supabase-rls-writer** — Gera RLS policies com indexing recomendado
- ... (outros agents)

## Commands
- ...
- **/supabase** — Suíte de assistência Supabase. Subcomandos: arquiteto...
- ...

## Skills
- example-skill — Example skill template...
- **supabase-auth-ssr** — Next.js v16 + @supabase/ssr (getAll/setAll)...
- **supabase-database-functions** — SECURITY INVOKER, search_path...
- **supabase-declarative-schema** — supabase/schemas/, db diff...
- **supabase-edge-functions** — Deno runtime, npm:/jsr: imports...
- **supabase-migrations** — naming YYYYMMDDHHmmss_*.sql, RLS obrigatório...
- **supabase-postgres-style** — Postgres SQL style guide (lowercase...)
- **supabase-realtime** — broadcast vs postgres_changes, RLS para realtime...
- **supabase-rls-policies** — auth.uid(), policies por operação, indexing...
```

**Justificativa:**
- **Custo zero de código.** v1.8 é content-only por design. Tocar `sync.js` para adicionar uma seção `## Supabase` quebraria a regra "este milestone é só conteúdo, nada mais". Cria precedente ruim (toda nova suíte quer sua categoria → sync.js cresce).
- **Cluster visual já acontece.** Em alfabética, todos os `supabase-*` ficam juntos. Visualmente: bom o suficiente.
- **TOK-02 lean.** v1.6 introduziu `summarize()` (sync.js:260-266) que corta descrições em 80 chars. Os 14 itens novos respeitam. Token cost de adicionar 14 linhas de ~80 chars: ~1.1 KB. Aceitável (CLAUDE.md já tem ~5 KB; +20%).

**Alternativas consideradas:**

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Não tocar `buildAggregatedRules`** (recomendada) | v1.8 fica content-only; cluster alfabético funciona | Sem categoria explícita — só prefixo | **Escolhida** |
| **B. Adicionar `## Suítes/Supabase` em CLAUDE.md** | Categorização explícita | Toca `sync.js` (viola regra v1.8); precisa decidir como detectar "suíte" (frontmatter? prefixo?); afeta todos os targets com `rules.mode: 'single'` | Rejeitada — escopo creep |
| **C. Frontmatter `category: supabase`** + filtro em `buildAggregatedRules` | Genérico para futuras suítes | Mesma objeção de B + custo de schema | Rejeitada |

**Trade-off explícito:** categorização explícita (mais bonita) vs zero mudança de código (consistente com v1.8 escopo). Zero-mudança vence — v1.9+ pode revisitar se o problema voltar com mais suítes.

**Impacto em consumers:**
- Em CLAUDE.md (Claude Code): cluster de 14 supabase-* alfabético. User com `Ctrl+F supabase` acha tudo de uma vez.
- Em AGENTS.md (Codex), GEMINI.md (Gemini), `.github/copilot-instructions.md` (Copilot), `.windsurf/rules/`, `.agents/rules/`, `.trae/rules/`, `.cursor/rules/`: mesmo conteúdo via `buildAggregatedRules` — comportamento consistente.

---

## Estrutura de Projeto Recomendada

Para o **repositório kit-mcp** (apenas adições):

```
kit/
├── agents/                              # 24 existentes + 6 novos
│   ├── schema-checker.md                # existente — atualizar tools para mcp__supabase__* (oportunístico)
│   ├── supabase-architect.md            ◄ novo
│   ├── supabase-auth-bootstrapper.md    ◄ novo
│   ├── supabase-edge-fn-writer.md       ◄ novo
│   ├── supabase-migration-writer.md     ◄ novo
│   ├── supabase-realtime-implementer.md ◄ novo
│   └── supabase-rls-writer.md           ◄ novo
├── commands/
│   └── supabase.md                      ◄ novo (único)
├── skills/                              # example-skill existente + 8 novas
│   ├── example-skill/SKILL.md           # existente
│   ├── supabase-auth-ssr/SKILL.md       ◄ novo
│   ├── supabase-database-functions/SKILL.md ◄ novo
│   ├── supabase-declarative-schema/SKILL.md ◄ novo
│   ├── supabase-edge-functions/SKILL.md ◄ novo
│   ├── supabase-migrations/SKILL.md     ◄ novo
│   ├── supabase-postgres-style/SKILL.md ◄ novo
│   ├── supabase-realtime/SKILL.md       ◄ novo
│   └── supabase-rls-policies/SKILL.md   ◄ novo
└── (resto do kit inalterado)
```

**Justificativa da estrutura:**
- **Zero diretórios novos no nível raiz.** Tudo cai em `agents/`, `commands/`, `skills/` — três pastas que `kit.js` já lê.
- **Zero subdiretórios em agents/commands.** `readMdDir` (`kit.js:79-109`) só varre o nível 1. Subdiretórios seriam invisíveis.
- **Zero subdiretórios extras em skills/<name>/.** `readSkillsDir` (`kit.js:111-145`) lê só `<dir>/SKILL.md`. Pode haver `references/` interno (template do `example-skill` documenta isso), mas não é varrido — só lido se a SKILL.md instruir Read manualmente. Útil para guias longos divididos em pedaços.

---

## Padrões Arquiteturais

### Padrão 1: Skill com `references/` para conteúdo grande

**O que é:** SKILL.md é o arquivo lazy-loaded que o LLM puxa quando description bate. Para conteúdo extenso (>50 KB), criar `references/<topic>.md` ao lado e SKILL.md instrui Read on-demand.

**Quando usar:** Skills com >5 sub-tópicos detalhados ou exemplos de código longos. Para Supabase: `supabase-rls-policies` (5 operações × 4 patterns = potencialmente longa) e `supabase-realtime` (broadcast vs postgres_changes vs presence é denso).

**Trade-offs:**
- **Pro:** mantém SKILL.md leve (~5-10 KB) — LLM carrega rápido; só puxa references quando precisa.
- **Contra:** mais arquivos para manter; user em IDE não-Claude pode não saber que references existem.

**Exemplo de organização:**
```
kit/skills/supabase-rls-policies/
├── SKILL.md                    # 5 KB — visão geral + ponteiros
├── references/
│   ├── select-policies.md      # patterns para SELECT
│   ├── insert-policies.md      # patterns para INSERT (WITH CHECK)
│   ├── auth-helpers.md         # auth.uid(), auth.jwt(), MFA
│   └── performance.md          # indexing, security definer fns
```

SKILL.md interno:
```markdown
Para policies de SELECT, ler [references/select-policies.md](references/select-policies.md).
Para indexing, ler [references/performance.md](references/performance.md).
```

### Padrão 2: Agent com bloco `<files_to_read>` para handoff de fase

**O que é:** Quando um agent é invocado pelo command `/supabase`, o command preenche um bloco `<files_to_read>` no prompt apontando para SUPABASE-DESIGN.md ou state files. O agent lê esses no boot.

**Quando usar:** Sempre que o agent precisa contexto de design/decisões prévias. Padrão herdado de `kit/agents/debugger.md:30` ("Se o prompt contiver um bloco `<files_to_read>`, você DEVE usar a ferramenta `Read` para carregar cada arquivo listado").

**Exemplo:**
```markdown
## Boot

Se o prompt anexar `<files_to_read>`:
- Ler todos antes de qualquer ação
- O contexto inclui design decisions já tomadas — não relitigue

Se vazio:
- Operar standalone com base na descrição em $ARGUMENTS
```

### Padrão 3: Detecção de capabilities + degradation graciosa

**O que é:** Toda invocação do agent começa com 3 file-exists checks (supabase/config.toml, supabase/schemas/, supabase/migrations/) + 1 capability check (Supabase MCP disponível?). Resultado branca o behavior em 4 modos: live-declarative, live-migration, offline-declarative, offline-migration.

**Quando usar:** Todos os 6 agents Supabase. Custo de detecção: ~50ms (3 file checks) + 0ms (tool availability lido do prompt env). Trivial.

**Exemplo:**
```markdown
## Detecção (executar primeiro)

```bash
HAS_DECLARATIVE=$(test -d supabase/schemas && echo 1 || echo 0)
HAS_MIGRATIONS=$(test -d supabase/migrations && echo 1 || echo 0)
HAS_CONFIG=$(test -f supabase/config.toml && echo 1 || echo 0)
```

Verificar tools no prompt: contém `mcp__supabase__execute_sql`?

| HAS_DECL | HAS_MIG | MCP | Modo escolhido |
|----------|---------|-----|----------------|
| 1 | * | 1 | live-declarative |
| 1 | * | 0 | offline-declarative |
| 0 | 1 | 1 | live-migration |
| 0 | 1 | 0 | offline-migration |
| 0 | 0 | * | AskUserQuestion: "supabase/ vazio. Rodar supabase init?" |
```

---

## Fluxo de Dados — Invocação Típica

### Fluxo 1: User digita `/supabase rls "Restringir SELECT em messages para sender ou receiver"`

```
User
 │
 ▼
/supabase command (kit/commands/supabase.md)
 │  - Parse subcomando "rls" → mapeia para supabase-rls-writer
 │  - Lê supabase/config.toml para project_id
 │  - Detecta layout (declarative vs migration)
 │
 ▼
Task(subagent_type="supabase-rls-writer", prompt={objective + context + tarefa})
 │
 ▼
supabase-rls-writer agent (kit/agents/supabase-rls-writer.md)
 │  - Detecta capabilities (MCP Supabase? declarative?)
 │  - Carrega skill supabase-rls-policies (via description match)
 │  - Carrega skill supabase-postgres-style (via description match)
 │  - Gera SQL: CREATE POLICY ... USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
 │  - Se MCP live: valida via mcp__supabase__execute_sql contra schema real
 │  - Escreve em supabase/schemas/messages.sql (declarative) ou nova migration
 │
 ▼
Output: caminho do arquivo escrito + diff resumido + recomendação ("rode supabase db diff")
```

### Fluxo 2: User está em Cursor sem MCP Supabase

```
User → /supabase rls (não funciona em Cursor — registry.js diz commands: null)
User → invoca @supabase-rls-writer diretamente via Cursor agent picker
 │
 ▼
supabase-rls-writer (.cursor/agents/supabase-rls-writer.md — stub apontando para kit/)
 │  - Detecta: sem MCP Supabase → modo offline
 │  - Detecta layout
 │  - Gera SQL puramente da skill loaded
 │  - Escreve no arquivo
 │  - Output marca claramente: "MODO OFFLINE — apliquei SQL baseado em convenções; valide com `supabase db push --dry-run`"
```

---

## Considerações de Escala

| Escala | Ajustes |
|--------|---------|
| **v1.8 — 14 itens supabase-*** | Estrutura flat com prefixo é confortável. CLAUDE.md cresce ~1 KB. Sync mantém perf via stubsOnly. |
| **v1.9-v2.0 — outras suítes (auth0, stripe, vercel)** | Mesma convenção: prefixo `<vendor>-`. CLAUDE.md cresce linearmente. Nenhuma reestruturação necessária até ~50 itens totais. |
| **v3.0+ — 100+ skills/agents** | Reconsiderar Decisão 8 (categorização em CLAUDE.md). Talvez frontmatter `category:` com gate em `buildAggregatedRules`. **Não fazer agora.** |

### Prioridades de Escala

1. **Primeiro gargalo: token cost de CLAUDE.md.** Cada novo item adiciona ~80 chars (após `summarize`). 100 itens = ~10 KB. Aceitável até ~200 KB de CLAUDE.md (~25k items). Não vai acontecer.
2. **Segundo gargalo: discoverability humana em listings flat.** Em `kit/agents/` com 50+ arquivos, scroll cansa. Mitigação futura: tooling auxiliar (`kit list --tag supabase` se virar problema).

---

## Anti-Padrões

### Anti-Padrão 1: Modificar `sync.js` ou `kit.js` em v1.8

**O que as pessoas fazem:** "Vou só adicionar uma flag em `listKit()` para devolver skills agrupadas por categoria...". Toque mínimo escala para refactor.

**Por que está errado:** v1.8 é content-only por carta de princípios (PROJECT.md milestone description: "Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada"). Tocar runtime quebra a invariância e abre caixa de Pandora ("se podemos tocar para Supabase, podemos tocar para Stripe...").

**Faça isto em vez disso:** Tudo o que a Suíte Supabase precisa, faça via convenção textual nos arquivos `.md`. Se descobrir que precisa de mudança de runtime, **adie para v1.9** com tagging "código depois de conteúdo".

### Anti-Padrão 2: Inventar nova sintaxe de cross-reference

**O que as pessoas fazem:** Criar `[[supabase-rls-policies]]` (wiki-style) ou `{{skill:supabase-rls-policies}}` (mustache) para cross-refs.

**Por que está errado:** Nenhum IDE/LLM tem leitor para essa sintaxe. Vira texto morto. Markdown link relativo já funciona em todo lugar.

**Faça isto em vez disso:** `[supabase-rls-policies](../skills/supabase-rls-policies/SKILL.md)`. Funciona no GitHub (preview), funciona no editor markdown, funciona no LLM que entende paths.

### Anti-Padrão 3: Hardcodar project_id em tools do agent (regressão de schema-checker)

**O que as pessoas fazem:** Copiar de `schema-checker.md` literalmente: `tools: ..., mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql`. Esse `0a712001-...` é UUID do projeto pessoal do mantenedor.

**Por que está errado:** Quem instalar `@luanpdd/kit-mcp` em outro projeto Supabase tem outro UUID. Tool não é encontrado, agent falha.

**Faça isto em vez disso:** Usar nomes canônicos `mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, etc. (lista oficial do servidor MCP Supabase community). Recomendar **atualizar `schema-checker.md`** também como cleanup oportunístico.

### Anti-Padrão 4: Skills longas demais (> 30 KB)

**O que as pessoas fazem:** Despejar todo material-fonte do guia oficial em um único SKILL.md.

**Por que está errado:** SKILL.md é lazy-loaded — toda vez que o description bate, é carregado. 30 KB × cada invocação = pesado. Skills devem ser destiladas, não cópias.

**Faça isto em vez disso:** SKILL.md ~5-10 KB com decisões/quando-usar/anti-padrões. Detalhes longos em `references/<topic>.md` que SKILL.md instrui Read on-demand. Padrão 1 acima.

### Anti-Padrão 5: Agents que escrevem fora de `supabase/`

**O que as pessoas fazem:** Por preguiça, agent escreve em `migrations/` no root ou em `db/policies/`.

**Por que está errado:** Não-padrão Supabase. CLI `supabase db push` não vai pegar. User confunde.

**Faça isto em vez disso:** Sempre dentro de `supabase/<convention-dir>/`. Se a convenção não cobre o caso, AskUserQuestion antes de escrever.

---

## Pontos de Integração

### Serviços Externos

| Serviço | Padrão de Integração | Notas |
|---------|----------------------|-------|
| Supabase MCP server | Tools `mcp__supabase__*` declarados no frontmatter de cada agent | Opcional — degrada para offline |
| Supabase CLI (local) | Agents recomendam comandos `supabase db push`, `supabase functions deploy` no output | User executa manualmente — agents não rodam CLI no Bash (poderia, mas pulamos para idempotência) |
| Material-fonte (7 guias oficiais) | Citado nas SKILL.md como fonte canônica + URLs | User pode validar diretamente |

### Limites Internos

| Limite | Comunicação | Notas |
|--------|-------------|-------|
| `/supabase` command ↔ 6 agents | Via `Task(subagent_type=...)` + prompt estruturado com `<objective>`, `<files_to_read>`, `<supabase_context>` | Padrão herdado de `/depurar` |
| Agent ↔ Skills | Via description match (gating LLM-side); links MD relativos no agent.md | Lazy — skill carrega só quando description bate com intenção da invocação |
| Skill ↔ Skill | Via links MD relativos | Ex: `supabase-migrations` cita `supabase-rls-policies` ("toda migration que cria tabela DEVE habilitar RLS — ver skill X") |
| Agent ↔ Sistema de arquivos | Read/Write/Edit em `supabase/**` | Agents NUNCA escrevem fora de `supabase/` exceto client code (Auth Next.js) que pergunta antes |

---

## Build Order Sugerido (ordem das fases)

A ordem dos efeitos de cascata é a seguinte (o que precisa estar resolvido antes de quê):

```
[Decisão 6: Naming flat com prefixo supabase-*]
        ↓ (fixa nomes para todas as outras)
[Decisão 1: Estrutura skills flat] ─┬─→ [Fase A: 8 skills]
[Decisão 4: Cross-refs MD link]    ─┘
        ↓
[Decisão 2: Tools dos agents (MCP-first)]  ─┐
[Decisão 5: Output destinos]               ─┼─→ [Fase B: 6 agents]
[Decisão 7: Compatibilidade docs]          ─┘
        ↓ (agents existem, podem ser dispatched)
[Decisão 3: /supabase command com subcomandos] ─→ [Fase C: 1 command]
        ↓
[Decisão 8: CLAUDE.md generation (não muda)]   ─→ [Fase D: validação E2E]
```

**Justificativa do ordering:**
- **Decisão 6 primeiro.** Decide os nomes. Tudo depende.
- **Skills antes de agents (Fase A → B).** Agents fazem cross-reference para skills (Decisão 4). Skills sem agents ainda têm valor (LLM carrega standalone). Agents sem skills referenciadas ficariam com links mortos.
- **Agents antes de command (Fase B → C).** Command faz dispatch via `Task(subagent_type=...)`. Sem agents existentes, command não tem o que invocar.
- **CLAUDE.md por último (Fase D).** É verificação, não construção. Roda `node tools.cjs sync claude-code` localmente, valida `CLAUDE.md` clusterizou os 14 itens corretamente. Smoke test E2E.

**Fases sugeridas para o roadmapper:**

| Fase | Foco | Decisões aplicadas | Outputs |
|------|------|--------------------|---------|
| **Phase 25** | 8 skills Supabase | 1, 4, 6, 7 | 8 SKILL.md (+ references/ se necessário) |
| **Phase 26** | 6 agents Supabase | 2, 4, 5, 6, 7 | 6 agent.md com cross-refs para skills da Phase 25 |
| **Phase 27** | /supabase command | 3, 6 | 1 command.md com dispatch para 6 agents |
| **Phase 28** | Validação cross-IDE + cleanup oportunístico | 8 + atualizar schema-checker.md (Anti-Padrão 3) | sync para 8 targets, smoke test, fix tool IDs em schema-checker |

Phase 25 e Phase 26 são parcialmente paralelizáveis (skills e agents são arquivos independentes), mas agents referenciam skills via link — então skills entregues primeiro evita revisão depois.

---

## Componentes — Novos vs Modificados

### Novos componentes (em v1.8)

- **8 SKILL.md** sob `kit/skills/supabase-*/SKILL.md`
- **6 agent.md** sob `kit/agents/supabase-*.md`
- **1 command.md** sob `kit/commands/supabase.md`
- **Total: 15 arquivos novos.** ~120-180 KB estimado (skill ~10-20 KB, agent ~8-12 KB, command ~3-5 KB).

### Componentes modificados (mudança mínima e oportunística)

- **`kit/agents/schema-checker.md`** — atualizar tools de `mcp__0a712001-...__*` para `mcp__supabase__*`. Não bloqueia v1.8 mas alinha. Marcar como tarefa opcional na Phase 28.

### Componentes inalterados (NÃO tocar em v1.8)

- `src/core/registry.js` — TARGETS table fica como está.
- `src/core/sync.js` — projeção sem mudanças.
- `src/core/kit.js` — leitura sem mudanças.
- `src/core/gates.js`, `gate-runner.js`, etc. — irrelevantes.
- `src/cli.js`, `src/mcp/server.js` — irrelevantes.
- CI workflows (`.github/workflows/`) — smoke tests devem continuar passando sem ajuste.

---

## Confidence & Riscos Conhecidos

**Confiança:** HIGH.

**Por quê:**
- Cada decisão tem precedente direto no código (`kit.js`, `sync.js`, `registry.js`) ou em arquivos `.md` existentes (`schema-checker.md`, `fluxos-trabalho.md`, `depurar.md`, `fazer.md`).
- Zero incógnitas técnicas — runtime testado desde v1.0; v1.7 acabou de fechar com 8 fases passing.
- Mecânica de sync (stubs vs copy) já validada para os 8 IDEs.

**Riscos residuais (baixo impacto):**

1. **Tool IDs `mcp__supabase__*` podem mudar.** Servidor MCP Supabase community pode renomear tools. Mitigação: versão atual conhecida (referência consultada em 2026-05-06). Se mudar, agent fica em modo offline silenciosamente (não falha catastrófico).
2. **Cross-refs em targets sem skills (Cursor, Trae) viram links mortos.** Mitigação: tabela de Compatibilidade no topo (Decisão 7) avisa explicitamente; user clica no link e vê 404, não crash.
3. **Cluster de 14+ itens em CLAUDE.md.** Mitigação: já discutido (Decisão 8), aceitável até ~50 itens; v1.9+ revisita se houver crescimento exponencial.

---

## Fontes

- `D:/projetos/opensource/mcp/src/core/kit.js` — leitura de skills/agents/commands (`listKit`, `readMdDir`, `readSkillsDir`)
- `D:/projetos/opensource/mcp/src/core/sync.js` — projeção stubs + `buildAggregatedRules` (linhas 268-290)
- `D:/projetos/opensource/mcp/src/core/registry.js` — TARGETS table cross-IDE (8 targets, capabilities por target)
- `D:/projetos/opensource/mcp/kit/agents/schema-checker.md` — precedente de tools MCP em agent
- `D:/projetos/opensource/mcp/kit/skills/example-skill/SKILL.md` — template de skill atual
- `D:/projetos/opensource/mcp/kit/commands/fluxos-trabalho.md` — precedente de subcomandos
- `D:/projetos/opensource/mcp/kit/commands/depurar.md` — precedente de dispatch para agent via Task
- `D:/projetos/opensource/mcp/kit/commands/fazer.md` — precedente de roteamento via tabela
- `D:/projetos/opensource/mcp/.planning/PROJECT.md` — milestone description fixa nomes e princípios
- [Supabase MCP Server docs](https://supabase.com/docs/guides/getting-started/mcp) — lista canônica de tools

---

*Pesquisa de arquitetura para: v1.8 Suíte Supabase — kit content packaging cross-IDE*
*Pesquisado: 2026-05-06*

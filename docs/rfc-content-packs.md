# RFC — Content Packs (loja de bundles instaláveis/desinstaláveis)

> **Status:** Draft (proposta para revisão). Autor: análise multi-agente + Claude. Data: 2026-06-13.
> Decisão de fundação tomada: **membership por manifesto `pack.json`** (não frontmatter).
> Nada aqui foi implementado — este documento é o contrato a aprovar antes de qualquer código.

Este RFC propõe transformar o kit-mcp de um pacote **all-or-nothing** num kit **modular**: um
núcleo (`core`) obrigatório stack-agnostic + **complementos opcionais por domínio/stack** que o
usuário instala e desinstala por projeto, como plugins de Docker. O objetivo declarado: deixar de
ser "Supabase-only" (resolvendo a própria seção *"Quando NÃO usar"* do README) e abrir caminho
para outros stacks (Appwrite, Firebase, PocketBase) como packs de primeira ou terceira parte.

Toda a proposta é **aditiva** e preserva a garantia de **stable API v1.0+** (16+ releases sem
breaking change): quem não selecionar packs continua recebendo o kit inteiro.

---

## 1. Contexto e motivação

### 1.1 O problema

- O README admite explicitamente: *"Você não usa Supabase… provavelmente outro kit serve melhor"*.
  Dos 74 agents, **19 são supabase-** e **36 referenciam `mcp__supabase__*`**; das 106 skills, **35
  são supabase-**. Quem não usa Supabase carrega esse peso sem usar.
- O `tagline` vende um kit genérico, mas a gravidade do conteúdo é Supabase. Packs reconciliam as
  duas naturezas: um `core` genérico serve quem não usa Supabase; packs de domínio servem o público
  atual.

### 1.2 O que o código já oferece de graça (costuras existentes)

| Costura | Onde | Uso para packs |
|---|---|---|
| `tier: core \| specialized` | frontmatter dos 74 agents (`scripts/tag-agent-tiers.mjs`) | Seed da membership do pack `core` (13 core). |
| `_shared-<domínio>/` | `kit/skills/` (6 dirs: supabase, multi-tenant, sre, observability, legacy, dados-distribuidos) | Domínios já são costuras reais no conteúdo. |
| Commands orquestradores | `/supabase`, `/multi-tenant`, `/sre`, `/observabilidade`, `/legacy`, `/dados-distribuidos` | Já enumeram os agents/skills do seu domínio → "manifestos implícitos" de bundle. |
| Descoberta por glob | `listKit()` em `src/core/kit.js:49-67` | Packs são camada de **seleção**, não mexem na descoberta. |
| Ponto único de projeção | `syncTo()` em `src/core/sync.js:94-150` | Um único filtro logo após `listKit()` propaga consistência. |

---

## 2. Objetivos e não-objetivos

### 2.1 Objetivos

1. Definir um **pack** como unidade instalável/desinstalável que agrupa agents + skills + commands
   (+ hooks que viajam com ele).
2. **Seleção na instalação** (checkbox interativo no `init`) **e a qualquer momento**
   (`kit pack add/remove/list/store`).
3. **Core obrigatório** vs **complemento opcional** definido por dados, não por adivinhação.
4. Resolver **dependências reais** entre packs (multi-tenant → supabase é hard dep).
5. **Extensibilidade para terceiros**: um terceiro publica um pack auto-contido sem editar o core.
6. **Zero breaking change**: default preserva o comportamento all-or-nothing.

### 2.2 Não-objetivos (v1)

- **Gates por pack** — gates rodam *in-process* a partir de `gates/` no pacote npm; `sync` **nunca**
  os projeta no projeto. Não há o que filtrar. Fora de escopo (ver §7.1).
- **Packs remotos / registry de terceiros hospedado** — v1 é local-only (packs first-party no npm
  + a possibilidade técnica de um terceiro adicionar `kit/packs/<id>/`). Distribuição remota é v2
  com modelo de segurança próprio (ver §9).
- **Granularidade por-feature** — packs são por-**suíte** (alinhado ao acoplamento real do hub
  `rls-hardener`). "Instalar só o sub-pedaço B2B sem supabase" não é possível e nem deveria ser.
- **Corrigir o glossário `_shared-*`** (bug pré-existente, ver §7.2).

---

## 3. Arquitetura atual (fatos da análise)

Referências de código verificadas:

- **Descoberta**: `listKit()` (`kit.js:49-67`) faz glob de `kit/agents/*.md`, `kit/commands/*.md`,
  `kit/skills/*/SKILL.md`, `kit/skills-extras/*/SKILL.md`, `kit/workflows/*.workflow.js`. O
  `file-manifest.json` **não** participa da descoberta — só integridade.
- **Projeção**: `syncTo()` (`sync.js:70-251`) itera **todos** os buckets (`sync.js:114-150`) e faz
  `mirror-tree` de `framework/` e `hooks/`. **Nenhum filtro** existe. `buildAggregatedRules()`
  (`sync.js:447-477`) monta o `CLAUDE.md` agregado a partir dos mesmos buckets.
- **Integridade**: `verifyManifest()` (`manifest-verify.js:50-174`) roda **antes** de escrever
  (`sync.js:83-88`); divergência de SHA256 lança `EMANIFESTMISMATCH` e aborta o install inteiro.
  `regen-manifest.js` varre `kit/**` (normaliza CRLF→LF) — **editar qualquer arquivo em `kit/`
  obriga regenerar o manifesto no mesmo commit**.
- **Remoção**: `removeFrom()` (`sync.js:303-335`) apaga **tudo** que tem `STUB_MARKER` num bucket,
  ou a subárvore inteira com `.kit-mcp-managed`. **Não distingue origem** → remoção parcial é
  impossível sem provenance.
- **Estado por-projeto**: só `.claude/.kit-mcp-version` (texto) + `.kit-mcp-restart-required`.
  All-or-nothing.
- **Interativo**: `src/core/ui.js:142-156` expõe só `select()` e `confirm()` (lazy
  `@inquirer/prompts`, optionalDependency). Falta `checkbox`.
- **Targets divergem radicalmente** (`registry.js:17-108`): Cursor não tem skills/commands/workflows;
  Codex não tem agents/commands; Antigravity não tem agents. **Crítico para o lockfile** (§5.4).
- **Hooks com hardcode**: `kit-router.cjs:30-83` tem `DOMAINS[]` com 7 domínios → entrypoints →
  agents literais. `post-apply-migration.js` é hook **morto** (não registrado) com vault Obsidian
  pessoal `chat-trynux` hardcoded.

---

## 4. O grafo de dependências (por que supabase é o nó crítico)

`supabase-rls-hardener` é o **hub canônico de materialização**: chamado via `Task()` por ~18 agents,
incluindo de fora da suíte Supabase (audit-log, crm, invite, org-onboarding, super-admin, lgpd,
multi-tenant-rls-writer, evolution-go) **+ `planner` + `debugger`**. Consequências:

- **multi-tenant e DDIA não funcionam sem supabase** → `requires` transitivo real.
- **O core não é 100% puro**: `executor.md` (L45-55), `planner.md` (L912), `verifier.md`,
  `discuss-phase.md` (L59) e `debugger.md` (L789) citam agents supabase por nome literal. Tratados
  como **soft-deps** (fallback p/ `general-purpose`), mas são **~4-5 agents core**, não 2.

---

## 5. Arquitetura proposta

### 5.1 Manifesto de pack — `kit/packs/<id>/pack.json`

Fonte de verdade da membership. Os recursos **continuam onde estão** (`kit/agents/`, etc.); o
manifesto apenas **referencia** por lista explícita e/ou glob.

```jsonc
{
  "schemaVersion": 1,
  "id": "supabase",                       // único, kebab-case, namespace-able: "acme.appwrite"
  "name": "Supabase Materialization Suite",
  "version": "1.39.0",                    // semver do pack (independente do pkg)
  "description": "Schema + RLS + Edge Functions + Auth materializers para Supabase",
  "publisher": "luanpdd",                 // first-party vs terceiro
  "kind": "domain",                       // "core" | "domain" | "stack-adapter"
  "removable": true,                      // core => false
  "compat": { "kitMcp": ">=1.39.0", "targets": ["claude-code","cursor","codex","windsurf","antigravity","copilot","trae"] },
  "requires": [],                         // ids de pack OU "capability:<x>" (hard dep)
  "recommends": ["observability"],        // soft dep (sugestão no store, não bloqueia)
  "conflicts": [],                        // ex: dois stack-adapters mutuamente exclusivos
  "provides": ["capability:db-materializer", "capability:rls-materializer"],
  "resources": {
    "agents":    ["supabase-*", "schema-checker", "!supabase-edge-fn-tester"],  // globs + exclusões + nomes
    "skills":    ["supabase-*"],
    "commands":  ["supabase"],
    "workflows": [],
    "hooks":     ["post-apply-migration.js"]   // hooks que viajam (registro/desregistro junto)
  }
}
```

**Por que manifesto e não frontmatter** (decisão tomada): (1) um terceiro entrega
`kit/packs/acme.appwrite/pack.json` + seus `.md` sem tocar o core; (2) os eixos `domain` não existem
em skills/commands hoje — globs evitam editar 200+ arquivos; (3) `requires`/`compat`/`conflicts`/
`provides` não cabem em frontmatter por-arquivo.

**Índice gerado** `kit/packs/registry.json` (por `scripts/regen-pack-registry.js`, idempotente como
`regen-manifest`): agrega todos os packs locais + `counts` derivados resolvendo os globs contra
`listKit()`. É o "catálogo da loja" e alimenta o menu do store.

### 5.2 Resolver — `src/core/packs.js` (novo módulo)

- `listPacks(kitRoot)` — lê `kit/packs/*/pack.json` (glob + cache TTL 30s, espelha `listGates`).
- `resolvePacks(selectedIds, catalog, ctx)` — fecho transitivo de `requires` (topo-sort), detecta
  ciclo (`EPACKCYCLE`), valida `conflicts` (`EPACKCONFLICT`), `compat.kitMcp` vs `PKG_VERSION`
  (`EPACKINCOMPAT`) e `compat.targets` vs target. **Resolve `capability:`**: um `requires:
  ["capability:db-materializer"]` é satisfeito por qualquer pack efetivo cujo `provides` contém a
  capability. Retorna `{ effective, added, warnings }`.
- `resourceSelector(effectiveIds, catalog)` — une os globs de todos os packs efetivos →
  `{ agents:Set, commands:Set, skills:Set, workflows:Set, hooks:Set }`. Exclusões (`!x`) por último.
- `filterKitByPacks(kit, selector)` — reduz cada bucket de `kit`.

### 5.3 Ponto de filtro — **um só**, em `sync.js:94`

```js
// dentro de syncTo, logo após  const kit = await listKit(...)
if (opts.packSelector) kit = filterKitByPacks(kit, opts.packSelector);
```

Como `ops[]`, `buildAggregatedRules` e `written[]` **todos derivam de `kit`**, filtrar uma vez torna
tudo consistente (anti shotgun-surgery). `framework/` mirror-tree continua sempre (é do core).

### 5.4 Lockfile de provenance — **por-(pack, target)**

> **Esta é a correção estrutural mais importante** que a crítica adversarial pegou. Os targets têm
> superfícies desiguais (Codex descarta agents; Antigravity não tem agents) e vivem em diretórios
> diferentes (`.claude/`, `.cursor/`, `.codex/`). Um lockfile único em `.claude/` corrompe a
> contabilidade multi-IDE.

Estado por-target (junto do marker existente de cada target):

```jsonc
// <targetDir>/.kit-mcp-packs.json   (ex.: .claude/, .cursor/, .codex/)
{
  "schemaVersion": 1,
  "kitMcpVersion": "1.39.0",
  "packs": {
    "core":         { "version": "1.39.0", "explicit": true },
    "supabase":     { "version": "1.39.0", "explicit": true },
    "multi-tenant": { "version": "1.39.0", "explicit": false, "reason": "required-by:ddia" }
  },
  "projectedFiles": {
    "supabase": ["agents/supabase-rls-hardener.md", "skills/supabase-migrations/SKILL.md"]
  }
}
```

`projectedFiles` é a provenance que falta hoje, mapeada `op → pack` durante o `syncTo` (em memória)
e **escrita FORA do `syncTo`**.

> **Regra dura:** o lockfile é escrito **apenas** nos pontos que conhecem packs
> (`kit pack add/remove`, `sync install --packs`, `init` com seleção). `syncTo`, `auto-install` e
> `watch` **só leem** packs ativos e filtram — **nunca escrevem** o lockfile. Senão um tick de
> `watch` ou um `auto-install` no connect do MCP (caminho quente, sem `opts.packs`) sobrescreve a
> seleção do usuário silenciosamente.

### 5.5 Remoção seletiva — `removePack(targetId, packId, opts)`

1. Valida que nenhum pack instalado tem `requires` apontando para `packId` (`EPACKDEPENDED`, a menos
   de `--cascade` que mostra o **fecho reverso** de dependents no preview).
2. Computa `exclusiveNames(lockfile, packsRemovidos, packsRemanescentes)` — nomes presentes
   **exclusivamente** nos packs removidos (interseção com packs ativos remanescentes; um agent em
   `supabase`+`multi-tenant` com `multi-tenant` ainda ativo **fica**).
3. Apaga só esses `projectedFiles`, **reconfirmando `STUB_MARKER`/`isCleanStub`** antes de cada
   delete (segurança contra edição manual).
4. Desregistra hooks do pack (ver §7.4) e reescreve o lockfile.
5. **Itera sobre todos os targets já instalados** (reusa `detectExistingTargets` em `watch.js:102`),
   senão o pack vira fantasma nos outros IDEs.

### 5.6 Store UX

- **`src/core/ui.js`** ganha `multiSelect()` via `checkbox` do `@inquirer/prompts`.
- **`init` e `sync install`**: após `pickTarget`, passo `packPicker()` — `core` pré-marcado e
  travado (`disabled`); confirma deps inline ("multi-tenant puxa supabase"); preview com totais.
- **Grupo CLI `kit pack`** (espelha `kit`/`sync`/`cost` ~`cli/index.js:177`):
  `list [--installed]`, `info <id>`, `add <id...>`, `remove <id...> [--cascade]`,
  `store` (checkbox interativo — o "Docker store a qualquer momento"), `doctor`.
- **Flag** `--packs <csv|all|core>` em `sync install`/`init` (CI/non-interactive).
- **MCP tool `pack`** (dispatch action-based como `reverse-sync`/`gates`):
  `list|info|resolve|doctor` (read-only, OK no MCP), `add|remove` (re-sync, OK pois recebem ids
  explícitos), `store` **bloqueado** no MCP (exige TTY — mesmo guard de `gates.run` em
  `index.js:397-413`).

---

## 6. Particionamento: core vs os 8 packs

### 6.1 `core` (required, `removable: false`) — base sempre instalada

- `framework/` inteiro (mirror-tree) + hooks.
- 16 agents de ciclo de vida: planner, plan-checker, phase-researcher, executor, verifier,
  codebase-mapper, project-researcher, research-synthesizer, roadmapper, assumptions-analyzer,
  advisor-researcher, integration-checker, debugger, nyquist-auditor, user-profiler, example-reviewer.
- 59 commands de ciclo de vida (planejar/executar/discutir/novo-projeto/progresso/proximo/…).
- 1 skill (example-skill) + os workflows `.workflow.js`.
- **softDeps documentadas** (não-membros): os ~5 agents core que citam supabase por nome → fallback
  graceful para `general-purpose` quando o pack supabase não está instalado.

### 6.2 Princípio: packs autossuficientes (zero `requires`)

Decisão (v1): **nenhum pack opcional depende de outro pack opcional.** Tudo que um pack precisa está
dentro dele ou na base (`core`). Isso elimina a classe inteira de bugs "instalei X mas quebrou porque
Y não está lá". Consequência prática: B2B multi-tenant e a auditoria de dados distribuídos (ex-"DDIA")
foram **fundidos dentro do pack `supabase`** — eles dependem dos materializadores Supabase via `Task()`,
então separá-los criaria packs dependentes. O resolver (`src/core/packs.js`) ainda suporta
`requires`/`conflicts`/`capability` para packs de terceiros no futuro, mas os first-party não usam.

### 6.3 Packs opcionais (`kind: domain`, todos `removable`, `requires: []`)

| Pack | agents | commands | skills | Conteúdo |
|---|--:|--:|--:|---|
| **supabase** — "Supabase (completo)" | 33 | 3 | 57 | Materialização (schema/RLS/migrations/Edge Functions/Auth/Storage/Realtime) **+** B2B multi-tenant (org/RBAC/convite/onboarding/super-admin/LGPD/CRM/WhatsApp) **+** auditoria de dados distribuídos (consistência, isolamento, hot-tenant, evolução de schema). Cmds: `/supabase` `/multi-tenant` `/dados-distribuidos` |
| **observability** — "Observabilidade & SRE" | 14 | 18 | 20 | OTel, golden signals, SLO/burn-rate, toil, postmortem, PRR, cascading, load shedding, release audit. Stack-agnostic |
| **legacy** — "Código Legado (Feathers)" | 6 | 8 | 13 | Characterization tests, seams, refactor gate, duplicação, storytelling, mutation |
| **ui** — "UI & Design" | 4 | 2 | 7 | UI-SPEC, verificação, auditoria visual, designer |
| **cost-workflow** — "Custo & Workflows" | 1 | 4 | 2 | Cost tracking + gerador de Dynamic Workflows |

`slo-engineer` fica no pack `observability` (base-friendly): produz `SLO.md` sem Supabase; só a
materialização SQL dos SLI events degrada graciosamente se o pack supabase não estiver presente —
soft-dep de runtime, **não** `requires` de instalação.

### 6.4 Stack-adapters futuros

`appwrite`, `firebase`, `pocketbase` — greenfield. Como cada pack é autossuficiente, um adapter futuro
seria um novo pack autossuficiente (com seus próprios materializadores). O mecanismo
`provides`/`capability` no resolver permanece disponível caso, mais tarde, se queira um pack de domínio
que troque de backend — mas o default v1 é não criar essa dependência.

---

## 7. Cross-cutting / minas (premissas falsas eliminadas pela crítica)

### 7.1 Gates NÃO são projetados — fora de escopo
`gates.js:23-58` lê de `DEFAULT_GATES_ROOT` (`gates/` no pacote npm) e roda in-process;
`sync.js` nunca copia gates; `registry.js` não tem capability `gates`. "Filtrar gates por pack" é
no-op. **Removido do escopo.** Se um dia gates forem por-pack, primeiro `sync` precisa **projetar**
gates (feature independente).

### 7.2 `_shared-*` NÃO são sincronizados (bug pré-existente)
Os 6 dirs `kit/skills/_shared-*` têm só `glossary.md`, sem `SKILL.md` → `readSkillsDir`
(`kit.js:125-131`) os pula → nunca entram em `listKit` → nunca são projetados (nem hoje). As skills
que referenciam o glossário **já têm referência quebrada no alvo**. Packs não pioram nem consertam.
**Não prometer** que o pack carrega o glossário. (Corrigir é trabalho separado: dar `SKILL.md`
mínimo ou um passo de cópia explícito.)

### 7.3 README counts ≠ CLAUDE.md do projeto
`update-readme-counts.js:51-55` conta o **repo** (fonte de verdade) → README sempre anuncia o kit
cheio. Já o `CLAUDE.md` **do projeto** (`buildAggregatedRules`) lista só os buckets filtrados →
encolhe corretamente. São coisas diferentes; documentar para não confundir. Estender o README para
contagem por-pack é trivial mas opcional.

### 7.4 kit-router — gerar router derivado no sync (não ler lockfile por-prompt)
`kit-router.cjs` roda como `UserPromptSubmit` hook (processo separado, sem `projectRoot` confiável).
Fazê-lo ler o lockfile a cada prompt é I/O no hot path + falha soft. **Solução**: materializar
`DOMAINS[]` no momento do `sync` a partir dos packs instalados, embutido no `.cjs` projetado. O
produto cartesiano packs×targets já produz o router correto. (Mesma técnica vale para tornar os
handoffs hardcoded do `executor.md`/`discuss-phase.md` condicionais — v2.)

### 7.5 Hooks por-pack: registro/desregistro seguro
`handleAutoInstall` (`index.js:555-585`) hoje hardcoda `HOOKS=['kit-router','kit-attribution-reminder']`
e registra por substring-match. Para hooks por-pack (ex.: `post-apply-migration` no pack supabase):
persistir no lockfile o **entry exato** inserido e, na remoção, casar por **igualdade estrutural**,
pulando entries cujo matcher/timeout/command divergem (= editado pelo usuário → preservar). E
`post-apply-migration.js` precisa do vault Obsidian `chat-trynux` extraído para config (hoje é
hook morto com path pessoal).

### 7.6 reverse-sync precisa ser pack-aware
`reverse-sync.js:31` chama `listKit()` sem filtro → um agent de pack não-instalado pode ser visto
como "new-in-ide" e sugerir sobrescrever o canonical. Propagar `packSelector` para `detectReverse`.

### 7.7 Diff de upgrade
Usuário com `--packs core` fixo perde features novas do core a cada release silenciosamente. O
lockfile tem `kitMcpVersion` → comparar com a versão atual e listar o delta de membership resolvido
("o pack X ganhou N recursos; novo pack Y disponível").

### 7.8 Manifesto SHA256 — gate de CI bloqueante
Editar `kit/packs/**` + tag inicial muda hashes → `regen-manifest.js` **obrigatório** no mesmo
commit, senão `EMANIFESTMISMATCH` quebra **todo** install em todos os IDEs. Mitigação: um único
script prepublish que roda em sequência tag → `regen-pack-registry` → `regen-manifest` →
`update-readme-counts`, + teste que **falha se `git status` ficar sujo** após rodar (padrão de
idempotência que esses scripts já têm).

### 7.9 Gate de cobertura
CI valida `UNIÃO(packs) == listKit()` completo — nenhum recurso órfão (projetado por pack nenhum).
Um recurso novo que não casa nenhum glob **some** do install seletivo; o gate falha o build.

---

## 8. Decisões em aberto

1. ~~slo-engineer e agents sem prefixo~~ **RESOLVIDO**: packs são autossuficientes (§6.2). Os agents
   supabase-locked sem prefixo (multi-tenant/ddia) foram fundidos no pack `supabase` via lista
   explícita no manifesto. `slo-engineer` fica em `observability` com soft-dep de runtime (degrada,
   não bloqueia). Nenhum first-party pack usa `requires`.
2. **`recommends` no store**: mostrar sugestões opcionais — incluir na v1 ou adiar.
3. **Contagem por-pack no README** — incluir ou deixar global.

---

## 9. Segurança (relevante quando houver packs de terceiros — v2)

MVP é local-only (first-party). Quando packs remotos/terceiros existirem: assinatura/checksum
por-pack (estender `file-manifest` para por-pack), allowlist de publishers, **nunca** auto-instalar
pack remoto sem `confirm` explícito, e revisão de que `hooks`/JS do pack são código que o IDE
executa. Ver `docs/sidecar-security.md` para o modelo de ameaça vizinho.

---

## 10. Plano de migração (3 fases, zero breaking change)

**Fase 1 — Seed (sem mudar runtime).** Criar `kit/packs/<id>/pack.json` para `core` + 8 domínios via
script de bootstrap (deriva membership de prefixos + `tier:core` + tabelas de dispatch dos
orquestradores). Gerar `registry.json`. Rodar `regen-manifest`. Gate de cobertura
`UNIÃO(packs)==listKit`. **Nada muda no comportamento.**

**Fase 2 — Seleção opt-in.** `src/core/packs.js` (resolver + selector + filtro em `sync.js:94`) +
lockfile por-target (escrito fora do syncTo). `kit pack` group + MCP tool + flag `--packs`.
**Default sem `--packs` e sem lockfile = todos os packs** (back-compat exato). Projetos com
`.kit-mcp-version` mas sem lockfile → backfill "all packs explicit".

**Fase 3 — Loja + hardening.** `checkbox` no `init`/`store`; `auto-install` lê lockfile existente
(preserva seleção em upgrade). Neutralizar acoplamentos: gerar `kit-router` derivado (§7.4),
hooks por-pack (§7.5), reverse-sync pack-aware (§7.6), diff de upgrade (§7.7).

---

## 11. Estratégia de testes

- **Unit**: resolver (fecho transitivo, ciclo, conflicts, compat, capability), `exclusiveNames`,
  `filterKitByPacks`.
- **Integração**: install com `--packs core` projeta só core; `add supabase` adiciona; `remove`
  com dependent bloqueia; multi-target remove em todos os IDEs; default sem flag == kit inteiro
  (snapshot vs comportamento atual).
- **Idempotência**: `regen-pack-registry` + `regen-manifest` deixam `git status` limpo.
- **Gate de cobertura**: união dos packs == `listKit()`.
- **Mutation** (stryker já configurado) no resolver.

---

## 12. Resumo das mudanças por arquivo

| Arquivo | Mudança |
|---|---|
| `kit/packs/<id>/pack.json` (novo) | 9 manifestos (core + 8) |
| `kit/packs/registry.json` (gerado) | índice/catálogo |
| `src/core/packs.js` (novo) | listPacks, resolvePacks, resourceSelector, filterKitByPacks, exclusiveNames |
| `src/core/sync.js` | filtro em :94; `removePack` seletivo; provenance op→pack |
| `src/core/ui.js` | `multiSelect()` (checkbox) |
| `src/cli/index.js` | grupo `kit pack`; flag `--packs` em sync/init; packPicker |
| `src/mcp-server/index.js` | tool `pack`; auto-install lê lockfile; hooks por-pack |
| `src/core/reverse-sync.js` | propagar packSelector |
| `kit/hooks/kit-router.cjs` | `DOMAINS[]` gerado no sync |
| `kit/hooks/post-apply-migration.js` | vault → config; registrar via pack supabase |
| `scripts/regen-pack-registry.js` (novo) | gera registry + chama regen-manifest |
| `scripts/tag-packs.mjs` (novo, opcional) | back-ref `pack:` no frontmatter p/ doctor |
| `scripts/update-readme-counts.js` | (opcional) contagem por-pack |

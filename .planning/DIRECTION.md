# DIRECTION — kit-mcp

> Gerado por `direction-prospector` em 2026-07-01 · Base: repo @luanpdd/kit-mcp **v1.45.0**
> (86 agents · 98 commands · 103 skills · 24 gates · 6 packs · 1 workflow embarcado)
> Método: skill `leverage-scoring` — `Leverage = (Impact / EffortNum) × ConfidenceWeight`.
> Regra de ouro aplicada: finding sem `file:line` (ou commit) verificável não entra na tabela.

## Resumo — de onde vieram os sinais

Quatro gatilhos varridos, todos com evidência interna:

1. **Planning artifacts** — `.planning/STATE.md` (parado em v1.37.0, 2026-06-05), `.planning/ROADMAP.md`
   (parado em v1.29, 2026-05-12), `.planning/MILESTONES.md` ("Em andamento: nada — v1.9.0 concluído").
   O repo está em v1.45.0 — drift de 8 a 36 releases entre os artefatos de planejamento e a realidade.
2. **Auditorias internas** — `.planning/KIT-AUDIT.md` (2026-06-19, v1.42), `.planning/TOIL-AUDIT.md`
   (2026-05-09), `.planning/codebase/concerns.md` (2026-05-09), `docs/audit-recursos-melhorias.md`
   (174/174 recursos analisados). Cada achado foi **reverificado hoje contra o HEAD** — vários já
   foram fechados (ver "Considerado e rejeitado"); só entram na tabela os que ainda reproduzem.
3. **Git log recente** — `52ee623` (release 1.45.0), `f802c28` (feat `/base` — registro canônico
   PROJETOS.md multi-projeto), PRs #31-#38 (Content Packs, cost-awareness, shadcn/improve, Antigravity).
4. **Verificação direta no filesystem** — `kit/framework/VERSION` = 1.44.0 vs `package.json` = 1.45.0;
   6× `pack.json` = 1.39.0; README com "75 agents" e "86 agents" no mesmo arquivo; `requires`/`recommends`
   vazios em todos os packs; `kit/workflows/` com 1 arquivo; TODO/FIXME em `src/` = zero;
   `npm audit --omit=dev` = 1 moderate.

## Tabela de direções (ordenada por leverage)

| # | id | Direção | Evidência-chave | Impact | Effort | Conf | Leverage | Veredito |
|---|----|---------|-----------------|:---:|:---:|:---:|:---:|---|
| 1 | DIR-01 | Higiene de release single-source (versões + contagens derivadas, gate em CI) | `kit/framework/VERSION:1` vs `package.json:3` | 4 | S | HIGH | **4.00** | **P0 — adotar agora** |
| 2 | DIR-02 | Dogfooding: reconciliar `.planning/` com a realidade v1.45 | `.planning/STATE.md:3` · `.planning/ROADMAP.md:7` | 3 | S | HIGH | **3.00** | **P0 — adotar agora** |
| 3 | DIR-03 | Content Packs Fase 4 — grafo de dependências + coesão dos packs | `kit/packs/supabase/pack.json:5` · `.planning/KIT-AUDIT.md:42` | 4 | M | HIGH | **2.00** | **P1 — adotar (próximo milestone)** |
| 4 | DIR-04 | Fechar P1 da auditoria de recursos — handoffs explícitos + matar "observabilidade aspiracional" | `docs/audit-recursos-melhorias.md:60,303` | 3 | M | HIGH | **1.50** | **P1 — adotar** |
| 5 | DIR-05 | Multi-projeto como produto — evoluir `/base` de command para capability runtime | commit `f802c28` · `CHANGELOG.md:13` | 4 | M | MEDIUM | **1.40** | **P1 — estacionar até validar demanda** |
| 6 | DIR-06 | Estático→dinâmico — converter comandos flagship em Dynamic Workflows embarcados | `kit/workflows/` (1 arquivo) · `.planning/KIT-AUDIT.md:44` | 4 | L | MEDIUM | **0.93** | **P2 — estacionar** |

---

## DIR-01 — Higiene de release single-source (Leverage 4.00 · P0)

**Pitch:** derive VERSION, `pack.version` e contagens do README de uma fonte única no release e
bloqueie drift com gate — porque o fix manual já regrediu duas vezes documentadas.

```yaml
- id: DIR-01
  category: direction
  evidence: "kit/framework/VERSION:1 (`1.44.0`) vs package.json:3 (`1.45.0`); kit/packs/supabase/pack.json:5 (`1.39.0` — idem nos 6 packs); README.md:288 (`75 agents`) vs README.md:13 (`86 agents`)"
  impact: 4
  effort: S
  risk: S
  confidence: HIGH
  leverage: 4.00
```

**Por quê:** `check-update.js` lê VERSION → diagnóstico errado para todo usuário. O README é a
vitrine e se auto-contradiz. O ponto decisivo: `.planning/KIT-AUDIT.md:39` flagou **exatamente esta
classe** em 2026-06-19 (VERSION 1.30 vs package.json 1.42) como P1 com recomendação "derivar de fonte
única + teste que falha se divergirem" — foi corrigido na mão e **regrediu de novo** (hoje 1.44 vs
1.45; packs presos em 1.39 desde a v1.39). Recorrência comprovada = o problema é estrutural, não
pontual. O `TOIL-AUDIT.md:35-36` já tinha classificado contagens/manifest como toil P0 (score 7.0-8.0).

**Fix:** script `scripts/sync-versions.mjs` que propaga `package.json.version` → VERSION + 6
`pack.json` + registry no `npm version`; estender `update-readme-counts.js` para cobrir README:288
(bloco ASCII-tree); acoplar ambos como check no `prepublishOnly` (mesmo molde do gate
`resource-frontmatter` da v1.41). ~0,5 dia; elimina a classe inteira para sempre.

**Veredito: adotar agora** — cabe num `/expresso` antes de qualquer outro trabalho.

---

## DIR-02 — Dogfooding: reconciliar `.planning/` com a realidade (Leverage 3.00 · P0)

**Pitch:** o framework que vende disciplina de planejamento está com o próprio `.planning/` 8-36
releases atrás — e isso degrada uma feature shipped (cost-phase).

```yaml
- id: DIR-02
  category: direction
  evidence: ".planning/STATE.md:3 (`milestone: v1.37.0`, last_updated 2026-06-05) · .planning/ROADMAP.md:7 (v1.29 como 'Em andamento', atualizado 2026-05-12) · .planning/MILESTONES.md:405 ('(nada — v1.9.0 concluído)') · src/core/cost/aggregate-phase.js:196 (lê .planning/STATE.md para correlation_confidence)"
  impact: 3
  effort: S
  risk: S
  confidence: HIGH
  leverage: 3.00
```

**Por quê:** não é só estética. (a) `aggregate-phase.js:193-205` cruza `completed_at` do STATE.md
para calcular `correlation_confidence` do `cost-phase` — STATE stale = confidence errada numa tool
publicada. (b) `/progresso`, `/proximo`, `/novo-marco` roteiam a partir do STATE/ROADMAP — hoje
sugeririam "publicar v1.37". (c) O repo do kit é a demo viva do próprio produto; um `.planning/`
abandonado contradiz o pitch. As releases v1.38→v1.45 aconteceram por PR direto, fora do fluxo de
fases — vale registrar isso como decisão (ou voltar ao fluxo).

**Fix:** rodar `/reconciliar` + `/concluir-marco` retroativo (arquivar v1.29-em-aberto como
superseded), atualizar STATE/ROADMAP/MILESTONES para v1.45, e absorver como backlog vivo os P1
remanescentes do KIT-AUDIT (que hoje só existem dentro do relatório). ~0,5 dia.

**Veredito: adotar agora** — pré-requisito para qualquer milestone novo (inclusive DIR-03/05).

---

## DIR-03 — Content Packs Fase 4: grafo de dependências + coesão (Leverage 2.00 · P1)

**Pitch:** os packs prometem instalação modular, mas `requires`/`recommends` estão vazios nos 6 —
instalar só `supabase` deixa cross-links órfãos e quebra a promessa central da v1.39-v1.41.

```yaml
- id: DIR-03
  category: direction
  evidence: "kit/packs/{core,cost-workflow,legacy,observability,supabase,ui}/pack.json — `requires: []` e `recommends: []` nos 6 (verificado hoje) · .planning/KIT-AUDIT.md:42 (supabase-edge-fn-writer linka 4 skills de observability; edge-fn-tester linka 4 de legacy) · .planning/KIT-AUDIT.md:43 (cluster git/release preso no core não-removível) · .planning/KIT-AUDIT.md:57-60 (skills React no supabase; cost-workflow com 2 domínios sem overlap; examples inflando o core)"
  impact: 4
  effort: M
  risk: M
  confidence: HIGH
  leverage: 2.00
```

**Por quê:** é o gap P1 mais valioso do KIT-AUDIT ainda 100% aberto (os novos agents propostos lá
já foram todos entregues — ver rejeitados). O quick-win nº 5 do próprio audit
(`recommends:["observability","legacy"]` no supabase) é edit de metadata. A fase completa fecha:
recommends cross-pack, extração do pack `git-release` (removable), realocação das 3 skills React,
split/rename do `cost-workflow`, pack `examples` opcional. É a continuação natural da linha
v1.39→v1.41 (Fases 1-3 do RFC `docs/rfc-content-packs.md`).

**Veredito: adotar** — candidato natural a milestone v1.46, logo após DIR-01/02.

---

## DIR-04 — Fechar P1 da auditoria de recursos: handoffs + observabilidade aspiracional (Leverage 1.50 · P1)

**Pitch:** a v1.41 entregou os P0 da auditoria de 174 recursos (cost_tier, descriptions, preflight);
os P1 — handoffs quebrados e seções de observabilidade que nenhum código emite — continuam abertos.

```yaml
- id: DIR-04
  category: direction
  evidence: "docs/audit-recursos-melhorias.md:60 (integration-checker nomeia caller 'auditor de milestone' que não existe) · :303 (8+ agents declaram 'Observabilidade integrada' com counters/histograms OTel que NENHUM código emite) · :114 (P1 deep: Task() com captura de output + tabela direcional substituindo 'Ver também') · :57 (outputs não capturados, ex. generated_signup_migration_sql)"
  impact: 3
  effort: M
  risk: S
  confidence: HIGH
  leverage: 1.50
```

**Por quê:** é a maior fonte de expectativa falsa no conteúdo entregue — "especialmente irônico num
kit cujo diferencial é consciência de uso/custo" (palavras da própria auditoria, linha 81). O
trabalho é mecânico e em massa (mesmo perfil das ondas P0 já executadas com sucesso na v1.41):
remover/marcar como "planejado" as 8+ seções aspiracionais, corrigir callers inexistentes,
converter "Ver também" em tabelas direcionais antes/depois com Task() explícito.

**Veredito: adotar** — empacota bem como onda P1 dentro do mesmo milestone de DIR-03 (ambos são
content-only, zero risco de Stable API).

---

## DIR-05 — Multi-projeto como produto: `/base` → capability runtime (Leverage 1.40 · P1)

**Pitch:** o `/base` (v1.45.0) criou o registro canônico PROJETOS.md; o passo de produto é o kit
**usar** esse registro em runtime — hoje é só um command markdown, sem tool, sem doctor, sem
contexto cross-projeto.

```yaml
- id: DIR-05
  category: direction
  evidence: "commit f802c28 (feat: comando /base — gestao do registro canonico PROJETOS.md) · CHANGELOG.md:13 (entry 1.45.0 — 'Suporta projetos conectados para devs multi-projeto') · a regra global em ~/.claude/CLAUDE.md exige PROJETOS.md em todo projeto, mas nenhuma MCP tool/CLI valida ou consome o arquivo"
  impact: 4
  effort: M
  risk: M
  confidence: MEDIUM
  leverage: 1.40
```

**Por quê:** é a única direção genuinamente **de produto novo** (as demais são débito/higiene).
Devs multi-repo são o público declarado da feature; extensões naturais: MCP tool `base`
(list/validate/resolve de projetos conectados), check no `kit doctor` (PROJETOS.md ausente/
incompleto), e agents que resolvem caminhos de projetos conectados ao cruzar contexto (o
comportamento nº 4 da regra global, hoje inteiramente manual). **Mas** o sinal tem 1 commit de
idade e zero validação de uso — confidence MEDIUM por desenho.

**Veredito: estacionar até validar demanda** — usar o `/base` em 2-3 projetos reais primeiro;
se a fricção manual aparecer (ela vai aparecer no passo de "consultar projeto conectado"),
promover a milestone de produto. Reavaliar em ~30 dias.

---

## DIR-06 — Estático→dinâmico: workflows flagship embarcados (Leverage 0.93 · P2)

**Pitch:** o kit ensina Dynamic Workflows (skill de 329 linhas, gerador de 538, 6 patterns) mas
embarca 1 único workflow — enquanto os comandos mais caros continuam como Task() serial em prosa.

```yaml
- id: DIR-06
  category: direction
  evidence: "kit/workflows/ contém apenas auditar-observabilidade-cobertura.workflow.js (verificado hoje) · .planning/KIT-AUDIT.md:44 (mapear-codebase é Fanout-And-Synthesize hardcoded em prosa, sem schema/verify/resume) · :61 (revisar depende de CLIs externas frágeis) · :62 (auditores cross-suite seriais por arquivo deixam qualidade/wall-clock na mesa)"
  impact: 4
  effort: L
  risk: M
  confidence: MEDIUM
  leverage: 0.93
```

**Por quê estacionar:** o benefício é real mas estimado (não medido), cada conversão é L
(schema por doc + verify adversarial + barrier), e o próprio KIT-AUDIT registra que "1 workflow
embarcado" é parcialmente stance deliberada (o kit cresce pela capacidade de gerar workflows
locais). Fica como P2 até que DIR-01/02/03 abram espaço — ou até uma dor concreta de wall-clock
em `mapear-codebase` justificar a primeira conversão isolada (que seria M, não L, e subiria para
leverage ~1.4).

**Veredito: estacionar** — revisitar quando houver medição de wall-clock/qualidade dos comandos flagship.

---

## Considerado e rejeitado

- **Hooks com `process.exit` antes de I/O drain + 4 CVEs runtime** (`.planning/codebase/concerns.md:76-87` e `:39-43`) —
  **stale**. O audit é de 2026-05-09 (era v1.12.1, 33 releases atrás); `npm audit --omit=dev` hoje
  reporta **1 moderate** (não 1 high + 3 moderate) e o `hono` HIGH foi corrigido na v1.44.0
  (CHANGELOG.md, seção Fixed). Os hooks ainda contêm `process.exit` (ex.: `kit/hooks/context-monitor.js`,
  10 ocorrências), mas sem re-audit não dá para afirmar que o padrão perigoso persiste — evidência
  fraca demais para direção. Ação correta: re-rodar `/mapear-codebase` (concerns) antes de decidir.
- **Novos agents do KIT-AUDIT** (billing-implementer, frontend-e2e-tester, app-security-auditor,
  supabase-rag-implementer, llm-eval-harness-writer, api-contract-designer, dr-readiness-auditor,
  supabase-query-performance-tuner — `.planning/KIT-AUDIT.md:74-81`) — **duplicata de trabalho fechado**:
  os 8 existem hoje em `kit/agents/` (verificado por listagem). Provável entrega na v1.43.
- **~24 cross-links relativos quebrados** (`.planning/KIT-AUDIT.md:38`) — **já corrigido**: varredura
  hoje resolve todos os links `.md` relativos de `kit/` com **1 único** não-resolvido, e é placeholder
  de template por design (`kit/framework/templates/summary.md` → `./{phase}-USER-SETUP.md`). Resta só
  criar o teste CI que previne regressão — absorvido em DIR-01 (mesma classe de gate).
- **TOIL-AUDIT P0** (CI multi-IDE, counts README, CHANGELOG automation — `.planning/TOIL-AUDIT.md:34-38`) —
  **majoritariamente fechado**: `.github/workflows/ci.yml:115` roda matrix de 7 targets; CHANGELOG está
  em dia até 1.45.0; `update-readme-counts.js` existe. O resíduo (README:288 fora do escopo do script)
  foi absorvido em DIR-01.
- **Embeddings + semantic dispatch** (`.planning/ROADMAP.md:33`, candidato v1.30) — **superseded**:
  `/fazer` (roteador de texto livre) + router bundle-aware (v1.41, CHANGELOG) já cobrem o caso de uso
  sem custo de embeddings. Só reabrir com evidência de falha de roteamento em escala 287 recursos.
- **Backlog macro antigo** (`.planning/MILESTONES.md:407-419` — double-`kit` CLI, HTTP transport,
  docs site) — **fora-de-escopo**: sem evidência de dor atual (zero issues, zero menções recentes);
  reavaliar no reconcile de DIR-02.

---
*Método: 4 gatilhos (planning drift, auditorias internas reverificadas, git log, filesystem HEAD).
Todo finding reproduzido in loco em 2026-07-01; achados de auditorias antigas que não reproduzem
foram movidos para rejeitados, não re-reportados.*

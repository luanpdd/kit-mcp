# Template de Phase Prompt

> **Nota:** A metodologia de planejamento está em `agents/planner.md`.
> Este template define o formato de saída PLAN.md que o agente produz.

Template para `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` - planos de fase executáveis otimizados para execução paralela.

**Nomenclatura:** Use o formato `{phase}-{plan}-PLAN.md` (ex.: `01-02-PLAN.md` para Fase 1, Plano 2)

---

## Template do Arquivo

```markdown
---
phase: XX-name
plan: NN
type: execute
wave: N                     # Wave de execução (1, 2, 3...). Pré-computado no momento do planejamento.
depends_on: []              # IDs de planos que este plano requer (ex.: ["01-01"]).
files_modified: []          # Arquivos que este plano modifica.
autonomous: true            # false se o plano tem checkpoints que requerem interação do usuário
requirements: []            # OBRIGATÓRIO — IDs de Requisitos do ROADMAP que este plano endereça. NÃO pode estar vazio.
user_setup: []              # Configuração manual necessária que Claude não pode automatizar (ver abaixo)

# Verificação goal-backward (derivada durante o planejamento, verificada após a execução)
must_haves:
  truths: []                # Comportamentos observáveis que devem ser verdadeiros para o atingimento do objetivo
  artifacts: []             # Arquivos que devem existir com implementação real
  key_links: []             # Conexões críticas entre artefatos
---

<objective>
[O que este plano realiza]

Purpose: [Por que isso importa para o projeto]
Output: [Quais artefatos serão criados]
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
[Se o plano contém tarefas de checkpoint (type="checkpoint:*"), adicionar:]
@./.claude/framework/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Referenciar SUMMARYs de planos anteriores apenas se genuinamente necessário:
# - Este plano usa tipos/exports de plano anterior
# - Plano anterior tomou decisão que afeta este plano
# NÃO encadear reflexivamente: Plano 02 ref 01, Plano 03 ref 02...

[Arquivos fonte relevantes:]
@src/path/to/relevant.ts
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: [Nome orientado à ação]</name>
  <files>path/to/file.ext, another/file.ext</files>
  <read_first>path/to/reference.ext, path/to/source-of-truth.ext</read_first>
  <action>[Implementação específica - o que fazer, como fazer, o que evitar e POR QUÊ. Inclua valores CONCRETOS: identificadores exatos, parâmetros, saídas esperadas, caminhos de arquivo, argumentos de comando. Nunca diga "alinhar X com Y" sem especificar o estado alvo exato.]</action>
  <verify>[Comando ou verificação para provar que funcionou]</verify>
  <acceptance_criteria>
    - [Condição verificável via grep: "file.ext contém 'string exata'"]
    - [Condição mensurável: "output.ext usa 'valor-esperado', NÃO 'valor-errado'"]
  </acceptance_criteria>
  <done>[Critérios de aceitação mensuráveis]</done>
</task>

<task type="auto">
  <name>Tarefa 2: [Nome orientado à ação]</name>
  <files>path/to/file.ext</files>
  <read_first>path/to/reference.ext</read_first>
  <action>[Implementação específica com valores concretos]</action>
  <verify>[Comando ou verificação]</verify>
  <acceptance_criteria>
    - [Condição verificável via grep]
  </acceptance_criteria>
  <done>[Critérios de aceitação]</done>
</task>

<!-- Para exemplos e padrões de tarefas de checkpoint, ver @./.claude/framework/references/checkpoints.md -->

<task type="checkpoint:decision" gate="blocking">
  <decision>[O que precisa ser decidido]</decision>
  <context>[Por que esta decisão importa]</context>
  <options>
    <option id="option-a"><name>[Nome]</name><pros>[Benefícios]</pros><cons>[Trade-offs]</cons></option>
    <option id="option-b"><name>[Nome]</name><pros>[Benefícios]</pros><cons>[Trade-offs]</cons></option>
  </options>
  <resume-signal>Select: option-a or option-b</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[O que Claude construiu] - servidor rodando em [URL]</what-built>
  <how-to-verify>Visite [URL] e verifique: [apenas verificações visuais, SEM comandos CLI]</how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
Antes de declarar o plano completo:
- [ ] [Comando de teste específico]
- [ ] [Build/verificação de tipos passa]
- [ ] [Verificação de comportamento]
</verification>

<success_criteria>

- Todas as tarefas concluídas
- Todas as verificações passam
- Nenhum erro ou aviso introduzido
- [Critérios específicos do plano]
  </success_criteria>

<output>
After completion, create `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
</output>
```

---

## Campos do Frontmatter

| Campo | Obrigatório | Propósito |
|-------|-------------|-----------|
| `phase` | Sim | Identificador da fase (ex.: `01-foundation`) |
| `plan` | Sim | Número do plano dentro da fase (ex.: `01`, `02`) |
| `type` | Sim | Sempre `execute` para planos padrão, `tdd` para planos TDD |
| `wave` | Sim | Número da wave de execução (1, 2, 3...). Pré-computado no momento do planejamento. |
| `depends_on` | Sim | Array de IDs de planos que este plano requer. |
| `files_modified` | Sim | Arquivos que este plano toca. |
| `autonomous` | Sim | `true` se sem checkpoints, `false` se tem checkpoints |
| `requirements` | Sim | **DEVE** listar IDs de requisitos do ROADMAP. Todo requisito do roadmap DEVE aparecer em pelo menos um plano. |
| `user_setup` | Não | Array de itens de configuração manual necessária (serviços externos) |
| `must_haves` | Sim | Critérios de verificação goal-backward (ver abaixo) |

**Wave é pré-computada:** Números de wave são atribuídos durante `/planejar-fase`. O execute-phase lê `wave` diretamente do frontmatter e agrupa planos por número de wave. Nenhuma análise de dependência em tempo de execução é necessária.

**Must-haves habilitam verificação:** O campo `must_haves` carrega requisitos goal-backward do planejamento para a execução. Após todos os planos concluírem, o execute-phase spawna um subagente de verificação que verifica esses critérios contra o codebase real.

---

## Paralelo vs Sequencial

<parallel_examples>

**Candidatos para Wave 1 (paralelo):**

```yaml
# Plano 01 - Funcionalidade de Usuário
wave: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/users.ts]
autonomous: true

# Plano 02 - Funcionalidade de Produto (sem sobreposição com Plano 01)
wave: 1
depends_on: []
files_modified: [src/models/product.ts, src/api/products.ts]
autonomous: true

# Plano 03 - Funcionalidade de Pedido (sem sobreposição)
wave: 1
depends_on: []
files_modified: [src/models/order.ts, src/api/orders.ts]
autonomous: true
```

Todos os três rodam em paralelo (Wave 1) - sem dependências, sem conflitos de arquivo.

**Sequencial (dependência genuína):**

```yaml
# Plano 01 - Base de Auth
wave: 1
depends_on: []
files_modified: [src/lib/auth.ts, src/middleware/auth.ts]
autonomous: true

# Plano 02 - Funcionalidades protegidas (precisa de auth)
wave: 2
depends_on: ["01"]
files_modified: [src/features/dashboard.ts]
autonomous: true
```

Plano 02 na Wave 2 aguarda Plano 01 na Wave 1 - dependência genuína nos tipos/middleware de auth.

**Plano com checkpoint:**

```yaml
# Plano 03 - UI com verificação
wave: 3
depends_on: ["01", "02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false  # Tem checkpoint:human-verify
```

Wave 3 roda após Waves 1 e 2. Pausa no checkpoint, orquestrador apresenta ao usuário, retoma na aprovação.

</parallel_examples>

---

## Seção de Contexto

**Contexto consciente de paralelismo:**

```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Incluir refs de SUMMARY apenas se genuinamente necessário:
# - Este plano importa tipos de plano anterior
# - Plano anterior tomou decisão que afeta este plano
# - Saída do plano anterior é entrada deste plano
#
# Planos independentes NÃO precisam de refs de SUMMARY anteriores.
# NÃO encadear reflexivamente: 02 ref 01, 03 ref 02...

@src/relevant/source.ts
</context>
```

**Padrão ruim (cria dependências falsas):**
```markdown
<context>
@.planning/phases/03-features/03-01-SUMMARY.md  # Apenas por ser anterior
@.planning/phases/03-features/03-02-SUMMARY.md  # Encadeamento reflexivo
</context>
```

---

## Orientação de Escopo

**Dimensionamento de plano:**

- 2-3 tarefas por plano
- ~50% de uso de contexto no máximo
- Fases complexas: Múltiplos planos focados, não um plano grande

**Quando dividir:**

- Subsistemas diferentes (auth vs API vs UI)
- >3 tarefas
- Risco de overflow de contexto
- Candidatos TDD - planos separados

**Fatias verticais preferidas:**

```
PREFERIR: Plano 01 = Usuário (model + API + UI)
          Plano 02 = Produto (model + API + UI)

EVITAR:   Plano 01 = Todos os models
          Plano 02 = Todas as APIs
          Plano 03 = Todas as UIs
```

---

## Planos TDD

Funcionalidades TDD recebem planos dedicados com `type: tdd`.

**Heurística:** Você pode escrever `expect(fn(input)).toBe(output)` antes de escrever `fn`?
→ Sim: Criar um plano TDD
→ Não: Tarefa padrão em plano padrão

Ver `./.claude/framework/references/tdd.md` para estrutura de plano TDD.

---

## Tipos de Tarefa

| Tipo | Usar Para | Autonomia |
|------|-----------|-----------|
| `auto` | Tudo que Claude pode fazer independentemente | Totalmente autônomo |
| `checkpoint:human-verify` | Verificação visual/funcional | Pausa, retorna ao orquestrador |
| `checkpoint:decision` | Escolhas de implementação | Pausa, retorna ao orquestrador |
| `checkpoint:human-action` | Passos manuais verdadeiramente inevitáveis (raro) | Pausa, retorna ao orquestrador |

**Comportamento de checkpoint na execução paralela:**
- Plano roda até o checkpoint
- Agente retorna com detalhes do checkpoint + agent_id
- Orquestrador apresenta ao usuário
- Usuário responde
- Orquestrador retoma agente com `resume: agent_id`

---

## Exemplos

**Plano paralelo autônomo:**

```markdown
---
phase: 03-features
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/features/user/model.ts, src/features/user/api.ts, src/features/user/UserList.tsx]
autonomous: true
---

<objective>
Implement complete User feature as vertical slice.

Purpose: Self-contained user management that can run parallel to other features.
Output: User model, API endpoints, and UI components.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: Create User model</name>
  <files>src/features/user/model.ts</files>
  <action>Define User type with id, email, name, createdAt. Export TypeScript interface.</action>
  <verify>tsc --noEmit passes</verify>
  <done>User type exported and usable</done>
</task>

<task type="auto">
  <name>Task 2: Create User API endpoints</name>
  <files>src/features/user/api.ts</files>
  <action>GET /users (list), GET /users/:id (single), POST /users (create). Use User type from model.</action>
  <verify>fetch tests pass for all endpoints</verify>
  <done>All CRUD operations work</done>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>

<success_criteria>
- All tasks completed
- User feature works end-to-end
</success_criteria>

<output>
After completion, create `.planning/phases/03-features/03-01-SUMMARY.md`
</output>
```

**Plano com checkpoint (não autônomo):**

```markdown
---
phase: 03-features
plan: 03
type: execute
wave: 2
depends_on: ["03-01", "03-02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false
---

<objective>
Build dashboard with visual verification.

Purpose: Integrate user and product features into unified view.
Output: Working dashboard component.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
@./.claude/framework/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-features/03-01-SUMMARY.md
@.planning/phases/03-features/03-02-SUMMARY.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: Build Dashboard layout</name>
  <files>src/components/Dashboard.tsx</files>
  <action>Create responsive grid with UserList and ProductList components. Use Tailwind for styling.</action>
  <verify>npm run build succeeds</verify>
  <done>Dashboard renders without errors</done>
</task>

<!-- Padrão de checkpoint: Claude inicia servidor, usuário visita URL. Ver checkpoints.md para padrões completos. -->
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background, wait for ready</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard - server at http://localhost:3000</what-built>
  <how-to-verify>Visit localhost:3000/dashboard. Check: desktop grid, mobile stack, no scroll issues.</how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] Visual verification passed
</verification>

<success_criteria>
- All tasks completed
- User approved visual layout
</success_criteria>

<output>
After completion, create `.planning/phases/03-features/03-03-SUMMARY.md`
</output>
```

---

## Anti-Padrões

**Ruim: Encadeamento reflexivo de dependências**
```yaml
depends_on: ["03-01"]  # Apenas porque 01 vem antes de 02
```

**Ruim: Agrupamento por camada horizontal**
```
Plano 01: Todos os models
Plano 02: Todas as APIs (depende de 01)
Plano 03: Todas as UIs (depende de 02)
```

**Ruim: Flag de autonomia ausente**
```yaml
# Tem checkpoint mas sem autonomous: false
depends_on: []
files_modified: [...]
# autonomous: ???  <- Faltando!
```

**Ruim: Tarefas vagas**
```xml
<task type="auto">
  <name>Configurar autenticação</name>
  <action>Adicionar auth ao app</action>
</task>
```

**Ruim: read_first ausente (executor modifica arquivos que não leu)**
```xml
<task type="auto">
  <name>Atualizar config do banco</name>
  <files>src/config/database.ts</files>
  <!-- Sem read_first! Executor não sabe o estado atual ou convenções -->
  <action>Atualizar a config do banco para corresponder às configurações de produção</action>
</task>
```

**Ruim: Critérios de aceitação vagos (não verificáveis)**
```xml
<acceptance_criteria>
  - Config está adequadamente configurada
  - Conexão com banco funciona corretamente
</acceptance_criteria>
```

**Bom: Concreto com read_first + critérios verificáveis**
```xml
<task type="auto">
  <name>Atualizar config do banco para connection pooling</name>
  <files>src/config/database.ts</files>
  <read_first>src/config/database.ts, .env.example, docker-compose.yml</read_first>
  <action>Adicionar configuração de pool: min=2, max=20, idleTimeoutMs=30000. Adicionar config SSL: rejectUnauthorized=true quando NODE_ENV=production. Adicionar entrada no .env.example: DATABASE_POOL_MAX=20.</action>
  <acceptance_criteria>
    - database.ts contém "max: 20" e "idleTimeoutMillis: 30000"
    - database.ts contém condicional SSL em NODE_ENV
    - .env.example contém DATABASE_POOL_MAX
  </acceptance_criteria>
</task>
```

---

## Diretrizes

- Sempre usar estrutura XML para parsing pelo Claude
- Incluir `wave`, `depends_on`, `files_modified`, `autonomous` em todo plano
- Preferir fatias verticais em vez de camadas horizontais
- Referenciar SUMMARYs anteriores apenas quando genuinamente necessário
- Agrupar checkpoints com tarefas auto relacionadas no mesmo plano
- 2-3 tarefas por plano, ~50% de contexto no máximo

---

## User Setup (Serviços Externos)

Quando um plano introduz serviços externos que requerem configuração humana, declarar no frontmatter:

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks → Add endpoint"
        details: "URL: https://[your-domain]/api/webhooks/stripe"
    local_dev:
      - "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
```

**A regra automation-first:** `user_setup` contém APENAS o que Claude literalmente não pode fazer:
- Criação de conta (requer cadastro humano)
- Recuperação de segredos (requer acesso ao dashboard)
- Configuração do dashboard (requer humano no browser)

**NÃO incluído:** Instalação de pacotes, mudanças de código, criação de arquivo, comandos CLI que Claude pode executar.

**Resultado:** Execute-plan gera `{phase}-USER-SETUP.md` com checklist para o usuário.

Ver `./.claude/framework/templates/user-setup.md` para schema completo e exemplos

---

## Must-Haves (Verificação Goal-Backward)

O campo `must_haves` define o que deve ser VERDADEIRO para o objetivo da fase ser alcançado. Derivado durante o planejamento, verificado após a execução.

**Estrutura:**

```yaml
must_haves:
  truths:
    - "Usuário pode ver mensagens existentes"
    - "Usuário pode enviar uma mensagem"
    - "Mensagens persistem após atualização"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Renderização da lista de mensagens"
      min_lines: 30
    - path: "src/app/api/chat/route.ts"
      provides: "Operações CRUD de mensagens"
      exports: ["GET", "POST"]
    - path: "prisma/schema.prisma"
      provides: "Model de Message"
      contains: "model Message"
  key_links:
    - from: "src/components/Chat.tsx"
      to: "/api/chat"
      via: "fetch in useEffect"
      pattern: "fetch.*api/chat"
    - from: "src/app/api/chat/route.ts"
      to: "prisma.message"
      via: "database query"
      pattern: "prisma\\.message\\.(find|create)"
```

**Descrições dos campos:**

| Campo | Propósito |
|-------|-----------|
| `truths` | Comportamentos observáveis da perspectiva do usuário. Cada um deve ser testável. |
| `artifacts` | Arquivos que devem existir com implementação real. |
| `artifacts[].path` | Caminho do arquivo relativo à raiz do projeto. |
| `artifacts[].provides` | O que este artefato entrega. |
| `artifacts[].min_lines` | Opcional. Mínimo de linhas para ser considerado substancial. |
| `artifacts[].exports` | Opcional. Exports esperados a verificar. |
| `artifacts[].contains` | Opcional. Padrão que deve existir no arquivo. |
| `key_links` | Conexões críticas entre artefatos. |
| `key_links[].from` | Artefato fonte. |
| `key_links[].to` | Artefato ou endpoint alvo. |
| `key_links[].via` | Como eles se conectam (descrição). |
| `key_links[].pattern` | Opcional. Regex para verificar se a conexão existe. |

**Por que isso importa:**

Conclusão de tarefa ≠ Atingimento de objetivo. Uma tarefa "criar componente de chat" pode ser concluída criando um placeholder. O campo `must_haves` captura o que deve realmente funcionar, permitindo que a verificação detecte lacunas antes que se acumulem.

**Fluxo de verificação:**

1. Plan-phase deriva must_haves do objetivo da fase (goal-backward)
2. Must_haves escritos no frontmatter do PLAN.md
3. Execute-phase roda todos os planos
4. Subagente de verificação verifica must_haves contra o codebase
5. Lacunas encontradas → planos de correção criados → execução → re-verificação
6. Todos os must_haves passam → fase completa

Ver `./.claude/framework/workflows/verify-phase.md` para a lógica de verificação.

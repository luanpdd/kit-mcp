# Template de Contexto de Fase

Template para `.planning/phases/XX-name/{phase_num}-CONTEXT.md` - captura decisões de implementação para uma fase.

**Propósito:** Documentar decisões que agentes downstream precisam. O Pesquisador usa isso para saber O QUE investigar. O Planejador usa isso para saber quais escolhas estão travadas vs. flexíveis.

**Princípio chave:** As categorias NÃO são predefinidas. Elas emergem do que foi realmente discutido para ESTA fase. Uma fase CLI tem seções relevantes para CLI, uma fase de UI tem seções relevantes para UI.

**Consumidores downstream:**
- `phase-researcher` — Lê decisões para focar a pesquisa (ex.: "layout de card" → pesquisar padrões de componentes card)
- `planner` — Lê decisões para criar tarefas específicas (ex.: "scroll infinito" → tarefa inclui virtualização)

---

## Template do Arquivo

```markdown
# Fase [X]: [Nome] - Contexto

**Coletado:** [data]
**Status:** Pronto para planejamento

<domain>
## Limite da Fase

[Declaração clara do que esta fase entrega — a âncora de escopo. Vem do ROADMAP.md e é fixo. A discussão esclarece a implementação dentro deste limite.]

</domain>

<decisions>
## Decisões de Implementação

### [Área 1 que foi discutida]
- **D-01:** [Decisão específica tomada]
- **D-02:** [Outra decisão, se aplicável]

### [Área 2 que foi discutida]
- **D-03:** [Decisão específica tomada]

### [Área 3 que foi discutida]
- **D-04:** [Decisão específica tomada]

### A Critério do Claude
[Áreas onde o usuário disse explicitamente "você decide" — Claude tem flexibilidade aqui durante o planejamento/implementação]

</decisions>

<specifics>
## Ideias Específicas

[Quaisquer referências, exemplos ou momentos "quero como X" da discussão. Referências de produto, comportamentos específicos, padrões de interação.]

[Se nenhum: "Sem requisitos específicos — aberto a abordagens padrão"]

</specifics>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler isso antes de planejar ou implementar.**

[Liste toda especificação, ADR, doc de funcionalidade ou design doc que define requisitos ou restrições para esta fase. Use caminhos relativos completos para que agentes possam lê-los diretamente. Agrupe por área de tópico quando a fase tem múltiplas preocupações.]

### [Área de tópico 1]
- `path/to/spec-or-adr.md` — [O que este doc decide/define que é relevante]
- `path/to/doc.md` §N — [Seção específica e o que ela cobre]

### [Área de tópico 2]
- `path/to/feature-doc.md` — [Que capacidade isto define]

[Se o projeto não tem specs externas: "Sem specs externas — requisitos estão totalmente capturados nas decisões acima"]

</canonical_refs>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- [Componente/hook/utilitário]: [Como poderia ser usado nesta fase]

### Padrões Estabelecidos
- [Padrão]: [Como restringe/habilita esta fase]

### Pontos de Integração
- [Onde o novo código se conecta ao sistema existente]

</code_context>

<deferred>
## Ideias Diferidas

[Ideias que surgiram durante a discussão mas pertencem a outras fases. Capturadas aqui para não serem perdidas, mas explicitamente fora do escopo desta fase.]

[Se nenhuma: "Nenhuma — a discussão ficou dentro do escopo da fase"]

</deferred>

---

*Fase: XX-nome*
*Contexto coletado: [data]*
```

<good_examples>

**Example 1: Visual feature (Post Feed)**

```markdown
# Phase 3: Post Feed - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Display posts from followed users in a scrollable feed. Users can view posts and see engagement counts. Creating posts and interactions are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Layout style
- Card-based layout, not timeline or list
- Each card shows: author avatar, name, timestamp, full post content, reaction counts
- Cards have subtle shadows, rounded corners — modern feel

### Loading behavior
- Infinite scroll, not pagination
- Pull-to-refresh on mobile
- New posts indicator at top ("3 new posts") rather than auto-inserting

### Empty state
- Friendly illustration + "Follow people to see posts here"
- Suggest 3-5 accounts to follow based on interests

### Claude's Discretion
- Loading skeleton design
- Exact spacing and typography
- Error state handling

</decisions>

<canonical_refs>
## Canonical References

### Feed display
- `docs/features/social-feed.md` — Feed requirements, post card fields, engagement display rules
- `docs/decisions/adr-012-infinite-scroll.md` — Scroll strategy decision, virtualization requirements

### Empty states
- `docs/design/empty-states.md` — Empty state patterns, illustration guidelines

</canonical_refs>

<specifics>
## Specific Ideas

- "I like how Twitter shows the new posts indicator without disrupting your scroll position"
- Cards should feel like Linear's issue cards — clean, not cluttered

</specifics>

<deferred>
## Deferred Ideas

- Commenting on posts — Phase 5
- Bookmarking posts — add to backlog

</deferred>

---

*Phase: 03-post-feed*
*Context gathered: 2025-01-20*
```

**Example 2: CLI tool (Database backup)**

```markdown
# Phase 2: Backup Command - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI command to backup database to local file or S3. Supports full and incremental backups. Restore command is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Output format
- JSON for programmatic use, table format for humans
- Default to table, --json flag for JSON
- Verbose mode (-v) shows progress, silent by default

### Flag design
- Short flags for common options: -o (output), -v (verbose), -f (force)
- Long flags for clarity: --incremental, --compress, --encrypt
- Required: database connection string (positional or --db)

### Error recovery
- Retry 3 times on network failure, then fail with clear message
- --no-retry flag to fail fast
- Partial backups are deleted on failure (no corrupt files)

### Claude's Discretion
- Exact progress bar implementation
- Compression algorithm choice
- Temp file handling

</decisions>

<canonical_refs>
## Canonical References

### Backup CLI
- `docs/features/backup-restore.md` — Backup requirements, supported backends, encryption spec
- `docs/decisions/adr-007-cli-conventions.md` — Flag naming, exit codes, output format standards

</canonical_refs>

<specifics>
## Specific Ideas

- "I want it to feel like pg_dump — familiar to database people"
- Should work in CI pipelines (exit codes, no interactive prompts)

</specifics>

<deferred>
## Deferred Ideas

- Scheduled backups — separate phase
- Backup rotation/retention — add to backlog

</deferred>

---

*Phase: 02-backup-command*
*Context gathered: 2025-01-20*
```

**Example 3: Organization task (Photo library)**

```markdown
# Phase 1: Photo Organization - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Organize existing photo library into structured folders. Handle duplicates and apply consistent naming. Tagging and search are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Grouping criteria
- Primary grouping by year, then by month
- Events detected by time clustering (photos within 2 hours = same event)
- Event folders named by date + location if available

### Duplicate handling
- Keep highest resolution version
- Move duplicates to _duplicates folder (don't delete)
- Log all duplicate decisions for review

### Naming convention
- Format: YYYY-MM-DD_HH-MM-SS_originalname.ext
- Preserve original filename as suffix for searchability
- Handle name collisions with incrementing suffix

### Claude's Discretion
- Exact clustering algorithm
- How to handle photos with no EXIF data
- Folder emoji usage

</decisions>

<canonical_refs>
## Canonical References

### Organization rules
- `docs/features/photo-organization.md` — Grouping rules, duplicate policy, naming spec
- `docs/decisions/adr-003-exif-handling.md` — EXIF extraction strategy, fallback for missing metadata

</canonical_refs>

<specifics>
## Specific Ideas

- "I want to be able to find photos by roughly when they were taken"
- Don't delete anything — worst case, move to a review folder

</specifics>

<deferred>
## Deferred Ideas

- Face detection grouping — future phase
- Cloud sync — out of scope for now

</deferred>

---

*Phase: 01-photo-organization*
*Context gathered: 2025-01-20*
```

</good_examples>

<guidelines>
**Este template captura DECISÕES para agentes downstream.**

A saída deve responder: "O que o pesquisador precisa investigar? Quais escolhas estão travadas para o planejador?"

**Bom conteúdo (decisões concretas):**
- "Layout baseado em cards, não timeline"
- "Tentar 3 vezes em falha de rede, então falhar"
- "Agrupar por ano, depois por mês"
- "JSON para uso programático, tabela para humanos"

**Conteúdo ruim (muito vago):**
- "Deve parecer moderno e limpo"
- "Boa experiência do usuário"
- "Rápido e responsivo"
- "Fácil de usar"

**Após a criação:**
- O arquivo fica no diretório da fase: `.planning/phases/XX-nome/{phase_num}-CONTEXT.md`
- `phase-researcher` usa decisões para focar a investigação E lê canonical_refs para saber QUAIS docs estudar
- `planner` usa decisões + pesquisa para criar tarefas executáveis E lê canonical_refs para verificar alinhamento
- Agentes downstream NÃO devem precisar perguntar ao usuário novamente sobre decisões capturadas

**CRÍTICO — Referências canônicas:**
- A seção `<canonical_refs>` é OBRIGATÓRIA. Todo CONTEXT.md deve ter uma.
- Se o seu projeto tem specs externas, ADRs ou design docs, liste-os com caminhos relativos completos agrupados por tópico
- Se ROADMAP.md lista `Canonical refs:` por fase, extraia e expanda-os
- Menções inline como "ver ADR-019" espalhadas nas decisões são inúteis para agentes downstream — eles precisam de caminhos completos e referências de seção em uma seção dedicada que podem encontrar
- Se não existem specs externas, diga explicitamente — não omita silenciosamente a seção
</guidelines>

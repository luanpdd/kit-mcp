<overview>
Integração git para o framework.
</overview>

<core_principle>

**Commite resultados, não processos.**

O log git deve parecer um changelog do que foi lançado, não um diário de atividade de planejamento.
</core_principle>

<commit_points>

| Evento                        | Commitar? | Por quê                                            |
| ----------------------------- | --------- | -------------------------------------------------- |
| BRIEF + ROADMAP criados       | SIM       | Inicialização do projeto                           |
| PLAN.md criado                | NÃO       | Intermediário — commitar com conclusão do plano    |
| RESEARCH.md criado            | NÃO       | Intermediário                                      |
| DISCOVERY.md criado           | NÃO       | Intermediário                                      |
| **Tarefa concluída**          | SIM       | Unidade atômica de trabalho (1 commit por tarefa)  |
| **Plano concluído**           | SIM       | Commit de metadados (SUMMARY + STATE + ROADMAP)    |
| Handoff criado                | SIM       | Estado WIP preservado                              |

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

Se NO_GIT: Execute `git init` silenciosamente. Projetos framework sempre têm seu próprio repositório.
</git_check>

<commit_formats>

<format name="initialization">
## Inicialização do Projeto (brief + roadmap juntos)

```
docs: initialize [nome-do-projeto] ([N] phases)

[Linha única do PROJECT.md]

Phases:
1. [nome-da-fase]: [objetivo]
2. [nome-da-fase]: [objetivo]
3. [nome-da-fase]: [objetivo]
```

O que commitar:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs: initialize [nome-do-projeto] ([N] phases)" --files .planning/
```

</format>

<format name="task-completion">
## Conclusão de Tarefa (Durante Execução do Plano)

Cada tarefa recebe seu próprio commit imediatamente após a conclusão.

> **Agentes paralelos:** Quando executando como executor paralelo (spawnado por execute-phase),
> use `--no-verify` em todos os commits para evitar contenção de bloqueio de hooks pré-commit.
> O orquestrador valida os hooks uma vez após todos os agentes concluírem.

```
{tipo}({fase}-{plano}): {nome-da-tarefa}

- [Alteração chave 1]
- [Alteração chave 2]
- [Alteração chave 3]
```

**Tipos de commit:**
- `feat` - Nova funcionalidade/recurso
- `fix` - Correção de bug
- `test` - Apenas testes (fase TDD VERMELHO)
- `refactor` - Limpeza de código (fase TDD REFATORAR)
- `perf` - Melhoria de desempenho
- `chore` - Dependências, configuração, ferramental

**Exemplos:**

```bash
# Tarefa padrão
git add src/api/auth.ts src/types/user.ts
git commit -m "feat(08-02): create user registration endpoint

- POST /auth/register validates email and password
- Checks for duplicate users
- Returns JWT token on success
"

# Tarefa TDD - fase VERMELHO
git add src/__tests__/jwt.test.ts
git commit -m "test(07-02): add failing test for JWT generation

- Tests token contains user ID claim
- Tests token expires in 1 hour
- Tests signature verification
"

# Tarefa TDD - fase VERDE
git add src/utils/jwt.ts
git commit -m "feat(07-02): implement JWT generation

- Uses jose library for signing
- Includes user ID and expiry claims
- Signs with HS256 algorithm
"
```

</format>

<format name="plan-completion">
## Conclusão do Plano (Após Todas as Tarefas Concluídas)

Após todas as tarefas commitadas, um commit final de metadados captura a conclusão do plano.

```
docs({fase}-{plano}): complete [nome-do-plano] plan

Tasks completed: [N]/[N]
- [Nome da Tarefa 1]
- [Nome da Tarefa 2]
- [Nome da Tarefa 3]

SUMMARY: .planning/phases/XX-nome/{fase}-{plano}-SUMMARY.md
```

O que commitar:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs({fase}-{plano}): complete [nome-do-plano] plan" --files .planning/phases/XX-nome/{fase}-{plano}-PLAN.md .planning/phases/XX-nome/{fase}-{plano}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md
```

**Nota:** Arquivos de código NÃO incluídos — já commitados por tarefa.

</format>

<format name="handoff">
## Handoff (WIP)

```
wip: [nome-da-fase] paused at task [X]/[Y]

Current: [nome da tarefa]
[Se bloqueado:] Blocked: [motivo]
```

O que commitar:

```bash
node "./.claude/framework/bin/tools.cjs" commit "wip: [nome-da-fase] paused at task [X]/[Y]" --files .planning/
```

</format>
</commit_formats>

<example_log>

**Abordagem antiga (commits por plano):**
```
a7f2d1 feat(checkout): Stripe payments with webhook verification
3e9c4b feat(products): catalog with search, filters, and pagination
8a1b2c feat(auth): JWT with refresh rotation using jose
5c3d7e feat(foundation): Next.js 15 + Prisma + Tailwind scaffold
2f4a8d docs: initialize ecommerce-app (5 phases)
```

**Nova abordagem (commits por tarefa):**
```
# Fase 04 - Checkout
1a2b3c docs(04-01): complete checkout flow plan
4d5e6f feat(04-01): add webhook signature verification
7g8h9i feat(04-01): implement payment session creation
0j1k2l feat(04-01): create checkout page component

# Fase 03 - Products
3m4n5o docs(03-02): complete product listing plan
6p7q8r feat(03-02): add pagination controls
9s0t1u feat(03-02): implement search and filters
2v3w4x feat(03-01): create product catalog schema

# Fase 02 - Auth
5y6z7a docs(02-02): complete token refresh plan
8b9c0d feat(02-02): implement refresh token rotation
1e2f3g test(02-02): add failing test for token refresh
4h5i6j docs(02-01): complete JWT setup plan
7k8l9m feat(02-01): add JWT generation and validation
0n1o2p chore(02-01): install jose library

# Fase 01 - Foundation
3q4r5s docs(01-01): complete scaffold plan
6t7u8v feat(01-01): configure Tailwind and globals
9w0x1y feat(01-01): set up Prisma with database
2z3a4b feat(01-01): create Next.js 15 project

# Inicialização
5c6d7e docs: initialize ecommerce-app (5 phases)
```

Cada plano produz 2-4 commits (tarefas + metadados). Claro, granular, bisectable.

</example_log>

<anti_patterns>

**Ainda não commitar (artefatos intermediários):**
- Criação do PLAN.md (commitar com conclusão do plano)
- RESEARCH.md (intermediário)
- DISCOVERY.md (intermediário)
- Ajustes menores de planejamento
- "Corrigi typo no roadmap"

**Commitar (resultados):**
- Cada conclusão de tarefa (feat/fix/test/refactor)
- Metadados de conclusão de plano (docs)
- Inicialização do projeto (docs)

**Princípio chave:** Commite código funcionando e resultados lançados, não processo de planejamento.

</anti_patterns>

<commit_strategy_rationale>

## Por Que Commits Por Tarefa?

**Engenharia de contexto para IA:**
- O histórico git torna-se a fonte primária de contexto para sessões futuras do Claude
- `git log --grep="{fase}-{plano}"` mostra todo o trabalho de um plano
- `git diff <hash>^..<hash>` mostra as alterações exatas por tarefa
- Menos dependência de análise do SUMMARY.md = mais contexto para o trabalho real

**Recuperação de falha:**
- Tarefa 1 commitada ✅, Tarefa 2 falhou ❌
- Claude na próxima sessão: vê tarefa 1 concluída, pode tentar novamente a tarefa 2
- Pode `git reset --hard` para a última tarefa bem-sucedida

**Debugging:**
- `git bisect` encontra a tarefa exata falhando, não apenas o plano falhando
- `git blame` rastreia a linha até o contexto específico da tarefa
- Cada commit é revertível independentemente

**Observabilidade:**
- Workflow de desenvolvedor solo + Claude se beneficia de atribuição granular
- Commits atômicos são boas práticas de git
- "Ruído de commit" irrelevante quando o consumidor é o Claude, não humanos

</commit_strategy_rationale>

<sub_repos_support>

## Suporte a Workspace Multi-Repositório (sub_repos)

Para workspaces com repositórios git separados (ex: `backend/`, `frontend/`, `shared/`), o framework roteia commits para cada repositório independentemente.

### Configuração

Em `.planning/config.json`, liste os diretórios de sub-repositório em `planning.sub_repos`:

```json
{
  "planning": {
    "commit_docs": false,
    "sub_repos": ["backend", "frontend", "shared"]
  }
}
```

Defina `commit_docs: false` para que os docs de planejamento permaneçam locais e não sejam commitados em nenhum sub-repositório.

### Como Funciona

1. **Auto-detecção:** Durante `/novo-projeto`, diretórios com sua própria pasta `.git` são detectados e oferecidos para seleção como sub-repositórios. Em execuções subsequentes, `loadConfig` sincroniza automaticamente a lista `sub_repos` com o sistema de arquivos — adicionando repositórios recém-criados e removendo os deletados. Isso significa que `config.json` pode ser reescrito automaticamente quando os repositórios mudam no disco.
2. **Agrupamento de arquivos:** Arquivos de código são agrupados pelo prefixo do sub-repositório (ex: `backend/src/api/users.ts` pertence ao repositório `backend/`).
3. **Commits independentes:** Cada sub-repositório recebe seu próprio commit atômico via `tools.cjs commit-to-subrepo`. Os caminhos de arquivo são tornados relativos à raiz do sub-repositório antes do staging.
4. **Planejamento permanece local:** O diretório `.planning/` não é commitado; ele age como coordenação entre repositórios.

### Roteamento de Commit

Em vez do comando `commit` padrão, use `commit-to-subrepo` quando `sub_repos` estiver configurado:

```bash
node ./.claude/framework/bin/tools.cjs commit-to-subrepo "feat(02-01): add user API" \
  --files backend/src/api/users.ts backend/src/types/user.ts frontend/src/components/UserForm.tsx
```

Isso faz staging de `src/api/users.ts` e `src/types/user.ts` no repositório `backend/`, e `src/components/UserForm.tsx` no repositório `frontend/`, commitando cada um independentemente com a mesma mensagem.

Arquivos que não correspondem a nenhum sub-repositório configurado são reportados como sem correspondência.

</sub_repos_support>

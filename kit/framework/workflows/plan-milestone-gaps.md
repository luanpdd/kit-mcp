<purpose>
Cria todas as fases necessárias para fechar as lacunas identificadas por `/auditar-marco`. Lê MILESTONE-AUDIT.md, agrupa lacunas em fases lógicas, cria entradas de fase no ROADMAP.md e oferece planejamento de cada fase. Um único comando cria todas as fases de correção — sem precisar usar `/adicionar-fase` manualmente por lacuna.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

## 1. Carregar Resultados da Auditoria

```bash
# Encontrar o arquivo de auditoria mais recente
(ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null || true) | head -1
```

Analise o frontmatter YAML para extrair lacunas estruturadas:
- `gaps.requirements` — requisitos não satisfeitos
- `gaps.integration` — conexões entre fases ausentes
- `gaps.flows` — fluxos E2E quebrados

Se nenhum arquivo de auditoria existir ou não tiver lacunas, erro:
```
Nenhuma lacuna de auditoria encontrada. Execute `/auditar-marco` primeiro.
```

## 2. Priorizar Lacunas

Agrupe lacunas por prioridade do REQUIREMENTS.md:

| Prioridade | Ação |
|------------|------|
| `must` | Criar fase, bloqueia o marco |
| `should` | Criar fase, recomendado |
| `nice` | Perguntar ao usuário: incluir ou adiar? |

Para lacunas de integração/fluxo, infira a prioridade a partir dos requisitos afetados.

## 3. Agrupar Lacunas em Fases

Agrupe lacunas relacionadas em fases lógicas:

**Regras de agrupamento:**
- Mesma fase afetada → combine em uma fase de correção
- Mesmo subsistema (auth, API, UI) → combine
- Ordem de dependência (corrija stubs antes de conectar)
- Mantenha as fases focadas: 2-4 tarefas cada

**Exemplo de agrupamento:**
```
Lacuna: DASH-01 não satisfeito (Dashboard não faz fetch)
Lacuna: Integração Fase 1→3 (Auth não passada para chamadas de API)
Lacuna: Fluxo "Ver dashboard" quebrado no carregamento de dados

→ Fase 6: "Conectar Dashboard à API"
  - Adicionar fetch em Dashboard.tsx
  - Incluir cabeçalho de auth no fetch
  - Tratar resposta, atualizar estado
  - Renderizar dados do usuário
```

## 4. Determinar Números das Fases

Encontrar a fase mais alta existente:
```bash
# Obter lista de fases ordenada, extrair a última
HIGHEST=$(node "./.claude/framework/bin/tools.cjs" phases list --pick directories[-1])
```

As novas fases continuam a partir daí:
- Se a Fase 5 for a mais alta, as lacunas se tornam as Fases 6, 7, 8...

## 5. Apresentar Plano de Fechamento de Lacunas

```markdown
## Plano de Fechamento de Lacunas

**Marco:** {versão}
**Lacunas a fechar:** {N} requisitos, {M} integração, {K} fluxos

### Fases Propostas

**Fase {N}: {Nome}**
Fecha:
- {REQ-ID}: {descrição}
- Integração: {de} → {para}
Tarefas: {contagem}

**Fase {N+1}: {Nome}**
Fecha:
- {REQ-ID}: {descrição}
- Fluxo: {nome do fluxo}
Tarefas: {contagem}

{Se existirem lacunas desejáveis:}

### Adiadas (opcionais)

Essas lacunas são opcionais. Incluir?
- {descrição da lacuna}
- {descrição da lacuna}

---

Criar essas {X} fases? (sim / ajustar / adiar todas as opcionais)
```

Aguarde a confirmação do usuário.

## 6. Atualizar ROADMAP.md

Adicione novas fases ao marco atual:

```markdown
### Fase {N}: {Nome}
**Objetivo:** {derivado das lacunas sendo fechadas}
**Requisitos:** {REQ-IDs sendo satisfeitos}
**Fechamento de Lacunas:** Fecha lacunas da auditoria

### Fase {N+1}: {Nome}
...
```

## 7. Atualizar Tabela de Rastreabilidade do REQUIREMENTS.md (OBRIGATÓRIO)

Para cada REQ-ID atribuído a uma fase de fechamento de lacuna:
- Atualize a coluna Fase para refletir a nova fase de fechamento
- Redefina o Status para `Pendente`

Redefina os requisitos marcados que a auditoria encontrou como não satisfeitos:
- Mude `[x]` → `[ ]` para qualquer requisito marcado como não satisfeito na auditoria
- Atualize a contagem de cobertura no topo do REQUIREMENTS.md

```bash
# Verificar se a tabela de rastreabilidade reflete as atribuições de fechamento de lacunas
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. Criar Diretórios de Fase

```bash
mkdir -p ".planning/phases/{NN}-{name}"
```

## 9. Commitar Atualização de Roadmap e Requisitos

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(roadmap): adicionar fases de fechamento de lacunas {N}-{M}" --files .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. Oferecer Próximos Passos

```markdown
## ✓ Fases de Fechamento de Lacunas Criadas

**Fases adicionadas:** {N} - {M}
**Lacunas endereçadas:** {contagem} requisitos, {contagem} integração, {contagem} fluxos

---

## ▶ Próximo Passo

**Planejar a primeira fase de fechamento de lacunas**

`/planejar-fase {N}`

<sub>`/clear` primeiro → contexto limpo</sub>

---

**Também disponível:**
- `/executar-fase {N}` — se os planos já existirem
- `cat .planning/ROADMAP.md` — ver roadmap atualizado

---

**Após conclusão de todas as fases de lacunas:**

`/auditar-marco` — re-auditar para verificar se as lacunas foram fechadas
`/concluir-marco {versão}` — arquivar quando a auditoria passar
```

</process>

<gap_to_phase_mapping>

## Como Lacunas se Tornam Tarefas

**Lacuna de requisito → Tarefas:**
```yaml
gap:
  id: DASH-01
  description: "Usuário vê seus dados"
  reason: "Dashboard existe mas não faz fetch da API"
  missing:
    - "useEffect com fetch para /api/user/data"
    - "Estado para dados do usuário"
    - "Renderizar dados do usuário em JSX"

becomes:

phase: "Conectar Dados do Dashboard"
tasks:
  - name: "Adicionar busca de dados"
    files: [src/components/Dashboard.tsx]
    action: "Adicionar useEffect que faz fetch de /api/user/data ao montar"

  - name: "Adicionar gerenciamento de estado"
    files: [src/components/Dashboard.tsx]
    action: "Adicionar useState para userData, estados de loading e error"

  - name: "Renderizar dados do usuário"
    files: [src/components/Dashboard.tsx]
    action: "Substituir placeholder por renderização de userData.map"
```

**Lacuna de integração → Tarefas:**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "Token de auth → chamadas de API"
  reason: "Chamadas de API do Dashboard não incluem cabeçalho de auth"
  missing:
    - "Cabeçalho de auth nas chamadas fetch"
    - "Refresh de token no 401"

becomes:

phase: "Adicionar Auth às Chamadas de API do Dashboard"
tasks:
  - name: "Adicionar cabeçalho de auth nos fetches"
    files: [src/components/Dashboard.tsx, src/lib/api.ts]
    action: "Incluir cabeçalho Authorization com token em todas as chamadas de API"

  - name: "Tratar respostas 401"
    files: [src/lib/api.ts]
    action: "Adicionar interceptador para refrescar token ou redirecionar ao login em 401"
```

**Lacuna de fluxo → Tarefas:**
```yaml
gap:
  name: "Usuário visualiza dashboard após login"
  broken_at: "Carregamento de dados do dashboard"
  reason: "Sem chamada fetch"
  missing:
    - "Fetch dos dados do usuário ao montar"
    - "Exibir estado de carregamento"
    - "Renderizar dados do usuário"

becomes:

# Geralmente a mesma fase que a lacuna de requisito/integração
# Lacunas de fluxo frequentemente se sobrepõem com outros tipos
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md carregado e lacunas analisadas
- [ ] Lacunas priorizadas (must/should/nice)
- [ ] Lacunas agrupadas em fases lógicas
- [ ] Usuário confirmou o plano de fases
- [ ] ROADMAP.md atualizado com novas fases
- [ ] Tabela de rastreabilidade do REQUIREMENTS.md atualizada com atribuições de fase de fechamento
- [ ] Checkboxes de requisitos não satisfeitos redefinidos (`[x]` → `[ ]`)
- [ ] Contagem de cobertura atualizada no REQUIREMENTS.md
- [ ] Diretórios de fase criados
- [ ] Mudanças commitadas (inclui REQUIREMENTS.md)
- [ ] Usuário sabe para executar `/planejar-fase` em seguida
</success_criteria>

# Workflow de Resumo de Milestone

Gerar um resumo abrangente e amigável ao humano a partir dos artefatos do milestone concluído.
Projetado para onboarding de equipe — um novo contribuidor pode ler a saída e entender o projeto inteiro.

---

## Passo 1: Resolver Versão

```bash
VERSION="$ARGUMENTS"
```

Se `$ARGUMENTS` estiver vazio:
1. Verificar `.planning/STATE.md` para a versão do milestone atual
2. Verificar `.planning/milestones/` para a versão arquivada mais recente
3. Se nenhum encontrado, verificar se `.planning/ROADMAP.md` existe (projeto pode estar no meio de um milestone)
4. Se nada encontrado: erro "Nenhum milestone encontrado. Execute /novo-projeto ou /novo-marco primeiro."

Definir `VERSION` para a versão resolvida (ex: "1.0").

## Passo 2: Localizar Artefatos

Determinar se o milestone está **arquivado** ou **atual**:

**Milestone arquivado** (`.planning/milestones/v{VERSION}-ROADMAP.md` existe):
```
ROADMAP_PATH=".planning/milestones/v${VERSION}-ROADMAP.md"
REQUIREMENTS_PATH=".planning/milestones/v${VERSION}-REQUIREMENTS.md"
AUDIT_PATH=".planning/milestones/v${VERSION}-MILESTONE-AUDIT.md"
```

**Milestone atual/em progresso** (sem arquivo ainda):
```
ROADMAP_PATH=".planning/ROADMAP.md"
REQUIREMENTS_PATH=".planning/REQUIREMENTS.md"
AUDIT_PATH=".planning/v${VERSION}-MILESTONE-AUDIT.md"
```

Nota: O arquivo de auditoria vai para `.planning/milestones/` no arquivamento (conforme workflow `concluir-marco`). Verificar ambos os locais como fallback.

**Sempre disponível:**
```
PROJECT_PATH=".planning/PROJECT.md"
RETRO_PATH=".planning/RETROSPECTIVE.md"
STATE_PATH=".planning/STATE.md"
```

Ler todos os arquivos que existem. Arquivos ausentes estão OK — o resumo se adapta ao que está disponível.

## Passo 3: Descobrir Artefatos de Fase

Encontrar todos os diretórios de fase:

```bash
tools.cjs init progress
```

Isso retorna metadados de fase. Para cada fase no escopo do milestone:

- Ler `{phase_dir}/{padded}-SUMMARY.md` se existir — extrair `one_liner`, `accomplishments`, `decisions`
- Ler `{phase_dir}/{padded}-VERIFICATION.md` se existir — extrair status, lacunas, itens adiados
- Ler `{phase_dir}/{padded}-CONTEXT.md` se existir — extrair decisões-chave da seção `<decisions>`
- Ler `{phase_dir}/{padded}-RESEARCH.md` se existir — notar o que foi pesquisado

Rastrear quais fases têm quais artefatos.

**Se nenhum diretório de fase existir** (milestone vazio ou estado pré-construção): pular para o Passo 5 e gerar um resumo mínimo observando "Nenhuma fase foi executada ainda." Não dar erro — o resumo ainda deve capturar conteúdo do PROJECT.md e ROADMAP.md.

## Passo 4: Coletar Estatísticas do Git

Tentar cada método em ordem até que um funcione:

**Método 1 — Milestone taggeado** (verificar primeiro):
```bash
git tag -l "v${VERSION}" | head -1
```
Se a tag existir:
```bash
git log v${VERSION} --oneline | wc -l
git diff --stat $(git log --format=%H --reverse v${VERSION} | head -1)..v${VERSION}
```

**Método 2 — Intervalo de data do STATE.md** (se sem tag):
Ler STATE.md e extrair a data `started_at` ou de sessão mais antiga. Usar como limite `--since`:
```bash
git log --oneline --since="<started_at_date>" | wc -l
```

**Método 3 — Commit de fase mais antigo** (se STATE.md não tiver data):
Encontrar o commit mais antigo de `.planning/phases/`:
```bash
git log --oneline --diff-filter=A -- ".planning/phases/" | tail -1
```
Usar a data desse commit como limite de início.

**Método 4 — Pular estatísticas** (se nenhum dos acima funcionar):
Reportar "Estatísticas do Git não disponíveis — nenhuma tag ou intervalo de data pôde ser determinado." Isso não é um erro — o resumo continua sem a seção de Estatísticas.

Extrair (quando disponível):
- Total de commits no milestone
- Arquivos alterados, inserções, deleções
- Linha do tempo (data de início → data de fim)
- Contribuidores (dos autores do git log)

## Passo 5: Gerar Documento de Resumo

Escrever em `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md`:

```markdown
# Milestone v{VERSION} — Resumo do Projeto

**Gerado:** {data}
**Propósito:** Onboarding de equipe e revisão do projeto

---

## 1. Visão Geral do Projeto

{De PROJECT.md: "O Que É", proposta de valor central, usuários-alvo}
{Se no meio do milestone: notar quais fases estão completas vs em progresso}

## 2. Arquitetura & Decisões Técnicas

{Dos arquivos CONTEXT.md entre fases: escolhas técnicas-chave}
{Das decisões SUMMARY.md: padrões, bibliotecas, frameworks escolhidos}
{De PROJECT.md: stack tecnológico se documentado}

Apresentar como uma lista com marcadores de decisões com breve raciocínio:
- **Decisão:** {o que foi escolhido}
  - **Por quê:** {raciocínio do CONTEXT.md}
  - **Fase:** {qual fase tomou esta decisão}

## 3. Fases Entregues

| Fase | Nome | Status | Resumo em Uma Linha |
|------|------|--------|---------------------|
{Para cada fase: número, nome, status (completo/em progresso/planejado), one_liner do SUMMARY.md}

## 4. Cobertura de Requisitos

{De REQUIREMENTS.md: listar cada requisito com status}
- ✅ {Requisito atendido}
- ⚠️ {Requisito parcialmente atendido — notar lacuna}
- ❌ {Requisito não atendido — notar motivo}

{Se MILESTONE-AUDIT.md existir: incluir veredicto da auditoria}

## 5. Log de Decisões-Chave

{Agregar de todas as seções `<decisions>` do CONTEXT.md}
{Cada decisão com: ID, descrição, fase, raciocínio}

## 6. Dívida Técnica & Itens Adiados

{Dos arquivos VERIFICATION.md: lacunas encontradas, anti-padrões notados}
{De RETROSPECTIVE.md: lições aprendidas, o que melhorar}
{Das seções `<deferred>` do CONTEXT.md: ideias guardadas para depois}

## 7. Primeiros Passos

{Pontos de entrada para novos contribuidores:}
- **Executar o projeto:** {de PROJECT.md ou SUMMARY.md}
- **Diretórios-chave:** {da estrutura da base de código}
- **Testes:** {comando de teste de PROJECT.md ou CLAUDE.md}
- **Onde olhar primeiro:** {pontos de entrada principais, módulos centrais}

---

## Estatísticas

- **Linha do tempo:** {início} → {fim} ({duração})
- **Fases:** {contagem completa} / {contagem total}
- **Commits:** {contagem}
- **Arquivos alterados:** {contagem} (+{inserções} / -{deleções})
- **Contribuidores:** {lista}
```

## Passo 6: Escrever e Commitar

**Guarda de sobrescrita:** Se `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md` já existir, perguntar ao usuário:
> "Um resumo do milestone para v{VERSION} já existe. Sobrescrever, ou ver o existente?"
Se "ver": exibir arquivo existente e pular para o Passo 8 (modo interativo). Se "sobrescrever": prosseguir.

Criar o diretório de relatórios se necessário:
```bash
mkdir -p .planning/reports
```

Escrever o resumo, então commitar:
```bash
tools.cjs commit "docs(v${VERSION}): gerar resumo de milestone para onboarding" \
  --files ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```

## Passo 7: Apresentar Resumo

Exibir o documento de resumo completo inline.

## Passo 8: Oferecer Modo Interativo

Após apresentar o resumo:

> "Resumo escrito em `.planning/reports/MILESTONE_SUMMARY-v{VERSION}.md`.
>
> Tenho contexto completo dos artefatos de construção. Quer perguntar algo sobre o projeto?
> Decisões de arquitetura, fases específicas, requisitos, dívida técnica — pode perguntar."

Se o usuário fizer perguntas:
- Responder a partir dos artefatos já carregados (CONTEXT.md, SUMMARY.md, VERIFICATION.md, etc.)
- Referenciar arquivos e decisões específicos
- Manter-se fundamentado no que foi realmente construído (não especulação)

Se o usuário terminar:
- Sugerir próximos passos: `/novo-marco`, `/progresso`, ou compartilhar o resumo com a equipe

## Passo 9: Atualizar STATE.md

```bash
tools.cjs state record-session \
  --stopped-at "Resumo do milestone v${VERSION} gerado" \
  --resume-file ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```

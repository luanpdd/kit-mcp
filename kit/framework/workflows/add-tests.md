<purpose>
Gerar testes unitários e E2E para uma fase concluída com base em seu SUMMARY.md, CONTEXT.md e implementação. Classifica cada arquivo alterado nas categorias TDD (unitário), E2E (navegador) ou Skip, apresenta um plano de testes para aprovação do usuário, então gera testes seguindo as convenções RED-GREEN.

Os usuários atualmente criam prompts `/expresso` manualmente para geração de testes após cada fase. Este workflow padroniza o processo com classificação adequada, portões de qualidade e relatório de lacunas.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.
</required_reading>

<process>

<step name="parse_arguments">
Analisar `$ARGUMENTS` para:
- Número de fase (inteiro, decimal ou sufixo de letra) → armazenar como `$PHASE_ARG`
- Texto restante após o número da fase → armazenar como `$EXTRA_INSTRUCTIONS` (opcional)

Exemplo: `/adicionar-testes 12 focar nos casos extremos` → `$PHASE_ARG=12`, `$EXTRA_INSTRUCTIONS="focar nos casos extremos"`

Se nenhum argumento de fase fornecido:

```
ERRO: Número de fase obrigatório
Uso: /adicionar-testes <fase> [instruções adicionais]
Exemplo: /adicionar-testes 12
Exemplo: /adicionar-testes 12 focar nos casos extremos no módulo de preços
```

Sair.
</step>

<step name="init_context">
Carregar contexto de operação de fase:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extrair do JSON de init: `phase_dir`, `phase_number`, `phase_name`.

Verificar se o diretório de fase existe. Se não:
```
ERRO: Diretório de fase não encontrado para a fase ${PHASE_ARG}
Certifique-se de que a fase existe em .planning/phases/
```
Sair.

Ler os artefatos da fase (em ordem de prioridade):
1. `${phase_dir}/*-SUMMARY.md` — o que foi implementado, arquivos alterados
2. `${phase_dir}/CONTEXT.md` — critérios de aceitação, decisões
3. `${phase_dir}/*-VERIFICATION.md` — cenários verificados pelo usuário (se UAT foi feito)

Se nenhum SUMMARY.md existir:
```
ERRO: Nenhum SUMMARY.md encontrado para a fase ${PHASE_ARG}
Este comando funciona em fases concluídas. Execute /executar-fase primeiro.
```
Sair.

Apresentar banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► ADICIONAR TESTES — Fase ${phase_number}: ${phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="analyze_implementation">
Extrair a lista de arquivos modificados pela fase do SUMMARY.md (seção "Files Changed" ou equivalente).

Para cada arquivo, classificar em uma das três categorias:

| Categoria | Critérios | Tipo de Teste |
|-----------|-----------|---------------|
| **TDD** | Funções puras onde `expect(fn(input)).toBe(output)` é escrevível | Testes unitários |
| **E2E** | Comportamento de UI verificável por automação de navegador | Testes Playwright/E2E |
| **Skip** | Não testável de forma significativa ou já coberto | Nenhum |

**Classificação TDD — aplicar quando:**
- Lógica de negócio: cálculos, preços, regras fiscais, validação
- Transformações de dados: mapeamento, filtragem, agregação, formatação
- Parsers: CSV, JSON, XML, análise de formato personalizado
- Validadores: validação de input, validação de schema, regras de negócio
- Máquinas de estado: transições de status, etapas de workflow
- Utilitários: manipulação de strings, tratamento de datas, formatação de números

**Classificação E2E — aplicar quando:**
- Atalhos de teclado: keybindings, teclas modificadoras, sequências de accordes
- Navegação: transições de página, roteamento, breadcrumbs, voltar/avançar
- Interações de formulário: envio, erros de validação, foco de campo, autocomplete
- Seleção: seleção de linha, multi-seleção, intervalos com shift-click
- Arrastar e soltar: reordenação, mover entre contêineres
- Diálogos modais: abrir, fechar, confirmar, cancelar
- Grids de dados: ordenação, filtragem, edição inline, redimensionamento de coluna

**Classificação Skip — aplicar quando:**
- Layout/estilo de UI: classes CSS, aparência visual, breakpoints responsivos
- Configuração: arquivos de config, variáveis de ambiente, feature flags
- Código de cola: configuração de injeção de dependência, registro de middleware, tabelas de roteamento
- Migrations: migrations de banco de dados, mudanças de schema
- CRUD simples: create/read/update/delete básico sem lógica de negócio
- Definições de tipo: records, DTOs, interfaces sem lógica

Ler cada arquivo para verificar a classificação. Não classificar apenas pelo nome do arquivo.
</step>

<step name="present_classification">
Apresentar a classificação ao usuário para confirmação antes de prosseguir:

```
AskUserQuestion(
  header: "Classificação de Testes",
  question: |
    ## Arquivos classificados para teste

    ### TDD (Testes Unitários) — {N} arquivos
    {lista de arquivos com breve motivo}

    ### E2E (Testes de Navegador) — {M} arquivos
    {lista de arquivos com breve motivo}

    ### Skip — {K} arquivos
    {lista de arquivos com breve motivo}

    {se $EXTRA_INSTRUCTIONS: "Instruções adicionais: ${EXTRA_INSTRUCTIONS}"}

    Como você gostaria de prosseguir?
  options:
    - "Aprovar e gerar plano de testes"
    - "Ajustar classificação (vou especificar mudanças)"
    - "Cancelar"
)
```

Se o usuário selecionar "Ajustar classificação": aplicar as mudanças e reapresentar.
Se o usuário selecionar "Cancelar": sair graciosamente.
</step>

<step name="discover_test_structure">
Antes de gerar o plano de testes, descobrir a estrutura de testes existente do projeto:

```bash
# Encontrar diretórios de testes existentes
find . -type d -name "*test*" -o -name "*spec*" -o -name "*__tests__*" 2>/dev/null | head -20
# Encontrar arquivos de teste existentes para correspondência de convenções
find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "*Tests.fs" -o -name "*Test.fs" \) 2>/dev/null | head -20
# Verificar runners de teste
ls package.json *.sln 2>/dev/null || true
```

Identificar:
- Estrutura de diretórios de teste (onde ficam testes unitários, onde ficam testes E2E)
- Convenções de nomenclatura (`.test.ts`, `.spec.ts`, `*Tests.fs`, etc.)
- Comandos do runner de testes (como executar testes unitários, como executar testes E2E)
- Framework de testes (xUnit, NUnit, Jest, Playwright, etc.)

Se a estrutura de testes for ambígua, perguntar ao usuário:
```
AskUserQuestion(
  header: "Estrutura de Testes",
  question: "Encontrei múltiplos locais de testes. Onde devo criar os testes?",
  options: [listar locais descobertos]
)
```
</step>

<step name="generate_test_plan">
Para cada arquivo aprovado, criar um plano de testes detalhado.

**Para arquivos TDD**, planejar testes seguindo RED-GREEN-REFACTOR:
1. Identificar funções/métodos testáveis no arquivo
2. Para cada função: listar cenários de input, outputs esperados, casos extremos
3. Nota: como o código já existe, os testes podem passar imediatamente — isso é OK, mas verificar que eles testam o comportamento CORRETO

**Para arquivos E2E**, planejar testes seguindo portões RED-GREEN:
1. Identificar cenários de usuário do CONTEXT.md/VERIFICATION.md
2. Para cada cenário: descrever a ação do usuário, resultado esperado, asserções
3. Nota: portão RED significa confirmar que o teste falharia se a funcionalidade estivesse quebrada

Apresentar o plano completo de testes:

```
AskUserQuestion(
  header: "Plano de Testes",
  question: |
    ## Plano de Geração de Testes

    ### Testes Unitários ({N} testes em {M} arquivos)
    {para cada arquivo: caminho do arquivo de teste, lista de casos de teste}

    ### Testes E2E ({P} testes em {Q} arquivos)
    {para cada arquivo: caminho do arquivo de teste, lista de cenários de teste}

    ### Comandos de Teste
    - Unitários: {comando de teste descoberto}
    - E2E: {comando e2e descoberto}

    Pronto para gerar?
  options:
    - "Gerar todos"
    - "Escolher individualmente (vou especificar quais)"
    - "Ajustar plano"
)
```

Se "Escolher individualmente": perguntar ao usuário quais testes incluir.
Se "Ajustar plano": aplicar mudanças e reapresentar.
</step>

<step name="execute_tdd_generation">
Para cada teste TDD aprovado:

1. **Criar arquivo de teste** seguindo as convenções do projeto descobertas (diretório, nomenclatura, imports)

2. **Escrever teste** com estrutura clara arrange/act/assert:
   ```
   // Arrange — configurar inputs e outputs esperados
   // Act — chamar a função sob teste
   // Assert — verificar que o output corresponde às expectativas
   ```

3. **Executar o teste**:
   ```bash
   {comando de teste descoberto}
   ```

4. **Avaliar resultado:**
   - **Teste passa**: Bom — a implementação satisfaz o teste. Verificar que o teste testa comportamento significativo (não apenas que compila).
   - **Teste falha com erro de asserção**: Isso pode ser um bug genuíno descoberto pelo teste. Sinalizar:
     ```
     ⚠️ Bug potencial encontrado: {nome do teste}
     Esperado: {esperado}
     Atual: {atual}
     Arquivo: {arquivo de implementação}
     ```
     NÃO corrigir a implementação — este é um comando de geração de testes, não de correção. Registrar o achado.
   - **Teste falha com erro (import, sintaxe, etc.)**: Este é um erro de teste. Corrigir o teste e re-executar.
</step>

<step name="execute_e2e_generation">
Para cada teste E2E aprovado:

1. **Verificar testes existentes** cobrindo o mesmo cenário:
   ```bash
   grep -r "{palavra-chave do cenário}" {diretório de testes e2e} 2>/dev/null || true
   ```
   Se encontrado, estender em vez de duplicar.

2. **Criar arquivo de teste** direcionado ao cenário de usuário do CONTEXT.md/VERIFICATION.md

3. **Executar o teste E2E**:
   ```bash
   {comando e2e descoberto}
   ```

4. **Avaliar resultado:**
   - **VERDE (passa)**: Registrar sucesso
   - **VERMELHO (falha)**: Determinar se é um problema de teste ou um bug genuíno de aplicação. Sinalizar bugs:
     ```
     ⚠️ Falha E2E: {nome do teste}
     Cenário: {descrição}
     Erro: {mensagem de erro}
     ```
   - **Não pode executar**: Reportar bloqueio. NÃO marcar como concluído.
     ```
     🛑 Bloqueio E2E: {motivo pelo qual os testes não podem ser executados}
     ```

**Regra sem-pular:** Se os testes E2E não puderem ser executados (dependências ausentes, problemas de ambiente), reportar o bloqueio e marcar o teste como incompleto. Nunca marcar sucesso sem realmente executar o teste.
</step>

<step name="summary_and_commit">
Criar um relatório de cobertura de testes e apresentar ao usuário:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► GERAÇÃO DE TESTES CONCLUÍDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Resultados

| Categoria | Gerados | Passando | Falhando | Bloqueados |
|-----------|---------|----------|----------|------------|
| Unitários | {N}     | {n1}     | {n2}     | {n3}       |
| E2E       | {M}     | {m1}     | {m2}     | {m3}       |

## Arquivos Criados/Modificados
{lista de arquivos de teste com caminhos}

## Lacunas de Cobertura
{áreas que não puderam ser testadas e por quê}

## Bugs Descobertos
{quaisquer falhas de asserção que indicam bugs de implementação}
```

Registrar geração de testes no estado do projeto:
```bash
node "./.claude/framework/bin/tools.cjs" state-snapshot
```

Se houver testes passando para commitar:

```bash
git add {arquivos de teste}
git commit -m "test(phase-${phase_number}): adicionar testes unitários e E2E do comando adicionar-testes"
```

Apresentar próximos passos:

```
---

## ▶ Próximo Passo

{se bugs descobertos:}
**Corrigir bugs descobertos:** `/expresso corrigir as {N} falhas de teste descobertas na fase ${phase_number}`

{se testes bloqueados:}
**Resolver bloqueios de teste:** {descrição do que é necessário}

{caso contrário:}
**Todos os testes passando!** Fase ${phase_number} está totalmente testada.

---

**Também disponível:**
- `/adicionar-testes {próxima_fase}` — testar outra fase
- `/verificar-trabalho {phase_number}` — executar verificação UAT

---
```
</step>

</process>

<success_criteria>
- [ ] Artefatos de fase carregados (SUMMARY.md, CONTEXT.md, opcionalmente VERIFICATION.md)
- [ ] Todos os arquivos alterados classificados nas categorias TDD/E2E/Skip
- [ ] Classificação apresentada ao usuário e aprovada
- [ ] Estrutura de testes do projeto descoberta (diretórios, convenções, runners)
- [ ] Plano de testes apresentado ao usuário e aprovado
- [ ] Testes TDD gerados com estrutura arrange/act/assert
- [ ] Testes E2E gerados direcionados a cenários de usuário
- [ ] Todos os testes executados — nenhum teste não executado marcado como passando
- [ ] Bugs descobertos pelos testes sinalizados (não corrigidos)
- [ ] Arquivos de teste commitados com mensagem adequada
- [ ] Lacunas de cobertura documentadas
- [ ] Próximos passos apresentados ao usuário
</success_criteria>

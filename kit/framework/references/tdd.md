<overview>
TDD é sobre qualidade de design, não métricas de cobertura. O ciclo vermelho-verde-refatorar força você a pensar sobre o comportamento antes da implementação, produzindo interfaces mais limpas e código mais testável.

**Princípio:** Se você pode descrever o comportamento como `expect(fn(input)).toBe(output)` antes de escrever `fn`, o TDD melhora o resultado.

**Insight chave:** O trabalho TDD é fundamentalmente mais pesado do que tarefas padrão — requer 2-3 ciclos de execução (VERMELHO → VERDE → REFATORAR), cada um com leituras de arquivo, execuções de teste e possível debugging. Funcionalidades TDD recebem planos dedicados para garantir que o contexto completo esteja disponível durante todo o ciclo.
</overview>

<when_to_use_tdd>
## Quando o TDD Melhora a Qualidade

**Candidatos a TDD (criar um plano TDD):**
- Lógica de negócio com entradas/saídas definidas
- Endpoints de API com contratos de requisição/resposta
- Transformações de dados, análise, formatação
- Regras e restrições de validação
- Algoritmos com comportamento testável
- Máquinas de estado e workflows
- Funções utilitárias com especificações claras

**Pular TDD (usar plano padrão com tarefas `type="auto"`):**
- Layout de UI, estilo, componentes visuais
- Alterações de configuração
- Código de cola conectando componentes existentes
- Scripts e migrações de uso único
- CRUD simples sem lógica de negócio
- Prototipagem exploratória

**Heurística:** Você pode escrever `expect(fn(input)).toBe(output)` antes de escrever `fn`?
→ Sim: Crie um plano TDD
→ Não: Use plano padrão, adicione testes depois se necessário
</when_to_use_tdd>

<tdd_plan_structure>
## Estrutura do Plano TDD

Cada plano TDD implementa **uma funcionalidade** através do ciclo completo VERMELHO-VERDE-REFATORAR.

```markdown
---
phase: XX-nome
plan: NN
type: tdd
---

<objective>
[O que é a funcionalidade e por quê]
Purpose: [Benefício de design do TDD para esta funcionalidade]
Output: [Funcionalidade funcionando e testada]
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@relevant/source/files.ts
</context>

<feature>
  <name>[Nome da funcionalidade]</name>
  <files>[arquivo fonte, arquivo de teste]</files>
  <behavior>
    [Comportamento esperado em termos testáveis]
    Casos: entrada → saída esperada
  </behavior>
  <implementation>[Como implementar uma vez que os testes passem]</implementation>
</feature>

<verification>
[Comando de teste que prova que a funcionalidade funciona]
</verification>

<success_criteria>
- Teste falhando escrito e commitado
- Implementação passa no teste
- Refatoração concluída (se necessário)
- Todos os 2-3 commits presentes
</success_criteria>

<output>
Após a conclusão, crie SUMMARY.md com:
- VERMELHO: Qual teste foi escrito, por que falhou
- VERDE: Qual implementação fez passar
- REFATORAR: Qual limpeza foi feita (se houver)
- Commits: Lista de commits produzidos
</output>
```

**Uma funcionalidade por plano TDD.** Se as funcionalidades são triviais o suficiente para agrupar, são triviais o suficiente para pular o TDD — use um plano padrão e adicione testes depois.
</tdd_plan_structure>

<execution_flow>
## Ciclo Vermelho-Verde-Refatorar

**VERMELHO - Escrever teste falhando:**
1. Criar arquivo de teste seguindo convenções do projeto
2. Escrever teste descrevendo o comportamento esperado (do elemento `<behavior>`)
3. Executar o teste - DEVE falhar
4. Se o teste passar: a funcionalidade existe ou o teste está errado. Investigue.
5. Commit: `test({fase}-{plano}): add failing test for [funcionalidade]`

**VERDE - Implementar para passar:**
1. Escrever código mínimo para fazer o teste passar
2. Sem astúcias, sem otimização — apenas faça funcionar
3. Executar o teste - DEVE passar
4. Commit: `feat({fase}-{plano}): implement [funcionalidade]`

**REFATORAR (se necessário):**
1. Limpar a implementação se houver melhorias óbvias
2. Executar os testes - DEVEM ainda passar
3. Commitar apenas se houver alterações: `refactor({fase}-{plano}): clean up [funcionalidade]`

**Resultado:** Cada plano TDD produz 2-3 commits atômicos.
</execution_flow>

<test_quality>
## Bons Testes vs. Testes Ruins

**Teste o comportamento, não a implementação:**
- Bom: "retorna string de data formatada"
- Ruim: "chama o helper formatDate com os parâmetros corretos"
- Os testes devem sobreviver a refatorações

**Um conceito por teste:**
- Bom: Testes separados para entrada válida, entrada vazia, entrada malformada
- Ruim: Teste único verificando todos os casos extremos com múltiplas asserções

**Nomes descritivos:**
- Bom: "should reject empty email", "returns null for invalid ID"
- Ruim: "test1", "handles error", "works correctly"

**Sem detalhes de implementação:**
- Bom: Testar API pública, comportamento observável
- Ruim: Mockar internos, testar métodos privados, verificar estado interno
</test_quality>

<framework_setup>
## Configuração do Framework de Teste (Se Nenhum Existir)

Ao executar um plano TDD mas nenhum framework de teste estiver configurado, configure-o como parte da fase VERMELHO:

**1. Detectar o tipo de projeto:**
```bash
# JavaScript/TypeScript
if [ -f package.json ]; then echo "node"; fi

# Python
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then echo "python"; fi

# Go
if [ -f go.mod ]; then echo "go"; fi

# Rust
if [ -f Cargo.toml ]; then echo "rust"; fi
```

**2. Instalar o framework mínimo:**
| Projeto | Framework | Instalação |
|---------|-----------|------------|
| Node.js | Jest | `npm install -D jest @types/jest ts-jest` |
| Node.js (Vite) | Vitest | `npm install -D vitest` |
| Python | pytest | `pip install pytest` |
| Go | testing | Integrado |
| Rust | cargo test | Integrado |

**3. Criar config se necessário:**
- Jest: `jest.config.js` com preset ts-jest
- Vitest: `vitest.config.ts` com globals de teste
- pytest: `pytest.ini` ou seção `pyproject.toml`

**4. Verificar a configuração:**
```bash
# Executar suite de testes vazia — deve passar com 0 testes
npm test  # Node
pytest    # Python
go test ./...  # Go
cargo test    # Rust
```

**5. Criar primeiro arquivo de teste:**
Siga as convenções do projeto para localização dos testes:
- `*.test.ts` / `*.spec.ts` ao lado da fonte
- Diretório `__tests__/`
- Diretório `tests/` na raiz

A configuração do framework é um custo único incluído na fase VERMELHO do primeiro plano TDD.
</framework_setup>

<error_handling>
## Tratamento de Erros

**O teste não falha na fase VERMELHO:**
- A funcionalidade pode já existir — investigue
- O teste pode estar errado (não testando o que você pensa)
- Corrija antes de prosseguir

**O teste não passa na fase VERDE:**
- Depure a implementação
- Não pule para refatorar
- Continue iterando até ficar verde

**Os testes falham na fase REFATORAR:**
- Desfaça a refatoração
- O commit foi prematuro
- Refatore em passos menores

**Testes não relacionados quebram:**
- Pare e investigue
- Pode indicar problema de acoplamento
- Corrija antes de prosseguir
</error_handling>

<commit_pattern>
## Padrão de Commit para Planos TDD

Planos TDD produzem 2-3 commits atômicos (um por fase):

```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected
- Tests empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322
- Returns boolean for validity
- Handles edge cases (empty, null)

refactor(08-02): extract regex to constant (optional)

- Moved pattern to EMAIL_REGEX constant
- No behavior changes
- Tests still pass
```

**Comparação com planos padrão:**
- Planos padrão: 1 commit por tarefa, 2-4 commits por plano
- Planos TDD: 2-3 commits para uma única funcionalidade

Ambos seguem o mesmo formato: `{tipo}({fase}-{plano}): {descrição}`

**Benefícios:**
- Cada commit é revertível independentemente
- `git bisect` funciona no nível de commit
- Histórico claro mostrando disciplina TDD
- Consistente com a estratégia geral de commits
</commit_pattern>

<context_budget>
## Orçamento de Contexto

Planos TDD visam **~40% de uso de contexto** (menor que os ~50% dos planos padrão).

Por que menor:
- Fase VERMELHO: escrever teste, executar teste, potencialmente depurar por que não falhou
- Fase VERDE: implementar, executar teste, potencialmente iterar em falhas
- Fase REFATORAR: modificar código, executar testes, verificar se não houve regressões

Cada fase envolve leitura de arquivos, execução de comandos, análise de saída. O vai e vem é inerentemente mais pesado do que a execução linear de tarefas.

O foco em uma única funcionalidade garante qualidade total durante todo o ciclo.
</context_budget>

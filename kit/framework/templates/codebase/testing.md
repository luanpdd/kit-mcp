# Template de Padrões de Teste

Template para `.planning/codebase/TESTING.md` - captura o framework e padrões de teste.

**Propósito:** Documentar como os testes são escritos e executados. Guia para adicionar testes que correspondam aos padrões existentes.

---

## Template do Arquivo

```markdown
# Padrões de Teste

**Data da Análise:** [AAAA-MM-DD]

## Framework de Testes

**Runner:**
- [Framework: ex.: "Jest 29.x", "Vitest 1.x"]
- [Config: ex.: "jest.config.js na raiz do projeto"]

**Biblioteca de Asserções:**
- [Biblioteca: ex.: "expect built-in", "chai"]
- [Matchers: ex.: "toBe, toEqual, toThrow"]

**Comandos de Execução:**
```bash
[ex.: "npm test" ou "npm run test"]              # Executar todos os testes
[ex.: "npm test -- --watch"]                     # Modo watch
[ex.: "npm test -- path/to/file.test.ts"]       # Arquivo único
[ex.: "npm run test:coverage"]                   # Relatório de cobertura
```

## Organização dos Arquivos de Teste

**Localização:**
- [Padrão: ex.: "*.test.ts junto aos arquivos fonte"]
- [Alternativa: ex.: "diretório __tests__/" ou "árvore tests/ separada"]

**Nomenclatura:**
- [Testes unitários: ex.: "nome-do-modulo.test.ts"]
- [Integração: ex.: "nome-da-funcionalidade.integration.test.ts"]
- [E2E: ex.: "fluxo-do-usuario.e2e.test.ts"]

**Estrutura:**
```
[Mostrar padrão real de diretório, ex.:
src/
  lib/
    utils.ts
    utils.test.ts
  services/
    user-service.ts
    user-service.test.ts
]
```

## Estrutura dos Testes

**Organização de Suites:**
```typescript
[Mostrar padrão real usado, ex.:

describe('NomeDoModulo', () => {
  describe('nomeDaFuncao', () => {
    it('deve tratar caso de sucesso', () => {
      // arrange
      // act
      // assert
    });

    it('deve tratar caso de erro', () => {
      // código do teste
    });
  });
});
]
```

**Padrões:**
- [Setup: ex.: "beforeEach para setup compartilhado, evitar beforeAll"]
- [Teardown: ex.: "afterEach para limpar, restaurar mocks"]
- [Estrutura: ex.: "padrão arrange/act/assert obrigatório"]

## Mocking

**Framework:**
- [Ferramenta: ex.: "mocking built-in do Jest", "Vitest vi", "Sinon"]
- [Import mocking: ex.: "vi.mock() no topo do arquivo"]

**Padrões:**
```typescript
[Mostrar padrão real de mocking, ex.:

// Mock dependência externa
vi.mock('./external-service', () => ({
  fetchData: vi.fn()
}));

// Mock no teste
const mockFetch = vi.mocked(fetchData);
mockFetch.mockResolvedValue({ data: 'test' });
]
```

**O Que Mockar:**
- [ex.: "APIs externas, sistema de arquivos, banco de dados"]
- [ex.: "Tempo/datas (usar vi.useFakeTimers)"]
- [ex.: "Chamadas de rede (usar mock fetch)"]

**O Que NÃO Mockar:**
- [ex.: "Funções puras, utilitários"]
- [ex.: "Lógica de negócio interna"]

## Fixtures e Factories

**Dados de Teste:**
```typescript
[Mostrar padrão para criar dados de teste, ex.:

// Padrão factory
function createTestUser(overrides?: Partial<User>): User {
  return {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

// Arquivo de fixture
// tests/fixtures/users.ts
export const mockUsers = [/* ... */];
]
```

**Localização:**
- [ex.: "tests/fixtures/ para fixtures compartilhadas"]
- [ex.: "funções factory no arquivo de teste ou tests/factories/"]

## Cobertura

**Requisitos:**
- [Meta: ex.: "80% de cobertura de linhas", "sem meta específica"]
- [Aplicação: ex.: "CI bloqueia <80%", "cobertura apenas para conscientização"]

**Configuração:**
- [Ferramenta: ex.: "cobertura built-in via flag --coverage"]
- [Exclusões: ex.: "excluir *.test.ts, arquivos de config"]

**Ver Cobertura:**
```bash
[ex.: "npm run test:coverage"]
[ex.: "open coverage/index.html"]
```

## Tipos de Testes

**Testes Unitários:**
- [Escopo: ex.: "testar função/classe única em isolamento"]
- [Mocking: ex.: "mockar todas as dependências externas"]
- [Velocidade: ex.: "deve executar em <1s por teste"]

**Testes de Integração:**
- [Escopo: ex.: "testar múltiplos módulos juntos"]
- [Mocking: ex.: "mockar serviços externos, usar módulos internos reais"]
- [Setup: ex.: "usar banco de dados de teste, seed de dados"]

**Testes E2E:**
- [Framework: ex.: "Playwright para E2E"]
- [Escopo: ex.: "testar fluxos completos do usuário"]
- [Localização: ex.: "diretório e2e/ separado dos testes unitários"]

## Padrões Comuns

**Teste Async:**
```typescript
[Mostrar padrão, ex.:

it('deve tratar operação async', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
]
```

**Teste de Erro:**
```typescript
[Mostrar padrão, ex.:

it('deve lançar com entrada inválida', () => {
  expect(() => functionCall()).toThrow('mensagem de erro');
});

// Erro async
it('deve rejeitar na falha', async () => {
  await expect(asyncCall()).rejects.toThrow('mensagem de erro');
});
]
```

**Snapshot Testing:**
- [Uso: ex.: "apenas para componentes React" ou "não usado"]
- [Localização: ex.: "diretório __snapshots__/"]

---

*Análise de testes: [data]*
*Atualizar quando padrões de teste mudarem*
```

<good_examples>
```markdown
# Testing Patterns

**Analysis Date:** 2025-01-20

## Test Framework

**Runner:**
- Vitest 1.0.4
- Config: vitest.config.ts in project root

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm run test:coverage                 # Coverage report
```

## Test File Organization

**Location:**
- *.test.ts alongside source files
- No separate tests/ directory

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
  it('should handle valid input', () => {
    // arrange
    const input = createTestInput();
    // act
    const result = functionName(input);
    // assert
    expect(result).toEqual(expectedOutput);
  });
});
```

---

*Testing analysis: 2025-01-20*
*Update when test patterns change*
```
</good_examples>

<guidelines>
**O que pertence ao TESTING.md:**
- Framework de teste e configuração do runner
- Padrões de localização e nomenclatura de arquivos de teste
- Estrutura de teste (describe/it, padrões beforeEach)
- Abordagem de mocking e exemplos
- Padrões de fixture/factory
- Requisitos de cobertura
- Como executar testes (comandos)
- Padrões comuns de teste no código real

**O que NÃO pertence aqui:**
- Casos de teste específicos (diferir para os arquivos de teste reais)
- Escolhas tecnológicas (isso é STACK.md)
- Setup de CI/CD (isso é docs de deployment)

**Ao preencher este template:**
- Verificar scripts do package.json para comandos de teste
- Encontrar arquivo de config de teste (jest.config.js, vitest.config.ts)
- Ler 3-5 arquivos de teste existentes para identificar padrões
- Procurar utilitários de teste em tests/ ou test-utils/
- Verificar configuração de cobertura
- Documentar padrões realmente usados, não padrões ideais

**Útil para planejamento de fases quando:**
- Adicionando novas funcionalidades (escrever testes correspondentes)
- Refatorando (manter padrões de teste)
- Corrigindo bugs (adicionar testes de regressão)
- Entendendo abordagem de verificação
- Configurando infraestrutura de teste

**Abordagem de análise:**
- Verificar package.json para framework de teste e scripts
- Ler arquivo de config de teste para cobertura, setup
- Examinar organização dos arquivos de teste (colocalizados vs. separados)
- Revisar 5 arquivos de teste para padrões (mocking, estrutura, asserções)
- Procurar utilitários de teste, fixtures, factories
- Notar quaisquer tipos de teste (unitário, integração, e2e)
- Documentar comandos para executar testes
</guidelines>

# Template de Stack Tecnológico

Template para `.planning/codebase/STACK.md` - captura a fundação tecnológica.

**Propósito:** Documentar quais tecnologias executam este codebase. Focado em "o que executa quando você roda o código."

---

## Template do Arquivo

```markdown
# Stack Tecnológico

**Data da Análise:** [AAAA-MM-DD]

## Linguagens

**Primária:**
- [Linguagem] [Versão] - [Onde usada: ex.: "todo o código da aplicação"]

**Secundária:**
- [Linguagem] [Versão] - [Onde usada: ex.: "scripts de build, tooling"]

## Runtime

**Ambiente:**
- [Runtime] [Versão] - [ex.: "Node.js 20.x"]
- [Requisitos adicionais, se houver]

**Gerenciador de Pacotes:**
- [Gerenciador] [Versão] - [ex.: "npm 10.x"]
- Lockfile: [ex.: "package-lock.json presente"]

## Frameworks

**Core:**
- [Framework] [Versão] - [Propósito: ex.: "servidor web", "framework de UI"]

**Testes:**
- [Framework] [Versão] - [ex.: "Jest para testes unitários"]
- [Framework] [Versão] - [ex.: "Playwright para E2E"]

**Build/Dev:**
- [Ferramenta] [Versão] - [ex.: "Vite para bundling"]
- [Ferramenta] [Versão] - [ex.: "Compilador TypeScript"]

## Dependências Chave

[Incluir apenas dependências críticas para entender o stack — limitar a 5-10 mais importantes]

**Críticas:**
- [Pacote] [Versão] - [Por que importa: ex.: "autenticação", "acesso ao banco de dados"]
- [Pacote] [Versão] - [Por que importa]

**Infraestrutura:**
- [Pacote] [Versão] - [ex.: "Express para roteamento HTTP"]
- [Pacote] [Versão] - [ex.: "Client PostgreSQL"]

## Configuração

**Ambiente:**
- [Como configurado: ex.: "arquivos .env", "variáveis de ambiente"]
- [Configs chave: ex.: "DATABASE_URL, API_KEY obrigatórios"]

**Build:**
- [Arquivos de config de build: ex.: "vite.config.ts, tsconfig.json"]

## Requisitos de Plataforma

**Desenvolvimento:**
- [Requisitos de SO ou "qualquer plataforma"]
- [Tooling adicional: ex.: "Docker para banco local"]

**Produção:**
- [Alvo de deployment: ex.: "Vercel", "AWS Lambda", "container Docker"]
- [Requisitos de versão]

---

*Análise de stack: [data]*
*Atualizar após mudanças principais de dependências*
```

<good_examples>
```markdown
# Technology Stack

**Analysis Date:** 2025-01-20

## Languages

**Primary:**
- TypeScript 5.3 - All application code

**Secondary:**
- JavaScript - Build scripts, config files

## Runtime

**Environment:**
- Node.js 20.x (LTS)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None (vanilla Node.js CLI)

**Testing:**
- Vitest 1.0 - Unit tests
- tsx - TypeScript execution without build step

## Key Dependencies

**Critical:**
- commander 11.x - CLI argument parsing and command structure
- chalk 5.x - Terminal output styling
- fs-extra 11.x - Extended file system operations

---

*Stack analysis: 2025-01-20*
*Update after major dependency changes*
```
</good_examples>

<guidelines>
**O que pertence ao STACK.md:**
- Linguagens e versões
- Requisitos de runtime (Node, Bun, Deno, browser)
- Gerenciador de pacotes e lockfile
- Escolhas de framework
- Dependências críticas (limitar a 5-10 mais importantes)
- Tooling de build
- Requisitos de plataforma/deployment

**O que NÃO pertence aqui:**
- Estrutura de arquivos (isso é STRUCTURE.md)
- Padrões arquiteturais (isso é ARCHITECTURE.md)
- Toda dependência no package.json (apenas as críticas)
- Detalhes de implementação (diferir para o código)

**Ao preencher este template:**
- Verificar package.json para dependências
- Notar versão do runtime em .nvmrc ou engines do package.json
- Incluir apenas dependências que afetam o entendimento (não todo utilitário)
- Especificar versões apenas quando a versão importa (mudanças breaking, compatibilidade)

**Útil para planejamento de fases quando:**
- Adicionando novas dependências (verificar compatibilidade)
- Atualizando frameworks (saber o que está em uso)
- Escolhendo abordagem de implementação (deve funcionar com stack existente)
- Entendendo requisitos de build
</guidelines>

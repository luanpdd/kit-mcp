# Template de Integrações Externas

Template para `.planning/codebase/INTEGRATIONS.md` - captura dependências de serviços externos.

**Propósito:** Documentar com quais sistemas externos este codebase se comunica. Focado em "o que vive fora do nosso código do qual dependemos."

---

## Template do Arquivo

```markdown
# Integrações Externas

**Data da Análise:** [AAAA-MM-DD]

## APIs & Serviços Externos

**Processamento de Pagamentos:**
- [Serviço] - [Para o que é usado: ex.: "cobrança de assinatura, pagamentos únicos"]
  - SDK/Client: [ex.: "pacote npm stripe v14.x"]
  - Auth: [ex.: "chave de API em variável de ambiente STRIPE_SECRET_KEY"]
  - Endpoints usados: [ex.: "sessões de checkout, webhooks"]

**Email/SMS:**
- [Serviço] - [Para o que é usado: ex.: "emails transacionais"]
  - SDK/Client: [ex.: "sendgrid/mail v8.x"]
  - Auth: [ex.: "chave de API em variável de ambiente SENDGRID_API_KEY"]
  - Templates: [ex.: "gerenciados no dashboard SendGrid"]

**APIs Externas:**
- [Serviço] - [Para o que é usado]
  - Método de integração: [ex.: "REST API via fetch", "cliente GraphQL"]
  - Auth: [ex.: "token OAuth2 em variável de ambiente AUTH_TOKEN"]
  - Rate limits: [se aplicável]

## Armazenamento de Dados

**Bancos de Dados:**
- [Tipo/Provedor] - [ex.: "PostgreSQL no Supabase"]
  - Conexão: [ex.: "via variável de ambiente DATABASE_URL"]
  - Client: [ex.: "Prisma ORM v5.x"]
  - Migrations: [ex.: "prisma migrate em migrations/"]

**Armazenamento de Arquivos:**
- [Serviço] - [ex.: "AWS S3 para uploads de usuários"]
  - SDK/Client: [ex.: "@aws-sdk/client-s3"]
  - Auth: [ex.: "credenciais IAM em variáveis de ambiente AWS_*"]
  - Buckets: [ex.: "prod-uploads, dev-uploads"]

**Cache:**
- [Serviço] - [ex.: "Redis para armazenamento de sessão"]
  - Conexão: [ex.: "variável de ambiente REDIS_URL"]
  - Client: [ex.: "ioredis v5.x"]

## Autenticação & Identidade

**Provedor de Auth:**
- [Serviço] - [ex.: "Supabase Auth", "Auth0", "JWT customizado"]
  - Implementação: [ex.: "SDK client Supabase"]
  - Armazenamento de token: [ex.: "cookies httpOnly", "localStorage"]
  - Gerenciamento de sessão: [ex.: "JWT refresh tokens"]

**Integrações OAuth:**
- [Provedor] - [ex.: "Google OAuth para login"]
  - Credenciais: [ex.: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"]
  - Escopos: [ex.: "email, profile"]

## Monitoramento & Observabilidade

**Rastreamento de Erros:**
- [Serviço] - [ex.: "Sentry"]
  - DSN: [ex.: "variável de ambiente SENTRY_DSN"]
  - Rastreamento de release: [ex.: "via SENTRY_RELEASE"]

**Analytics:**
- [Serviço] - [ex.: "Mixpanel para analytics de produto"]
  - Token: [ex.: "variável de ambiente MIXPANEL_TOKEN"]
  - Eventos rastreados: [ex.: "ações do usuário, page views"]

**Logs:**
- [Serviço] - [ex.: "CloudWatch", "Datadog", "nenhum (apenas stdout)"]
  - Integração: [ex.: "built-in do AWS Lambda"]

## CI/CD & Deployment

**Hospedagem:**
- [Plataforma] - [ex.: "Vercel", "AWS Lambda", "Docker no ECS"]
  - Deployment: [ex.: "automático no push para branch main"]
  - Variáveis de ambiente: [ex.: "configuradas no dashboard Vercel"]

**Pipeline CI:**
- [Serviço] - [ex.: "GitHub Actions"]
  - Workflows: [ex.: "test.yml, deploy.yml"]
  - Segredos: [ex.: "armazenados nos secrets do repositório GitHub"]

## Configuração de Ambiente

**Desenvolvimento:**
- Variáveis de ambiente necessárias: [Listar variáveis críticas]
- Localização dos segredos: [ex.: ".env.local (gitignored)", "cofre 1Password"]
- Serviços mock/stub: [ex.: "modo de teste Stripe", "PostgreSQL local"]

**Staging:**
- Diferenças específicas do ambiente: [ex.: "usa conta Stripe de staging"]
- Dados: [ex.: "banco de dados de staging separado"]

**Produção:**
- Gerenciamento de segredos: [ex.: "variáveis de ambiente Vercel"]
- Failover/redundância: [ex.: "replicação DB multi-região"]

## Webhooks & Callbacks

**Recebidos:**
- [Serviço] - [Endpoint: ex.: "/api/webhooks/stripe"]
  - Verificação: [ex.: "validação de assinatura via stripe.webhooks.constructEvent"]
  - Eventos: [ex.: "payment_intent.succeeded, customer.subscription.updated"]

**Enviados:**
- [Serviço] - [O que o aciona]
  - Endpoint: [ex.: "webhook CRM externo no cadastro do usuário"]
  - Lógica de retry: [se aplicável]

---

*Auditoria de integrações: [data]*
*Atualizar ao adicionar/remover serviços externos*
```

<good_examples>
```markdown
# External Integrations

**Analysis Date:** 2025-01-20

## APIs & External Services

**Payment Processing:**
- Stripe - Subscription billing and one-time course payments
  - SDK/Client: stripe npm package v14.8
  - Auth: API key in STRIPE_SECRET_KEY env var
  - Endpoints used: checkout sessions, customer portal, webhooks

**Email/SMS:**
- SendGrid - Transactional emails (receipts, password resets)
  - SDK/Client: @sendgrid/mail v8.1
  - Auth: API key in SENDGRID_API_KEY env var
  - Templates: Managed in SendGrid dashboard (template IDs in code)

---

*Integration audit: 2025-01-20*
*Update when adding/removing external services*
```
</good_examples>

<guidelines>
**O que pertence ao INTEGRATIONS.md:**
- Serviços externos com os quais o código se comunica
- Padrões de autenticação (onde os segredos vivem, não os segredos em si)
- SDKs e bibliotecas client usadas
- Nomes das variáveis de ambiente (não os valores)
- Endpoints de webhook e métodos de verificação
- Padrões de conexão com banco de dados
- Localizações de armazenamento de arquivos
- Serviços de monitoramento e logging

**O que NÃO pertence aqui:**
- Chaves de API ou segredos reais (NUNCA escreva esses)
- Arquitetura interna (isso é ARCHITECTURE.md)
- Padrões de código (isso é PATTERNS.md)
- Escolhas tecnológicas (isso é STACK.md)
- Problemas de performance (isso é CONCERNS.md)

**Ao preencher este template:**
- Verificar .env.example ou .env.template para variáveis de ambiente necessárias
- Procurar imports de SDK (stripe, @sendgrid/mail, etc.)
- Verificar handlers de webhook em rotas/endpoints
- Notar onde os segredos são gerenciados (não os segredos)
- Documentar diferenças específicas do ambiente (dev/staging/prod)
- Incluir padrões de auth para cada serviço

**Útil para planejamento de fases quando:**
- Adicionando novas integrações com serviços externos
- Depurando problemas de autenticação
- Entendendo fluxo de dados fora da aplicação
- Configurando novos ambientes
- Auditando dependências de terceiros
- Planejando para falhas ou migrações de serviço

**Nota de segurança:**
Documentar ONDE os segredos vivem (variáveis de ambiente, dashboard Vercel, 1Password), nunca QUAIS são os segredos.
</guidelines>

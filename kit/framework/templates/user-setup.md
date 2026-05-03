# Template de User Setup

Template para `.planning/phases/XX-name/{phase}-USER-SETUP.md` - configuração manual necessária que Claude não pode automatizar.

**Propósito:** Documentar tarefas de configuração que literalmente requerem ação humana — criação de conta, configuração de dashboard, recuperação de segredos. Claude automatiza tudo que é possível; este arquivo captura apenas o que resta.

---

## Template do Arquivo

```markdown
# Fase {X}: Configuração Manual Necessária

**Gerado:** [AAAA-MM-DD]
**Fase:** {nome-da-fase}
**Status:** Incompleto

Complete estes itens para que a integração funcione. Claude automatizou tudo que foi possível; estes itens requerem acesso humano a dashboards/contas externas.

## Variáveis de Ambiente

| Status | Variável | Fonte | Adicionar em |
|--------|----------|-------|--------------|
| [ ] | `NOME_DA_VAR` | [Dashboard do Serviço → Caminho → Para → Valor] | `.env.local` |
| [ ] | `OUTRA_VAR` | [Dashboard do Serviço → Caminho → Para → Valor] | `.env.local` |

## Configuração de Conta

[Apenas se criação de nova conta for necessária]

- [ ] **Criar conta no [Serviço]**
  - URL: [URL de cadastro]
  - Pular se: Já tem conta

## Configuração do Dashboard

[Apenas se configuração do dashboard for necessária]

- [ ] **[Tarefa de configuração]**
  - Local: [Dashboard do Serviço → Caminho → Para → Configuração]
  - Definir como: [Valor ou configuração necessária]
  - Notas: [Detalhes importantes]

## Verificação

Após completar a configuração, verificar com:

```bash
# [Comandos de verificação]
```

Resultados esperados:
- [Como o sucesso se parece]

---

**Quando todos os itens estiverem completos:** Marcar status como "Completo" no topo do arquivo.
```

---

## Quando Gerar

Gerar `{phase}-USER-SETUP.md` quando o frontmatter do plano contiver o campo `user_setup`.

**Gatilho:** `user_setup` existe no frontmatter do PLAN.md e tem itens.

**Local:** Mesmo diretório que PLAN.md e SUMMARY.md.

**Timing:** Gerado durante execute-plan.md após as tarefas concluírem, antes da criação do SUMMARY.md.

---

## Schema do Frontmatter

No PLAN.md, `user_setup` declara configuração manual necessária:

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
        details: "URL: https://[your-domain]/api/webhooks/stripe, Events: checkout.session.completed, customer.subscription.*"
    local_dev:
      - "Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
      - "Use the webhook secret from CLI output for local testing"
```

---

## A Regra Automation-First

**USER-SETUP.md contém APENAS o que Claude literalmente não pode fazer.**

| Claude PODE Fazer (não vai em USER-SETUP) | Claude NÃO PODE Fazer (→ USER-SETUP) |
|-------------------------------------------|--------------------------------------|
| `npm install stripe` | Criar conta no Stripe |
| Escrever código do webhook handler | Obter chaves de API do dashboard |
| Criar estrutura do arquivo `.env.local` | Copiar valores reais dos segredos |
| Executar `stripe listen` | Autenticar o Stripe CLI (OAuth no browser) |
| Configurar package.json | Acessar dashboards de serviços externos |
| Escrever qualquer código | Recuperar segredos de sistemas de terceiros |

**O teste:** "Isso requer um humano no browser, acessando uma conta que Claude não tem credenciais?"
- Sim → USER-SETUP.md
- Não → Claude faz automaticamente

---

## Exemplos por Serviço

<stripe_example>
```markdown
# Fase 10: Configuração Manual Necessária

**Gerado:** 2025-01-14
**Fase:** 10-monetization
**Status:** Incompleto

Complete estes itens para que a integração com Stripe funcione.

## Variáveis de Ambiente

| Status | Variável | Fonte | Adicionar em |
|--------|----------|-------|--------------|
| [ ] | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key | `.env.local` |
| [ ] | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key | `.env.local` |
| [ ] | `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret | `.env.local` |

## Configuração de Conta

- [ ] **Criar conta no Stripe** (se necessário)
  - URL: https://dashboard.stripe.com/register
  - Pular se: Já tem conta no Stripe

## Configuração do Dashboard

- [ ] **Criar endpoint de webhook**
  - Local: Stripe Dashboard → Developers → Webhooks → Add endpoint
  - URL do endpoint: `https://[seu-dominio]/api/webhooks/stripe`
  - Eventos a enviar:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

- [ ] **Criar produtos e preços** (se usando tiers de assinatura)
  - Local: Stripe Dashboard → Products → Add product
  - Criar cada tier de assinatura
  - Copiar Price IDs para:
    - `STRIPE_STARTER_PRICE_ID`
    - `STRIPE_PRO_PRICE_ID`

## Desenvolvimento Local

Para testar webhooks localmente:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Use o webhook signing secret da saída do CLI (começa com `whsec_`).

## Verificação

Após completar a configuração:

```bash
# Verificar se as variáveis de ambiente estão definidas
grep STRIPE .env.local

# Verificar se o build passa
npm run build

# Testar endpoint do webhook (deve retornar 400 bad signature, não 500 crash)
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'
```

Esperado: Build passa, webhook retorna 400 (validação de assinatura funcionando).

---

**Quando todos os itens estiverem completos:** Marcar status como "Completo" no topo do arquivo.
```
</stripe_example>

<supabase_example>
```markdown
# Fase 2: Configuração Manual Necessária

**Gerado:** 2025-01-14
**Fase:** 02-authentication
**Status:** Incompleto

Complete estes itens para que o Supabase Auth funcione.

## Variáveis de Ambiente

| Status | Variável | Fonte | Adicionar em |
|--------|----------|-------|--------------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `.env.local` |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public | `.env.local` |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | `.env.local` |

## Configuração de Conta

- [ ] **Criar projeto no Supabase**
  - URL: https://supabase.com/dashboard/new
  - Pular se: Já tem projeto para este app

## Configuração do Dashboard

- [ ] **Habilitar Email Auth**
  - Local: Supabase Dashboard → Authentication → Providers
  - Habilitar: provedor de Email
  - Configurar: Confirmar email (on/off conforme preferência)

- [ ] **Configurar provedores OAuth** (se usando login social)
  - Local: Supabase Dashboard → Authentication → Providers
  - Para Google: Adicionar Client ID e Secret do Google Cloud Console
  - Para GitHub: Adicionar Client ID e Secret do GitHub OAuth Apps

## Verificação

Após completar a configuração:

```bash
# Verificar variáveis de ambiente
grep SUPABASE .env.local

# Verificar conexão (executar no diretório do projeto)
npx supabase status
```

---

**Quando todos os itens estiverem completos:** Marcar status como "Completo" no topo do arquivo.
```
</supabase_example>

---

## Diretrizes

**Nunca incluir:** Valores reais de segredos. Passos que Claude pode automatizar (instalação de pacotes, mudanças de código).

**Nomenclatura:** `{phase}-USER-SETUP.md` corresponde ao padrão de número de fase.
**Rastreamento de status:** Usuário marca checkboxes e atualiza linha de status quando completo.
**Busca:** `grep -r "USER-SETUP" .planning/` encontra todas as fases com requisitos do usuário.

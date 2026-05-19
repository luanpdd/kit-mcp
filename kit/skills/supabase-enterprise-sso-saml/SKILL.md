---
name: supabase-enterprise-sso-saml
description: Use ao configurar Enterprise SSO via SAML 2.0 no Supabase — Okta, Azure AD, Google Workspace, signInWithSSO, attribute mapping e RLS multi-tenant.
---

# Supabase — Enterprise SSO (SAML 2.0)

## Quando usar

LLM carrega esta skill quando configurar **Single Sign-On empresarial via SAML 2.0** no Supabase, integrando com provedores de identidade (IdP) como Okta, Azure AD/Entra ID, Google Workspace ou PingIdentity.

Trigger phrases:

- "SAML SSO Supabase", "signInWithSSO"
- "enterprise single sign-on", "Okta Supabase"
- "Azure AD SAML", "Entra ID Supabase"
- "attribute mapping SAML", "multi-tenant SSO"
- "identity provider Supabase", "SP-initiated flow"
- "supabase sso add", "sso_provider_id RLS"

## Princípio canônico

SSO via SAML 2.0 permite que empresas clientes (tenants) façam login com suas credenciais corporativas existentes, sem criar senhas no Supabase. O Supabase atua como **Service Provider (SP)** e o sistema da empresa (Okta, Azure AD, etc.) é o **Identity Provider (IdP)**.

**Disponibilidade:** SAML SSO exige plano **Pro ou superior** do Supabase.

**Providers SAML suportados (testados):**

| Provider | Observação |
|----------|------------|
| Okta | Provider mais comum em B2B enterprise |
| Azure AD / Entra ID | Microsoft identity — integração via app enterprise |
| Google Workspace | Apenas org-level SSO (não contas pessoais Google) |
| PingIdentity | Usado em grandes enterprises financeiras |
| OneLogin | Alternativa frequente em médias empresas |
| Auth0 (como IdP) | Quando o tenant usa Auth0 para SSO interno |

**Quando usar SSO SAML:**

- ✅ B2B SaaS com clientes enterprise que exigem login corporativo
- ✅ Compliance que exige autenticação via IdP central da empresa
- ✅ Migração de usuários — empresa já tem Okta/Azure com todos os colaboradores
- ✅ Multi-tenant onde cada tenant tem seu próprio IdP

**Quando NÃO usar SSO SAML:**

- ❌ Aplicação B2C (usuários comuns) — use OAuth social ou magic link
- ❌ Plano Free do Supabase — SAML exige Pro+
- ❌ Poucos usuários que podem usar email/senha — overhead de configuração não compensa

## Terminologia SAML

| Termo | Significado |
|-------|-------------|
| **Identity Provider (IdP)** | Sistema que autentica o usuário (Okta, Azure AD) |
| **Service Provider (SP)** | Seu aplicativo (Supabase) — confia no IdP |
| **EntityID** | Identificador único do SP/IdP (geralmente uma URL) |
| **NameID** | Identificador do usuário no SAML assertion (email ou UUID) |
| **Assertion** | Documento XML assinado que o IdP envia ao SP após autenticação |
| **Metadata** | XML descrevendo endpoints, certificados e configurações do SP/IdP |
| **Certificate** | Certificado X.509 para assinar/verificar assertions |
| **ACS URL** | Assertion Consumer Service — endpoint do SP que recebe o assertion |
| **Binding** | Método de transporte (HTTP-POST ou HTTP-Redirect) |
| **RelayState** | Parâmetro opaco passado pelo SP ao IdP para manter estado (ex: URL de destino) |

## URLs SAML do Projeto Supabase

O Supabase expõe endpoints SAML padrão para cada projeto:

| Endpoint | URL |
|----------|-----|
| **Metadata (EntityID)** | `https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata` |
| **ACS URL** | `https://<project-ref>.supabase.co/auth/v1/sso/saml/acs` |

**NameID:** configurar no IdP para enviar `emailAddress` (formato `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`) ou `persistent` (UUID opaco). Prefira `persistent` em ambientes onde o email pode mudar.

**Configurar no IdP (exemplo Okta):**

1. No Okta Admin Console → Applications → Create App Integration → SAML 2.0
2. **Single Sign-On URL:** `https://<project-ref>.supabase.co/auth/v1/sso/saml/acs`
3. **Audience URI (SP Entity ID):** `https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata`
4. **Name ID format:** `EmailAddress`
5. Adicionar attribute mappings (ver seção abaixo)
6. Baixar metadata XML do Okta para usar no `supabase sso add`

## Gerenciar Conexões SSO via Supabase CLI

**Requisito:** Supabase CLI v1.46.4 ou superior.

```bash
# verificar versão
supabase --version  # deve ser >= 1.46.4

# adicionar conexão SSO via metadata URL (Okta/Azure expõem URL de metadata)
supabase sso add \
  --project-ref <project-ref> \
  --type saml \
  --metadata-url https://okta.example.com/app/xxx/sso/saml/metadata \
  --domains empresa.com,empresa.com.br

# adicionar via arquivo XML (quando o IdP não expõe URL pública de metadata)
supabase sso add \
  --project-ref <project-ref> \
  --type saml \
  --metadata-file ./idp-metadata.xml \
  --domains empresa.com

# adicionar com attribute mapping customizado
supabase sso add \
  --project-ref <project-ref> \
  --type saml \
  --metadata-url https://okta.example.com/.../metadata \
  --domains empresa.com \
  --attribute-mapping-file ./attribute-mapping.json

# listar todas as conexões SSO do projeto
supabase sso list --project-ref <project-ref>

# ver detalhes de uma conexão (inclui provider_id)
supabase sso show --project-ref <project-ref> --sso-provider-id <uuid>

# atualizar domains ou metadata de uma conexão
supabase sso update \
  --project-ref <project-ref> \
  --sso-provider-id <uuid> \
  --domains empresa.com,novodominio.com

# remover conexão SSO
supabase sso remove \
  --project-ref <project-ref> \
  --sso-provider-id <uuid>
```

## Fluxo SP-Initiated (padrão)

O fluxo padrão é iniciado pelo SP (seu app) quando o usuário tenta acessar:

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// SP-initiated: identificar pelo domínio do email do usuário
const iniciarSSO = async (email: string) => {
  const dominio = email.split('@')[1]

  const { data, error } = await supabase.auth.signInWithSSO({
    domain: dominio,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Erro ao iniciar SSO:', error.message)
    return
  }

  if (data?.url) {
    // redirecionar para o IdP
    window.location.href = data.url
  }
}

// Alternativa: identificar pelo sso_provider_id (para multi-tenant com seleção explícita)
const iniciarSSOPorProvider = async (ssoProviderId: string) => {
  const { data, error } = await supabase.auth.signInWithSSO({
    providerId: ssoProviderId,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (data?.url) window.location.href = data.url
}
```

**Callback — trocar code por sessão:**

```ts
// app/auth/callback/route.ts (Next.js Route Handler)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.redirect(new URL('/auth/error', request.url))
}
```

## Attribute Mappings

Attribute mappings definem como atributos SAML do IdP são mapeados para campos do usuário Supabase. Os dados mapeados ficam em `auth.identities.identity_data` e `auth.users.raw_user_meta_data`.

**Formato do arquivo JSON de mapping:**

```json
{
  "keys": {
    "email": {
      "name": "mail",
      "names": ["email", "mail", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
    },
    "email_verified": {
      "default": true
    },
    "first_name": {
      "name": "givenName",
      "names": ["firstName", "givenName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"]
    },
    "last_name": {
      "name": "sn",
      "names": ["lastName", "sn", "surname", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"]
    },
    "department": {
      "name": "department",
      "array": false
    },
    "groups": {
      "name": "groups",
      "array": true
    }
  }
}
```

**Campos do mapping:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome principal do atributo SAML |
| `names` | string[] | Aliases (Supabase tenta cada um até encontrar) |
| `array` | boolean | Se o atributo é multi-valor (ex: grupos) |
| `default` | any | Valor padrão se o atributo não vier no assertion |

**Acessar dados mapeados:**

```sql
-- em RLS policy ou função
select raw_user_meta_data->>'department' from auth.users where id = auth.uid();
select raw_user_meta_data->'groups' from auth.users where id = auth.uid();
```

```ts
// no cliente
const { data: { user } } = await supabase.auth.getUser()
const department = user?.user_metadata?.department
const groups = user?.user_metadata?.groups  // array se configurado como array: true
```

## Contas SSO — Diferenças Importantes

Contas criadas via SSO têm comportamento diferente de contas email/senha:

| Aspecto | Conta Email/Senha | Conta SSO |
|---------|-------------------|-----------|
| Auto-linking | Supabase pode vincular por email | **Sem auto-linking** — sempre cria nova identidade |
| Unicidade de email | Emails são únicos por padrão | **Emails NÃO são únicos** — dois IdPs podem ter mesmo email |
| Identificador seguro | Email | **UUID (`auth.uid()`)** |
| Sessão máxima | Configurável via JWT TTL | Pode ter duração máxima definida pelo IdP |
| Senha | Usuário tem senha | **Sem senha** — autenticação apenas via IdP |

**Crítico:** nunca usar email como identificador primário em sistemas com SSO. Dois tenants (empresas) diferentes podem ter colaboradores com mesmo email se houver overlap de domínio — situação rara mas válida (ex: empresa A e empresa B ambas têm `joao@empresa.com` em seus diretórios).

## RLS para Multi-tenant SSO

O `sso_provider_id` no JWT identifica de qual conexão SSO o usuário veio — use como chave de isolamento de tenant:

```sql
-- extrair sso_provider_id do JWT
-- retorna o UUID do IdP (conexão SSO configurada) ou null se não for SSO
select auth.jwt()#>>'{amr,0,provider}' as sso_provider_id;

-- tabela de configurações por tenant SSO
create table public.organization_settings (
  id                uuid default gen_random_uuid() primary key,
  sso_provider_id   uuid not null unique,   -- UUID do provider SSO
  organization_name text not null,
  plan              text not null default 'pro',
  max_users         int  not null default 100,
  created_at        timestamptz default now()
);
comment on table public.organization_settings
  is 'Configurações por tenant SSO — isolamento via sso_provider_id.';

-- habilitar RLS
alter table public.organization_settings enable row level security;

-- política RESTRICTIVE — escopo de tenant SSO
create policy "Tenant SSO só vê sua própria organização" on public.organization_settings
  as restrictive
  for select
  to authenticated
  using (
    sso_provider_id = (auth.jwt()#>>'{amr,0,provider}')::uuid
  );

-- política permissiva para leitura
create policy "Usuários autenticados podem ler config da org" on public.organization_settings
  as permissive
  for select
  to authenticated
  using (true);
```

**Tabela de recursos com escopo de tenant:**

```sql
create table public.projetos (
  id              uuid default gen_random_uuid() primary key,
  sso_provider_id uuid not null,   -- tenant owner
  nome            text not null,
  dados           jsonb,
  criado_em       timestamptz default now()
);

alter table public.projetos enable row level security;

-- escopo rígido por tenant SSO
create policy "Usuário vê apenas projetos do seu tenant" on public.projetos
  as restrictive
  for all
  to authenticated
  using (
    sso_provider_id = (auth.jwt()#>>'{amr,0,provider}')::uuid
  );
```

**Helper function para uso em múltiplas policies:**

```sql
create or replace function public.sso_provider_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select (auth.jwt()#>>'{amr,0,provider}')::uuid
$$;

-- uso simplificado em policies
create policy "Tenant isolado" on public.projetos
  as restrictive for all to authenticated
  using ((select public.sso_provider_id()) = sso_provider_id);
```

## IdP-Initiated Flow — Caveat PKCE

**IdP-initiated flow** é quando o usuário clica em um ícone no portal do IdP (ex: Okta App Dashboard) para acessar o app — sem que o SP inicie o fluxo.

**Problema:** IdP-initiated é **incompatível com PKCE** porque não há `state` do SP para validar o `code_verifier`.

**Solução — Padrão "Bookmark App":**

```ts
// 1. Criar um endpoint que inicia o SP-initiated flow
// app/auth/sso-bookmark/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('provider_id')
  const tenant = searchParams.get('tenant')  // para multi-tenant

  if (!providerId && !tenant) {
    return NextResponse.redirect(new URL('/auth/error', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // iniciar SP-initiated (não IdP-initiated)
  const { data, error } = await supabase.auth.signInWithSSO({
    ...(providerId ? { providerId } : { domain: `${tenant}.empresa.com` }),
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (data?.url) return NextResponse.redirect(data.url)
  return NextResponse.redirect(new URL('/auth/error', request.url))
}

// 2. No Okta/Azure: configurar o ícone do app para apontar para:
//    https://seu-app.com/auth/sso-bookmark?provider_id=<uuid-do-provider>
//    (não para o ACS URL diretamente)
```

## Multi-Subdomínio com SSO

Para apps com subdomínio por tenant (`empresa1.app.com`, `empresa2.app.com`):

```ts
// detectar tenant pelo subdomínio e redirecionar com callback correto
const iniciarSSOMultiSubdomain = async (email: string) => {
  const dominio = email.split('@')[1]
  const subdominio = window.location.hostname.split('.')[0]  // ex: 'empresa1'

  const { data, error } = await supabase.auth.signInWithSSO({
    domain: dominio,
    options: {
      // callback no subdomínio correto
      redirectTo: `https://${subdominio}.app.com/auth/callback`,
    },
  })

  if (data?.url) window.location.href = data.url
}
```

## Regras absolutas

1. **SSO exige Supabase CLI v1.46.4+** — versões anteriores não têm o subcomando `sso`.
2. **Usar UUID (`auth.uid()`), NUNCA email, como identificador de usuário** — emails não são únicos em ambientes multi-IdP SSO.
3. **IdP-initiated é incompatível com PKCE** — implementar padrão "bookmark app" (endpoint que inicia SP-initiated).
4. **RLS RESTRICTIVE para escopo de tenant** — isolamento via `sso_provider_id` deve ser política RESTRICTIVE.
5. **Sem auto-linking SSO** — nunca assumir que dois registros com mesmo email são o mesmo usuário.
6. **Usar `@supabase/ssr`, nunca `auth-helpers-nextjs`** — pacote legado descontinuado.
7. **Validar JWT no servidor com `getClaims()`** — nunca confiar apenas no cliente para verificar identidade SSO.

## Anti-patterns

### Anti-pattern 1: Usar email como chave de usuário SSO

**Errado:**
```sql
-- assumindo que email é único entre tenants SSO
create table public.perfis (
  email text primary key,  -- ERRADO para SSO
  dados jsonb
);

create policy "Usuário vê próprio perfil" on public.perfis
  as permissive for select to authenticated
  using (email = (auth.jwt()->>'email'));  -- ERRADO
```

**Por quê:** se dois IdPs diferentes tiverem um usuário com `joao@empresa.com`, haverá conflito. UUID é o único identificador garantidamente único.

**Certo:**
```sql
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dados   jsonb
);

create policy "Usuário vê próprio perfil" on public.perfis
  as permissive for select to authenticated
  using (user_id = auth.uid());  -- UUID sempre único
```

### Anti-pattern 2: Assumir auto-linking de contas por email

**Errado:**
```ts
// assumindo que se o email já existe, é o mesmo usuário
const { data: { user } } = await supabase.auth.getUser()
const perfil = await supabase.from('perfis')
  .select()
  .eq('email', user.email)
  .single()
// ERRADO: pode retornar perfil de outro usuário SSO com mesmo email
```

**Por quê:** Supabase **não faz auto-linking** por email em SSO. Cada `signInWithSSO` cria uma identidade nova em `auth.identities`, mesmo que o email já exista.

**Certo:** usar `auth.uid()` como chave de join, nunca email.

### Anti-pattern 3: Esperar IdP-initiated funcionar com PKCE

**Errado:**
```
// configurando no Okta:
// Ícone do app → aponta para ACS URL diretamente
// ACS URL: https://proj.supabase.co/auth/v1/sso/saml/acs
// Resultado: erro PKCE validation failed
```

**Por quê:** quando o IdP inicia, não há `code_verifier` do SP. O PKCE (Proof Key for Code Exchange) exige que o SP inicie o fluxo.

**Certo:** configurar o ícone do app no IdP para apontar ao "bookmark app" (endpoint SP-initiated), não ao ACS URL.

### Anti-pattern 4: Conexão SSO sem validar domínios

**Errado:**
```bash
# adicionar SSO sem especificar domains
supabase sso add \
  --project-ref abc123 \
  --type saml \
  --metadata-url https://idp.exemplo.com/metadata
  # sem --domains → qualquer um pode tentar signInWithSSO com qualquer domínio
```

**Por quê:** sem restrição de domínio, `signInWithSSO({ domain: 'qualquer.com' })` pode ser abusado para descoberta de providers.

**Certo:** sempre especificar `--domains` com os domínios exatos de email do tenant:
```bash
supabase sso add \
  --project-ref abc123 \
  --type saml \
  --metadata-url https://idp.exemplo.com/metadata \
  --domains empresa.com.br,empresa.com
```

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — outros providers de autenticação (OAuth, magic link, email)
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — RLS hierárquica para multi-tenant complexo
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — padrão `@supabase/ssr` com Next.js e cookies
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — RBAC via custom claims combinado com SSO
- [supabase-mfa](../supabase-mfa/SKILL.md) — MFA adicional para usuários SSO (TOTP sobre aal2)
- [supabase-sso-saml-architect](../../agents/supabase-sso-saml-architect.md) — agente que configura SSO SAML end-to-end

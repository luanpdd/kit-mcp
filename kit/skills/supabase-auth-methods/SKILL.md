---
name: supabase-auth-methods
description: Use ao implementar fluxos de autenticação de usuário final no Supabase — senha, magic link, OTP, anônimo, Web3 e identity linking.
---

# Supabase — Métodos de Autenticação

## Quando usar

LLM carrega esta skill quando implementar **métodos de autenticação de usuário final** no Supabase — qualquer fluxo que o usuário final use para criar conta ou fazer login.

Trigger phrases:

- "sign up Supabase", "signInWithPassword", "signUp email"
- "magic link", "signInWithOtp", "OTP email"
- "phone login", "OTP SMS", "phone OTP"
- "anonymous sign in", "signInAnonymously", "usuário anônimo"
- "Web3 login Supabase", "signInWithWeb3", "wallet login"
- "identity linking", "linkIdentity", "unlinkIdentity"
- "reset password", "resetPasswordForEmail", "updateUser password"
- "signOut", "logout Supabase"
- "verifyOtp", "confirmar código OTP"
- "is_anonymous claim", "getClaims Supabase"

## Regras absolutas

1. **SSR sempre usa PKCE.** Todo fluxo de confirmação/callback no servidor deve ir por `/auth/confirm` com `verifyOtp({ type, token_hash })`, nunca com token de URL fragment.
2. **Validar sessão no servidor com `getClaims()`**, não com `getSession()`. `getClaims()` valida a assinatura do JWT; `getSession()` não valida contra o servidor.
3. **Usuário anônimo exige política RLS RESTRICTIVE** checando `(auth.jwt()->>'is_anonymous')::boolean`. Política só PERMISSIVE não basta — um anônimo pode ter acesso a dados de outros anônimos.
4. **Nunca expor `sb_secret_`/`service_role`** no cliente. Chaves de servidor ficam exclusivamente em variáveis de ambiente server-side.
5. **`@supabase/ssr` sempre, `@supabase/auth-helpers-nextjs` nunca.** O pacote `auth-helpers-nextjs` está deprecated.
6. **Nunca confiar em `user_metadata`** em RLS policies — o usuário pode escrever nesse campo. Use `app_metadata` (via admin API) ou claims customizados.
7. **Telefone como identificador de senha é desencorajado** — números de telefone são reciclados pelas operadoras. Se usar, exija MFA obrigatório.

## Autenticação por Senha (email / telefone)

### Cadastro com email

```ts
import { createClient } from '@supabase/ssr'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!  // sb_publishable_...
)

const { data, error } = await supabase.auth.signUp({
  email: 'usuario@exemplo.com',
  password: 'senha-segura',
  options: {
    emailRedirectTo: 'https://meuapp.com/auth/confirm',
    data: {
      nome_completo: 'Maria Silva',  // user_metadata — só dados não-privilegiados
    },
  },
})
```

O Supabase envia email de confirmação. O link de confirmação redireciona para `emailRedirectTo` com `?token_hash=...&type=signup` (fluxo PKCE).

### Route handler `/auth/confirm` — confirmação PKCE

```ts
// app/auth/confirm/route.ts (Next.js App Router)
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      // Redireciona para a página de destino após confirmação
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Redireciona para página de erro caso falhe
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

### Login com senha

```ts
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@exemplo.com',
  password: 'senha-segura',
})

// Alternativa com telefone (desencorajado — ver Regra 7)
const { data, error } = await supabase.auth.signInWithPassword({
  phone: '+5511999990000',
  password: 'senha-segura',
})
```

### Fluxo de reset de senha (PKCE completo)

```ts
// 1. Solicitar reset — envia email com link
const { error } = await supabase.auth.resetPasswordForEmail(
  'usuario@exemplo.com',
  { redirectTo: 'https://meuapp.com/auth/confirm?next=/conta/nova-senha' }
)

// 2. Route handler /auth/confirm processa token_hash com type='recovery'
//    (mesmo código acima — verifyOtp com type='recovery')

// 3. Após redirect, na página /conta/nova-senha — atualizar senha
const { error } = await supabase.auth.updateUser({
  password: 'nova-senha-segura',
})

// 4. Verificar senha atual antes de trocar (segurança extra)
const { error } = await supabase.auth.updateUser({
  password: 'nova-senha-segura',
  // currentPassword disponível dependendo de configuração do projeto
})
```

## Magic Link e OTP por Email

### Magic link (padrão)

```ts
// Envia magic link por padrão (link clicável no email)
const { error } = await supabase.auth.signInWithOtp({
  email: 'usuario@exemplo.com',
  options: {
    emailRedirectTo: 'https://meuapp.com/auth/confirm',
    shouldCreateUser: true,  // false = só login, não cria conta nova
  },
})
```

### OTP de 6 dígitos por email

Para ativar OTP numérico em vez de magic link: edite o template de email no Dashboard (`Authentication > Email Templates`) incluindo `{{ .Token }}` no corpo — a presença do token muda o comportamento para OTP.

```ts
// Verificar OTP de 6 dígitos enviado por email
const { data, error } = await supabase.auth.verifyOtp({
  email: 'usuario@exemplo.com',
  token: '123456',         // código digitado pelo usuário
  type: 'email',
})
```

## OTP por Telefone (SMS / WhatsApp)

### Enviar OTP por SMS

```ts
const { error } = await supabase.auth.signInWithOtp({
  phone: '+5511999990000',
  options: {
    channel: 'sms',      // 'sms' (padrão) | 'whatsapp'
    shouldCreateUser: true,
  },
})
```

### Verificar OTP por telefone

```ts
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+5511999990000',
  token: '123456',
  type: 'sms',    // 'sms' | 'whatsapp'
})
```

### Atualizar telefone do usuário autenticado

```ts
// 1. Solicita a mudança — envia OTP para novo número
const { error } = await supabase.auth.updateUser({
  phone: '+5521888880000',
})

// 2. Verificar OTP enviado ao novo número
const { error } = await supabase.auth.verifyOtp({
  phone: '+5521888880000',
  token: '654321',
  type: 'phone_change',   // type específico para troca de telefone
})
```

**Atenção:** configure um provider SMS no Dashboard (`Authentication > Phone`) antes de usar — Twilio, MessageBird, Vonage, ou Textlocal.

## Login Anônimo

### Sign in anônimo

```ts
const { data, error } = await supabase.auth.signInAnonymously()

// O usuário anônimo recebe um JWT com:
// - role: 'authenticated' (igual a usuário normal — importante para RLS)
// - is_anonymous: true (claim para distinguir no JWT)
```

### RLS para dados de usuários anônimos

**Obrigatório: política RESTRICTIVE checando `is_anonymous`**

```sql
-- Política RESTRICTIVE: nega acesso mesmo se outras permitem
-- Impede que usuários anônimos vejam dados de outros usuários
create policy "Anônimos só acessam os próprios dados" on public.rascunhos
  as restrictive             -- RESTRICTIVE, não permissive
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and not (auth.jwt()->>'is_anonymous')::boolean  -- bloqueia anônimos de dados compartilhados
  );

-- Política PERMISSIVE complementar: anônimo pode criar/ler próprios rascunhos
create policy "Anônimos criam rascunhos" on public.rascunhos
  as permissive
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Converter conta anônima em permanente

```ts
// Opção 1: vincular email/senha
const { error } = await supabase.auth.updateUser({
  email: 'usuario@exemplo.com',
  password: 'senha-nova',
})
// Supabase envia email de confirmação; ao confirmar, conta deixa de ser anônima

// Opção 2: vincular via OAuth (linkIdentity)
const { error } = await supabase.auth.linkIdentity({
  provider: 'google',
  options: { redirectTo: 'https://meuapp.com/auth/confirm' },
})
```

### Prevenção de abuso de contas anônimas

```ts
// Adicionar CAPTCHA ao signInAnonymously (requer Turnstile/hCaptcha configurado)
const { error } = await supabase.auth.signInAnonymously({
  options: { captchaToken: tokenDoTurnstile },
})
```

```sql
-- Cleanup de contas anônimas antigas (executar via cron/pg_cron)
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '30 days';
```

**Configurações recomendadas no Dashboard:**
- Habilitar CAPTCHA em `Authentication > Sign In / Up > CAPTCHA protection`
- Rate limit: padrão 30 sign-ins anônimos/hora por IP — mantenha esse limite

## Login com Web3

```ts
// Suporte a Ethereum (EIP-4361 / Sign-In with Ethereum) e Solana
const { data, error } = await supabase.auth.signInWithWeb3({
  chain: 'ethereum',   // 'ethereum' | 'solana'
  // statement: mensagem customizada exibida na wallet (opcional)
  statement: 'Entre no MeuApp com sua carteira',
})
```

**Pré-requisitos:**
- URL do app deve estar na allowlist de Redirect URLs no Dashboard (`Authentication > URL Configuration`)
- Habilitar CAPTCHA para evitar abuso de contas Web3
- Rate limit específico Web3 (configurável no Dashboard)

**Fluxo técnico (EIP-4361):**
1. Supabase gera mensagem SIWE (Sign-In with Ethereum) com nonce
2. Usuário assina com wallet (MetaMask, WalletConnect etc.)
3. `signInWithWeb3` verifica a assinatura e emite sessão

## Identity Linking (Vincular Identidades)

### Linking automático vs manual

**Linking automático:** se o provider externo retorna o mesmo email já cadastrado, o Supabase vincula automaticamente as identidades (comportamento padrão, configurável).

**Linking manual:** o usuário autenticado pode vincular uma nova identidade OAuth explicitamente.

```ts
// Habilitar no Dashboard: Authentication > Sign In Methods > Linked Identities

// Vincular nova identidade OAuth ao usuário já autenticado
const { data, error } = await supabase.auth.linkIdentity({
  provider: 'google',
  options: { redirectTo: 'https://meuapp.com/auth/confirm' },
})

// Listar todas as identidades vinculadas
const { data: { identities } } = await supabase.auth.getUserIdentities()
// identities: Array<{ id, user_id, identity_data, provider, created_at }>

// Desvincular uma identidade (usuário deve ter ao menos uma outra forma de login)
const identity = identities[0]
const { error } = await supabase.auth.unlinkIdentity(identity)
```

### Resolver conflitos de identidade

```ts
// Ao vincular, o provider pode retornar uma identidade que já existe em outra conta
// O Supabase lança AuthError com código 'identity_already_exists'

const { error } = await supabase.auth.linkIdentity({ provider: 'github' })

if (error?.code === 'identity_already_exists') {
  // Orientar o usuário a fazer login pela conta original e desvincular de lá,
  // ou exibir mensagem explicativa
  console.error('Essa identidade já está vinculada a outra conta.')
}
```

## Sign Out

```ts
// Encerrar somente a sessão atual (dispositivo atual)
await supabase.auth.signOut({ scope: 'local' })

// Encerrar TODAS as sessões em todos os dispositivos
await supabase.auth.signOut({ scope: 'global' })

// Encerrar todas as OUTRAS sessões, mantendo a atual ativa
await supabase.auth.signOut({ scope: 'others' })
```

## Validação de sessão no servidor com `getClaims()`

```ts
// lib/supabase/server.ts — sempre use getClaims() para validar no servidor
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() valida assinatura do JWT — use sempre no servidor
  const { data: { claims }, error } = await supabase.auth.getClaims()

  if (error || !claims) return null

  return {
    userId: claims.sub,
    email: claims.email,
    isAnonymous: claims.is_anonymous === true,
    role: claims.user_role,   // custom claim via auth hook (ver skill supabase-custom-claims-rbac)
  }
}
```

## Anti-patterns

### 1. Usar `getSession()` para validar no servidor

**Errado:**
```ts
// NÃO faça isso em Server Components ou Route Handlers
const { data: { session } } = await supabase.auth.getSession()
if (!session) return redirect('/login')
const userId = session.user.id  // INSEGURO — sessão pode estar adulterada
```

**Por quê:** `getSession()` lê cookies locais sem validar a assinatura do JWT. Um cookie adulterado passa despercebido.

**Certo:**
```ts
const { data: { claims }, error } = await supabase.auth.getClaims()
if (error || !claims) return redirect('/login')
const userId = claims.sub
```

### 2. Usar `auth-helpers-nextjs`

**Errado:**
```ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
```

**Por quê:** `@supabase/auth-helpers-nextjs` está deprecated e usa `getAll`/`setAll` de forma incompatível com o runtime mais recente do Next.js.

**Certo:**
```ts
import { createServerClient } from '@supabase/ssr'
```

### 3. Confiar em `user_metadata` em RLS

**Errado:**
```sql
-- user_metadata é editável pelo próprio usuário via updateUser({ data: {...} })
create policy "Admin pode tudo" on public.pedidos
  using ((auth.jwt()->'user_metadata'->>'role') = 'admin');  -- VULNERÁVEL
```

**Por quê:** qualquer usuário pode chamar `supabase.auth.updateUser({ data: { role: 'admin' } })` e escalar privilégios.

**Certo:** use `app_metadata` (somente editável via admin API / service_role) ou custom claims via Auth Hook (ver [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md)).

### 4. Política só PERMISSIVE para usuários anônimos

**Errado:**
```sql
-- Uma única política PERMISSIVE não impede cross-user data leak para anônimos
create policy "Usuário acessa próprios dados" on public.sessoes
  as permissive for select to authenticated
  using (auth.uid() = user_id);
```

**Por quê:** um anônimo com `user_id` correto passa na policy permissiva, mas não há barreira para impedir que anônimos cruzem dados com `service_role` injetado.

**Certo:** adicione política RESTRICTIVE explícita que cheque `is_anonymous`:
```sql
create policy "Bloqueia anônimos de dados sensíveis" on public.pagamentos
  as restrictive for all to authenticated
  using (not (auth.jwt()->>'is_anonymous')::boolean);
```

### 5. Expor `sb_secret_` no cliente

**Errado:**
```ts
// NUNCA — expõe chave com privilégios de service_role ao navegador
const supabase = createClient(URL, process.env.SUPABASE_SECRET_KEY!)
```

**Por quê:** a chave `sb_secret_` (ou `service_role`) bypassa RLS completamente. Qualquer pessoa com DevTools tem acesso irrestrito ao banco.

**Certo:** use apenas `sb_publishable_` (ou `anon`) no cliente. Operações privilegiadas ficam em route handlers/server actions com `sb_secret_`.

### 6. Ignorar conflitos de identidade ao vincular

**Errado:**
```ts
await supabase.auth.linkIdentity({ provider: 'github' })
// sem tratamento de erro
```

**Por quê:** se a identidade GitHub já existe em outra conta, o linking falha silenciosamente ou cria inconsistências.

**Certo:** trate `error?.code === 'identity_already_exists'` e informe o usuário com instrução clara de como resolver.

## Ver também

- [supabase-social-oauth](../supabase-social-oauth/SKILL.md) — fluxos OAuth com providers sociais (Google, GitHub, Apple etc.)
- [supabase-auth-sessions](../supabase-auth-sessions/SKILL.md) — PKCE vs implicit flow, lifetime de sessão, refresh token
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — configuração de cliente SSR com `@supabase/ssr` no Next.js
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — RBAC via Custom Access Token Auth Hook
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS policies canônicas, caching, SECURITY DEFINER
- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) — defesa em profundidade com múltiplas camadas de RLS
- [supabase-mfa](../supabase-mfa/SKILL.md) — autenticação multifator (TOTP, SMS)
- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — rotação de chaves JWT, validação de assinatura

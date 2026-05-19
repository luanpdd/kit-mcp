---
name: supabase-mfa
description: Use ao implementar Multi-Factor Authentication (MFA) com TOTP, Phone ou AAL no Supabase — enrollment, challenge, verify, enforce via RLS aal2.
---

# Supabase — Multi-Factor Authentication (MFA)

## Quando usar

LLM carrega esta skill quando implementar **autenticação multifator (MFA)** no Supabase, incluindo TOTP por app autenticador, MFA por telefone (SMS/WhatsApp) e enforce via RLS com AAL.

Trigger phrases:

- "MFA Supabase", "two-factor auth", "2FA"
- "TOTP enrollment", "auth.mfa.enroll", "AAL aal2"
- "MFA challenge verify", "phone MFA"
- "getAuthenticatorAssuranceLevel"
- "como forçar MFA via RLS", "enforce MFA para todos os usuários"
- "QR code TOTP Supabase", "app autenticador Supabase"

## Princípio canônico

MFA no Supabase opera em **4 etapas principais**: enrollment, unenroll, challenge no login e enforce. O mecanismo central é o **AAL (Authenticator Assurance Level)** — o JWT do usuário sobe de `aal1` (1 fator) para `aal2` (MFA verificado) após `mfa.verify()` bem-sucedido.

**Dois fatores suportados:**

| Fator | API | Observação |
|-------|-----|------------|
| App Autenticador | `factorType: 'totp'` | Gera QR code SVG + URI `otpauth://` |
| Telefone | `factorType: 'phone'` | SMS ou WhatsApp; caveat SIM swap |

**Quando usar MFA:**

- ✅ Aplicações com dados sensíveis (saúde, financeiro, jurídico)
- ✅ Usuários admin/moderator com acesso privilegiado
- ✅ Compliance SOC 2, HIPAA, LGPD para dados críticos
- ✅ B2B SaaS que precisa oferecer MFA por opção ou por obrigação

**Quando NÃO enforce MFA para todos:**

- ❌ Aplicação de baixo risco onde MFA prejudica conversão
- ❌ Usuários já autenticam via SSO com MFA no IdP (enforce no IdP, não duplicar)

## Fluxo de Enrollment — 3 passos

O enrollment segue sempre a sequência: **enroll → challenge → verify**.

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// Passo 1: iniciar enrollment
const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'App Autenticador',  // opcional — exibido na lista de fatores
})
// enrollData.id          → factorId (salvar para challenge/unenroll)
// enrollData.totp.qr_code  → SVG do QR code (renderizar no img src)
// enrollData.totp.uri      → URI otpauth:// (para deep link)
// enrollData.totp.secret   → segredo manual (se user não conseguir escanear)

// Passo 2: criar challenge
const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
  factorId: enrollData.id,
})
// challengeData.id → challengeId (usar no verify)

// Passo 3: verificar código TOTP digitado pelo usuário
const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
  factorId: enrollData.id,
  challengeId: challengeData.id,
  code: userInputCode,  // código de 6 dígitos digitado pelo usuário
})
// após verify bem-sucedido: JWT atualiza para aal2
```

**Importante:** código TOTP é válido por intervalos de **30 segundos**. Se o usuário demorar, o challenge expira e precisa de novo `mfa.challenge()`.

## TOTP — Componente React `EnrollMFA`

```tsx
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface EnrollMFAProps {
  onEnrolled: () => void
  onCancelled: () => void
}

export function EnrollMFA({ onEnrolled, onCancelled }: EnrollMFAProps) {
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [step, setStep] = useState<'enroll' | 'verify'>('enroll')
  const [error, setError] = useState('')

  const iniciarEnrollment = async () => {
    setError('')
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'App Autenticador',
    })
    if (error) { setError(error.message); return }

    setFactorId(data.id)
    setQrCode(data.totp.qr_code)  // SVG

    // criar challenge já
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challengeError) { setError(challengeError.message); return }

    setChallengeId(challengeData.id)
    setStep('verify')
  }

  const verificarCodigo = async () => {
    setError('')
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: verifyCode,
    })
    if (error) { setError(error.message); return }
    onEnrolled()
  }

  if (step === 'enroll') {
    return (
      <div>
        <p>Configure seu app autenticador (Google Authenticator, Authy, etc.).</p>
        <button onClick={iniciarEnrollment}>Começar configuração</button>
        <button onClick={onCancelled}>Cancelar</button>
      </div>
    )
  }

  return (
    <div>
      {/* QR code: data.totp.qr_code é SVG inline */}
      <img src={qrCode} alt="QR Code MFA" />
      <p>Escaneie o QR code com seu app autenticador e digite o código de 6 dígitos:</p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={verifyCode}
        onChange={(e) => setVerifyCode(e.target.value)}
        placeholder="000000"
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={verificarCodigo}>Verificar</button>
    </div>
  )
}
```

## Phone MFA

```ts
// Enrollment — Phone MFA (SMS ou WhatsApp)
const { data: enrollData, error } = await supabase.auth.mfa.enroll({
  factorType: 'phone',
  phone: '+5511999999999',   // formato E.164
})
// enrollData.id → factorId para challenge/verify

// Challenge — dispara OTP via SMS/WhatsApp
const { data: challengeData, error: challengeError } =
  await supabase.auth.mfa.challenge({ factorId: enrollData.id })
// OTP válido por 5 minutos

// Verify
const { error: verifyError } = await supabase.auth.mfa.verify({
  factorId: enrollData.id,
  challengeId: challengeData.id,
  code: smsCode,   // código recebido por SMS
})
```

**Caveat ataque SIM swap:** Phone MFA é mais fraco que TOTP porque número de telefone pode ser sequestrado via SIM swap (atacante convence operadora a transferir número). Para aplicações de alto risco, **prefira TOTP** ou exija TOTP como fator adicional. Se usar Phone MFA, eduque usuários sobre o risco.

## AAL — Authenticator Assurance Level

`getAuthenticatorAssuranceLevel()` retorna o nível atual e o próximo nível possível:

```ts
const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
// data.currentLevel  → 'aal1' | 'aal2'
// data.nextLevel     → 'aal1' | 'aal2'
// data.currentAuthenticationMethods → array de métodos usados
```

**Tabela de estados AAL:**

| `currentLevel` | `nextLevel` | Significado |
|----------------|-------------|-------------|
| `aal1` | `aal1` | Usuário sem MFA enrollado — 1 fator só |
| `aal1` | `aal2` | MFA enrollado mas não verificado na sessão atual |
| `aal2` | `aal2` | MFA verificado — sessão totalmente autenticada |
| `aal2` | `aal1` | MFA foi removido (unenroll) mas JWT ainda não foi atualizado |

**Fluxo canônico no login:**

```ts
// após supabase.auth.signInWithPassword(...)
const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

if (aalData.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
  // redirecionar para tela de MFA challenge
  router.push('/auth/mfa-challenge')
}
```

**Em SSR (Next.js):** verificar AAL no middleware ou Server Component, não retornar 401 — sempre redirecionar:

```ts
// middleware.ts ou Server Component
import { createServerClient } from '@supabase/ssr'

// criar novo client por request (NUNCA reutilizar)
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { cookies: { getAll: () => request.cookies.getAll(), setAll: ... } }
)

const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

if (aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
  // NUNCA retornar 401 em SSR — sempre redirecionar para tela de MFA
  return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
}
```

## Enforce MFA via RLS

Políticas de enforce MFA **DEVEM** usar `as restrictive` — sem isso, outra política permissiva pode contornar o MFA. Uma política RESTRICTIVE sozinha (sem nenhuma permissiva) bloqueia tudo; combine com política permissiva para o CRUD normal.

### Variante 1 — Todos os usuários devem ter aal2

```sql
-- política RESTRICTIVE bloqueia se não for aal2
create policy "Requer aal2 para acesso" on public.documentos
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');

-- política permissiva para SELECT normal
create policy "Usuários autenticados veem seus documentos" on public.documentos
  as permissive
  for select
  to authenticated
  using (auth.uid() = user_id);
```

### Variante 2 — Só exige aal2 para usuários criados após determinada data (roll-out gradual)

```sql
-- exige aal2 apenas para novos usuários (criados a partir de 2025-01-01)
create policy "Novos usuários precisam de aal2" on public.documentos
  as restrictive
  for all
  to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    or
    -- usuários antigos ficam isentos até migração
    (select (auth.jwt()->'user_metadata'->>'created_at')::timestamptz
      < '2025-01-01'::timestamptz)
  );
```

### Variante 3 — Só exige aal2 para quem optou por MFA (opt-in)

```sql
-- exige aal2 apenas se o usuário já tem um fator MFA enrollado e verificado
create policy "Requer aal2 se MFA enrollado" on public.documentos
  as restrictive
  for all
  to authenticated
  using (
    -- se não tem fator enrollado: aal1 é ok
    not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid()
        and status = 'verified'
    )
    or
    -- se tem fator enrollado: exige aal2
    (select auth.jwt()->>'aal') = 'aal2'
  );
```

## Unenroll — Componente `UnenrollMFA`

```ts
// listar fatores enrollados
const { data: factorsData } = await supabase.auth.mfa.listFactors()
// factorsData.totp   → array de fatores TOTP
// factorsData.phone  → array de fatores Phone

// unenroll um fator específico
const { error } = await supabase.auth.mfa.unenroll({ factorId: 'fator-id-aqui' })
```

```tsx
export function UnenrollMFA() {
  const [factors, setFactors] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (data) setFactors([...data.totp, ...data.phone])
    })
  }, [])

  const removerFator = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) { setError(error.message); return }
    setFactors((prev) => prev.filter((f) => f.id !== factorId))
  }

  return (
    <div>
      <h3>Fatores MFA cadastrados</h3>
      {factors.map((fator) => (
        <div key={fator.id}>
          <span>{fator.friendly_name || fator.factor_type} ({fator.status})</span>
          <button onClick={() => removerFator(fator.id)}>Remover</button>
        </div>
      ))}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
```

## claim `amr` — verificar método e timestamp

O claim `amr` (Authentication Methods References) em `auth.jwt()` registra quais métodos foram usados e quando:

```sql
-- checar se MFA TOTP foi usado (jsonb_path_query)
select
  jsonb_path_query(
    auth.jwt(),
    '$.amr[*] ? (@.method == "totp")'
  ) as mfa_totp_info;
-- resultado: {"method": "totp", "timestamp": 1704067200}

-- policy: rejeitar sessões MFA antigas (exige re-verificação a cada 24h)
create policy "MFA verificado nas últimas 24h" on public.dados_sensiveis
  as restrictive
  for all
  to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(auth.jwt()->'amr') as m
      where (m->>'method') = 'totp'
        and (m->>'timestamp')::bigint > extract(epoch from now() - interval '24 hours')
    )
  );
```

## Regras absolutas

1. **`as restrictive` é OBRIGATÓRIO** em políticas RLS de enforce MFA — sem ele, política permissiva existente contorna o MFA completamente.
2. **SSR: criar novo client por request** — nunca reutilizar instância `supabase` entre requests (vazamento de sessão entre usuários).
3. **Sempre checar `getAuthenticatorAssuranceLevel()` após login** — não assumir que o login sozinho garante aal2.
4. **Redirecionar para tela MFA em SSR, nunca retornar 401** — 401 em middleware SSR quebra a UX e não orienta o usuário.
5. **TOTP exige challenge antes de verify** — `mfa.verify()` sem `mfa.challenge()` prévio falha.
6. **Usar `@supabase/ssr`, nunca `auth-helpers-nextjs`** — pacote legado descontinuado.

## Anti-patterns

### Anti-pattern 1: Omitir `as restrictive` na política de enforce

**Errado:**
```sql
-- política SEM as restrictive
create policy "Requer MFA" on public.documentos
  for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');
-- outra política permissiva existente pode contornar esta!
```

**Por quê:** sem `as restrictive`, a avaliação de RLS é `(policy_permissiva OR policy_mfa)`. Se qualquer política permissiva retornar verdadeiro, o acesso é liberado independente do MFA.

**Certo:**
```sql
create policy "Requer MFA" on public.documentos
  as restrictive   -- ← OBRIGATÓRIO
  for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');
```

### Anti-pattern 2: Retornar 401 em SSR ao invés de redirecionar

**Errado:**
```ts
// middleware.ts
if (aalData.currentLevel !== 'aal2') {
  return new Response('Unauthorized', { status: 401 })
}
```

**Por quê:** usuário recebe erro genérico sem saber o que fazer. Em Next.js, um 401 no middleware pode causar loop ou tela branca.

**Certo:**
```ts
if (aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
  return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
}
```

### Anti-pattern 3: Reutilizar client Supabase em SSR entre requests

**Errado:**
```ts
// lib/supabase.ts — singleton compartilhado (ERRADO para SSR)
export const supabase = createServerClient(URL, KEY, { cookies: globalCookies })
// múltiplos requests compartilham o mesmo client → sessões vazam
```

**Por quê:** em ambiente serverless, o mesmo módulo pode ser reusado entre requests de usuários diferentes. O client guarda estado de sessão — vazamento de sessão entre usuários.

**Certo:** criar novo client a cada invocação de Server Component ou middleware:
```ts
// app/page.tsx (Server Component)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => { /* ... */ },
    },
  })
  // ...
}
```

### Anti-pattern 4: Chamar `mfa.verify()` sem `mfa.challenge()` prévio

**Errado:**
```ts
// tentando verificar sem challenge
await supabase.auth.mfa.verify({
  factorId: 'fator-id',
  challengeId: 'id-inventado',
  code: userCode,
})
```

**Por quê:** `challengeId` é gerado pelo servidor e tem TTL. IDs inválidos causam erro `invalid_challenge`.

**Certo:** sempre `challenge()` → `verify()` em sequência, e lidar com expiração:
```ts
const { data: ch } = await supabase.auth.mfa.challenge({ factorId })
if (!ch) return // tratar erro
const { error } = await supabase.auth.mfa.verify({
  factorId,
  challengeId: ch.id,
  code: userCode,
})
```

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — providers de login (email, OAuth, magic link)
- [supabase-auth-hooks](../supabase-auth-hooks/SKILL.md) — MFA Verification Hook (Teams/Enterprise) para rate-limit customizado
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — fundamentos de RLS e políticas RESTRICTIVE vs PERMISSIVE
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — padrão `@supabase/ssr` com Next.js
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — combinar MFA (aal2) com RBAC via custom claims
- [supabase-mfa-implementer](../../agents/supabase-mfa-implementer.md) — agente que materializa setup completo de MFA

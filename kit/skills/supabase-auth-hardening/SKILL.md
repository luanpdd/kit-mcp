---
name: supabase-auth-hardening
cost_tier: leve
description: Configura hardening de auth Supabase — SMTP customizado, email templates, redirect URLs seguras, rate limits, CAPTCHA (hCaptcha/Turnstile), senha forte e audit logs. Use ao endurecer auth em
---

# Supabase — Hardening de Autenticação (Config, SMTP, Rate Limits, CAPTCHA)

## Quando usar

LLM carrega esta skill quando o projeto precisar **endurecer a segurança de autenticação** do Supabase — configurando SMTP para produção, protegendo contra bots e abuso, gerenciando email templates, redirect URLs seguras ou habilitando proteção de senhas.

Trigger phrases:

- "custom SMTP Supabase", "email template Supabase"
- "redirect URLs Supabase", "rate limit auth"
- "CAPTCHA Supabase", "hCaptcha", "Turnstile"
- "password security Supabase", "leaked password protection"
- "auth audit logs", "signup abuse Supabase"
- "email prefetching problema", "OTP email Supabase"

## Princípio canônico

Auth hardening em Supabase tem **4 camadas complementares**:

1. **Config básica** — controlar quem pode se registrar, confirmar email, sessões anônimas
2. **SMTP + email templates** — garantir entregabilidade e segurança dos emails de auth
3. **Rate limits + CAPTCHA** — proteger contra abuso automatizado e bots
4. **Password security + audit** — senhas fortes, proteção contra vazamentos, rastreabilidade

Nenhuma camada substitui as outras — produção exige todas as quatro.

## Config geral de autenticação

### Via Dashboard

`Authentication > Providers > Email`

### Via `config.toml`

```toml
[auth]
# Permitir ou bloquear novos registros (false = apenas usuários existentes)
enable_signup = true

# Exigir confirmação de email antes de liberar acesso
double_confirm_email_change = true

# Sessões anônimas (usuários sem login — útil para carrinhos, rascunhos)
enable_anonymous_sign_ins = false

# Permitir que usuários vinculem múltiplos provedores de auth manualmente
enable_manual_linking = false

# Expiração do access token (padrão: 3600 = 1h)
jwt_expiry = 3600

# Refresh token não expira automaticamente
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10   # janela de reuso em segundos (graceful)
```

### Configurações recomendadas por ambiente

| Config | Desenvolvimento | Produção |
|--------|----------------|---------|
| `enable_signup` | `true` | Depende do modelo (invite-only = `false`) |
| `double_confirm_email_change` | `false` | `true` |
| `enable_anonymous_sign_ins` | `true` | Conforme necessidade |
| `enable_refresh_token_rotation` | `true` | `true` (obrigatório) |

## Email Templates

### Tipos de templates

**Emails de autenticação** (enviados via SMTP configurado):
- `confirm_signup` — confirmação de email no cadastro
- `invite` — convite de usuário por admin
- `magic_link` — link mágico de login
- `change_email_address` — confirmação de troca de email
- `reset_password` — redefinição de senha

**Emails de notificação de segurança** (sempre enviados, não customizáveis via template):
- Alertas de login de novo dispositivo
- Notificações de MFA configurado/removido

### Variáveis disponíveis nos templates

| Variável | Descrição |
|----------|-----------|
| `{{ .ConfirmationURL }}` | URL completa de confirmação (inclui token) |
| `{{ .Token }}` | OTP de 6 dígitos (para fluxo OTP, evita prefetching) |
| `{{ .TokenHash }}` | Hash do token (fluxo PKCE — não expõe token direto) |
| `{{ .SiteURL }}` | URL base do site (configurada em Auth settings) |
| `{{ .RedirectTo }}` | URL de redirect passada pelo cliente |
| `{{ .Email }}` | Email do usuário |
| `{{ .NewEmail }}` | Novo email (para change_email_address) |
| `{{ .Data }}` | Metadados adicionais (objeto JSON) |

### Problema crítico: Email Prefetching

Alguns serviços de email corporativos (Outlook, Exchange, scanners de segurança) **acessam automaticamente links nos emails** para verificar malware — consumindo o token de confirmação antes do usuário clicar.

**Errado (vulnerável a prefetching):**
```html
<!-- Template padrão com link direto -->
<p>Confirme seu cadastro:</p>
<a href="{{ .ConfirmationURL }}">Confirmar email</a>
<!-- Scanner consome o link antes do usuário → usuário vê "link expirado" -->
```

**Solução A — OTP (recomendado para flows sensíveis):**
```html
<!-- Template com OTP de 6 dígitos — scanner não "usa" um número -->
<p>Seu código de confirmação: <strong>{{ .Token }}</strong></p>
<p>Digite este código na tela de confirmação do aplicativo.</p>
```

```ts
// Frontend — verificar OTP
const { data, error } = await supabase.auth.verifyOtp({
  email: userEmail,
  token: otpDigitado,    // código 6 dígitos do email
  type: 'signup',        // 'signup' | 'magiclink' | 'recovery' | 'email_change'
})
```

**Solução B — Link customizado com token_hash (PKCE flow):**
```html
<!-- Token hash não é o token real — scanner não consegue usar -->
<a href="{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}">
  Confirmar email
</a>
```

```ts
// Rota /confirm — trocar token_hash pelo token real
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as any

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) redirect(url.searchParams.get('next') ?? '/')
  }

  redirect('/auth/error?message=link-invalido')
}
```

### Customizar templates com Go Templates

Templates suportam sintaxe Go Template para lógica condicional:

```html
{{ if eq .Data.plan "enterprise" }}
  <p>Bem-vindo ao plano Enterprise! Seu gerente de conta entrará em contato.</p>
{{ else }}
  <p>Bem-vindo! Comece sua avaliação gratuita de 14 dias.</p>
{{ end }}

<p>Confirme seu email:</p>
<a href="{{ .ConfirmationURL }}">Confirmar</a>
```

### Management API para templates

```ts
// Atualizar template via API (service_role)
const { error } = await supabaseAdmin.from('_supabase_auth_templates').upsert({
  template_type: 'confirm_signup',
  subject: 'Confirme seu cadastro em {{ .SiteURL }}',
  content: '<html>...</html>',
})
```

## Custom SMTP

### Por que SMTP customizado é obrigatório em produção

O SMTP padrão do Supabase:
- **Só envia para endereços da equipe do projeto** — não envia para usuários externos
- **Rate limit muito baixo** — inadequado para produção
- **Não customizável** — domínio `noreply@mail.supabase.io`, sem DKIM/DMARC

**Provedores recomendados por caso de uso:**

| Provedor | Melhor para |
|----------|------------|
| Resend | DX moderno, APIs React Email |
| AWS SES | Escala, custo baixo, ecossistema AWS |
| Postmark | Alta entregabilidade transacional |
| SendGrid | Volume alto, analytics |
| Mailgun | Europeu, GDPR |

### Configurar via `config.toml`

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(SMTP_PASSWORD)"     # env var — nunca valor direto em config.toml
admin_email = "noreply@meuapp.com"
sender_name = "Meu App"
```

### Configurar via Dashboard

`Authentication > Providers > Email > Custom SMTP` → preencher host, port, user, password.

### Checklist de configuração de email

```
☐ SPF record — "v=spf1 include:_spf.resend.com ~all"
☐ DKIM record — chave pública no DNS (obtida no provedor)
☐ DMARC policy — "v=DMARC1; p=quarantine; rua=mailto:dmarc@meuapp.com"
☐ Domínio de envio verificado no provedor
☐ Endereço de reply-to configurado
☐ Emails de auth separados dos emails de marketing (subdomínios diferentes)
☐ Testar entregabilidade com mail-tester.com
```

### Separar emails de auth dos de marketing

**Problema:** usar o mesmo domínio/IP para emails transacionais (auth) e marketing (newsletters) faz com que reclamações de spam do marketing afetem a entregabilidade de emails de auth.

**Certo:** usar subdomínio dedicado para auth:
- Auth: `noreply@auth.meuapp.com` (subdomínio `auth.`)
- Marketing: `news@meuapp.com` (domínio principal)

### Mitigação de abuso de SMTP

```toml
[auth.email]
# Rate limit de emails por hora por IP
max_frequency = "1m"    # mínimo 1 minuto entre emails para o mesmo endereço
```

Combinado com CAPTCHA (ver abaixo) e rate limits de endpoint.

## Redirect URLs

### Site URL

A Site URL é o redirect padrão quando nenhum `redirectTo` é especificado:

```toml
[auth]
site_url = "https://meuapp.com"    # PRODUÇÃO — nunca deixar como localhost
# site_url = "http://localhost:3000"  # só em desenvolvimento local
```

**Erro crítico:** Site URL apontando para `localhost` em produção — usuários são redirecionados para localhost após login/confirmação.

### Allowlist de URLs

```toml
[auth]
additional_redirect_urls = [
  "https://meuapp.com",
  "https://app.meuapp.com",
  "https://meuapp.vercel.app",
]
```

### Wildcards em redirect URLs

| Wildcard | Comportamento |
|----------|--------------|
| `*` | Qualquer string sem `/` (mesmo segmento) |
| `**` | Qualquer string incluindo `/` (multi-segmento) |
| `?` | Um único caractere |

```toml
additional_redirect_urls = [
  # URLs de preview do Vercel (branch deploys)
  "https://meuapp-*.vercel.app",       # * cobre apenas um segmento
  "https://meuapp-git-*.vercel.app/**", # ** cobre qualquer path após
  
  # Netlify
  "https://*--meuapp.netlify.app",
  
  # Mobile deep links
  "meuapp://auth/callback",
]
```

**Atenção com wildcards:** wildcards muito amplos (ex: `https://*`) são vetores de open redirect. Ser específico ao máximo — usar o domínio base como prefixo do wildcard.

### Passando `redirectTo` no código

```ts
// Signup com redirect customizado
const { error } = await supabase.auth.signUp({
  email: 'user@exemplo.com',
  password: 'senha123',
  options: {
    emailRedirectTo: 'https://meuapp.com/onboarding',  // deve estar na allowlist
  },
})

// Magic link com redirect customizado
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@exemplo.com',
  options: {
    emailRedirectTo: 'https://meuapp.com/dashboard',
  },
})
```

## Rate Limits

### Algoritmo Token Bucket

Supabase usa token bucket para rate limiting de auth:

```
Capacidade: N tokens
Reabastecimento: K tokens por período
Request consome 1 token
Quando tokens = 0: requisição rejeitada com 429
```

### Limites padrão por endpoint

| Endpoint | Limite padrão | Customizável |
|----------|--------------|--------------|
| `/auth/v1/signup` | 30/hora por IP | Sim (Pro+) |
| `/auth/v1/token` (signIn) | 30/hora por IP | Sim (Pro+) |
| `/auth/v1/otp` (magic link) | 30/hora por IP | Sim (Pro+) |
| `/auth/v1/recover` (reset password) | 30/hora por IP | Sim (Pro+) |
| `/auth/v1/user` | 30/hora por IP | Sim (Pro+) |
| `/auth/v1/resend` | 3/hora por email | Não |

### IP Forwarding com `Sb-Forwarded-For`

Em deployments atrás de proxy/load balancer, o IP real do cliente pode ser mascarado. Use o header `Sb-Forwarded-For` para informar o IP real ao Supabase:

```ts
// Edge Function ou backend — repassar IP real para rate limiting
const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Sb-Forwarded-For': request.headers.get('x-forwarded-for') ?? '',
    // ATENÇÃO: 'Sb-Forwarded-For' só é respeitado com service_role key
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ email, password }),
})
```

**Requisito de segurança:** o header `Sb-Forwarded-For` é aceito apenas quando a requisição usa `service_role` key. Com `anon` key, o header é ignorado (prevenção de spoofing).

## CAPTCHA

### Provedores suportados

| Provedor | Tipo | Privacy |
|----------|------|---------|
| **hCaptcha** | Challenges visuais | Maior privacidade |
| **Cloudflare Turnstile** | Invisível (comportamental) | Privacy-first |

### Habilitar via Dashboard

`Authentication > Security > CAPTCHA protection` → Selecionar provedor → Colar Site Key.

### Habilitar via `config.toml`

```toml
[auth.captcha]
enabled = true
provider = "turnstile"  # ou "hcaptcha"
secret = "env(CAPTCHA_SECRET_KEY)"
```

### Componente frontend (React)

```tsx
// components/AuthForm.tsx — com Turnstile
import { Turnstile } from '@marsidev/react-turnstile'

export function SignUpForm() {
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const { error } = await supabase.auth.signUp({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      options: {
        captchaToken,   // token obtido do widget
      },
    })

    if (error) console.error(error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />

      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onSuccess={setCaptchaToken}
        onExpire={() => setCaptchaToken('')}
      />

      <button type="submit" disabled={!captchaToken}>Criar conta</button>
    </form>
  )
}
```

### CAPTCHA em outros endpoints

```ts
// Magic link com CAPTCHA
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { captchaToken },
})

// Reset de senha com CAPTCHA
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  captchaToken,
  redirectTo: 'https://meuapp.com/reset',
})
```

### hCaptcha — Alternativa com maior privacidade

```tsx
import HCaptcha from '@hcaptcha/react-hcaptcha'

function SignInForm() {
  const captchaRef = useRef<HCaptcha>(null)
  const [captchaToken, setCaptchaToken] = useState<string>('')

  return (
    <form>
      <HCaptcha
        sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!}
        ref={captchaRef}
        onVerify={setCaptchaToken}
        onExpire={() => setCaptchaToken('')}
      />
      <button type="submit" disabled={!captchaToken}>Entrar</button>
    </form>
  )
}
```

## Password Security

### Configurar políticas de senha

```toml
[auth.password]
# Comprimento mínimo (padrão: 6, recomendado: 12+)
min_length = 12

# Exigir caracteres específicos
require_uppercase = true     # pelo menos 1 maiúscula
require_lowercase = true     # pelo menos 1 minúscula
require_numbers = true       # pelo menos 1 número
require_special_characters = true  # pelo menos 1 especial

# Proteção contra senhas vazadas (HaveIBeenPwned) — Pro+
check_breached_passwords = true
```

### Leaked Password Protection (HaveIBeenPwned)

```toml
[auth.password]
check_breached_passwords = true   # rejeita senhas em listas de vazamento conhecidas
```

Como funciona: a senha é verificada via k-Anonymity contra a API HaveIBeenPwned — apenas os 5 primeiros caracteres do hash SHA-1 são enviados (a senha nunca sai do ambiente).

### Exigir reautenticação antes de trocar senha

```ts
// 1. Solicitar verificação de identidade (envia email/SMS)
const { error } = await supabase.auth.reauthenticate()

// 2. Verificar código recebido
const { error } = await supabase.auth.verifyOtp({
  email: userEmail,
  token: codigoDigitado,
  type: 'reauthentication',
})

// 3. Após verificação, atualizar senha
const { error } = await supabase.auth.updateUser({
  password: novaSenha,
})
```

### Exigir senha atual ao trocar senha

```ts
// Passar a senha atual junto da nova senha para garantir autenticidade
const { error } = await supabase.auth.updateUser({
  password: novaSenha,
  // current_password evita ataques de session fixation
  // (disponível em versões recentes do @supabase/supabase-js)
})
```

## Audit Logs

### Tabela `auth.audit_log_entries`

```sql
-- Ver últimas ações de auth
select
  created_at,
  payload->>'action' as action,
  payload->>'actor_id' as user_id,
  payload->>'actor_username' as email,
  payload->>'ip_address' as ip,
  payload->>'traits' as traits
from auth.audit_log_entries
order by created_at desc
limit 100;

-- Filtrar por tipo de ação
select *
from auth.audit_log_entries
where payload->>'action' = 'login'
  and created_at > now() - interval '24 hours';
```

### Ações registradas

| Ação | Descrição |
|------|-----------|
| `login` | Login bem-sucedido |
| `logout` | Logout |
| `signup` | Novo cadastro |
| `token_refreshed` | Refresh de access token |
| `password_recovery` | Pedido de reset de senha |
| `user_modified` | Dados do usuário atualizados |
| `user_deleted` | Conta deletada |
| `mfa_challenge_verified` | Desafio MFA verificado |
| `invite` | Usuário convidado por admin |

### Armazenamento externo de audit logs

Por padrão, logs ficam no Postgres do projeto (tabela `auth.audit_log_entries`). Para retenção de longo prazo ou compliance (LGPD, SOC 2):

```ts
// Edge Function — exportar audit logs para armazenamento externo
// supabase/functions/export-audit-logs/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString() // última hora

  const { data: logs } = await supabase
    .from('auth.audit_log_entries')
    .select('*')
    .gt('created_at', since)
    .order('created_at')

  if (logs?.length) {
    // Enviar para S3, Datadog, Elastic, etc.
    await fetch(Deno.env.get('LOG_EXPORT_URL')!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs }),
    })
  }

  return new Response('ok')
})
```

### Desabilitar armazenamento no Postgres (se usar externo)

```toml
[auth]
# Desabilita inserção em auth.audit_log_entries (ainda envia para hooks)
enable_audit_log = false
```

## Regras absolutas

1. **Produção exige SMTP custom** — o SMTP padrão do Supabase só envia para membros da equipe do projeto; sem SMTP custom, usuários não recebem emails de confirmação/reset
2. **Habilitar CAPTCHA contra abuso de signup por bots** — signups automatizados consomem cota de email e poluem a base de usuários; Turnstile invisível tem menor atrito
3. **Habilitar leaked password protection** — HaveIBeenPwned k-Anonymity não expõe a senha; rejeita 99%+ das senhas mais comuns em vazamentos
4. **Site URL deve ser a URL de produção, não localhost** — usuários redirecionados para localhost perdem o fluxo de auth; verificar antes do deploy
5. **URLs de preview precisam de entradas na allowlist** — Vercel e Netlify geram URLs dinâmicas por branch; usar wildcard específico com domínio base
6. **Separar emails de auth dos emails de marketing** — usar subdomínio dedicado para auth; reclamações de spam do marketing não devem afetar entregabilidade transacional

## Anti-patterns

### Anti-pattern 1: SMTP padrão em produção

**Errado:**
```toml
# config.toml sem configuração de SMTP
# "vai funcionar no dashboard.supabase.com" — ERRADO para usuários reais
```

**Por quê:** o SMTP built-in do Supabase é exclusivo para desenvolvimento e testes — emails para endereços fora da equipe do projeto são silenciosamente descartados. Usuários em produção não recebem emails de confirmação ou reset de senha.

**Certo:** configurar SMTP custom (Resend, SES, Postmark) com domínio verificado, DKIM e DMARC antes de ir para produção.

### Anti-pattern 2: Site URL apontando para localhost

**Errado:**
```toml
[auth]
site_url = "http://localhost:3000"  # copiado do .env de dev → esquecido em produção
```

**Por quê:** após clicar no link de confirmação de email ou reset de senha, o usuário é redirecionado para `localhost:3000` — que não existe em produção. Fluxo de auth quebrado para todos os usuários.

**Certo:** `site_url` em staging/produção sempre aponta para a URL real; usar variável de ambiente ou CI/CD para garantir que o valor correto seja aplicado por ambiente.

### Anti-pattern 3: Signup sem CAPTCHA

**Errado:**
```ts
// Signup direto sem proteção
const { error } = await supabase.auth.signUp({ email, password })
```

**Por quê:** sem CAPTCHA, qualquer script pode criar milhares de contas automaticamente — consumindo cota de email SMTP, poluindo a base de usuários, e potencialmente causando custos inesperados.

**Certo:** habilitar Turnstile (invisível, menos atrito) ou hCaptcha; passar `captchaToken` no `signUp()`.

### Anti-pattern 4: Misturar emails de auth e marketing

**Errado:**
```
Domínio: meuapp.com
Auth emails: noreply@meuapp.com (mesmo domínio/IP)
Marketing: newsletter@meuapp.com (mesmo domínio/IP)
```

**Por quê:** alta taxa de unsubscribe ou reclamações de spam nas newsletters degrada a reputação do domínio/IP → emails de auth (confirmação, reset de senha) também caem no spam ou são bloqueados.

**Certo:**
```
Auth: noreply@auth.meuapp.com (subdomínio dedicado, IP separado)
Marketing: news@meuapp.com (domínio principal)
```

Reputações de email são por domínio/IP; subdominios permitem isolamento.

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — panorama de métodos de auth (email, magic link, OAuth social)
- [supabase-social-oauth](../supabase-social-oauth/SKILL.md) — OAuth social (Google, GitHub, etc.)
- [supabase-auth-hooks](../supabase-auth-hooks/SKILL.md) — hooks de autenticação (before/after events)
- [supabase-mfa](../supabase-mfa/SKILL.md) — Multi-Factor Authentication (TOTP, SMS)
- [supabase-auth-bootstrapper](../../agents/supabase-auth-bootstrapper.md) — agente que configura auth completo desde o início
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — @supabase/ssr para Next.js

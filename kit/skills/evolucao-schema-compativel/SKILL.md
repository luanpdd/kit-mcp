---
name: evolucao-schema-compativel
cost_tier: leve
description: Guia migrations Postgres zero-downtime (padrão 3-passos, DROP 2-fase, rename via view) e payload Edge Function backward+forward compat. Use ao alterar colunas em uso ou versionar contrato API.
---

# Evolução de Schema Compatível — Padrão 3-Passos + Rolling Upgrade

## Quando usar

LLM carrega esta skill ao escrever migration Postgres ou versionar contrato de API em Edge Function Supabase com risco de quebra de compat. Trigger phrases:

- "alterar coluna existente", "add not null em coluna em uso"
- "migration sem downtime", "padrão 3-passos backfill"
- "schema evolution Postgres", "Avro Postgres", "Protobuf Postgres"
- "compat backward forward", "rolling upgrade Edge Function"
- "renomear coluna sem downtime", "drop column antigo", "narrow type unsafe"
- "versionar payload API", "JWT compat entre versões"

Esta skill **estende** [`supabase-migrations`](../supabase-migrations/SKILL.md) (v1.8) — herda naming convention, RLS obrigatório e style guide; adiciona o padrão 3-passos canônico DDIA Ch 4 traduzido para Postgres.

Material-fonte: *Designing Data-Intensive Applications*, Martin Kleppmann (O'Reilly 2017), capítulo 4 "Encoding and Evolution". Termos canônicos PT-BR ↔ EN definidos em [`../_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seção (g).

## Regras absolutas

**REGRA #1 (nunca adicionar NOT NULL em coluna existente direto):** `ALTER TABLE ... ALTER COLUMN x SET NOT NULL` em coluna em uso **DEVE** ser feita após backfill 100% verificado. Adicionar direto trava a tabela com `AccessExclusiveLock` enquanto Postgres scaneia toda a tabela validando — bloqueia reads/writes; pode demorar minutos em tabelas grandes; falha se houver 1 NULL remanescente.

**REGRA #2 (nunca DROP COLUMN sem 2-fase):** `ALTER TABLE ... DROP COLUMN x` quebra rolling upgrade. App v1 ainda lendo a coluna recebe erro. Padrão correto: marcar deprecated em V2 (app não escreve mais), DROP em V3 (após 100% das instâncias V1 desligadas).

**REGRA #3 (nunca narrow type direto):** `ALTER TABLE ... ALTER COLUMN x TYPE varchar(50)` em coluna `varchar(255)` em uso **DEVE** falhar se houver row com valor > 50 chars; mesmo se passar, viola forward compat (app antigo escreve string longa, falha). Padrão: nova coluna `x_short` + backfill com truncamento + transição V1→V2 → DROP da antiga.

**REGRA #4 (nunca mudar default em coluna em uso direto):** `ALTER TABLE ... ALTER COLUMN x SET DEFAULT 'novo'` muda comportamento de inserts em pleno rolling upgrade (V1 não passa default explícito, espera o antigo; V2 espera o novo). Padrão: 2-passos (nova coluna shadow com novo default → backfill → swap).

**REGRA #5 (Edge Function: nunca remover campo required do payload):** Cliente antigo enviando payload sem o campo novo deve continuar funcionando até forçar upgrade. Adicionar campo = optional + default no servidor; remover campo = manter como ignored por N versões antes de deletar; renomear = aceitar ambos os nomes durante transição.

**REGRA #6 (rolling upgrade preserva ambas as versões em produção):** Em qualquer momento durante deploy, **V1 e V2 coexistem**. Schema/payload de dados em trânsito **DEVE** atender backward compat (V2 lê dados V1) **E** forward compat (V1 lê dados V2 ignorando campos novos).

## Patterns canônicos

### Padrão 3-passos: adicionar coluna NOT NULL em tabela em uso

Pattern canônico DDIA Ch 4 ("rolling upgrade") aplicado a Postgres:

```sql
-- ============================================================
-- MIGRATION 1 (V1+V2 coexistindo): adicionar coluna NULLABLE
-- ============================================================
-- Header v1.8 supabase-migrations
-- Purpose: adicionar coluna phone_country a leads (3-passos, parte 1)
-- Affected: public.leads
-- Special considerations: coluna fica nullable temporariamente

alter table public.leads
  add column phone_country text;
  -- nullable por default, sem CHECK ainda

-- App V1 não usa essa coluna — ignora (forward compat OK)
-- App V2 começa a escrever phone_country quando criar leads novos
-- Linhas antigas continuam com NULL (sem quebrar V1)

-- Index opcional para queries futuras
create index if not exists leads_phone_country_idx
  on public.leads (phone_country)
  where phone_country is not null;
```

```sql
-- ============================================================
-- MIGRATION 2 (após V2 100% deployado): backfill em batches
-- ============================================================
-- Executar via job pg_cron OU script externo, NÃO em migration
-- (migrations devem ser rápidas; backfill em loop)

do $$
declare
  rows_updated int;
begin
  loop
    -- Batch de 10k rows por iteração — evita lock prolongado
    update public.leads
    set phone_country = case
      when contact_phone like '+55%' then 'BR'
      when contact_phone like '+1%'  then 'US'
      when contact_phone like '+44%' then 'UK'
      else 'UNKNOWN'
    end
    where ctid in (
      select ctid from public.leads
      where phone_country is null
      limit 10000
    );

    get diagnostics rows_updated = row_count;
    exit when rows_updated = 0;

    -- Pausa entre batches — alivia replication lag e WAL pressure
    perform pg_sleep(0.1);
  end loop;
end $$;

-- Verificar 100% backfilled antes de prosseguir
select count(*) as remaining_nulls
from public.leads
where phone_country is null;
-- DEVE retornar 0
```

```sql
-- ============================================================
-- MIGRATION 3 (apenas após backfill 100% verificado): NOT NULL
-- ============================================================
-- Postgres 12+ otimiza esta operação SE houver CHECK constraint VALID
-- antes — escaneamento full table não acontece.

-- Passo 3a: adicionar CHECK constraint NOT VALID (não escaneia)
alter table public.leads
  add constraint leads_phone_country_check
  check (phone_country is not null) not valid;

-- Passo 3b: validar a constraint (escaneia mas usa ShareUpdateExclusiveLock,
-- não AccessExclusiveLock — reads/writes continuam funcionando)
alter table public.leads
  validate constraint leads_phone_country_check;

-- Passo 3c: adicionar NOT NULL (Postgres 12+ usa a CHECK validada,
-- pula escaneamento, lock breve)
alter table public.leads
  alter column phone_country set not null;

-- Passo 3d: remover a CHECK redundante (NOT NULL já cobre)
alter table public.leads
  drop constraint leads_phone_country_check;
```

**Por que 3 migrations e não 1:** entre Migration 1 e 3 precisa haver:
- Deploy completo de V2 (que escreve `phone_country`)
- Backfill rodado e verificado (pode levar horas em tabelas grandes)
- Janela de validação (opcional: 24-72h para confirmar zero NULLs novos)

### Análogos Avro/Protobuf → Postgres (matriz canônica)

| Operação Avro/Protobuf | Compat Avro/Protobuf | Equivalente Postgres | Compat Postgres |
|---|---|---|---|
| Add field with default | backward + forward | `ADD COLUMN x text DEFAULT 'val'` | backward + forward (V1 ignora coluna nova; V2 lê valor explícito ou default) |
| Add field required (sem default) | quebra forward | 3-passos (add nullable → backfill → SET NOT NULL) | seguro com 3-passos |
| Remove optional field | backward + forward (Avro) | 2-passos (V2 não escreve mais → `DROP COLUMN` em V3) | seguro com 2-fase |
| Remove required field | quebra ambos | NUNCA fazer; deprecate com 2-passos | seguro apenas se 100% V1 desligado |
| Rename field | backward + forward via aliases (Avro) | `CREATE OR REPLACE VIEW` mantém nome antigo + nova coluna real | seguro via view alias |
| Widen type (int32 → int64) | backward + forward (Avro/Protobuf) | `ALTER TABLE ... ALTER COLUMN x TYPE bigint` (em coluna `int`) | seguro (sem rewrite em Postgres 12+) |
| Narrow type (int64 → int32) | quebra ambos | nova coluna + backfill com cast + swap | inseguro direto |
| Widen string (varchar(50) → varchar(255)) | backward + forward | `ALTER TABLE ... ALTER COLUMN x TYPE varchar(255)` | seguro (catalog-only change Postgres 9.2+) |
| Narrow string (varchar(255) → varchar(50)) | quebra ambos | nova coluna `x_short` + backfill com truncate + swap | inseguro direto |
| Change default value | quebra forward | 2-passos (nova coluna shadow → backfill → swap) | inseguro direto em coluna em uso |

### Rename de coluna via view (zero downtime)

```sql
-- ============================================================
-- Cenário: renomear leads.contact_phone → leads.phone_e164
-- ============================================================

-- MIGRATION 1: criar nova coluna + backfill + view de compat
alter table public.leads add column phone_e164 text;

-- Backfill (em batches conforme padrão acima)
update public.leads set phone_e164 = contact_phone where phone_e164 is null;

-- VIEW expondo nome antigo para apps V1 — backward compat
create or replace view public.leads_v1 as
  select
    id,
    org_id,
    phone_e164 as contact_phone,  -- alias preserva nome antigo
    contact_email,
    stage,
    created_at
  from public.leads;

-- App V1 lê de leads_v1 (vê contact_phone)
-- App V2 lê de leads (vê phone_e164)
-- Ambos coexistem

-- MIGRATION 2 (após 100% V2 deployado e validado N dias):
drop view public.leads_v1;
alter table public.leads drop column contact_phone;
-- (Note: contact_phone aqui é a coluna ANTIGA renomeada via cópia,
--  no exemplo simplificado backfill copiou; em rename real você
--  faria backfill + DROP da antiga após swap)
```

### Mudança de default em coluna em uso (2-passos)

```sql
-- ============================================================
-- Cenário: leads.stage default 'lead' → 'qualified'
-- ============================================================

-- ❌ ERRADO (1-passo direto):
-- alter table public.leads alter column stage set default 'qualified';
-- Quebra rolling upgrade: V1 inserts sem default explícito esperam 'lead'

-- ✅ CERTO (2-passos):

-- MIGRATION 1: criar coluna shadow com novo default
alter table public.leads
  add column stage_v2 text default 'qualified';

-- Backfill (apenas rows novas/atualizadas; rows antigas mantêm stage original)
-- Em V2 deployment: app escreve em AMBAS as colunas durante transição

-- MIGRATION 2 (após V2 100% deployado escrevendo em ambas):
-- swap atomic
begin;
  alter table public.leads drop column stage;
  alter table public.leads rename column stage_v2 to stage;
commit;
```

### Versionamento de payload em Edge Functions Supabase

```typescript
// ============================================================
// supabase/functions/lead-create/index.ts
// Padrão de versionamento de payload com backward + forward compat
// ============================================================

import { serve } from 'jsr:@supabase/functions-js'

// V1 schema — original
interface LeadPayloadV1 {
  org_id: string
  contact_email: string
  contact_phone: string
}

// V2 schema — adiciona campos opcionais (forward compat: V1 não envia)
interface LeadPayloadV2 extends LeadPayloadV1 {
  phone_country?: string      // optional — V1 clients omitem
  source_channel?: 'web' | 'whatsapp' | 'api'  // optional + enum
  utm_campaign?: string       // optional
}

// V3 deprecation: contact_phone vira opcional (substituído por phone_e164)
interface LeadPayloadV3 extends Omit<LeadPayloadV2, 'contact_phone'> {
  contact_phone?: string      // ainda aceito mas deprecated — emitir warning
  phone_e164?: string         // novo nome canônico — preferred
}

Deno.serve(async (req) => {
  const payload = await req.json() as LeadPayloadV3

  // 1. Resolver alias (backward compat: V1 e V2 ainda enviam contact_phone)
  const phone = payload.phone_e164 ?? payload.contact_phone
  if (!phone) {
    return new Response(
      JSON.stringify({ error: 'phone required (phone_e164 or contact_phone)' }),
      { status: 400 }
    )
  }

  // 2. Aplicar defaults para campos novos opcionais (forward compat)
  const phoneCountry = payload.phone_country ?? inferCountryFromPhone(phone)
  const sourceChannel = payload.source_channel ?? 'api'  // default

  // 3. Emitir deprecation warning para clients antigos (não bloquear)
  const warnings: string[] = []
  if (payload.contact_phone && !payload.phone_e164) {
    warnings.push('contact_phone is deprecated; use phone_e164 (will be removed in v4)')
  }

  // 4. Inserir com schema atual do DB
  // ... insert logic ...

  return new Response(
    JSON.stringify({ success: true, warnings }),
    { headers: { 'content-type': 'application/json' } }
  )
})

function inferCountryFromPhone(phone: string): string {
  if (phone.startsWith('+55')) return 'BR'
  if (phone.startsWith('+1')) return 'US'
  return 'UNKNOWN'
}
```

**Regras de versionamento de payload aplicadas acima:**
1. **Add field optional** — V2 adiciona `phone_country?`, `source_channel?` — V1 clients funcionam sem enviá-los (server aplica default)
2. **Never-remove-required** — `contact_phone` foi marcado opcional em V3 (não removido) — V1/V2 clients ainda funcionam
3. **Aliasing for rename** — V3 aceita ambos `contact_phone` e `phone_e164` durante transição
4. **Deprecation warning** — server emite warning não-bloqueante para clients usando campo antigo, dando sinal para upgrade

### Rolling upgrade client-side com JWT/session compat

```typescript
// ============================================================
// Pattern: deploy escalonado V1+V2 coexistindo no SDK do cliente
// ============================================================

// JWT contém versão do schema que o cliente conhece
// Cliente V1 tem JWT com schema_version: 1
// Cliente V2 tem JWT com schema_version: 2 (após refreshSession após upgrade)

// Server lê JWT e adapta resposta — backward compat
import { createClient } from 'jsr:@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function fetchLead(leadId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const schemaVersion = session?.user?.app_metadata?.schema_version ?? 1

  // Buscar do DB (sempre schema atual)
  const { data: lead } = await supabase
    .from('leads')
    .select('id, org_id, contact_email, phone_e164, phone_country, source_channel')
    .eq('id', leadId)
    .single()

  if (!lead) return null

  // Adaptar response para a versão do JWT
  if (schemaVersion === 1) {
    // Cliente V1 não conhece phone_e164/source_channel — converter para nomes antigos
    return {
      id: lead.id,
      org_id: lead.org_id,
      contact_email: lead.contact_email,
      contact_phone: lead.phone_e164,  // alias para nome antigo
      // omite phone_country e source_channel (cliente V1 não usa)
    }
  }

  return lead  // Cliente V2 recebe schema completo
}

// Após upgrade do cliente para V2, chamar refreshSession
// para obter JWT com schema_version: 2
async function upgradeClientVersion() {
  await supabase.auth.refreshSession()
  // Hook custom JWT no servidor seta app_metadata.schema_version = 2
}
```

## Anti-patterns

### Anti-pattern 1: ADD COLUMN NOT NULL em tabela com dados (1-passo)

**Errado:**
```sql
alter table public.leads add column phone_country text not null default 'BR';
```

**Por quê:**
- Trava a tabela com `AccessExclusiveLock` enquanto Postgres reescreve cada row preenchendo o default. Em tabelas com milhões de rows isso pode travar reads/writes por minutos.
- Se a tabela é particionada, locks são tomados em todas as partições.
- Default fixo `'BR'` é wrong para tenants internacionais — viola correção do dado.

**Certo:** padrão 3-passos (add nullable → backfill conditional → SET NOT NULL).

### Anti-pattern 2: DROP COLUMN durante rolling upgrade

**Errado:**
```sql
-- App V1 ainda em produção lê leads.legacy_field
alter table public.leads drop column legacy_field;
-- Boom: V1 quebra com "column does not exist"
```

**Por quê:** quebra backward compat instantaneamente. Mesmo que apenas 1% das instâncias V1 ainda esteja rodando, esse 1% trava.

**Certo:** 2-fase. V2 para de escrever/ler `legacy_field` (mas tolera presença). Após 100% V1 desligado por janela de segurança (24-72h), DROP COLUMN.

### Anti-pattern 3: ALTER COLUMN TYPE narrow direto

**Errado:**
```sql
alter table public.leads alter column contact_email type varchar(50);
-- Falha se houver email > 50 chars; mesmo passando, V1 que escreve email longo quebra
```

**Por quê:** narrowing quebra forward compat. App antigo (V1) que ainda envia strings de 100 chars vai falhar com violation. Mesmo se você "souber" que dados atuais cabem, app V1 em produção pode escrever long string a qualquer momento.

**Certo:** nova coluna `email_short varchar(50)` + backfill com truncate + swap após V2 100% deployado.

### Anti-pattern 4: rename via `ALTER TABLE RENAME COLUMN` durante rolling upgrade

**Errado:**
```sql
alter table public.leads rename column contact_phone to phone_e164;
-- App V1 que ainda referencia contact_phone quebra IMEDIATAMENTE
```

**Por quê:** não há janela de coexistência. V1 e V2 não podem ler colunas com nomes diferentes ao mesmo tempo. Postgres não tem conceito nativo de "alias" para coluna como Avro tem para field.

**Certo:** nova coluna + view alias para nome antigo + backfill + DROP da view e coluna antiga após V2 100%. Ver pattern `Rename de coluna via view (zero downtime)` acima.

### Anti-pattern 5: remover campo required do payload da Edge Function sem deprecation

**Errado:**
```typescript
// V2 da Edge Function rejeita request V1 sem o novo campo
interface LeadPayload {
  org_id: string
  contact_email: string
  source_channel: 'web' | 'whatsapp' | 'api'  // novo, marcado required
}
// Cliente V1 que não envia source_channel recebe 400
```

**Por quê:** quebra forward compat. SDK V1 instalado em apps mobile não atualizados continua mandando payload antigo. Forçar upgrade instantâneo é hostile (mobile apps demoram dias para atualizar).

**Certo:** novo campo = `optional` no servidor. Server aplica default razoável quando ausente. Após N versões (~3 meses) e telemetria mostrando 0% de requests sem o campo, considerar tornar required.

### Anti-pattern 6: schema migration sem schema registry equivalente em Postgres (info loss)

**Errado:** confiar que "todo dev sabe que `leads.tier` é um enum com valores `free/pro/enterprise`" sem documentar.

**Por quê:** Avro/Protobuf têm schema registry centralizado — schema é dado de primeira classe. Em Postgres puro, schema vive no código + memória do dev. Após 6 meses, ninguém lembra que `tier` é enum implícito.

**Certo:**
- Use `CHECK constraint` para enforçar valores válidos no DB: `tier text check (tier in ('free','pro','enterprise'))`
- Use `COMMENT ON COLUMN public.leads.tier IS 'enum free|pro|enterprise — see schema docs'` para documentação no catálogo Postgres
- Consider Postgres `ENUM` type quando valores são realmente fechados (mas trade-off: ALTER TYPE ADD VALUE precisa cuidado em transações)

## Checklist pré-merge de migration

Antes de aceitar PR com migration que modifica coluna existente:

- [ ] É ADD COLUMN sem default — sem risco (NULL ok)
- [ ] É ADD COLUMN com default constante — verificar tamanho da tabela; se >100k rows, considerar 3-passos
- [ ] É ADD COLUMN NOT NULL — **REQUER 3-passos** (add nullable → backfill → SET NOT NULL)
- [ ] É DROP COLUMN — **REQUER 2-fase** (V2 para de usar → DROP em V3)
- [ ] É ALTER COLUMN TYPE — **WIDENING ok, NARROWING requer pattern shadow column**
- [ ] É ALTER COLUMN SET DEFAULT em coluna em uso — **REQUER 2-passos** (shadow column)
- [ ] É RENAME COLUMN — **REQUER pattern view alias** durante rolling upgrade
- [ ] Migration é idempotent (`IF NOT EXISTS`, `IF EXISTS`)
- [ ] Backfill (se houver) está em script externo / pg_cron job, não na migration

## Ver também

- [`../_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) — termos canônicos PT-BR ↔ EN: `rolling upgrade`, `backward compatibility`, `forward compatibility`, `schema evolution`, `Avro`, `Protocol Buffers`, `schema registry` (seção g)
- [`../supabase-migrations/SKILL.md`](../supabase-migrations/SKILL.md) — naming convention `YYYYMMDDHHmmss_short.sql`, header de metadados, RLS obrigatório (v1.8 herdado)
- [`../supabase-declarative-schema/SKILL.md`](../supabase-declarative-schema/SKILL.md) — workflow `stop → db diff -f → revisar → apply` (v1.8)
- [`../supabase-database-functions/SKILL.md`](../supabase-database-functions/SKILL.md) — funções PG com `STABLE` marker para uso em backfill (v1.8)
- [`../supabase-edge-functions/SKILL.md`](../supabase-edge-functions/SKILL.md) — Deno + imports `npm:`/`jsr:` para Edge Functions com versionamento de payload (v1.8)
- [`../supabase-postgres-style/SKILL.md`](../supabase-postgres-style/SKILL.md) — convenções SQL (snake_case, lowercase reserved, ISO 8601) (v1.8)
- DDIA cap. 4 "Encoding and Evolution" — fonte canônica do padrão rolling upgrade
- [Martin Kleppmann — Schema evolution in Avro, Protocol Buffers and Thrift](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html)

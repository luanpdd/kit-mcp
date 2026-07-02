---
name: supabase-storage
cost_tier: leve
description: Configura Supabase Storage com buckets públicos vs privados, signed URLs com expiration, RLS sobre storage.objects, multi-tenant path isolation, image transforms e TUS uploads para arquivos grandes.
---

# Supabase — Storage

## Quando usar

LLM carrega esta skill quando trabalhar com upload, download, ou serve de arquivos via Supabase Storage. Trigger phrases:

- "Supabase Storage", "upload de arquivo"
- "signed URL", "createSignedUrl"
- "bucket público vs privado"
- "RLS storage.objects"
- "multi-tenant arquivos"
- "image transforms Supabase"
- "TUS resumable upload"

## Regras absolutas

- **Bucket privado é default em produção** — apenas dados públicos (avatares públicos, marketing) vão em buckets públicos.
- **Bucket público:** URL direta `getPublicUrl()` + servida via CDN (cache).
- **Bucket privado:** apenas `signed URL` (`createSignedUrl()`) com `expiresIn` curto (60s downloads, 3600s imagens).
- **`storage.objects`** — RLS sempre habilitada. Sem RLS, qualquer authenticated lê qualquer bucket privado.
- **`multi-tenant path`** isolation — usar `auth.uid()` (ou `org_id`) como path prefix: `<user_id>/<filename>`. Validar em RLS via `(storage.foldername(name))[1] = (select auth.uid())::text`.
- **Image transformations** apenas em buckets com transformation enabled (Pro plan+). Query params `?width=800&height=600&resize=contain`.
- **Uploads grandes (> 6 MB):** use TUS resumable protocol (`uploadToSignedUrl` + chunked upload).
- **Awareness de egress billing** — bucket público sem cache headers customizados pode disparar custo significativo. Use Smart CDN + TTL adequado.
- **Não overwrite arquivos públicos** com mesmo nome — CDN cache fica stale. Use versionamento (`avatar-v2.jpg`) ou random suffix.

## Patterns canônicos

### RLS multi-tenant em `storage.objects`

```sql
-- PT-BR: usuário só vê arquivos sob seu próprio prefix de path
-- path canônico: <user_id>/<filename> (ex: 550e8400-e29b-41d4-a716-446655440000/avatar.jpg)

create policy "users_read_own_files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users_insert_own_files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users_update_own_files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users_delete_own_files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

### Upload com path multi-tenant

```ts
// PT-BR: cliente — path sempre prefixado com user.id
import { createClient } from '@/utils/supabase/client'

async function uploadAvatar(file: File) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  // PT-BR: path = <user_id>/<filename>
  const path = `${user.id}/avatar.jpg`

  const { data, error } = await supabase.storage
    .from('private-uploads')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,                   // PT-BR: sobrescreve se mesmo path
    })

  if (error) throw error
  return data
}
```

### Signed URL — download privado

```ts
// PT-BR: signed URL com expiração 1h
const { data, error } = await supabase.storage
  .from('private-uploads')
  .createSignedUrl(`${userId}/avatar.jpg`, 3600)

// data.signedUrl pode ser usado em <img src={data.signedUrl}> por 1h
```

### Image transformations (em bucket com transform habilitado)

```ts
// PT-BR: signed URL com transformação inline
const { data } = await supabase.storage
  .from('private-uploads')
  .createSignedUrl(`${userId}/avatar.jpg`, 3600, {
    transform: { width: 200, height: 200, resize: 'cover' },
  })
```

### Public bucket — getPublicUrl + cache headers

```ts
// PT-BR: para bucket PÚBLICO apenas (não funciona em privado)
const { data } = supabase.storage
  .from('public-avatars')
  .getPublicUrl('hero.jpg')

// PT-BR: ao upload, set cacheControl alto para reduzir egress
await supabase.storage
  .from('public-avatars')
  .upload('hero.jpg', file, {
    cacheControl: '31536000',         // 1 ano — assets imutáveis
    upsert: false,                    // não sobrescrever (versionar via path)
  })
```

### TUS resumable upload (arquivos grandes)

```ts
// PT-BR: signed upload URL + TUS chunked upload (>6MB)
import * as tus from 'npm:tus-js-client'

async function uploadLarge(file: File, path: string) {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('private-uploads')
    .createSignedUploadUrl(path)
  if (error) throw error

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: data.signedUrl,
      headers: { authorization: `Bearer ${data.token}` },
      chunkSize: 6 * 1024 * 1024,     // 6 MB chunks
      onError: reject,
      onSuccess: () => resolve(upload.url),
    })
    upload.start()
  })
}
```

### Notas de futuro (alpha — não detalhar em produção)

- **Vector Buckets** e **Analytics Buckets** existem em alpha (2026). Mencione apenas como existência se relevante; pattern canônico ainda mudando — não detalhar.

## Anti-patterns

### Anti-pattern 1: Path sem prefix de tenant

**Errado:**
```ts
await supabase.storage.from('private-uploads').upload('avatar.jpg', file)
```

**Por quê:** path global — qualquer user sobrescreve `avatar.jpg`. RLS multi-tenant não consegue isolar.

**Certo:**
```ts
const path = `${user.id}/avatar.jpg`
await supabase.storage.from('private-uploads').upload(path, file)
```

### Anti-pattern 2: Bucket privado sem RLS em `storage.objects`

**Errado:**
```sql
create bucket 'private-uploads';
-- (esqueceu policies em storage.objects)
```

**Por quê:** sem RLS em `storage.objects`, qualquer `authenticated` lê arquivos do bucket — multi-tenancy quebrado.

**Certo:** ver pattern "RLS multi-tenant" acima — 4 policies separadas (SELECT/INSERT/UPDATE/DELETE).

### Anti-pattern 3: `getPublicUrl` em bucket privado

**Errado:**
```ts
// PT-BR: bucket-id é privado
const { data } = supabase.storage.from('private-uploads').getPublicUrl('x.jpg')
// data.publicUrl retorna mas o URL não funciona (403)
```

**Por quê:** `getPublicUrl` só funciona em buckets marcados public. Em privado, retorna URL que sempre dá 403.

**Certo:** use `createSignedUrl` com expiration:
```ts
const { data } = await supabase.storage
  .from('private-uploads')
  .createSignedUrl('x.jpg', 3600)
// data.signedUrl funciona por 1h
```

### Anti-pattern 4: Overwrite de arquivo público com mesmo path

**Errado:**
```ts
// PT-BR: hero.jpg público
await supabase.storage.from('public').upload('hero.jpg', newFile, { upsert: true })
// CDN cache antigo continua servindo old hero.jpg por horas/dias
```

**Por quê:** CDN cache pelo path. Overwrite não invalida cache; usuários veem versão antiga.

**Certo:** versionar ou random suffix:
```ts
await supabase.storage.from('public').upload(`hero-${version}.jpg`, newFile)
// ou: hero-<sha>.jpg, hero-<timestamp>.jpg
```

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS sobre `storage.objects` + multi-tenant pattern
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — usuário autenticado obtém `auth.uid()` para path prefix
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions podem mediar uploads complexos
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN

---
name: supabase-pgvector-rag
cost_tier: leve
description: Guia pgvector RAG Supabase — schema vector(N), HNSW/IVFFlat, match_documents (security invoker), RAG with permissions via RLS, chunking. Use ao implementar embeddings ou similarity search.
---

# Supabase — pgvector + RAG

## Quando usar

LLM carrega esta skill quando implementar embeddings, similarity search ou RAG (Retrieval-Augmented Generation) com Supabase. Trigger phrases:

- "pgvector", "vector embeddings"
- "RAG Supabase", "retrieval augmented generation"
- "semantic search Postgres"
- "HNSW vs IVFFlat"
- "embedding dimension"
- "match_documents function"

## Regras absolutas

- **Setup:** `create extension if not exists vector;` em migration ou `supabase/schemas/`.
- **Dimension fixa por modelo** — defina `embedding vector(N)` com N = dim do modelo: 1536 (OpenAI ada-002), 768 (nomic-embed-text), 384 (all-MiniLM-L6-v2). Mismatch = silent fail ou matches aleatórios.
- **Index obrigatório** — sem index, similarity search faz full scan e degrada drasticamente em > 10k linhas.
- **`HNSW`** = default em 2026 — recall melhor, queries mais rápidas com mais data. Build mais lento.
- **`IVFFlat`** = alternativa quando build time domina (datasets dinâmicos com re-build frequente). Recall menor.
- **Distance operators canônicos:**
  - **`<=>`** — cosine distance (mais comum em embeddings normalizados)
  - **`<#>`** — negative inner product
  - **`<->`** — L2 (euclidean) distance
- **`RAG with permissions`** — combine similarity search com RLS na tabela source. Sem isso, retrieval vaza documents entre tenants.
- **Chunking:** 200-500 tokens com overlap 10-20%. Chunks > 1k tokens degradam embeddings; < 100 perdem contexto.
- **Embedding generation server-side** — geração via Edge Function ou worker (model API key não vai para client).

## Patterns canônicos

### Schema com RLS + HNSW index

```sql
-- PT-BR: extension uma vez por projeto
create extension if not exists vector;

-- PT-BR: documents com embedding e user_id para RAG with permissions
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,                    -- PT-BR: chunk de texto (200-500 tokens)
  embedding vector(1536) not null,          -- PT-BR: dim casa com modelo
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- PT-BR: HNSW com cosine distance (default 2026)
create index documents_embedding_hnsw_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops);

-- PT-BR: RLS — RAG with permissions
alter table public.documents enable row level security;

create policy "users_read_own_docs"
  on public.documents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_docs"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create index documents_user_id_idx on public.documents (user_id);
```

### Função `match_documents` — RAG with permissions

```sql
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language plpgsql
security invoker                            -- PT-BR: invoker → respeita RLS do caller
set search_path = ''
stable
as $$
begin
  return query
    select
      d.id,
      d.content,
      1 - (d.embedding <=> query_embedding) as similarity,
      d.metadata
    from public.documents as d
    where 1 - (d.embedding <=> query_embedding) > match_threshold
    order by d.embedding <=> query_embedding
    limit match_count;
end;
$$;
```

**Por que `security invoker`:** garante que a função só retorna documentos que o caller (usuário autenticado) tem permissão de ver via RLS. Sem RLS, qualquer caller via similarity recupera documents de outros tenants.

### Uso da função do client

```ts
// PT-BR: gerar embedding (em Edge Function, server-side) e chamar match_documents
const queryEmbedding = await embedQuery(userQuestion)   // dim 1536

const { data: matches } = await supabase.rpc('match_documents', {
  query_embedding: queryEmbedding,
  match_threshold: 0.78,
  match_count: 10,
})

// matches: [{ id, content, similarity, metadata }, ...] já filtrado por RLS
const context = matches.map((m) => m.content).join('\n\n')
const answer = await llmComplete({ context, question: userQuestion })
```

### IVFFlat alternativa

```sql
-- PT-BR: usar IVFFlat quando build time importa (dataset dinâmico)
-- lists = sqrt(N) é heurística para N total de linhas
create index documents_embedding_ivfflat_idx
  on public.documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);                       -- ajustar conforme volume
```

### Geração de embeddings em Edge Function

```ts
// supabase/functions/embed-document/index.ts
// PT-BR: chunking + embedding + insert
import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai@4'

Deno.serve(async (req) => {
  const { user_id, document } = await req.json()
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default']
  )

  // PT-BR: chunk em pedaços de ~400 tokens com overlap 20%
  const chunks = chunkText(document, { size: 400, overlap: 80 })

  for (const chunk of chunks) {
    const embedRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',      // dim 1536
      input: chunk,
    })
    await supabase.from('documents').insert({
      user_id,
      content: chunk,
      embedding: embedRes.data[0].embedding,
    })
  }

  return new Response('embedded')
})
```

## Anti-patterns

### Anti-pattern 1: Dim mismatch entre modelo e coluna

**Errado:**
```sql
create table documents (embedding vector(1536) not null);
```
```ts
// PT-BR: usa nomic-embed-text que retorna dim 768
const embedding = await nomicEmbed(text)              // 768
await supabase.from('documents').insert({ embedding })  // ⚠ insert falha
```

**Por quê:** Postgres rejeita insert com dim mismatch (`expected 1536 dimensions, got 768`). Em pior caso, se aceito, similarity retorna ranking aleatório.

**Certo:** alinhe dim:
```sql
create table documents (embedding vector(768) not null);
```
ou troque o modelo para um que retorne 1536.

### Anti-pattern 2: Similarity search sem RLS — vazamento RAG

**Errado:**
```sql
-- PT-BR: tabela documents sem RLS
create table public.documents (
  id uuid primary key,
  content text,
  embedding vector(1536)
);
```

**Por quê:** qualquer authenticated chama `match_documents` e recupera documents de outros usuários. Em apps multi-tenant, é vazamento crítico — RAG do tenant A vê docs do tenant B.

**Certo:** habilite RLS + policies por `user_id`/`org_id` + use `security invoker` em funções de match (ver pattern canônico).

### Anti-pattern 3: Chunks gigantes (> 1k tokens)

**Errado:**
```ts
// PT-BR: chunk inteiro de documento (5k tokens)
const chunks = [fullDocument]
const embedding = await embed(fullDocument)
```

**Por quê:** embeddings perdem detalhe semântico em chunks muito grandes. O modelo média muitos conceitos em um único vetor, similarity vira ruidosa. Ranking RAG fica ruim.

**Certo:** chunks de 200-500 tokens com overlap:
```ts
const chunks = chunkText(fullDocument, { size: 400, overlap: 80 })
for (const chunk of chunks) {
  await embed(chunk).then(insert)
}
```

### Anti-pattern 4: Sem index em coluna `embedding`

**Errado:**
```sql
create table documents (embedding vector(1536) not null);
-- (esqueceu create index)
```

**Por quê:** sem index, similarity search vira sequential scan. Em > 10k linhas, queries levam segundos a minutos. Em produção, app fica inviável.

**Certo:**
```sql
create index documents_embedding_hnsw_idx on documents using hnsw (embedding vector_cosine_ops);
```

## Notas de futuro

- **Hybrid search** (FTS + vector com RRF — Reciprocal Rank Fusion) está coberto em skill `supabase-fts` (defer v1.9 — full-text search standalone).
- **Vector Buckets** e **Analytics Buckets** ainda em alpha em 2026 — mencione como existência mas não detalhe (pattern canônico evoluindo).

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS é base de RAG with permissions
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — função `match_documents` com `security invoker` + `set search_path = ''`
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — geração de embeddings server-side
- [supabase-migrations](../supabase-migrations/SKILL.md) — schema com `vector` extension
- [glossário](../_shared-supabase/glossary.md) — operadores `<=>`/`<#>`/`<->`

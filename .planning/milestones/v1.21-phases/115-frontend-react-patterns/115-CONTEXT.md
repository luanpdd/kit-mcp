# Phase 115: Frontend React Patterns - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen

<domain>
3 skills React multi-tenant. URL `/orgs/[slug]/` (Next.js middleware OR Vite SPA), CASL gates declarativos, shadcn/ui composição canônica para member management. Onda 4 — final, depende de 108 (RLS) + 110 (invite).

REQs: REACT-01..06.
</domain>

<decisions>
- URL pattern path-based default (subdomain só com Vercel Pro Wildcard)
- Zustand v5 persist em vez de Context API
- CASL React 4.x (não Casbin/Permify — overkill para monolito React+Supabase)
- shadcn/ui copy-paste (não NPM) — 9 componentes canônicos
- JWT stale strategy: refreshSession imediato após role change
- Server-side enforcement via RLS é INALIENÁVEL — frontend gate é UX apenas
</decisions>

<code_context>
- Phase 108 RLS hierárquica + private.has_permission disponível
- Phase 110 invite flow para botão Convidar
- Phase 111 super-admin para impersonation banner (cross-ref)
- supabase-auth-ssr (v1.8) skill para middleware Next.js v16
</code_context>

<deferred>
- TanStack Start integration — v1.22+
- Expo (React Native) integration — v1.22+
- Solid/Svelte/Vue ports — v1.22+
- Subdomain (white-label) full setup — backlog
</deferred>

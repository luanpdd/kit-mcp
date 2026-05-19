# Compatibilidade Agent × IDE

> Source of truth para tier × capability de cada agent em cada IDE suportado.
> Agents linkam para este arquivo via `**Compat:** ...` no header. Single source — atualize aqui, não em cada agent.

## Visão Geral por Pattern

Os agents do kit caem em 3 patterns de compatibilidade:

- **Pattern A — Filesystem-only:** análise puramente local (Read/Grep/Bash + git, opcionalmente test runner ou LLM hospedeiro). Funciona idêntico em todos os IDEs (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae) — tier **Full** em todos.
- **Pattern B — Supabase MCP-dependent:** precisa de queries live (`mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, `mcp__supabase__apply_migration`, advisors). Tier varia por suporte do IDE ao Supabase MCP:
  - **Full** em Claude Code + Cursor (com Supabase MCP instalado)
  - **Partial** em Codex + Gemini CLI (lê filesystem; user roda queries manualmente e cola)
  - **Offline-only** em Windsurf, Antigravity, Copilot, Trae (apenas estrutura artefatos; user faz queries manualmente)
- **Pattern C — MCP-augmented (degrada para filesystem):** funciona razoavelmente sem MCP (usa filesystem como source-of-truth fallback) e ganha capability adicional quando MCP/embedder disponível. Tier:
  - **Full** em Claude Code + Cursor + Codex (com MCP/embedder configurado)
  - **Partial** em Gemini CLI + Windsurf/Antigravity/Copilot/Trae (modo degradado mas útil)

Modo offline fallback (Patterns B e C): agent declara `[MODO OFFLINE — sem live data]` no output e marca itens MCP-dependentes como `EVIDENCE_PENDING_MCP` para o user preencher.

## Matriz por Agent

| Agent | Pattern | Claude Code | Cursor | Codex | Gemini CLI | Windsurf, Antigravity, Copilot, Trae | Capability resumida |
|---|---|---|---|---|---|---|---|
| ai-mutation-tester | A | Full | Full | Full | Full | Full | Mutação semântica via LLM hospedeiro (próprio Claude/Gemini); sem OpenAI key separada |
| burn-rate-forecaster | B | Full | Full | Partial | Partial | Offline-only | Queries live em SLI views via `execute_sql`; offline gera SQL como text |
| cascading-failures-auditor | A | Full | Full | Full | Full | Full | Análise estática filesystem + AST para 5 triggers cascade canônicos (cap 22) |
| golden-signals-instrumenter | A | Full | Full | Full | Full | Full | Não usa `mcp__supabase__*` — instrumentação em arquivos do app (Edge Function, Node, Python) |
| incident-investigator | B | Full | Full | Partial | Partial | Offline-only | Logs + SQL + advisors live para validar hipóteses; offline estrutura investigação por hipóteses |
| legacy-characterizer | A | Full | Full | Full | Full | Full | Filesystem + test runner + coverage; não usa `mcp__supabase__*` |
| load-shedding-instrumenter | A | Full | Full | Full | Full | Full | Read + Edit + verify para aplicar 5 patterns canônicos de load shedding |
| observability-coverage-auditor | C | Full | Full | Full | Partial | Partial | MCP Supabase + filesystem; sem MCP reverte para enumeration via `supabase/functions/` (sem traffic 30d) |
| observability-instrumenter | A | Full | Full | Full | Full | Full | Não usa `mcp__supabase__*` — instrumentação em arquivos do app, não no DB |
| omm-auditor | B | Full | Full | Partial | Partial | Offline-only | Lê repo + queries SLI (se Supabase MCP disponível); offline apenas análise repo local |
| payload-capture-instrumenter | C | Full | Full | Full | Partial | Partial | Drenagem de logs via `mcp__supabase__get_logs`; sem MCP gera instrumentação + script para user rodar `supabase functions logs` manualmente |
| postmortem-writer | B | Full | Full | Partial | Partial | Partial | Lê investigation + escreve postmortem + AskUserQuestion; offline limitado a `--from-investigation` |
| prr-conductor | B | Full | Full | Partial | Partial | Offline-only | Lista tabelas + executa SQL + advisors + Edge Functions live; offline estrutura template para preenchimento manual |
| refactor-safety-auditor | A | Full | Full | Full | Full | Full | Filesystem + coverage tools + git; não usa `mcp__supabase__*` |
| release-pipeline-auditor | A | Full | Full | Full | Full | Full | Filesystem + GitHub API via `gh` CLI |
| seam-finder | A | Full | Full | Full | Full | Full | Lê + grep + escreve análise (técnicas cap 25 Feathers) |
| shotgun-surgery-detector | C | Full | Full | Full | Partial | Partial | Detecção semântica via OpenAI API ou pgvector self-hosted; sem nenhum dos dois reverte para sintática only |
| slo-engineer | B | Full | Full | Partial | Partial | Offline-only | Lê schema atual + `apply_migration` para criar view; offline escreve SLO.md + SQL como text |
| storytelling-analyst | A | Full | Full | Full | Full | Full | Lê código + escreve análise; não usa MCP |
| supabase-architect | B | Full | Full | Partial | Partial | Offline-only | Lista tabelas/extensions live para detectar estado atual; offline projeta plano em texto |
| supabase-auth-bootstrapper | A | Full | Full | Full | Full | Full | Cria estrutura de pastas + arquivos + audit `.env*`; auth bootstrap totalmente offline |
| supabase-auth-hook-writer | B | Full | Full | Partial | Partial | Offline-only | Materializa Auth Hooks Postgres/HTTP; valida grants `supabase_auth_admin` via `execute_sql`; offline escreve SQL + Edge Function para user aplicar |
| supabase-edge-fn-writer | A | Full | Full | Full | Full | Full | Escreve Edge Functions (arquivos locais); não usa `mcp__supabase__*` tools |
| supabase-mfa-implementer | B | Full | Full | Partial | Partial | Offline-only | Materializa enrollment MFA + políticas RLS por AAL; valida `as restrictive` via `execute_sql`; offline escreve componentes + SQL |
| supabase-migration-writer | B | Full | Full | Partial | Partial | Offline-only | Aplica migration via `mcp__supabase__apply_migration` após validação; offline escreve arquivo SQL para user aplicar |
| supabase-oauth-server-implementer | B | Full | Full | Partial | Partial | Offline-only | Materializa OAuth 2.1/OIDC server + MCP auth; aplica RLS por `client_id` via `execute_sql`; offline escreve config.toml + UI consentimento |
| supabase-realtime-implementer | B | Full | Full | Partial | Partial | Offline-only | Aplica RLS via `mcp__supabase__execute_sql` direto; offline escreve SQL + código client para user aplicar |
| supabase-rls-writer | B | Full | Full | Partial | Partial | Offline-only | Detecta tabela existente + sugere indexes baseado em policy; offline gera SQL puro para migration manual |
| supabase-social-auth-implementer | A | Full | Full | Full | Full | Full | Materializa social login OAuth (signInWithOAuth/IdToken) + rota callback PKCE + componentes nativos; totalmente filesystem |
| supabase-sso-saml-architect | A | Full | Full | Full | Full | Full | Gera comandos `supabase sso` + attribute mapping JSON + RLS de tenant; totalmente filesystem (não usa MCP) |
| supabase-storage-implementer | B | Full | Full | Partial | Partial | Offline-only | Aplica RLS via `mcp__supabase__execute_sql`; offline escreve SQL + código client para user aplicar |
| toil-auditor | A | Full | Full | Full | Full | Full | Filesystem + git log + escreve `TOIL-AUDIT.md`; não usa `mcp__supabase__*` |

## Troubleshooting

**Pattern B agent reportou tier diferente do que esta matriz declara?** Verifique:
1. Supabase MCP está instalado? `kit install dry-run claude-code` mostra MCP servers configurados.
2. IDE host suporta MCP? Cursor/Claude Code têm suporte first-class; outros via stdio bridge ou paste.
3. Versão do Supabase MCP — alguns tools (advisors, get_logs) requerem versão recente.

**Pattern C agent reportou tier degradado inesperado?** Verifique:
1. `OPENAI_API_KEY` env var presente (para `shotgun-surgery-detector` semântico).
2. pgvector extension instalada no projeto Supabase (alternativa a OpenAI).
3. `mcp__supabase__get_logs` tool disponível (para `payload-capture-instrumenter` drenagem).

**Quer adicionar um agent novo aqui?** Edite a matriz acima — uma row. Não duplicar info no header do agent. Footer de cada agent já linka pra cá via `**Compat:** ...`.

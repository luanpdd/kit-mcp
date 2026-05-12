# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

### v1.29 — MCP-Native Discovery via Auto-Sync

**Iniciado:** 2026-05-12. **Modo execução:** totalmente autônomo. **6 fases, 25 REQs.**

**Objetivo:** Resolver o gap "MCP puro vs sync manual" — kit-mcp auto-configura `.claude/agents/`, `.claude/skills/`, `.claude/commands/` no primeiro contato com o host. Na próxima sessão o usuário tem `subagent_type` real, skills com auto-trigger nativo, slash-commands sem rodar CLI.

| # | Fase | Effort | Status |
|---|---|---|---|
| 166 | MCP `roots` capability — consumir projectRoot declarado pelo host | S | pending |
| 167 | Auto-sync no boot (idempotente + permission gate) | M | pending |
| 168 | Restart signal — `_kit_action: session_restart_recommended` + marker | S | pending |
| 169 | MCP `resources` + `notifications/resources/updated` | M | pending |
| 170 | Tool descriptions com keywords (fallback MCP puro) | XS | pending |
| 171 | `kit doctor` sync drift check | S | pending |

**Princípios:**
- P1 — Spec MCP intocável (apenas capabilities oficiais: roots, notifications)
- P2 — Idempotência (reconnect não reescreve se já em sync)
- P3 — Permission gate honesto (não contornar prompts do host)
- P4 — Fallback gracioso (host sem roots → modo MCP puro com aviso)
- P5 — Stable API v1.0+ preservada (16 → 17 releases)
- P6 — Sem side effects no boot do MCP (auto-sync via tool, não em startStdio)

## Próximo milestone: v1.30 (a definir — backlog acumulado)

Candidatos:
- Embeddings + semantic dispatch (`kit:dispatch <intent>`) — orquestração inteligente
- Supabase Vault (encryption at rest)
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills)
- Outros Auth Hooks (Send Email, Send SMS, MFA Verification, Password Verification, Before User Created)
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Terraform provider (alternativa IaC ao GitHub branching)
- SOC 2 compliance específico

## Arquivados

- **v1.28 — UX & Onboarding** (2026-05-12): 10 phases (156-165), 40 REQs, 6 root causes de CI fixadas → tag [v1.28.0](https://github.com/luanpdd/kit-mcp/releases/tag/v1.28.0)
- **v1.27 — Supabase Branching & CI/CD Workflow** (2026-05-11): 7 phases (149-155), 45 REQs, 5 skills + 2 agents + 3 cross-suite enrichments → [v1.27-ROADMAP.md](milestones/v1.27-ROADMAP.md)
- **v1.26 — Postgres Roles** (2026-05-11): 6 phases (143-148), 34 REQs → [v1.26-ROADMAP.md](milestones/v1.26-ROADMAP.md)
- **v1.25 — Custom Claims & RBAC via Auth Hooks** (2026-05-11): 6 phases (137-142), 32 REQs → [v1.25-ROADMAP.md](milestones/v1.25-ROADMAP.md)
- **v1.24 — Column-Level Security** (2026-05-11): 6 phases (131-136), 26 REQs → [v1.24-ROADMAP.md](milestones/v1.24-ROADMAP.md)
- **v1.23 — Reforço RLS Supabase + Handoff Cooperativo SQL** (2026-05-11): 7 phases (124-130), 42 REQs → [v1.23-ROADMAP.md](milestones/v1.23-ROADMAP.md)
- **v1.22 — Suíte DDIA Foundations** (2026-05-10): 7 phases (117-123), 60 REQs
- **v1.21 — Suíte Multi-Tenant SaaS B2B** (2026-05-10): 11 phases (106-116), 59 REQs
- **v1.20 — Tech Debt Closure & Quality Hardening** (2026-05-10): 6 phases (100-105), PRR 30/30
- **v1.13 → v1.19** (2026-05-09): 7 releases, 21 phases

---
*Atualizado: 2026-05-12 — `/novo-marco v1.28` iniciado*

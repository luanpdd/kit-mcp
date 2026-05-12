# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

### v1.28 — UX & Onboarding (kit-mcp developer experience)

**Iniciado:** 2026-05-12. **Modo execução:** totalmente autônomo. **10 fases, 40 REQs.**

**Objetivo:** Eliminar opacidade do servidor MCP stdio e reduzir TTFU. Adições UX-only, zero breaking changes na Stable API v1.0+.

#### Wave 1 — Visibilidade imediata (resolve dor reportada)

| # | Fase | Effort | Plans | Status |
|---|---|---|---|---|
| 156 | README diagrama 2 fluxos + tabela "quando uso o quê" | XS | 1 | pending |
| 157 | Sidecar UI auto-spawn ON por padrão (`KIT_MCP_NO_UI=1` escape) | S | 1 | pending |
| 158 | Log file rotativo `~/.kit-mcp/logs/` + `kit logs --tail` | S | 2 | pending |
| 159 | `kit doctor` — health check completo | M | 2 | pending |

#### Wave 2 — Onboarding fluido

| # | Fase | Effort | Plans | Status |
|---|---|---|---|---|
| 160 | `kit sync` progress bar + diff sumário | S | 1 | pending |
| 161 | `kit init` onboarding interativo | M | 2 | pending |
| 162 | `kit status` — metrics-snapshot CLI | S | 1 | pending |

#### Wave 3 — Power user dev tools

| # | Fase | Effort | Plans | Status |
|---|---|---|---|---|
| 163 | `kit mcp --inspect` TUI dev mode (request/response live) | M | 2 | pending |
| 164 | Notification on tool call (opt-in, throttled) | S | 1 | pending |
| 165 | `kit replay <id>` — reexecutar tool call para debug | M | 2 | pending |

**Princípios de execução:**
- P1 — Spec MCP intocável (stdout JSON-RPC puro)
- P2 — Zero breaking changes (Stable API v1.0+)
- P3 — Sem deps novas críticas
- P4 — Cross-platform (Windows/macOS/Linux paridade)
- P5 — Observabilidade local-first (zero telemetria remota implícita)

## Próximo milestone: v1.29 (a definir — backlog v1.27)

Candidatos remanescentes:
- Supabase Vault (encryption at rest) — proteção em repouso para PII columns
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills)
- Outros Auth Hooks (Send Email, Send SMS, MFA Verification, Password Verification, Before User Created)
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Realtime authorization patterns avançados
- Terraform provider (alternativa IaC ao GitHub branching)
- SOC 2 compliance específico

## Arquivados

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

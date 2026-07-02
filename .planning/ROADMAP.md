# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.
> Reconciliado em 2026-07-01 (DIR-02): as releases v1.30→v1.45 foram shippadas por PR direto,
> fora do fluxo de fases do framework — registro 1-linha-por-release em `.planning/MILESTONES.md`;
> versões canônicas em `CHANGELOG.md`.

## Em andamento

(nada — v1.45.0 shipped em 2026-07-01; posição atual: entre milestones)

## Próximo milestone

**A definir — ver `.planning/DIRECTION.md`** (gerado em 2026-07-01: 6 direções priorizadas por
leverage — DIR-01 e DIR-02 P0, DIR-03/DIR-04/DIR-05 P1, DIR-06 P2).

## Backlog

Candidatos herdados do antigo "Próximo milestone: v1.30 (a definir)" — reavaliados em 2026-07-01:

- ~~Embeddings + semantic dispatch (`kit:dispatch <intent>`)~~ — **superseded**: `/fazer` (roteador
  de texto livre) + router bundle-aware (v1.41) cobrem o caso de uso sem custo de embeddings
  (ver `.planning/DIRECTION.md`, "Considerado e rejeitado"; só reabrir com evidência de falha de
  roteamento em escala).
- Supabase Vault (encryption at rest)
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills)
- Outros Auth Hooks (Send Email, Send SMS, MFA Verification, Password Verification, Before User Created)
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Terraform provider (alternativa IaC ao GitHub branching)
- SOC 2 compliance específico

## Arquivados

Shipped fora do fluxo de fases (v1.30→v1.45 — detalhe em `.planning/MILESTONES.md` + `CHANGELOG.md`):

- **v1.45 — Comando `/base` (registro canônico PROJETOS.md)** (shipped 2026-07-01) → tag v1.45.0 (inclui patch v1.44.1)
- **v1.44 — Absorção do shadcn/improve** (shipped 2026-06-23): advisor-auditor, diff-auditor, direction-prospector, `/auditar`, `/prospectar-direcao`, `/reconciliar`, PLAN.md hermético → tag v1.44.0
- **v1.42–v1.43 — commit-pr-conductor + 8 agents da auditoria do kit** (shipped 2026-06-19): sem entries no CHANGELOG; fonte git log → tags v1.42.0/v1.43.0
- **v1.39–v1.41 — Content Packs Fases 1-3 + consciência de custo** (shipped 2026-06-13→14): 6 packs, lockfile, `kit pack`, cost_tier, gate resource-frontmatter → tags v1.39.0/v1.40.0/v1.41.0
- **v1.38 — Google Antigravity 2.0** (shipped 2026-06-13): target antigravity IDE+CLI; remove gemini-cli → tag v1.38.0
- **v1.34–v1.37 — Dynamic Workflows + Workflow Generator + Cost Tracking Suite** (shipped 2026-06-05): capability workflows, gerador com 6 patterns + hardening, 5 MCP tools cost-* + CLI + statusline (Phase 172) → tag v1.37.0 (1.34-1.36 sem tag; CHANGELOG)
- **v1.30–v1.33 — Edge Functions 2026 + density/routing + auth Supabase + design UI** (shipped 2026-05-13→25) → tags v1.30.0-v1.33.0

Shipped dentro do fluxo de fases:

- **v1.29 — MCP-Native Discovery via Auto-Sync** (shipped 2026-05-12): 6 phases (166-171), 25 REQs — roots capability, tool `auto-install`, restart signal, resources, doctor drift check → tag [v1.29.0](https://github.com/luanpdd/kit-mcp/releases/tag/v1.29.0)
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
*Atualizado: 2026-07-01 — reconcile DIR-02 (dogfooding: `.planning/` alinhado à realidade v1.45.0)*

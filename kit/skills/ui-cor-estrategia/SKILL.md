---
name: ui-cor-estrategia
description: Use ao definir paleta ou auditar cor — split 60/30/10 (superficie/secundaria/destaque), destaque so em listados, OKLCH em vez de HSL/HEX, WCAG AA 4.5:1, sem paleta padrao IA, dark via tokens.
---

# UI — Estratégia de Cor

## Quando usar

LLM carrega esta skill quando:

- "Que cor usar para CTA / link / button"
- "Definir paleta / color tokens"
- "Audit cor / muito colorido / parece genérico"
- "Adicionar dark mode"
- Preenchendo seção **Cores** de DESIGN.md
- Editando `globals.css :root` ou `tailwind.config` colors

## Regras absolutas

**REGRA #1 (split 60/30/10):** Superfície dominante 60%, secundária 30%, destaque 10%. Mais que 10% de destaque = ruído, sinal perde força.

**REGRA #2 (lista de reserva do destaque):** A cor de destaque vai a uma lista DECLARADA de elementos. Ex: "destaque = apenas CTA primário + link de nav ativo". Tudo fora da lista vira superfície ou foreground neutro.

**REGRA #3 (OKLCH preferido):** Novos tokens em `oklch()`. Lightness é perceptualmente linear (HSL não é), o que torna dark mode + variants automáticos. HEX só em integrações legacy.

**REGRA #4 (AA 4.5:1 mínimo):** Contraste body em superfície ≥ 4.5:1. UI controls + interactive ≥ 3:1 (AA non-text). AAA opcional mas declare em MARCA.md.

**REGRA #5 (semântico ≠ paleta):** Tokens são semânticos (`--primary`, `--destructive`, `--muted`), não nome de cor (`--blue-500`). Trocar paleta = mudar 1 lugar.

## Estrutura canônica de tokens

```css
:root {
  /* ─── Stack de superfície (60%) ─── */
  --background: oklch(0.99 0 0);           /* canvas */
  --card:       oklch(0.99 0 0);           /* alias to background */
  --popover:    oklch(0.99 0 0);

  /* ─── Foreground & secundária (30%) ─── */
  --foreground: oklch(0.18 0 0);           /* body text on background */
  --muted:      oklch(0.94 0.005 240);     /* superfície secundária */
  --muted-foreground: oklch(0.45 0 0);     /* caption, helper text */
  --border:     oklch(0.90 0 0);
  --input:      oklch(0.90 0 0);
  --ring:       oklch(0.55 0.18 28);       /* matches primary, focus ring */

  /* ─── Destaque (10%) ─── */
  --primary:    oklch(0.55 0.18 28);       /* THE brand color */
  --primary-foreground: oklch(0.99 0 0);

  /* ─── Semântico ─── */
  --destructive: oklch(0.55 0.22 25);       /* red-ish, irreversível */
  --destructive-foreground: oklch(0.99 0 0);

  /* ─── Opcional: success/warning ───
   * Use com parcimônia. Sucesso/aviso são UX patterns,
   * não brand. Use cor apenas quando ícone+texto não bastarem.
   */
}

.dark {
  --background: oklch(0.14 0 0);
  --card:       oklch(0.16 0 0);            /* slight lift */
  --foreground: oklch(0.96 0 0);
  --muted:      oklch(0.20 0.005 240);
  --muted-foreground: oklch(0.65 0 0);
  --border:     oklch(0.24 0 0);
  --primary:    oklch(0.65 0.15 28);        /* shift saturation down + L up */
}
```

## Lista de reserva do destaque — patterns

Em DESIGN.md > Cores, declare a lista EXATA:

```markdown
## Cores
- Destaque (10%) — `--primary` — reservada para:
  - CTA primário (exatamente um por tela)
  - Underline de link de nav ativo
  - Estado selecionado de toggle/tab
  - Focus ring em inputs (via `--ring`)
  - Logo da marca
- Destrutiva — `--destructive` — reservada para:
  - Botão de confirmação final "Deletar X"
  - Variante destrutiva de toast
```

Tudo FORA dessa lista usa `--foreground` ou `--muted-foreground`. Inclui:

- Botões secundários → `bg-secondary` (= `--muted`) + `text-foreground`
- Ícones de UI geral → `text-muted-foreground`
- Links em prose → `text-foreground underline` (não destaque)
- Badges decorativos → `bg-muted text-muted-foreground`

## Padrões anti-rainbow

Em produto (não marca), use **monocromático + 1 destaque**:
- Stack de superfície: 4 tons neutros (background, card lift, muted, border)
- Stack de foreground: 2 tons (foreground, muted-foreground)
- Destaque: 1 cor única + sua foreground complementar

Total: ~8 tokens distintos. Paleta rainbow (10+ cores) é sinal de tell T09.

## Status colors — usar com parcimônia

```css
/* SOMENTE se ícone + label não bastarem */
--success: oklch(0.55 0.15 145);      /* green */
--warning: oklch(0.75 0.15 75);       /* amber, não yellow saturado */
--info:    oklch(0.55 0.15 240);      /* blue */
```

Status colors quebram o split 60/30/10. Use só em:
- Toast variants (feedback nível sistema)
- Form inline validation (ícone + label é primário, cor é reforço)

NÃO use status colors em:
- Card backgrounds para "tipo de item" (vira card com borda lateral colorida T05)
- Texto em botão para indicar significado (texto faz isso)

## Verificação de contraste

```bash
# tooling local
npx pa11y http://localhost:3000 --standard WCAG2AA

# CSS-only check em dev: outline elements abaixo de 4.5:1
# (snippet em CLAUDE.md ou globals.css dev)
```

Mínimos:
- `--foreground` em `--background`: ≥ 4.5:1
- `--muted-foreground` em `--background`: ≥ 4.5:1 (ela é caption mas é texto)
- `--primary-foreground` em `--primary`: ≥ 4.5:1
- Buttons disabled state: ≥ 3:1 (UI control non-text)

Combo failing comum: `text-gray-400` em `bg-gray-100` → ~3.2:1, AA fail.

## Anti-patterns

### Anti-pattern 1: paleta IA padrão (roxo + mint + amarelo + gray)

**Errado:**
```css
--primary: #6366F1;    /* indigo */
--secondary: #10B981;  /* mint */
--accent: #FBBF24;     /* yellow */
--neutral: #64748B;    /* slate */
```

**Por quê:** T09 — esta é a paleta que aparece em Lovable, v0, Bolt, Replit default. Cliente identifica instantaneamente.

**Certo:** derive de MARCA.md anti-referência. Se anti-ref é "Lovable default", adote monocromático + 1 destaque warm (terra cota, ocre, ferrugem) OU 1 destaque cool fora do espectro indigo (ciano profundo, verde-azulado oxidado).

### Anti-pattern 2: usar HEX em token novo

**Errado:** `--primary: #4F46E5;`

**Por quê:** REGRA #3 — HSL/HEX não são perceptualmente uniformes. Lightness não corresponde a brilho percebido. Dark mode + states (hover/active) viram tentativa-e-erro.

**Certo:** `--primary: oklch(0.55 0.18 270);` — agora `oklch(0.45 ...)` é "mais escuro de forma percebida".

### Anti-pattern 3: rainbow status no dashboard

**Errado:** cada card de stats com cor diferente — sales verde, churn vermelho, revenue azul, MRR roxo.

**Por quê:** REGRA #1 quebrada — 4 destaques em 1 tela = caos. Sinal perde força.

**Certo:** todos os números em foreground neutro. Apenas o número "preocupante" (churn alto) ganha destructive color. Tendências (up/down) via ícone arrow + sinal +/−, não cor.

### Anti-pattern 4: dark mode duplicando tokens

**Errado:**
```css
:root.dark {
  --primary-dark: #818CF8;
  --background-dark: #0F172A;
}
/* uso: bg-[var(--primary-dark)] em .dark, manual */
```

**Por quê:** REGRA #5 — tokens devem ser semânticos. `--primary` muda valor entre `:root` e `.dark`, não nome. Senão toda regra de CSS precisa branch.

**Certo:**
```css
:root      { --primary: oklch(0.55 0.18 28); }
.dark      { --primary: oklch(0.65 0.15 28); }
/* uso único: bg-[var(--primary)] sempre */
```

### Anti-pattern 5: destaque em link de body

**Errado:**
```tsx
<p>Leia mais em nossa <a className="text-primary">documentação</a></p>
```

**Por quê:** REGRA #2 — destaque reservado a CTA primário. Espalhado em prose vira ruído + dilui sinal de "esta é A ação".

**Certo:**
```tsx
<p>Leia mais em nossa <a className="text-foreground underline underline-offset-4 hover:text-primary">documentação</a></p>
```
Hover pode revelar destaque, default fica no foreground.

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — T01 (gradiente roxo), T05 (card borda lateral), T09 (paleta IA), Q04 (contraste baixo)
- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — seção Cores do DESIGN.md
- [ui-tipografia](../ui-tipografia/SKILL.md) — hierarquia usa peso + cor
- OKLCH playground: https://oklch.com/

---
name: ui-anti-padroes-ia
cost_tier: leve
description: Detecta 18 anti-padroes de UI gerada por IA (tells + qualidade) com greps CI-friendly. Use ao gerar ou revisar UI — zero P0 antes do ship. Verifica gradiente, monocultura, touch <44px e contraste.
---

# UI — Anti-padrões IA

## Quando usar

LLM carrega esta skill quando:

- "Gerar componente / página / layout" (preventivo)
- "Esse design parece gerado por IA" / "tem cara de Lovable / Bolt / v0 / Replit"
- "Audite design / verifique tells / detect anti-patterns"
- "Faça crítica ou auditoria"
- Antes de declarar feature de UI pronta

## Regras absolutas

**REGRA #1 (zero P0 antes do ship):** Itens marcados P0 abaixo são deal-breakers. Nenhuma feature merge sem todos os P0 zerados ou justificados em DESIGN.md > Faça/Não faça como override consciente.

**REGRA #2 (determinístico primeiro):** Anti-pattern só vira regra desta skill se for grepável. Subjetivos vão para [ui-critica-auditoria](../ui-critica-auditoria/SKILL.md).

**REGRA #3 (contexto marca vs produto):** Algumas regras suavizam em marca (gradiente sutil ok), endurecem em produto (zero gradiente). Sempre cite o registro ao classificar.

## Catálogo — Tells-IA (deal-breakers)

### T01 — Gradientes roxo/violeta (P0)

**Tell:** Hero ou CTA com gradiente roxo→rosa, ou roxo→azul. Marca registrada de defaults de modelos 2023-2024.

```bash
grep -rnE "from-(purple|violet|indigo|fuchsia)-[0-9]+ +to-(purple|violet|indigo|pink|fuchsia)-|bg-gradient-to-[a-z]+ +from-(purple|violet)" src 2>/dev/null
```

Fix: troque por destaque sólido único OU gradiente brand-específico em duas cores warm/neutras (nunca purple→pink).

### T02 — Texto com gradiente (P0)

**Tell:** Heading com `bg-clip-text text-transparent` + gradiente.

```bash
grep -rnE "bg-clip-text.*text-transparent|background-clip:\s*text" src 2>/dev/null
```

Fix: texto sólido em foreground. Se quer ênfase, peso + tamanho, nunca gradiente.

### T03 — Hero com display italic-serif (P0)

**Tell:** `<h1>` em italic + serif gigante. "Build *beautiful* products".

```bash
grep -rnE "<h1[^>]*\b(italic|font-serif)\b[^>]*>" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

Fix: display em grotesk ou regular serif (não italic). Italic só em palavra-chave inline pontual, não 100% do heading.

### T04 — Rótulo uppercase decorativo acima do hero (P0)

**Tell:** "NEW FEATURE • SHIPPED" — chip pequeno uppercase + tracking-wider acima do H1.

```bash
grep -rnE "uppercase.*tracking-(wider|widest)|text-xs.*uppercase.*tracking" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

Fix: remova. Se tem realmente um anúncio, use banner topo de página ou badge inline pequeno, não decorativo acima do heading.

### T05 — Card com borda lateral colorida (P0)

**Tell:** Card com `border-l-4 border-blue-500 bg-blue-50`. Visual de "tab indicator" em todo card.

```bash
grep -rnE "border-l-[2-8].*bg-(blue|green|yellow|red|purple)-(50|100)" src 2>/dev/null
```

Fix: remova a borda lateral. Se realmente precisa categorizar, use badge de cor ou ícone, não barra vertical.

### T06 — Card aninhado (P1)

**Tell:** Card dentro de card. `<Card><Card>...</Card></Card>` ou seção inteira embrulhada em card só porque "fica organizado".

```bash
grep -rln "<Card" src --include="*.tsx" 2>/dev/null | while read f; do
  count=$(grep -c "<Card" "$f")
  [ "$count" -gt 3 ] && echo "$f: $count Card refs"
done
```

Fix: cards são para itens discretos em lista. Section containers usam padding + border-top divider, nunca card.

### T07 — Monocultura Inter (P1)

**Tell:** Inter como única fonte do projeto.

```bash
grep -rE "font-family.*Inter|font-Inter|--font.*Inter" src --include="*.css" --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
```

Fix: combine pelo menos display + body distintos. Display em Söhne, Söhne Breit, Roobert, Inter Display (variante!), Avenir, ou um humanist serif. Inter pode ficar só no body se inevitável.

### T08 — Monocultura de fontes saturadas (P1)

**Tell:** projeto adota uma das fontes "saturadas 2024-2026" como display:

```bash
grep -rohE "(Fraunces|Geist|Mona Sans|Plus Jakarta Sans|Space Grotesk|Recoleta|Instrument Sans)" \
  src --include="*.ts*" --include="*.css" 2>/dev/null | sort | uniq -c
```

Fix: use foundry independente (Klim, Pangram, Grilli, Lineto, Commercial Type, ABC Dinamo) ou pareça com a personalidade do MARCA.md.

### T09 — Paleta IA genérica (P1)

**Tell:** roxo + verde mint + amarelo claro + cinza neutro. A "paleta padrão de IA".

Sinal: olhar `tailwind.config.*` `globals.css` por paleta OKLCH com cromaticidade muito uniforme em ~5-6 cores. Heurística humana — esta regra **não** é puramente grepável, mas o ponto de partida é:

```bash
grep -rnE "oklch\([^)]+\)" src --include="*.css" 2>/dev/null | wc -l
```

Se > 30 cores definidas com chroma similar, suspeitar.

Fix: derive paleta de ANTI-REFERÊNCIA em MARCA.md. Ex: "parece com Lovable default" → adotar paleta editorial monocromática + 1 destaque.

### T10 — Stack glassmorphism (P1)

**Tell:** múltiplas camadas de `backdrop-blur` + `bg-white/10` + `border-white/20`. Volta dos mortos do iOS 7.

```bash
grep -rnE "backdrop-blur.*bg-(white|black)/[0-9]+.*border-(white|black)/" src 2>/dev/null
```

Fix: max 1 camada com backdrop-blur (header sticky talvez). Senão, superfície sólida.

## Catálogo — Qualidade (regardless of source)

### Q01 — Touch targets < 44px (P0 a11y)

```bash
grep -rnE "(h-[1-9]|size-[1-9])\b[^0-9].*onClick|button.*h-[1-9]\b" src --include="*.tsx" 2>/dev/null
```

Min 44×44 px (≈ `h-11 w-11` em Tailwind base 4px). Apertado em produto ok mas nunca < 44.

### Q02 — Body flush ao viewport edge (P0)

```bash
grep -rnE "main[^>]*p-0|<body[^>]*p-0|class=[\"'][^\"']*(px-0)\b" src 2>/dev/null
```

Fix: sempre `px-4` (mobile) → `px-6` (tablet) → `px-8` (desktop) no min. Texto encostando viewport = sem ar para respirar.

### Q03 — Cores hard-coded (P1)

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(" \
  src --include="*.tsx" --include="*.jsx" 2>/dev/null | \
  grep -vE "var\(--|tw-|theme\("
```

Fix: substitua por token (`text-foreground`, `bg-primary`, `border-border`). Aceitável apenas em SVG ilustrativo.

### Q04 — Botão estilizado com contraste baixo (P0 a11y)

Custom `<button>` com `bg-*-300` + `text-white` ou `bg-*-200` + `text-*-400`. Falha 4.5:1.

```bash
grep -rnE "<button[^>]*bg-[a-z]+-([1-3]00)\b" src --include="*.tsx" 2>/dev/null
```

Fix: use shadcn variants (`default`, `secondary`, `destructive`) que já passam contraste, ou rode contraste com `npx pa11y` localmente.

### Q05 — Anchor com herança silenciosa (P1)

`<a>` sem cor explícita, herda do parent. Em `text-muted-foreground` parent → link visível como texto normal.

```bash
grep -rn "<a " src --include="*.tsx" 2>/dev/null | grep -v "className"
```

Fix: todo `<a>` em conteúdo tem `text-primary underline-offset-4 hover:underline` ou similar.

### Q06 — Padding cramped (P1)

`p-1`, `p-2`, `px-2 py-1` em botão importante. Cramped em interactive = hit area pequena + densidade desconfortável.

```bash
grep -rnE "<button[^>]*\bp[xy]?-(1|2)\b|<Button[^>]*\bp[xy]?-(1|2)\b" src --include="*.tsx" 2>/dev/null
```

Fix: min `px-4 py-2` em botões; `px-3 py-1.5` só em badges/chips.

### Q07 — Pular nível de heading (h1 → h3) (P1 a11y)

Pula nível semântico, screen reader perde hierarquia.

```bash
grep -rn "<h1\|<h2\|<h3\|<h4" src --include="*.tsx" 2>/dev/null
# Inspecionar por seção
```

Fix: sequência h1 → h2 → h3. Se quer "small heading" use h{N+1} com style, não jumpar nível.

### Q08 — Bounce easing (P1)

`ease-bounce`, `cubic-bezier(0.68, -0.55, 0.265, 1.55)`. Motion playful em produto = pouco profissional.

```bash
grep -rnE "bounce|cubic-bezier\(0\.68" src --include="*.css" --include="*.tsx" 2>/dev/null
```

Fix: `ease-out` ou `ease-[cubic-bezier(0.2,0.8,0.2,1)]` para interactions. Bounce só em onboarding/celebration moment justificado.

## Tabela de severidade

| Código | Anti-pattern | Categoria | Severidade | Override por registro |
|------|--------------|----------|----------|-------------------|
| T01 | Gradiente roxo | Tells-IA | P0 | Marca pode aceitar gradiente 2 cores warm |
| T02 | Texto gradiente | Tells-IA | P0 | Nunca |
| T03 | Italic serif H1 | Tells-IA | P0 | Marca editorial pode (1 keyword inline) |
| T04 | Rótulo uppercase decorativo | Tells-IA | P0 | Nunca |
| T05 | Card borda lateral | Tells-IA | P0 | Nunca |
| T06 | Card aninhado | Tells-IA | P1 | — |
| T07 | Monocultura Inter | Tells-IA | P1 | Produto corp pode (mas combine display) |
| T08 | Fonte saturada | Tells-IA | P1 | — |
| T09 | Paleta IA genérica | Tells-IA | P1 | — |
| T10 | Glassmorphism | Tells-IA | P1 | Marca pode 1 camada |
| Q01 | Touch < 44px | Qualidade | P0 | Nunca |
| Q02 | Edge flush | Qualidade | P0 | Nunca |
| Q03 | Cor hard-coded | Qualidade | P1 | Aceitável em SVG decorativo |
| Q04 | Botão contraste baixo | Qualidade | P0 | Nunca |
| Q05 | Anchor herança | Qualidade | P1 | — |
| Q06 | Padding cramped | Qualidade | P1 | Produto density-heavy pode menor |
| Q07 | Pular heading | Qualidade | P1 | Nunca |
| Q08 | Bounce easing | Qualidade | P1 | Onboarding/celebration ok |

## Anti-patterns DESTA skill

### Anti-pattern 1: usar como linter cego

**Errado:** rodar grep e auto-corrigir tudo P0/P1 sem ler contexto.

**Por quê:** parceiro opinativo, não validator. Override consciente em DESIGN.md > Faça/Não faça é legítimo. Paleta IA pode ser intencional se MARCA.md anti-referência disser explicitamente "embrace genérico-de-propósito".

**Certo:** Rode detector → apresente findings → discuta com user antes de patches automáticos. Cada P0 ignorado precisa entry em DESIGN.md justificando.

### Anti-pattern 2: declarar pronto sem rodar detector

**Errado:** "Feature implementada e revisada". Mas grep T01 retorna 3 hits.

**Por quê:** REGRA #1 — zero P0 antes de ship. Tells de IA são caros de remover depois (cliente já viu).

**Certo:** Detector é último passo antes de commit final. Cole a output do varredor no PR description.

## Ver também

- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — Regras (Faça/Não faça) vivem aqui após override
- [ui-critica-auditoria](../ui-critica-auditoria/SKILL.md) — camada subjetiva (Nielsen, carga cognitiva)
- [ui-tipografia](../ui-tipografia/SKILL.md) — regras tipográficas detalhadas
- [ui-cor-estrategia](../ui-cor-estrategia/SKILL.md) — regras de cor detalhadas

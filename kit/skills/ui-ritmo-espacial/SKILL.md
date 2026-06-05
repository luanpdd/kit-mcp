---
name: ui-ritmo-espacial
description: Use ao definir spacing/padding/grid — escala base 4 (4/8/16/24/32/48/64/96), alinhamento optico != matematico, breathing room no viewport edge, sem arbitrary [13px] nem padding cramped.
---

# UI — Ritmo Espacial

## Quando usar

LLM carrega esta skill quando:

- "Espaçamento parece estranho / cramped / inconsistente"
- "Alinhar elementos / grid / layout"
- "Padding em botão / card / dialog"
- "Container width / max-width"
- "Optical alignment" / "está 1px off"
- Preenchendo seção **Componentes** com spacing rules

## Regras absolutas

**REGRA #1 (escala base-4):** Spacing apenas em múltiplos de 4. Permitidos: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`. **Proibidos:** valores arbitrários `[13px]`, `[27px]`, `[1.7rem]`. Se você precisa de um, problema é de escala não documentada.

**REGRA #2 (3 níveis de densidade):**
- **Densa** (`gap-1`/`p-2`/`px-3`): tables, data grids, command palettes
- **Padrão** (`gap-4`/`p-4`/`px-6`): cards, forms, sections
- **Generosa** (`gap-8`/`p-8`/`px-12`): heroes, marketing, empty states

Misturar densa + generosa na mesma seção = ritmo quebrado.

**REGRA #3 (no edge flush):** Texto e UI sempre com padding lateral mínimo `px-4` (mobile) → `px-6` (tablet) → `px-8` (desktop). Conteúdo nunca encosta na viewport.

**REGRA #4 (container width em ch):** Containers de texto têm `max-width` em `ch` unit (50-75ch body). Container de UI em `max-w-7xl` (1280px) ou `max-w-5xl` (1024px) padrão.

**REGRA #5 (alinhamento óptico):** Ícones e glifos têm bounding box que ≠ shape óptico. Centralização matemática vê desalinhada. Compense: setas/triângulos shift -1 ou -2 px na direção oposta da ponta. Texto + ícone vertical alinha pela `cap-height`, não pela baseline.

## Escala canônica

```js
// tailwind.config.js — restrinja explicit, esconda o resto
module.exports = {
  theme: {
    spacing: {
      '0': '0',
      'px': '1px',
      '0.5': '2px',  // só para borders/dividers
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '5': '20px',
      '6': '24px',
      '8': '32px',
      '10': '40px',
      '12': '48px',
      '16': '64px',
      '20': '80px',
      '24': '96px',
      '32': '128px',
    }
  }
}
```

Não inclua `7`, `9`, `11`, `14`, etc — força escolha de uma escala vizinha em vez de "tô em dúvida, vou de meio termo".

## Patterns canônicos

### Padding interno por componente

| Componente | Padding | Notas |
|------------|---------|-------|
| Button (padrão) | `px-4 py-2` (h-10) | min 44px touch target |
| Button (sm) | `px-3 py-1.5` (h-9) | minimum, densidade-tight |
| Button (lg) | `px-6 py-3` (h-12) | CTA hero |
| Input | `px-3 py-2` (h-10) | espaço para focus ring outside |
| Card (padrão) | `p-6` | conteúdo respira |
| Card (denso) | `p-4` | em lista de muitos |
| Dialog | `p-6` (mobile) / `p-8` (desktop) | conteúdo central |
| Badge / Chip | `px-2 py-0.5` | exceção à base-4, ok |
| Section (vertical) | `py-16` (mobile) / `py-24` (desktop) | hero/marketing |
| Section (vertical, produto) | `py-8` / `py-12` | denso |

### Container patterns

```tsx
// Layout shell
<div className="min-h-screen">
  <header className="border-b">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center">
      {/* nav */}
    </div>
  </header>

  <main>
    {/* Marketing section */}
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <h1 className="max-w-[18ch] text-balance text-6xl">…</h1>
      <p className="max-w-[50ch] mt-6 text-lg text-muted-foreground">…</p>
    </section>

    {/* Produto dashboard */}
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">…</div>
    </section>

    {/* Prose article */}
    <article className="mx-auto max-w-prose px-4 sm:px-6 py-12">
      {/* max-w-prose = 65ch */}
    </article>
  </main>
</div>
```

### Ritmo vertical em prose

```tsx
<article className="prose">
  <h1 className="mb-8">…</h1>        {/* h1 + spacing maior abaixo */}
  <h2 className="mt-12 mb-4">…</h2>  {/* h2 separa seções */}
  <p className="mb-4 leading-7">…</p>{/* p body */}
  <ul className="my-4 space-y-2">…</ul>
</article>
```

Regra: spacing acima de heading > spacing abaixo. Senão heading "flutua" no meio.

### Alinhamento óptico

```tsx
// Texto + ícone: align pelo center vertical, não baseline
<button className="inline-flex items-center gap-2">
  <ArrowRight className="size-4 -translate-y-px" />  {/* -1px opcional para cap-height match */}
  <span>Próximo</span>
</button>

// Heading + ícone decorativo: ícone alinha pelo x-height, não top
<h2 className="flex items-baseline gap-2">
  <Sparkles className="size-5 translate-y-1" />  {/* push down to baseline-ish */}
  <span>Feature</span>
</h2>

// Pill button: padding horizontal mais leve que vertical estaria — compense
<button className="rounded-full px-4 py-2">  {/* px-4 não px-3 — pill rouba H */}
  Ação
</button>
```

## Anti-patterns

### Anti-pattern 1: arbitrary values salpicados

**Errado:**
```tsx
<div className="p-[13px] mt-[27px] gap-[18px]">…</div>
```

**Por quê:** REGRA #1 — escala se desfaz. Outro dev vê `13px` e adiciona `15px` ao lado. Em 6 meses ninguém sabe o que é "spacing default".

**Certo:** `p-3 mt-6 gap-4` (12/24/16, todos na escala). Se realmente precisa de um valor fora, adicione ao theme em vez de inline.

### Anti-pattern 2: padding cramped em interactive

**Errado:** `<button className="px-2 py-1">Salvar</button>`

**Por quê:** Q06 — touch hit area pequena + densidade desconfortável. Botão difícil de clicar.

**Certo:** `px-4 py-2` mínimo. Botão denso `px-3 py-1.5` apenas em toolbar.

### Anti-pattern 3: section sem padding lateral em mobile

**Errado:**
```tsx
<section className="max-w-7xl mx-auto py-16">
  <h1 className="text-4xl">Title</h1>  {/* encosta na borda em mobile */}
</section>
```

**Por quê:** REGRA #3 — texto sem ar para respirar + acessibilidade em landscape narrow.

**Certo:**
```tsx
<section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
```

### Anti-pattern 4: hero text sem max-width

**Errado:**
```tsx
<h1 className="text-6xl">Build amazing products with our platform today</h1>
```

**Por quê:** REGRA #4 — line-length destruído em widescreen, leitura interrompida.

**Certo:**
```tsx
<h1 className="text-6xl max-w-[18ch] text-balance leading-tight">
  Build amazing products
</h1>
```

### Anti-pattern 5: misturar densidades sem motivo

**Errado:**
```tsx
<Card className="p-2">  {/* densa */}
  <CardHeader className="p-8">  {/* generosa */}
    <CardTitle>...</CardTitle>
  </CardHeader>
  <CardContent className="p-4">  {/* padrão */}
    ...
  </CardContent>
</Card>
```

**Por quê:** REGRA #2 — ritmo quebrado, agente IA depois não sabe qual densidade replicar.

**Certo:** uma densidade por componente. Card denso = todo o card `p-4` máximo. Card padrão = todo o card `p-6`.

### Anti-pattern 6: alinhar centro com texto

**Errado:**
```tsx
<div className="flex items-center">
  <Icon />
  <h2>Heading</h2>
</div>
```

Pixel-perfect: ícone tem `cap-height` diferente do texto.

**Certo:**
```tsx
<div className="flex items-baseline gap-2">  {/* ou items-center + ícone -translate-y-px */}
  <Icon className="translate-y-0.5" />
  <h2>Heading</h2>
</div>
```

## Detecção

```bash
# Arbitrary spacing values
grep -rnE "(p|m|gap|space)-(x|y)?-\[[0-9]+(px|rem)\]" src --include="*.tsx" 2>/dev/null

# Edge flush
grep -rnE "max-w-7xl.*mx-auto.*py-" src --include="*.tsx" 2>/dev/null | grep -v "px-"

# Botão cramped
grep -rnE "<(button|Button)[^>]*\bp[xy]?-(1|2)\b" src --include="*.tsx" 2>/dev/null

# Hero sem max-w em ch
grep -rnE "text-(5xl|6xl|7xl|8xl|9xl)" src --include="*.tsx" 2>/dev/null | grep -v "max-w-\["
```

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — Q02 (edge flush), Q06 (padding cramped)
- [ui-tipografia](../ui-tipografia/SKILL.md) — line-length em ch
- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — escala vai em DESIGN.json

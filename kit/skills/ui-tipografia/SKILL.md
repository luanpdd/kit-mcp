---
name: ui-tipografia
description: Use ao escolher fontes, tamanhos, pesos ou hierarquia tipográfica — sistema canônico Display + Body + Mono distintos (sem monocultura Inter), max 4 tamanhos × 2 pesos, line-height 1.5 body / 1.2 heading, line-length 50-75ch body / 30-50ch hero, banidas Fraunces/Geist/Mona Sans/Plus Jakarta Sans/Space Grotesk/Recoleta/Instrument Sans em produto novo (fontes saturadas no default IA).
---

# UI — Tipografia

## Quando usar

LLM carrega esta skill quando:

- "Que fonte uso?" / "Escolher tipografia"
- "Hierarquia tipográfica" / "type scale"
- "Heading parece genérico" / "tipo parece acidental"
- Preenchendo seção **Tipografia** de DESIGN.md
- Editando `tailwind.config.*` font tokens

## Regras absolutas

**REGRA #1 (3 famílias distintas):** Sistema canônico tem **display + body + mono**, três tipos visualmente distintos. Inter como todas as três = monocultura (T07).

**REGRA #2 (max 4 sizes × 2 weights):** Exatamente 3-4 tamanhos em uso ativo, máximo 2 pesos. Se você precisa de mais, há um problema de hierarquia, não de escala tipográfica.

**REGRA #3 (line-length real):** Body 50-75 chars per line. Hero 30-50 chars. Container width = `ch` unit, não pixel. Texto que estica viewport inteira = ilegível.

**REGRA #4 (line-height por contexto):** Body 1.5, headings 1.2, mono/code 1.4. Não 1.6 "para respirar" (afrouxa demais).

**REGRA #5 (defaults banidos em produto novo):** Fraunces, Geist, Mona Sans, Plus Jakarta Sans, Space Grotesk, Recoleta, Instrument Sans — saturadas no default IA. Use só com justificativa em MARCA.md (ex: "Geist intencional para match com infra cloud space").

## Escala canônica

### Type scale (em px, base 16)

| Nome | px | uso |
|------|----|----|
| `xs` | 12 | Microcopy, labels secundárias, badges |
| `sm` | 14 | UI controls, table cells, dense lists |
| `base` | 16 | Body padrão, paragraphs |
| `lg` | 20 | Lead paragraph, dialog title |
| `xl` | 24 | h3 |
| `2xl` | 32 | h2 |
| `4xl` | 48 | h1 (produto) |
| `6xl` | 72 | h1 (hero marca) |

**Use 3-4 destas em ativo.** Esconda o resto do Tailwind via `fontSize` override no config.

### Pesos

Apenas 2 pesos por família:
- **Body:** `400` (regular) + `600` (semibold para emphasis)
- **Display:** `400` (regular) + `700` (bold) OU peso único caracteristicamente forte

Pesos proibidos sem justificativa: `300` (light), `100` (thin) — fica frágil em LCD comum + baixa legibilidade.

### Line-height

```css
--lh-tight: 1.1;    /* hero 6xl+ */
--lh-heading: 1.2;  /* h1, h2 */
--lh-snug: 1.35;    /* lg lead */
--lh-body: 1.5;     /* base body */
--lh-mono: 1.4;     /* code */
```

### Line-length

```css
.prose { max-width: 65ch; }      /* body content */
.hero { max-width: 18ch; }       /* big heading */
.lead { max-width: 50ch; }       /* large intro paragraph */
```

`ch` unit > pixel para textos. Em mono use `30em`.

## Pareamentos canônicos (com nome próprio)

### Marca editorial
- Display: **GT Sectra** (Grilli Type) ou **Söhne Breit** (Klim)
- Body: **Söhne** (Klim) ou **Inter Display**
- Mono: **JetBrains Mono** ou **Berkeley Mono**

### Produto calm/clinical
- Display: **Söhne Breit** (Klim) ou **ABC Diatype** (Dinamo)
- Body: **Söhne** ou **ABC Diatype**
- Mono: **JetBrains Mono**

### Produto warm/playful
- Display: **GT Maru** (Grilli) ou **Söhne Schmal**
- Body: **GT Walsheim** ou **Söhne**
- Mono: **MD IO** (Mass-Driver)

### Editorial serif moment
- Display: **Tiempos Headline** (Klim) ou **GT Sectra**
- Body: **Tiempos Text** ou **Söhne**
- Mono: **JetBrains Mono**

### Free / open-source fallback (justificar em MARCA.md)
- Display: **Manrope** (free) ou **Inter Display** (free variante!)
- Body: **Inter** OK como único free se for **apenas** body
- Mono: **JetBrains Mono** (free)

> **Inter no display** é sempre tell de IA. Inter Display (variante distinta) é aceitável.

## Hierarquia — patterns

### Hierarquia por size + weight + color (3 alavancas)

```tsx
// Bom — 3 alavancas, claramente diferenciado
<h2 className="text-2xl font-semibold text-foreground">Section</h2>
<p className="text-sm font-normal text-muted-foreground">Caption</p>

// Ruim — só size, peso body, muddy
<h2 className="text-base text-foreground">Section</h2>
<p className="text-sm text-foreground">Caption</p>
```

### Widow/orphan em heading

Last word sozinho em line = widow. Use `text-wrap: balance` ou `&nbsp;` no penúltimo separator.

```tsx
<h1 className="text-balance">Build better software with one calm tool</h1>
```

### Letter-spacing

- Display tamanhos grandes (`4xl`+): `tracking-tight` (-0.01em) ou `-0.02em`
- Body: default `tracking-normal`
- All-caps: `tracking-wider` mas SOMENTE em badge pequena (rótulo uppercase decorativo acima de heading é proibido — ver T04 em anti-padroes-ia)

## Anti-patterns

### Anti-pattern 1: 6+ tamanhos diferentes em uma tela

**Errado:** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl` todos numa página.

**Por quê:** REGRA #2 — hierarquia inflacionada, agente IA depois perde sinal sobre o que é importante.

**Certo:** restringir a 4. Se "preciso de mais", problema é decisão de info architecture, não de tipo.

### Anti-pattern 2: Inter em display + body + mono

**Errado:**
```css
:root {
  --font-display: Inter;
  --font-sans: Inter;
  --font-mono: Inter;
}
```

**Por quê:** T07 — monocultura é tell #1 de "IA gerou isto".

**Certo:** display + body distintos, mesmo que ambos sans. Mono é monospace, sempre distinto.

### Anti-pattern 3: weight `300` para hero

**Errado:** `<h1 className="font-light text-6xl">Build it</h1>`

**Por quê:** thin no display falha em retina baixa + perde presença. Era moda 2015-2018, agora datado.

**Certo:** `font-medium` ou `font-semibold`. Hero quer presença, não fragilidade.

### Anti-pattern 4: body em 14px porque "fica clean"

**Errado:** `<body class="text-sm">`

**Por quê:** 14px body falha em legibilidade > 40 anos + cansa em sessões longas. AA exige 16px effective.

**Certo:** 16px body min. 14px só em controls densos, tables, captions.

### Anti-pattern 5: hero text estica viewport

**Errado:**
```tsx
<h1 className="text-7xl">Build something amazing with our platform today and ship faster than ever</h1>
```

**Por quê:** REGRA #3 — line-length destruído, leitura interrompida múltiplas vezes.

**Certo:** wrap container 18-25ch + balance:
```tsx
<h1 className="text-7xl max-w-[18ch] text-balance leading-[1.05] tracking-tight">
  Ship faster.
</h1>
<p className="text-lg max-w-[50ch] mt-4 text-muted-foreground">
  Sub-headline com contexto em line-length confortável.
</p>
```

## Detecção

```bash
# tamanhos em uso (deveria ser 3-4)
grep -rohE "text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b" src --include="*.tsx" 2>/dev/null | sort -u | wc -l

# pesos em uso (deveria ser 2)
grep -rohE "font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b" src --include="*.tsx" 2>/dev/null | sort -u

# Inter monocultura
grep -rohE "Inter\b" src --include="*.css" --include="*.ts" 2>/dev/null | wc -l

# defaults banidos
grep -rohE "(Fraunces|Geist|Mona Sans|Plus Jakarta Sans|Space Grotesk|Recoleta|Instrument Sans)" src 2>/dev/null
```

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — T03, T04, T07, T08 detalhados
- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — onde Display/Body/Mono são declarados

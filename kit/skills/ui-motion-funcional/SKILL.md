---
name: ui-motion-funcional
description: Use ao adicionar animation, transition ou motion — princípio canônico "motion com propósito que comunica estado, não decoração". Durações 150-200ms interações / 250-400ms layout / 600ms+ celebration justificada. ease-out default, nunca ease-in para entrance, evita bounce em produto. Respeitar prefers-reduced-motion sempre. Sem auto-play, sem parallax gratuito, sem confetti exceto onboarding.
---

# UI — Motion Funcional

## Quando usar

LLM carrega esta skill quando:

- "Adicionar animation / transition / motion"
- "Algo parece estático / sem vida"
- "Confetti / celebration / delight moment"
- "Page transition / route change"
- Preenchendo Componentes/Regras com motion rules

## Regras absolutas

**REGRA #1 (com propósito, não decorativo):** Motion existe para comunicar **mudança de estado** (loading → done, hidden → visible, focus, error). Decoração pura (parallax, auto-scrolling text, ambient bg motion) é proibida em produto, raramente justificada em marca.

**REGRA #2 (duração por contexto):**
- **Micro-interação** (hover, focus, button press): **100-150ms**
- **Mudança de estado** (toggle, dropdown, popover open): **150-200ms**
- **Layout shift** (modal open, drawer slide): **250-400ms**
- **Page transition**: **300-400ms** max
- **Celebration** (confetti, hero entrance): **600-800ms** com justificativa, 1 vez

Duração > 500ms em interação = lento. < 100ms = imperceptível, sem valor.

**REGRA #3 (easing canônico):**
- **Padrão**: `ease-out` ou `cubic-bezier(0.2, 0.8, 0.2, 1)` (entry rápido, settle suave)
- **Exit/dismiss**: `ease-in` aceitável para "remover do palco"
- **Layout shifts**: `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard)
- **PROIBIDO em produto**: `bounce`, `elastic`, `back` easings — playful demais para uso funcional

**REGRA #4 (prefers-reduced-motion sempre):** Toda animation tem fallback estático.

**REGRA #5 (no layout thrash):** Anime apenas `transform` + `opacity`. Nunca anime `width`, `height`, `top`, `left`, `padding` em hot path. Use `transform: translate3d()` + `scale()`.

## Patterns canônicos

### Micro-interação (button hover)

```css
.button {
  transition: background-color 150ms ease-out, transform 150ms ease-out;
}
.button:hover {
  background-color: var(--primary-hover);
}
.button:active {
  transform: translateY(1px);  /* sutil press-down */
}

@media (prefers-reduced-motion: reduce) {
  .button { transition: none; }
}
```

### Dropdown / Popover open

```tsx
// Framer Motion
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
>
  {/* content */}
</motion.div>

// Tailwind / CSS only
className="data-[state=open]:animate-in data-[state=open]:fade-in-0
           data-[state=open]:slide-in-from-top-1
           data-[state=closed]:animate-out data-[state=closed]:fade-out-0
           data-[state=closed]:slide-out-to-top-1
           duration-200 ease-out"
```

### Modal / Dialog

```tsx
// Mobile: slide-from-bottom (sheet)
// Desktop: scale central + fade

className="
  /* mobile */
  data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom
  data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom
  /* desktop */
  sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95
  sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:fade-out-0
  /* timing */
  duration-300 ease-out
"
```

### Layout state transitions

```tsx
// Lista que filtra: AnimatePresence + layout
<AnimatePresence mode="popLayout">
  {items.map(item => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {item.label}
    </motion.div>
  ))}
</AnimatePresence>
```

### Loading state (skeleton + transition)

```tsx
{loading ? (
  <Skeleton className="h-24 animate-pulse" />
) : (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
  >
    {data}
  </motion.div>
)}
```

### Celebration (use 1× por flow, justificado)

```tsx
// Onboarding: primeiro check-in completado
import confetti from 'canvas-confetti'

useEffect(() => {
  if (justCompleted) {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.4 },
      colors: [primaryColor, foregroundColor],  // brand-tinted, não rainbow
      disableForReducedMotion: true,
    })
  }
}, [justCompleted])
```

Critérios para usar confetti:
1. Evento raro (não toast comum)
2. Sucesso significativo (não "saved successfully" trivial)
3. Cores da marca (não default rainbow)
4. `disableForReducedMotion: true`
5. Não bloqueia interação subsequente

## Anti-patterns

### Anti-pattern 1: bounce easing em produto

**Errado:**
```css
.dropdown {
  transition: transform 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55); /* bounce */
}
```

**Por quê:** Q08 — bounce em interação comum = playful demais, perde profissionalismo em context dashboard.

**Certo:** `ease-out` ou `cubic-bezier(0.2, 0.8, 0.2, 1)`.

### Anti-pattern 2: motion em decoração de bg

**Errado:** SVG floating shapes orbitando hero em background, animação infinita.

**Por quê:** REGRA #1 — decoração sem propósito + drena GPU + viewport battery + distrai do conteúdo.

**Certo:** static. Ou movimento triggerado por scroll JÁ engajado (parallax leve, max -10% translate), nunca infinito.

### Anti-pattern 3: animar `height` ou `width` em accordion

**Errado:**
```css
.accordion-content {
  transition: height 300ms;
}
.accordion-content.open { height: auto; }  /* além de quebrar transition, layout thrash */
```

**Por quê:** REGRA #5 — height/width disparam reflow + paint, queda de fps em mobile.

**Certo:** anime `transform: scaleY` ou `max-height` + `clip-path`. Ou use lib (Radix Accordion) que faz right.

### Anti-pattern 4: page transition longa

**Errado:** route change com fade out 600ms + fade in 600ms = 1.2s de tela vazia.

**Por quê:** REGRA #2 — user percebe app lento. App nativo bom = transição instantânea ou < 300ms.

**Certo:** 200ms fade out + 200ms fade in, OU cross-fade overlap 250ms total.

### Anti-pattern 5: ignorar prefers-reduced-motion

**Errado:**
```tsx
<motion.div animate={{ x: [0, 100, 0] }} transition={{ repeat: Infinity }} />
```

**Por quê:** REGRA #4 — users com vestibular disorder ou enxaqueca + usuários com bateria fraca + corporate machines.

**Certo:**
```tsx
const shouldReduceMotion = useReducedMotion()
<motion.div
  animate={shouldReduceMotion ? {} : { x: [0, 100, 0] }}
  transition={{ repeat: shouldReduceMotion ? 0 : Infinity }}
/>
```

### Anti-pattern 6: auto-play hero video sem controle

**Errado:** `<video autoPlay loop muted playsInline>` em hero, 5MB+, sem botão pausar.

**Por quê:** Acessibilidade + bateria + bandwidth. Tem que existir pause/control visível e respeitar prefers-reduced-motion (pausa default).

**Certo:**
```tsx
<video
  ref={videoRef}
  autoPlay={!prefersReducedMotion}
  loop muted playsInline
  poster="/hero-static.jpg"
/>
<button onClick={togglePlay} aria-label="Toggle video">…</button>
```

## Detecção

```bash
# Bounce/elastic easing
grep -rnE "bounce|cubic-bezier\(0\.68|elastic" src --include="*.css" --include="*.tsx" 2>/dev/null

# Animação > 500ms em interação
grep -rnE "duration-(700|1000|1500|2000)\b|duration:\s*(700|800|1000|1500)" src --include="*.tsx" --include="*.css" 2>/dev/null

# Layout-thrashing animations
grep -rnE "transition.*width|transition.*height|transition.*top|transition.*left|transition.*padding|transition.*margin" src --include="*.css" 2>/dev/null

# Falta de prefers-reduced-motion handler
grep -rln "framer-motion\|animate=" src --include="*.tsx" 2>/dev/null | while read f; do
  grep -q "useReducedMotion\|prefers-reduced-motion" "$f" || echo "$f: motion sem reduce handler"
done
```

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — Q08 (bounce easing)
- [ui-contexto-produto](../ui-contexto-produto/SKILL.md) — sensibilidade a motion em MARCA.md
- WCAG SC 2.3.3 Animation from Interactions: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions

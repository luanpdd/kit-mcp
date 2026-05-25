---
name: ui-contexto-produto
description: Use ANTES de qualquer trabalho de UI — carrega/gera MARCA.md (estratégia: registro marca vs produto, persona, voz, anti-referências) + DESIGN.md (visual: 6 seções canônicas Visão/Cores/Tipografia/Elevação/Componentes/Regras). Estratégia ≠ visual; arquivos separados deliberadamente. Bootstrap canônico de fluência de design para IA.
---

# UI — Contexto de Produto (MARCA.md + DESIGN.md)

## Quando usar

LLM carrega esta skill quando:

- "Desenhe / refine / audite UI" em projeto que ainda não tem brand spec
- "Crie um DESIGN.md / MARCA.md / docs de design system"
- "Onboard o IA no design deste projeto"
- "Faça o ensino / extração de design"
- Antes de invocar agente `designer-ui` pela primeira vez

## Regras absolutas

**REGRA #1 (separação de preocupações):** `MARCA.md` responde **estratégia** (quem/o quê/porquê). `DESIGN.md` responde **visual** (como aparenta). Nunca coloque cor, fonte ou pixel em MARCA.md. Nunca coloque persona ou tom de voz em DESIGN.md.

**REGRA #2 (registro primeiro):** Primeira pergunta sempre é registro: **marca** (marketing, hero, motion-rich) vs **produto** (dashboard, calm-clinical). Tudo deriva disso.

**REGRA #3 (específico, não adjetivo):** Recuse respostas genéricas. "Moderno e limpo" → reject. "Caloroso, mecânico, opinativo" → accept. Referências por **nome próprio**: "Linear sidebar density", não "técnico e limpo".

**REGRA #4 (6 seções fixas):** DESIGN.md tem exatamente 6 seções, em ordem fixa, com nomes fixos. NÃO adicione Layout, Motion ou Responsivo como top-level — eles vivem dentro de Componentes ou Regras.

**REGRA #5 (ancorado no codebase):** Modo scan lê tokens reais (CSS vars, Tailwind config, shadcn preset). Nunca invente valores que o codebase não suporta — marque como `<!-- RASCUNHO -->` se vier de prompt e não de código.

## Template canônico — MARCA.md

```markdown
# MARCA.md

> Contexto estratégico para parceiros de design IA. Visuais vivem em DESIGN.md.

## Registro
{marca | produto | híbrido — justifique em 1 linha}

## Usuários
- Primário: {persona específica, contexto, estado de espírito}
  Exemplo: "SRE em on-call às 3h, debugando incidente, só mobile, janela de paciência 90s"
- Secundário: {se houver}

## Propósito
{O que o produto faz, em 1 frase de no máximo 20 palavras. Sem "platform" ou "solution"}

## Personalidade
3-5 adjetivos. Exemplo: "Calmo, clínico, opinativo, mecânico, sem hype"
Reject: "moderno, limpo, simples, intuitivo" (genéricos)

## Referências
- {Nome próprio + URL}. Ex: "Linear app — densidade de sidebar"
- {Nome próprio + URL}. Ex: "Vercel dashboard — empty states"

## Anti-referências
- {Nome próprio + razão}. Ex: "Templates SaaS genéricos — sobreuso de cards"
- {Nome próprio + razão}. Ex: "Hero Stripe 2014 — era do gradiente roxo"

## Voz
- Tom: {calmo | brincalhão | clínico | caloroso | mecânico | outro}
- Tempo verbal: {presente padrão | passado para eventos}
- Frases banidas: {liste 3-5. Ex: "alavancar", "seamless", "incrível"}

## Acessibilidade
- WCAG: {AA | AAA}
- Locale: {pt-BR primário | en secundário | etc}
- Sensibilidade a motion: {respeitar prefers-reduced-motion: sim/não — default sim}
- Daltonismo: {protanopia/deuteranopia testados via tooling}

## Restrições
- {Técnica. Ex: "shadcn/ui locked", "Tailwind v4 OKLCH tokens"}
- {Negócio. Ex: "deve parecer sério para pitch enterprise"}
```

## Template canônico — DESIGN.md

```markdown
# DESIGN.md

> Sistema visual. Agentes IA leem isto antes de gerar UI. 6 seções, ordem fixa.

## Visão
{North Star em 2-3 frases. O "feeling" do produto traduzido em direção visual.}
Exemplo: "Quietude editorial. Preto sobre creme, accent único, espaçamento generoso, motion apenas em mudança de estado."

## Cores
- Superfície (60%): `{token | hex}` — `--background`
- Secundária (30%): `{token | hex}` — `--muted`
- Destaque (10%): `{token | hex}` — reservada para: {liste elementos exatos. Ex: "apenas CTA primário"}
- Destrutiva: `{token | hex}` — reservada para: confirmação de ação irreversível
- Foreground / contraste: AA mín 4.5:1 em cada superfície
Modo: {claro só | escuro só | ambos com pref do sistema}

## Tipografia
- Display ({nome próprio}): h1/h2 hero
- Body ({nome próprio}): todo o resto
- Mono ({nome próprio}): código, dados, tempo

Tamanhos (exatos, máximo 4): {ex: 14, 16, 20, 32}
Pesos (exatos, máximo 2): {ex: 400, 600}
Altura de linha: body 1.5, heading 1.2
Comprimento de linha: 50-75 chars body, 30-50 hero

Banidas: {liste fontes proibidas. Ex: "Inter, Geist, Space Grotesk" se quer fugir do default genérico}

## Elevação
Filosofia: {flat | sombra sutil | dramático | nenhuma}
Tokens:
- `elev-0`: `none` — superfície rasa
- `elev-1`: `{shadow value}` — cards, popovers
- `elev-2`: `{shadow value}` — modais, command palette
Anti-pattern: glassmorphism (`backdrop-blur` em ≥ 3 camadas) PROIBIDO

## Componentes
Notas breves de caráter por padrão. Não replique docs do shadcn — declare *o que é opinativo aqui*.
- **Button**: {raio, peso, altura, caráter}. Ex: "Raio 4px afiado, semibold, h-10, sem sombra"
- **Card**: {quando usar, quando NÃO}. Ex: "Apenas para itens de dados em lista. Nunca envolva uma seção em card. Nunca aninhe."
- **Input**: {caráter}. Ex: "Apenas underline, sem borda, foco = border-bottom accent"
- **Dialog**: {motion, tamanho, dismiss}. Ex: "Slide-from-bottom em mobile, scale central em desktop, ESC sempre dismissa"
- **Toast**: {posição, duração, caráter}

## Regras (Faça / Não faça)
FAÇA:
- {regra brand-específica. Ex: "Use cor de destaque APENAS em CTA primário por tela"}
- {regra. Ex: "Body copy max 70ch — wrap container em 65ch"}

NÃO FAÇA:
- {anti-pattern relevante. Ex: "Sem gradiente em texto. Nunca."}
- {anti-pattern brand. Ex: "Sem emoji em strings de UI fora de error toasts"}
- {anti-pattern. Ex: "Nunca envolva headings em italic serif. Display é grotesk."}
```

## Sidecar — DESIGN.json

Companion machine-readable. Tokens primários extraídos do codebase:

```json
{
  "version": "1.0",
  "tokens": {
    "color": {
      "surface": "oklch(0.99 0 0)",
      "muted": "oklch(0.94 0.005 240)",
      "accent": "oklch(0.55 0.18 28)"
    },
    "typography": {
      "display": "Söhne Breit",
      "body": "Söhne",
      "sizes": [14, 16, 20, 32],
      "weights": [400, 600]
    },
    "spacing": [4, 8, 16, 24, 32, 48, 64],
    "radius": { "default": 4, "pill": 9999 }
  }
}
```

## Workflow

### Modo Scan (codebase existe)

1. `Grep` por `tailwind.config.*`, `globals.css`, `:root {` para extrair tokens
2. `Read` `components.json` (shadcn) para preset
3. `Glob` `src/components/**` para inventário
4. Apresentar valores detectados → pedir confirmação para Visão + notas de caráter
5. Gerar MARCA.md (via entrevista) + DESIGN.md (via scan + confirmação)

### Modo Rascunho (greenfield)

1. Entrevista de 5-8 minutos. Perguntas mínimas:
   - Registro (marca vs produto)?
   - Usuário primário em 1 frase com contexto + estado de espírito?
   - 3-5 adjetivos de personalidade (não-genéricos)?
   - 2-3 referências **nomeadas** com URL?
   - 2 anti-referências **nomeadas**?
   - Locale + nível WCAG?
2. Scaffold DESIGN.md com comentários `<!-- RASCUNHO -->` em valores não-extraídos
3. Marcar para revisão pós-implementação inicial

## Anti-patterns

### Anti-pattern 1: misturar estratégia e visual

**Errado (MARCA.md):**
```markdown
## Personalidade
Moderno, limpo, com #4F46E5 primário
```

**Por quê:** REGRA #1 — cor pertence a DESIGN.md. MARCA.md fica fora de sincronia quando rebrand.

**Certo:** "Personalidade: Mecânico, opinativo" em MARCA.md. "#4F46E5" em DESIGN.md > Cores > Destaque.

### Anti-pattern 2: respostas adjetivais genéricas

**Errado:**
```markdown
## Referências
- Apps SaaS modernos
- Design systems limpos
```

**Por quê:** REGRA #3 — sem nome próprio, IA volta ao default genérico ("dribbble médio").

**Certo:**
```markdown
## Referências
- [Linear](https://linear.app) — densidade de sidebar + gravidade do command palette
- [Klim Type Foundry](https://klim.co.nz) — hero editorial quieto
```

### Anti-pattern 3: criar Layout/Motion/Responsivo como seção top-level em DESIGN.md

**Errado:**
```markdown
## Visão
## Cores
## Tipografia
## Layout            ← não!
## Motion            ← não!
## Responsivo        ← não!
```

**Por quê:** REGRA #4 — schema canônico tem 6 seções fixas. Layout/motion/responsivo são propriedades dos Componentes ou regras em Faça/Não faça. Agentes IA downstream esperam o schema fixo.

**Certo:** Embuta em Componentes ("Dialog: slide-from-bottom em mobile, scale central em desktop") ou Regras ("FAÇA: respeitar prefers-reduced-motion").

### Anti-pattern 4: MARCA.md sem anti-referências

**Errado:**
```markdown
## Referências
- Linear
## Personalidade
- Limpo
```
(sem anti-referências)

**Por quê:** IA tende a regressão à média. Sem "NÃO se parecer com X", o output gravita para template SaaS médio mesmo com referências fortes.

**Certo:** sempre 2+ anti-referências nomeadas com razão.

## Ver também

- [ui-anti-padroes-ia](../ui-anti-padroes-ia/SKILL.md) — catálogo de tells a evitar (alimenta seção Não faça de DESIGN.md)
- [ui-tipografia](../ui-tipografia/SKILL.md) — preenche seção Tipografia
- [ui-cor-estrategia](../ui-cor-estrategia/SKILL.md) — preenche seção Cores

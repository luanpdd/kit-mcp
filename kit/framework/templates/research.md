# Template de Research

Template para `.planning/phases/XX-name/{phase_num}-RESEARCH.md` - pesquisa abrangente de ecossistema antes do planejamento.

**Propósito:** Documentar o que Claude precisa saber para implementar uma fase bem — não apenas "qual biblioteca" mas "como especialistas constroem isso."

---

## Template do Arquivo

```markdown
# Fase [X]: [Nome] - Pesquisa

**Pesquisado:** [data]
**Domínio:** [tecnologia primária/domínio do problema]
**Confiança:** [HIGH/MEDIUM/LOW]

<user_constraints>
## Restrições do Usuário (do CONTEXT.md)

**CRÍTICO:** Se CONTEXT.md existir do /discuss-phase, copiar decisões travadas aqui literalmente. Estas DEVEM ser honradas pelo planejador.

### Decisões Travadas
[Copiar da seção `## Decisões` do CONTEXT.md - estas são NÃO-NEGOCIÁVEIS]
- [Decisão 1]
- [Decisão 2]

### A Critério do Claude
[Copiar do CONTEXT.md - áreas onde pesquisador/planejador pode escolher]
- [Área 1]
- [Área 2]

### Ideias Diferidas (FORA DO ESCOPO)
[Copiar do CONTEXT.md - NÃO pesquisar ou planejar estas]
- [Diferida 1]
- [Diferida 2]

**Se não existir CONTEXT.md:** Escrever "Sem restrições do usuário - todas as decisões a critério do Claude"
</user_constraints>

<research_summary>
## Resumo

[Resumo executivo de 2-3 parágrafos]
- O que foi pesquisado
- Qual é a abordagem padrão
- Recomendações chave

**Recomendação principal:** [orientação acionável em uma linha]
</research_summary>

<standard_stack>
## Stack Padrão

As bibliotecas/ferramentas estabelecidas para este domínio:

### Core
| Biblioteca | Versão | Propósito | Por que é Padrão |
|------------|--------|-----------|------------------|
| [nome] | [ver] | [o que faz] | [por que especialistas usam] |
| [nome] | [ver] | [o que faz] | [por que especialistas usam] |

### Suporte
| Biblioteca | Versão | Propósito | Quando Usar |
|------------|--------|-----------|-------------|
| [nome] | [ver] | [o que faz] | [caso de uso] |
| [nome] | [ver] | [o que faz] | [caso de uso] |

### Alternativas Consideradas
| Em vez de | Poderia Usar | Trade-off |
|-----------|--------------|-----------|
| [padrão] | [alternativa] | [quando alternativa faz sentido] |

**Instalação:**
```bash
npm install [pacotes]
# ou
yarn add [pacotes]
```
</standard_stack>

<architecture_patterns>
## Padrões de Arquitetura

### Estrutura de Projeto Recomendada
```
src/
├── [pasta]/        # [propósito]
├── [pasta]/        # [propósito]
└── [pasta]/        # [propósito]
```

### Padrão 1: [Nome do Padrão]
**O quê:** [descrição]
**Quando usar:** [condições]
**Exemplo:**
```typescript
// [exemplo de código do Context7/docs oficiais]
```

### Padrão 2: [Nome do Padrão]
**O quê:** [descrição]
**Quando usar:** [condições]
**Exemplo:**
```typescript
// [exemplo de código]
```

### Anti-Padrões a Evitar
- **[Anti-padrão]:** [por que é ruim, o que fazer em vez disso]
- **[Anti-padrão]:** [por que é ruim, o que fazer em vez disso]
</architecture_patterns>

<dont_hand_roll>
## Não Implemente do Zero

Problemas que parecem simples mas têm soluções existentes:

| Problema | Não Construa | Use Em Vez | Por quê |
|----------|--------------|------------|---------|
| [problema] | [o que você construiria] | [biblioteca] | [casos extremos, complexidade] |
| [problema] | [o que você construiria] | [biblioteca] | [casos extremos, complexidade] |
| [problema] | [o que você construiria] | [biblioteca] | [casos extremos, complexidade] |

**Insight chave:** [por que soluções customizadas são piores neste domínio]
</dont_hand_roll>

<common_pitfalls>
## Armadilhas Comuns

### Armadilha 1: [Nome]
**O que dá errado:** [descrição]
**Por que acontece:** [causa raiz]
**Como evitar:** [estratégia de prevenção]
**Sinais de alerta:** [como detectar cedo]

### Armadilha 2: [Nome]
**O que dá errado:** [descrição]
**Por que acontece:** [causa raiz]
**Como evitar:** [estratégia de prevenção]
**Sinais de alerta:** [como detectar cedo]

### Armadilha 3: [Nome]
**O que dá errado:** [descrição]
**Por que acontece:** [causa raiz]
**Como evitar:** [estratégia de prevenção]
**Sinais de alerta:** [como detectar cedo]
</common_pitfalls>

<code_examples>
## Exemplos de Código

Padrões verificados de fontes oficiais:

### [Operação Comum 1]
```typescript
// Fonte: [URL do Context7/docs oficiais]
[código]
```

### [Operação Comum 2]
```typescript
// Fonte: [URL do Context7/docs oficiais]
[código]
```

### [Operação Comum 3]
```typescript
// Fonte: [URL do Context7/docs oficiais]
[código]
```
</code_examples>

<sota_updates>
## Estado da Arte (2024-2025)

O que mudou recentemente:

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|------------------|-----------------|--------------|---------|
| [antiga] | [nova] | [data/versão] | [o que significa para a implementação] |

**Novas ferramentas/padrões a considerar:**
- [Ferramenta/Padrão]: [o que habilita, quando usar]
- [Ferramenta/Padrão]: [o que habilita, quando usar]

**Obsoleto/desatualizado:**
- [Coisa]: [por que está desatualizada, o que a substituiu]
</sota_updates>

<open_questions>
## Questões Abertas

Coisas que não puderam ser totalmente resolvidas:

1. **[Questão]**
   - O que sabemos: [info parcial]
   - O que está incerto: [a lacuna]
   - Recomendação: [como lidar durante o planejamento/execução]

2. **[Questão]**
   - O que sabemos: [info parcial]
   - O que está incerto: [a lacuna]
   - Recomendação: [como lidar]
</open_questions>

<sources>
## Fontes

### Primárias (confiança HIGH)
- [ID da biblioteca no Context7] - [tópicos consultados]
- [URL dos docs oficiais] - [o que foi verificado]

### Secundárias (confiança MEDIUM)
- [WebSearch verificada com fonte oficial] - [descoberta + verificação]

### Terciárias (confiança LOW - requer validação)
- [Apenas WebSearch] - [descoberta, marcada para validação durante a implementação]
</sources>

<metadata>
## Metadados

**Escopo da pesquisa:**
- Tecnologia core: [o quê]
- Ecossistema: [bibliotecas exploradas]
- Padrões: [padrões pesquisados]
- Armadilhas: [áreas verificadas]

**Breakdown de confiança:**
- Stack padrão: [HIGH/MEDIUM/LOW] - [motivo]
- Arquitetura: [HIGH/MEDIUM/LOW] - [motivo]
- Armadilhas: [HIGH/MEDIUM/LOW] - [motivo]
- Exemplos de código: [HIGH/MEDIUM/LOW] - [motivo]

**Data da pesquisa:** [data]
**Válido até:** [estimativa - 30 dias para tecnologia estável, 7 dias para tecnologia em rápida evolução]
</metadata>

---

*Fase: XX-nome*
*Pesquisa concluída: [data]*
*Pronto para planejamento: [sim/não]*
```

---

## Bom Exemplo

```markdown
# Phase 3: 3D City Driving - Research

**Researched:** 2025-01-20
**Domain:** Three.js 3D web game with driving mechanics
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Three.js ecosystem for building a 3D city driving game. The standard approach uses Three.js with React Three Fiber for component architecture, Rapier for physics, and drei for common helpers.

Key finding: Don't hand-roll physics or collision detection. Rapier (via @react-three/rapier) handles vehicle physics, terrain collision, and city object interactions efficiently. Custom physics code leads to bugs and performance issues.

**Primary recommendation:** Use R3F + Rapier + drei stack. Start with vehicle controller from drei, add Rapier vehicle physics, build city with instanced meshes for performance.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | 0.160.0 | 3D rendering | The standard for web 3D |
| @react-three/fiber | 8.15.0 | React renderer for Three.js | Declarative 3D, better DX |
| @react-three/drei | 9.92.0 | Helpers and abstractions | Solves common problems |
| @react-three/rapier | 1.2.1 | Physics engine bindings | Best physics for R3F |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/postprocessing | 2.16.0 | Visual effects | Bloom, DOF, motion blur |
| leva | 0.9.35 | Debug UI | Tweaking parameters |
| zustand | 4.4.7 | State management | Game state, UI state |
| use-sound | 4.0.1 | Audio | Engine sounds, ambient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rapier | Cannon.js | Cannon simpler but less performant for vehicles |
| R3F | Vanilla Three | Vanilla if no React, but R3F DX is much better |
| drei | Custom helpers | drei is battle-tested, don't reinvent |

**Installation:**
```bash
npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Vehicle/          # Player car with physics
│   ├── City/             # City generation and buildings
│   ├── Road/             # Road network
│   └── Environment/      # Sky, lighting, fog
├── hooks/
│   ├── useVehicleControls.ts
│   └── useGameState.ts
├── stores/
│   └── gameStore.ts      # Zustand state
└── utils/
    └── cityGenerator.ts  # Procedural generation helpers
```

### Pattern 1: Vehicle with Rapier Physics
**What:** Use RigidBody with vehicle-specific settings, not custom physics
**When to use:** Any ground vehicle
**Example:**
```typescript
// Source: @react-three/rapier docs
import { RigidBody, useRapier } from '@react-three/rapier'

function Vehicle() {
  const rigidBody = useRef()

  return (
    <RigidBody
      ref={rigidBody}
      type="dynamic"
      colliders="hull"
      mass={1500}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <mesh>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial />
      </mesh>
    </RigidBody>
  )
}
```

### Anti-Patterns to Avoid
- **Creating meshes in render loop:** Create once, update transforms only
- **Not using InstancedMesh:** Individual meshes for buildings kills performance
- **Custom physics math:** Rapier handles it better, every time
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vehicle physics | Custom velocity/acceleration | Rapier RigidBody | Wheel friction, suspension, collisions are complex |
| Collision detection | Raycasting everything | Rapier colliders | Performance, edge cases, tunneling |
| Camera follow | Manual lerp | drei CameraControls or custom with useFrame | Smooth interpolation, bounds |
| City generation | Pure random placement | Grid-based with noise for variation | Random looks wrong, grid is predictable |
| LOD | Manual distance checks | drei <Detailed> | Handles transitions, hysteresis |

**Key insight:** 3D game development has 40+ years of solved problems. Rapier implements proper physics simulation. drei implements proper 3D helpers. Fighting these leads to bugs that look like "game feel" issues but are actually physics edge cases.
</dont_hand_roll>

<sources>
## Sources

### Primary (HIGH confidence)
- /pmndrs/react-three-fiber - getting started, hooks, performance
- /pmndrs/drei - instances, controls, helpers
- /dimforge/rapier-js - physics setup, vehicle physics

### Tertiary (LOW confidence - needs validation)
- None - all findings verified
</sources>

---

*Phase: 03-city-driving*
*Research completed: 2025-01-20*
*Ready for planning: yes*
```

---

## Diretrizes

**Quando criar:**
- Antes de planejar fases em domínios niche/complexos
- Quando os dados de treinamento do Claude provavelmente estão desatualizados ou escassos
- Quando "como especialistas fazem isso" importa mais do que "qual biblioteca"

**Estrutura:**
- Usar tags XML para marcadores de seção (combina com templates framework)
- Sete seções core: summary, standard_stack, architecture_patterns, dont_hand_roll, common_pitfalls, code_examples, sources
- Todas as seções obrigatórias (impulsiona pesquisa abrangente)

**Qualidade do conteúdo:**
- Stack padrão: Versões específicas, não apenas nomes
- Arquitetura: Incluir exemplos reais de código de fontes autoritativas
- Don't hand-roll: Ser explícito sobre quais problemas NÃO resolver você mesmo
- Armadilhas: Incluir sinais de alerta, não apenas "não faça isso"
- Fontes: Marcar níveis de confiança honestamente

**Integração com planejamento:**
- RESEARCH.md carregado como referência @context no PLAN.md
- Stack padrão informa escolhas de biblioteca
- Don't hand-roll previne soluções customizadas
- Armadilhas informam critérios de verificação
- Exemplos de código podem ser referenciados em ações de tarefas

**Após a criação:**
- Arquivo fica no diretório da fase: `.planning/phases/XX-nome/{phase_num}-RESEARCH.md`
- Referenciado durante o workflow de planejamento
- plan-phase o carrega automaticamente quando presente

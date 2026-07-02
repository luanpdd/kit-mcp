---
phase: {N}
slug: {phase-slug}
status: draft
shadcn_initialized: false
preset: none
created: {date}
---

# Fase {N} — Contrato de Design de UI

> Contrato visual e de interação para fases de frontend. Gerado por ui-researcher, verificado por ui-checker.

---

## Sistema de Design

| Propriedade | Valor |
|-------------|-------|
| Ferramenta | {shadcn / none} |
| Preset | {string do preset ou "não aplicável"} |
| Biblioteca de componentes | {radix / base-ui / none} |
| Biblioteca de ícones | {biblioteca} |
| Fonte | {fonte} |

---

## Escala de Espaçamento

Valores declarados (devem ser múltiplos de 4):

| Token | Valor | Uso |
|-------|-------|-----|
| xs | 4px | Espaçamentos de ícones, padding inline |
| sm | 8px | Espaçamento compacto de elementos |
| md | 16px | Espaçamento padrão de elementos |
| lg | 24px | Padding de seção |
| xl | 32px | Espaços de layout |
| 2xl | 48px | Quebras principais de seção |
| 3xl | 64px | Espaçamento de nível de página |

Exceções: {listar quaisquer, ou "nenhuma"}

---

## Tipografia

| Papel | Tamanho | Peso | Altura de Linha |
|-------|---------|------|-----------------|
| Body | {px} | {weight} | {ratio} |
| Label | {px} | {weight} | {ratio} |
| Heading | {px} | {weight} | {ratio} |
| Display | {px} | {weight} | {ratio} |

---

## Cores

| Papel | Valor | Uso |
|-------|-------|-----|
| Dominante (60%) | {hex} | Fundo, superfícies |
| Secundário (30%) | {hex} | Cards, sidebar, nav |
| Destaque (10%) | {hex} | {listar elementos específicos apenas} |
| Destrutivo | {hex} | Somente ações destrutivas |

Destaque reservado para: {lista explícita — nunca "todos os elementos interativos"}

---

## Contrato de Copywriting

| Elemento | Texto |
|----------|-------|
| CTA Principal | {verbo + substantivo específico} |
| Título de estado vazio | {texto} |
| Corpo de estado vazio | {texto + próximo passo} |
| Estado de erro | {problema + caminho para solução} |
| Confirmação destrutiva | {nome da ação}: {texto de confirmação} |

---

## Segurança de Registry

| Registry | Blocos Usados | Gate de Segurança |
|----------|---------------|-------------------|
| shadcn oficial | {lista} | não necessário |
| {nome de terceiro} | {lista} | visualização shadcn + diff necessário |

---

## Aprovação do Checker

- [ ] Dimensão 1 Copywriting: PASS
- [ ] Dimensão 2 Visuais: PASS
- [ ] Dimensão 3 Cores: PASS
- [ ] Dimensão 4 Tipografia: PASS
- [ ] Dimensão 5 Espaçamento: PASS
- [ ] Dimensão 6 Segurança de Registry: PASS

**Aprovação:** {pending / approved YYYY-MM-DD}

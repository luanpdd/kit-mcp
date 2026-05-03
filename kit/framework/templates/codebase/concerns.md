# Template de Preocupações do Codebase

Template para `.planning/codebase/CONCERNS.md` - captura problemas conhecidos e áreas que requerem cuidado.

**Propósito:** Apresentar avisos acionáveis sobre o codebase. Focado em "o que observar ao fazer mudanças."

---

## Template do Arquivo

```markdown
# Preocupações do Codebase

**Data da Análise:** [AAAA-MM-DD]

## Dívida Técnica

**[Área/Componente]:**
- Problema: [Qual é o atalho/solução paliativa]
- Por quê: [Por que foi feito assim]
- Impacto: [O que quebra ou degrada por causa disso]
- Abordagem de correção: [Como endereçar adequadamente]

**[Área/Componente]:**
- Problema: [Qual é o atalho/solução paliativa]
- Por quê: [Por que foi feito assim]
- Impacto: [O que quebra ou degrada por causa disso]
- Abordagem de correção: [Como endereçar adequadamente]

## Bugs Conhecidos

**[Descrição do bug]:**
- Sintomas: [O que acontece]
- Gatilho: [Como reproduzir]
- Contorno: [Mitigação temporária, se houver]
- Causa raiz: [Se conhecida]
- Bloqueado por: [Se aguardando algo]

**[Descrição do bug]:**
- Sintomas: [O que acontece]
- Gatilho: [Como reproduzir]
- Contorno: [Mitigação temporária, se houver]
- Causa raiz: [Se conhecida]

## Considerações de Segurança

**[Área que requer cuidado de segurança]:**
- Risco: [O que pode dar errado]
- Mitigação atual: [O que está implementado agora]
- Recomendações: [O que deveria ser adicionado]

**[Área que requer cuidado de segurança]:**
- Risco: [O que pode dar errado]
- Mitigação atual: [O que está implementado agora]
- Recomendações: [O que deveria ser adicionado]

## Gargalos de Performance

**[Operação/endpoint lento]:**
- Problema: [O que está lento]
- Medição: [Números reais: "500ms p95", "2s de carregamento"]
- Causa: [Por que está lento]
- Caminho de melhoria: [Como acelerar]

**[Operação/endpoint lento]:**
- Problema: [O que está lento]
- Medição: [Números reais]
- Causa: [Por que está lento]
- Caminho de melhoria: [Como acelerar]

## Áreas Frágeis

**[Componente/Módulo]:**
- Por que é frágil: [O que o faz quebrar facilmente]
- Falhas comuns: [O que tipicamente dá errado]
- Modificação segura: [Como mudar sem quebrar]
- Cobertura de testes: [Está testado? Lacunas?]

**[Componente/Módulo]:**
- Por que é frágil: [O que o faz quebrar facilmente]
- Falhas comuns: [O que tipicamente dá errado]
- Modificação segura: [Como mudar sem quebrar]
- Cobertura de testes: [Está testado? Lacunas?]

## Limites de Escalabilidade

**[Recurso/Sistema]:**
- Capacidade atual: [Números: "100 req/seg", "10k usuários"]
- Limite: [Onde quebra]
- Sintomas no limite: [O que acontece]
- Caminho de escalabilidade: [Como aumentar a capacidade]

## Dependências em Risco

**[Pacote/Serviço]:**
- Risco: [ex.: "deprecado", "sem manutenção", "mudanças breaking chegando"]
- Impacto: [O que quebra se falhar]
- Plano de migração: [Alternativa ou caminho de upgrade]

## Funcionalidades Críticas Ausentes

**[Lacuna de funcionalidade]:**
- Problema: [O que está faltando]
- Contorno atual: [Como os usuários lidam]
- Bloqueia: [O que não pode ser feito sem isso]
- Complexidade de implementação: [Estimativa aproximada de esforço]

## Lacunas de Cobertura de Testes

**[Área não testada]:**
- O que não está testado: [Funcionalidade específica]
- Risco: [O que poderia quebrar despercebido]
- Prioridade: [Alta/Média/Baixa]
- Dificuldade de testar: [Por que ainda não está testado]

---

*Auditoria de preocupações: [data]*
*Atualizar conforme problemas são corrigidos ou novos descobertos*
```

<good_examples>
```markdown
# Codebase Concerns

**Analysis Date:** 2025-01-20

## Tech Debt

**Database queries in React components:**
- Issue: Direct Supabase queries in 15+ page components instead of server actions
- Files: `app/dashboard/page.tsx`, `app/profile/page.tsx`, `app/courses/[id]/page.tsx`
- Why: Rapid prototyping during MVP phase
- Impact: Can't implement RLS properly, exposes DB structure to client
- Fix approach: Move all queries to server actions in `app/actions/`, add proper RLS policies

## Known Bugs

**Race condition in subscription updates:**
- Symptoms: User shows as "free" tier for 5-10 seconds after successful payment
- Trigger: Fast navigation after Stripe checkout redirect, before webhook processes
- Workaround: Stripe webhook eventually updates status (self-heals)
- Root cause: Webhook processing slower than user navigation, no optimistic UI update

## Security Considerations

**Admin role check client-side only:**
- Risk: Admin dashboard pages check isAdmin from Supabase client, no server verification
- Current mitigation: None (relying on UI hiding)
- Recommendations: Add middleware to admin routes in `middleware.ts`, verify role server-side

---

*Concerns audit: 2025-01-20*
*Update as issues are fixed or new ones discovered*
```
</good_examples>

<guidelines>
**O que pertence ao CONCERNS.md:**
- Dívida técnica com impacto claro e abordagem de correção
- Bugs conhecidos com etapas de reprodução
- Lacunas de segurança e recomendações de mitigação
- Gargalos de performance com medições
- Código frágil que quebra facilmente
- Limites de escalabilidade com números
- Dependências que precisam de atenção
- Funcionalidades ausentes que bloqueiam workflows
- Lacunas de cobertura de testes

**O que NÃO pertence aqui:**
- Opiniões sem evidência ("código está bagunçado")
- Reclamações sem soluções ("auth está ruim")
- Ideias de funcionalidades futuras (isso é para planejamento de produto)
- TODOs normais (esses vivem em comentários de código)
- Decisões arquiteturais que estão funcionando bem
- Problemas menores de estilo de código

**Ao preencher este template:**
- **Sempre incluir caminhos de arquivo** — Preocupações sem localização não são acionáveis. Use backticks: `src/file.ts`
- Ser específico com medições ("500ms p95" não "lento")
- Incluir etapas de reprodução para bugs
- Sugerir abordagens de correção, não apenas problemas
- Focar em itens acionáveis
- Priorizar por risco/impacto
- Atualizar conforme problemas são resolvidos
- Adicionar novas preocupações conforme descobertas

**Diretrizes de tom:**
- Profissional, não emocional ("padrão N+1 de query" não "queries terríveis")
- Orientado a soluções ("Correção: adicionar índice" não "precisa de correção")
- Focado em risco ("Poderia expor dados do usuário" não "segurança está ruim")
- Factual ("3,5s de tempo de carregamento" não "muito lento")

**Útil para planejamento de fases quando:**
- Decidindo no que trabalhar a seguir
- Estimando risco de mudanças
- Entendendo onde ter cuidado
- Priorizando melhorias
- Integrando novos contextos Claude
- Planejando trabalho de refatoração

**Como isso é populado:**
Agentes Explore detectam esses durante o mapeamento do codebase. Adições manuais são bem-vindas para problemas descobertos por humanos. Esta é documentação viva, não uma lista de reclamações.
</guidelines>

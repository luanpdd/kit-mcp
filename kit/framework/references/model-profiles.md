# Perfis de Modelo

Perfis de modelo controlam qual modelo Claude cada agente framework usa. Isso permite equilibrar qualidade vs. custo de tokens, ou herdar o modelo de sessão selecionado atualmente.

## Definições de Perfil

| Agente | `quality` | `balanced` | `budget` | `inherit` |
|--------|-----------|------------|----------|-----------|
| planner | opus | opus | sonnet | inherit |
| roadmapper | opus | sonnet | sonnet | inherit |
| executor | opus | sonnet | sonnet | inherit |
| phase-researcher | opus | sonnet | haiku | inherit |
| project-researcher | opus | sonnet | haiku | inherit |
| research-synthesizer | sonnet | sonnet | haiku | inherit |
| debugger | opus | sonnet | sonnet | inherit |
| codebase-mapper | sonnet | haiku | haiku | inherit |
| verifier | sonnet | sonnet | sonnet | inherit |
| plan-checker | sonnet | sonnet | haiku | inherit |
| integration-checker | sonnet | sonnet | haiku | inherit |
| nyquist-auditor | sonnet | sonnet | haiku | inherit |

## Filosofia dos Perfis

**quality** - Máximo poder de raciocínio
- Opus para todos os agentes de tomada de decisão
- Sonnet para verificação somente-leitura
- Use quando: cota disponível, trabalho crítico de arquitetura

**balanced** (padrão) - Alocação inteligente
- Opus apenas para planejamento (onde decisões de arquitetura acontecem)
- Sonnet para execução e pesquisa (segue instruções explícitas)
- Sonnet para verificação (precisa de raciocínio, não apenas correspondência de padrões)
- Use quando: desenvolvimento normal, bom equilíbrio de qualidade e custo

**budget** - Uso mínimo de Opus
- Sonnet para qualquer coisa que escreva código
- Haiku para pesquisa e checks leves (plan-checker, integration-checker, nyquist)
- **Sonnet para o `verifier`** mesmo no budget — auditoria de objetivo nunca cai abaixo de sonnet
- Use quando: conservando cota, trabalho de alto volume, fases menos críticas

**inherit** - Seguir o modelo de sessão atual
- Todos os agentes resolvem para `inherit`
- Melhor quando você troca modelos interativamente (por exemplo `/model` do OpenCode)
- **Obrigatório ao usar provedores não-Anthropic** (OpenRouter, modelos locais, etc.) — caso contrário o framework pode chamar modelos Anthropic diretamente, gerando custos inesperados
- Use quando: você quer que o framework siga seu modelo de runtime selecionado atualmente

## Usando Runtimes Não-Claude (Codex, OpenCode, Antigravity CLI)

Quando instalado para um runtime não-Claude, o instalador do framework define `resolve_model_ids: "omit"` em `~/.framework/defaults.json`. Isso retorna um parâmetro model vazio para todos os agentes, então cada agente usa o modelo padrão do runtime. Nenhuma configuração manual é necessária.

Para atribuir modelos diferentes a agentes diferentes, adicione `model_overrides` com IDs de modelo que seu runtime reconhece:

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "planner": "o3",
    "executor": "o4-mini",
    "debugger": "o3",
    "codebase-mapper": "o4-mini"
  }
}
```

A mesma lógica de níveis se aplica: modelos mais fortes para planejamento e debugging, modelos mais baratos para execução e mapeamento.

## Usando Claude Code com Provedores Não-Anthropic (OpenRouter, Local)

Se você estiver usando Claude Code com OpenRouter, um modelo local, ou qualquer provedor não-Anthropic, defina o perfil `inherit` para evitar que o framework chame modelos Anthropic para subagentes:

```bash
# Via comando de configurações
/configuracoes
# → Selecione "Inherit" para perfil de modelo

# Ou manualmente em .planning/config.json
{
  "model_profile": "inherit"
}
```

Sem `inherit`, o perfil `balanced` padrão do framework spawna modelos Anthropic específicos (`opus`, `sonnet`, `haiku`) para cada tipo de agente, o que pode resultar em custos adicionais de API pelo seu provedor não-Anthropic.

## Lógica de Resolução

Orquestradores resolvem o modelo antes de spawnar:

```
1. Ler .planning/config.json
2. Verificar model_overrides para override específico de agente
3. Se não houver override, consultar agente na tabela de perfil
4. Passar parâmetro model para chamada Task
```

## Overrides Por Agente

Sobrescreva agentes específicos sem alterar o perfil inteiro:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "executor": "opus",
    "planner": "haiku"
  }
}
```

Overrides têm precedência sobre o perfil. Valores válidos: `opus`, `sonnet`, `haiku`, `inherit`, ou qualquer ID de modelo totalmente qualificado (ex: `"o3"`, `"openai/o3"`, `"google/gemini-2.5-pro"`).

## Alternando Perfis

Runtime: `/definir-perfil <perfil>`

Padrão por projeto: Defina em `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Justificativa do Design

**Por que Opus para planner?**
O planejamento envolve decisões de arquitetura, decomposição de objetivos e design de tarefas. É onde a qualidade do modelo tem o maior impacto.

**Por que Sonnet para executor?**
Executores seguem instruções explícitas do PLAN.md. O plano já contém o raciocínio; a execução é implementação.

**Por que Sonnet (não Haiku) para verificadores no balanced?**
A verificação requer raciocínio regressivo de objetivos — verificar se o código *entrega* o que a fase prometeu, não apenas correspondência de padrões. Sonnet lida bem com isso; Haiku pode perder lacunas sutis.

**Por que o `verifier` nunca cai abaixo de Sonnet (nem no budget)?**
Verificação É auditoria — decide se o código entrega o objetivo. Absorvido do padrão `improve` ("o modelo que AUDITA deve ser ao menos tão capaz quanto o que executou"): auditoria barata é auditoria que mente. Haiku perde stubs/HOLLOW props no rastreamento de fluxo de dados (nível 4), então o `verifier` resolve para `sonnet` em todos os perfis (budget incluído) e só sobe para opus no quality. Os checks mais leves (plan-checker, integration-checker, nyquist) seguem em haiku no budget — eles casam padrões, não auditam objetivo.

**Por que Haiku para codebase-mapper?**
Exploração somente-leitura e extração de padrões. Não requer raciocínio, apenas saída estruturada do conteúdo dos arquivos.

**Por que `inherit` em vez de passar `opus` diretamente?**
O alias `"opus"` do Claude Code mapeia para uma versão específica do modelo. Organizações podem bloquear versões mais antigas do opus enquanto permitem versões mais novas. O framework retorna `"inherit"` para agentes de nível opus, fazendo-os usar qualquer versão do opus que o usuário configurou na sessão. Isso evita conflitos de versão e fallbacks silenciosos para Sonnet.

**Por que o perfil `inherit`?**
Alguns runtimes (incluindo OpenCode) permitem que usuários troquem modelos em runtime (`/model`). O perfil `inherit` mantém todos os subagentes framework alinhados com essa seleção ao vivo.

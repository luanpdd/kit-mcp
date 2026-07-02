# Template de Debug

Template para `.planning/debug/[slug].md` — rastreamento de sessão de debug ativa.

---

## Template do Arquivo

```markdown
---
status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
trigger: "[entrada verbatim do usuário]"
created: [timestamp ISO]
updated: [timestamp ISO]
---

## Foco Atual
<!-- SOBRESCREVER a cada atualização - sempre reflete AGORA -->

hypothesis: [teoria atual sendo testada]
test: [como está sendo testado]
expecting: [o que significa o resultado se verdadeiro/falso]
next_action: [próximo passo imediato]

## Sintomas
<!-- Escrito durante gathering, depois imutável -->

expected: [o que deveria acontecer]
actual: [o que realmente acontece]
errors: [mensagens de erro, se houver]
reproduction: [como acionar]
started: [quando quebrou / sempre quebrado]

## Eliminados
<!-- APENAS APPEND - evita reinvestigação após /clear -->

- hypothesis: [teoria que estava errada]
  evidence: [o que a refutou]
  timestamp: [quando eliminado]

## Evidências
<!-- APENAS APPEND - fatos descobertos durante a investigação -->

- timestamp: [quando encontrado]
  checked: [o que foi examinado]
  found: [o que foi observado]
  implication: [o que isso significa]

## Resolução
<!-- SOBRESCREVER conforme o entendimento evolui -->

root_cause: [vazio até ser encontrado]
fix: [vazio até ser aplicado]
verification: [vazio até ser verificado]
files_changed: []
```

---

<section_rules>

**Frontmatter (status, trigger, timestamps):**
- `status`: SOBRESCREVER - reflete a fase atual
- `trigger`: IMUTÁVEL - entrada verbatim do usuário, nunca muda
- `created`: IMUTÁVEL - definido uma vez
- `updated`: SOBRESCREVER - atualizar a cada mudança

**Foco Atual:**
- SOBRESCREVER completamente a cada atualização
- Sempre reflete o que Claude está fazendo AGORA
- Se Claude ler após /clear, sabe exatamente onde retomar
- Campos: hypothesis, test, expecting, next_action

**Sintomas:**
- Escrito durante a fase inicial de gathering
- IMUTÁVEL após o gathering estar completo
- Ponto de referência do que estamos tentando corrigir
- Campos: expected, actual, errors, reproduction, started

**Eliminados:**
- APENAS APPEND - nunca remover entradas
- Evita reinvestigação de becos sem saída após reset de contexto
- Cada entrada: hypothesis, evidência que a refutou, timestamp
- Crítico para eficiência entre limites de /clear

**Evidências:**
- APENAS APPEND - nunca remover entradas
- Fatos descobertos durante a investigação
- Cada entrada: timestamp, o que foi checado, o que foi encontrado, implicação
- Constrói o caso para a causa raiz

**Resolução:**
- SOBRESCREVER conforme o entendimento evolui
- Pode atualizar múltiplas vezes enquanto correções são tentadas
- Estado final mostra causa raiz confirmada e correção verificada
- Campos: root_cause, fix, verification, files_changed

</section_rules>

<lifecycle>

**Criação:** Imediatamente quando /debug é chamado
- Criar arquivo com trigger da entrada do usuário
- Definir status como "gathering"
- Foco Atual: next_action = "gather symptoms"
- Sintomas: vazio, a ser preenchido

**Durante coleta de sintomas:**
- Atualizar seção Sintomas conforme o usuário responde perguntas
- Atualizar Foco Atual com cada pergunta
- Quando completo: status → "investigating"

**Durante investigação:**
- SOBRESCREVER Foco Atual com cada hipótese
- APPEND em Evidências com cada descoberta
- APPEND em Eliminados quando hipótese for refutada
- Atualizar timestamp no frontmatter

**Durante correção:**
- status → "fixing"
- Atualizar Resolução.root_cause quando confirmado
- Atualizar Resolução.fix quando aplicado
- Atualizar Resolução.files_changed

**Durante verificação:**
- status → "verifying"
- Atualizar Resolução.verification com resultados
- Se verificação falhar: status → "investigating", tentar novamente

**Após verificação própria passar:**
- status → "awaiting_human_verify"
- Solicitar confirmação explícita do usuário em um checkpoint
- NÃO mover arquivo para resolvido ainda

**Na resolução:**
- status → "resolved"
- Mover arquivo para .planning/debug/resolved/ (somente após usuário confirmar correção)

</lifecycle>

<resume_behavior>

Quando Claude ler este arquivo após /clear:

1. Analisar frontmatter → saber status
2. Ler Foco Atual → saber exatamente o que estava acontecendo
3. Ler Eliminados → saber o que NÃO tentar novamente
4. Ler Evidências → saber o que foi aprendido
5. Continuar a partir de next_action

O arquivo É o cérebro de debug. Claude deve ser capaz de retomar perfeitamente de qualquer ponto de interrupção.

</resume_behavior>

<size_constraint>

Manter arquivos de debug focados:
- Entradas de Evidências: 1-2 linhas cada, apenas os fatos
- Eliminados: breve - hipótese + por que falhou
- Sem prosa narrativa - apenas dados estruturados

Se as evidências crescerem muito (10+ entradas), considere se está andando em círculos. Verifique Eliminados para garantir que não está repisando o mesmo caminho.

</size_constraint>

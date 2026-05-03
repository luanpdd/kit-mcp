<purpose>
Surfaçar as premissas do Claude sobre uma fase antes do planejamento, permitindo que os usuários corrijam equívocos cedo.

Diferença principal do discutir-fase: Isso é ANÁLISE do que o Claude pensa, não COLETA do que o usuário sabe. Sem saída de arquivo — puramente conversacional para provocar discussão.
</purpose>

<process>

<step name="validate_phase" priority="first">
Número da fase: $ARGUMENTS (obrigatório)

**Se argumento ausente:**

```
Erro: Número de fase obrigatório.

Uso: /listar-hipoteses-fase [número-fase]
Exemplo: /listar-hipoteses-fase 3
```

Sair do workflow.

**Se argumento fornecido:**
Validar que a fase existe no roadmap:

```bash
cat .planning/ROADMAP.md | grep -i "Phase ${PHASE}"
```

**Se fase não encontrada:**

```
Erro: Fase ${PHASE} não encontrada no roadmap.

Fases disponíveis:
[listar fases do roadmap]
```

Sair do workflow.

**Se fase encontrada:**
Analisar detalhes da fase do roadmap:

- Número da fase
- Nome da fase
- Descrição/objetivo da fase
- Quaisquer detalhes de escopo mencionados

Continuar para analyze_phase.
</step>

<step name="analyze_phase">
Com base na descrição do roadmap e contexto do projeto, identificar premissas em cinco áreas:

**1. Abordagem Técnica:**
Quais bibliotecas, frameworks, padrões ou ferramentas o Claude usaria?
- "Eu usaria a biblioteca X porque..."
- "Eu seguiria o padrão Y porque..."
- "Eu estruturaria isso como Z porque..."

**2. Ordem de Implementação:**
O que o Claude construiria primeiro, segundo, terceiro?
- "Eu começaria com X porque é fundamental"
- "Então Y porque depende de X"
- "Por fim Z porque..."

**3. Limites de Escopo:**
O que está incluído vs excluído na interpretação do Claude?
- "Esta fase inclui: A, B, C"
- "Esta fase NÃO inclui: D, E, F"
- "Ambiguidades de limite: G pode ir para qualquer lado"

**4. Áreas de Risco:**
Onde o Claude espera complexidade ou desafios?
- "A parte complicada é X porque..."
- "Problemas potenciais: Y, Z"
- "Eu ficaria de olho em..."

**5. Dependências:**
O que o Claude assume que existe ou precisa estar em vigor?
- "Isso assume X de fases anteriores"
- "Dependências externas: Y, Z"
- "Isso será consumido por..."

Seja honesto sobre incerteza. Marque premissas com níveis de confiança:
- "Bastante confiante: ..." (claro no roadmap)
- "Assumindo: ..." (inferência razoável)
- "Incerto: ..." (pode ir por múltiplos caminhos)
</step>

<step name="present_assumptions">
Apresentar premissas em formato claro e escaneável:

```
## Minhas Premissas para a Fase ${PHASE}: ${PHASE_NAME}

### Abordagem Técnica
[Listar premissas sobre como implementar]

### Ordem de Implementação
[Listar premissas sobre sequenciamento]

### Limites de Escopo
**No escopo:** [o que está incluído]
**Fora do escopo:** [o que está excluído]
**Ambíguo:** [o que pode ir para qualquer lado]

### Áreas de Risco
[Listar desafios antecipados]

### Dependências
**De fases anteriores:** [o que é necessário]
**Externas:** [necessidades de terceiros]
**Alimenta:** [o que fases futuras precisam disso]

---

**O que você acha?**

Essas premissas são precisas? Me diga:
- O que eu acertei
- O que eu errei
- O que estou perdendo
```

Aguardar resposta do usuário.
</step>

<step name="gather_feedback">
**Se o usuário fornece correções:**

Reconhecer as correções:

```
Correções principais:
- [correção 1]
- [correção 2]

Isso muda meu entendimento significativamente. [Resumir novo entendimento]
```

**Se o usuário confirma premissas:**

```
Premissas validadas.
```

Continuar para offer_next.
</step>

<step name="offer_next">
Apresentar próximos passos:

```
O que vem a seguir?
1. Discutir contexto (/discutir-fase ${PHASE}) - Deixe-me fazer perguntas para construir contexto abrangente
2. Planejar esta fase (/planejar-fase ${PHASE}) - Criar planos de execução detalhados
3. Re-examinar premissas - Analisarei novamente com suas correções
4. Por ora é suficiente
```

Aguardar seleção do usuário.

Se "Discutir contexto": Observar que CONTEXT.md incorporará quaisquer correções discutidas aqui
Se "Planejar esta fase": Prosseguir sabendo que as premissas são compreendidas
Se "Re-examinar": Retornar para analyze_phase com entendimento atualizado
</step>

</process>

<success_criteria>
- Número de fase validado contra o roadmap
- Premissas surfaçadas em cinco áreas: abordagem técnica, ordem de implementação, escopo, riscos, dependências
- Níveis de confiança marcados onde apropriado
- Prompt "O que você acha?" apresentado
- Feedback do usuário reconhecido
- Próximos passos claros oferecidos
</success_criteria>

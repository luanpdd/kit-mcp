<purpose>
Executar descoberta no nível de profundidade adequado.
Produz DISCOVERY.md (para Nível 2-3) que informa a criação do PLAN.md.

Chamado a partir do passo mandatory_discovery do plan-phase.md com um parâmetro de profundidade.

NOTA: Para pesquisa abrangente de ecossistema ("como especialistas constroem isso"), use /pesquisar-fase, que produz RESEARCH.md.
</purpose>

<depth_levels>
**Este workflow suporta três níveis de profundidade:**

| Nível | Nome | Tempo | Saída | Quando |
|-------|------|-------|-------|--------|
| 1 | Verificação Rápida | 2-5 min | Nenhum arquivo, prosseguir com conhecimento verificado | Biblioteca única, confirmando sintaxe atual |
| 2 | Padrão | 15-30 min | DISCOVERY.md | Escolhendo entre opções, nova integração |
| 3 | Mergulho Profundo | 1+ hora | DISCOVERY.md detalhado com portões de validação | Decisões arquiteturais, problemas novos |

**A profundidade é determinada pelo plan-phase.md antes de rotear aqui.**
</depth_levels>

<source_hierarchy>
**OBRIGATÓRIO: Context7 ANTES do WebSearch**

Os dados de treinamento do Claude têm 6-18 meses de defasagem. Sempre verifique.

1. **Context7 MCP PRIMEIRO** — Documentação atual, sem alucinação
2. **Documentação oficial** — Quando o Context7 não tem cobertura suficiente
3. **WebSearch POR ÚLTIMO** — Apenas para comparações e tendências

Consulte `<discovery_protocol>` em ./.claude/framework/templates/discovery.md para o protocolo completo.
</source_hierarchy>

<process>

<step name="determine_depth">
Verificar o parâmetro de profundidade passado pelo plan-phase.md:
- `depth=verify` → Nível 1 (Verificação Rápida)
- `depth=standard` → Nível 2 (Descoberta Padrão)
- `depth=deep` → Nível 3 (Mergulho Profundo)

Encaminhar para o fluxo de nível adequado abaixo.
</step>

<step name="level_1_quick_verify">
**Nível 1: Verificação Rápida (2-5 minutos)**

Para: Biblioteca única conhecida, confirmando se a sintaxe/versão ainda está correta.

**Processo:**

1. Resolver biblioteca no Context7:

   ```
   mcp__context7__resolve-library-id with libraryName: "[biblioteca]"
   ```

2. Buscar documentação relevante:

   ```
   mcp__context7__get-library-docs with:
   - context7CompatibleLibraryID: [do passo 1]
   - topic: [preocupação específica]
   ```

3. Verificar:

   - Versão atual corresponde às expectativas
   - Sintaxe da API inalterada
   - Sem breaking changes em versões recentes

4. **Se verificado:** Retornar ao plan-phase.md com confirmação. DISCOVERY.md não é necessário.

5. **Se problemas encontrados:** Escalar para Nível 2.

**Saída:** Confirmação verbal para prosseguir, ou escalada para Nível 2.
</step>

<step name="level_2_standard">
**Nível 2: Descoberta Padrão (15-30 minutos)**

Para: Escolhendo entre opções, nova integração externa.

**Processo:**

1. **Identificar o que descobrir:**

   - Quais opções existem?
   - Quais são os critérios de comparação chave?
   - Qual é o nosso caso de uso específico?

2. **Context7 para cada opção:**

   ```
   Para cada biblioteca/framework:
   - mcp__context7__resolve-library-id
   - mcp__context7__get-library-docs (mode: "code" para API, "info" para conceitos)
   ```

3. **Documentação oficial** para o que o Context7 não cobre.

4. **WebSearch** para comparações:

   - "[opção A] vs [opção B] {ano_atual}"
   - "[opção] problemas conhecidos"
   - "[opção] com [nossa stack]"

5. **Verificação cruzada:** Qualquer resultado do WebSearch → confirmar com Context7/documentação oficial.

6. **Criar DISCOVERY.md** usando a estrutura de ./.claude/framework/templates/discovery.md:

   - Resumo com recomendação
   - Descobertas chave por opção
   - Exemplos de código do Context7
   - Nível de confiança (deve ser MÉDIO-ALTO para Nível 2)

7. Retornar ao plan-phase.md.

**Saída:** `.planning/phases/XX-name/DISCOVERY.md`
</step>

<step name="level_3_deep_dive">
**Nível 3: Mergulho Profundo (1+ hora)**

Para: Decisões arquiteturais, problemas novos, escolhas de alto risco.

**Processo:**

1. **Definir o escopo da descoberta** usando ./.claude/framework/templates/discovery.md:

   - Definir escopo claro
   - Definir limites de inclusão/exclusão
   - Listar perguntas específicas a responder

2. **Pesquisa exaustiva no Context7:**

   - Todas as bibliotecas relevantes
   - Padrões e conceitos relacionados
   - Múltiplos tópicos por biblioteca se necessário

3. **Leitura aprofundada da documentação oficial:**

   - Guias de arquitetura
   - Seções de melhores práticas
   - Guias de migração/upgrade
   - Limitações conhecidas

4. **WebSearch para contexto do ecossistema:**

   - Como outros resolveram problemas similares
   - Experiências em produção
   - Armadilhas e anti-padrões
   - Mudanças/anúncios recentes

5. **Verificação cruzada de TODOS os resultados:**

   - Toda afirmação do WebSearch → verificar com fonte autoritativa
   - Marcar o que é verificado vs assumido
   - Sinalizar contradições

6. **Criar DISCOVERY.md abrangente:**

   - Estrutura completa de ./.claude/framework/templates/discovery.md
   - Relatório de qualidade com atribuição de fontes
   - Confiança por descoberta
   - Se confiança BAIXA em qualquer descoberta crítica → adicionar pontos de verificação

7. **Portão de confiança:** Se a confiança geral for BAIXA, apresentar opções antes de prosseguir.

8. Retornar ao plan-phase.md.

**Saída:** `.planning/phases/XX-name/DISCOVERY.md` (abrangente)
</step>

<step name="identify_unknowns">
**Para Nível 2-3:** Definir o que precisamos aprender.

Perguntar: O que precisamos aprender antes de poder planejar esta fase?

- Escolhas de tecnologia?
- Melhores práticas?
- Padrões de API?
- Abordagem de arquitetura?
</step>

<step name="create_discovery_scope">
Usar ./.claude/framework/templates/discovery.md.

Incluir:

- Objetivo claro de descoberta
- Listas de inclusão/exclusão definidas
- Preferências de fonte (documentação oficial, Context7, ano atual)
- Estrutura de saída para DISCOVERY.md
</step>

<step name="execute_discovery">
Executar a descoberta:
- Usar busca na web para informações atuais
- Usar Context7 MCP para documentação de biblioteca
- Preferir fontes do ano atual
- Estruturar descobertas conforme o template
</step>

<step name="create_discovery_output">
Escrever `.planning/phases/XX-name/DISCOVERY.md`:
- Resumo com recomendação
- Descobertas chave com fontes
- Exemplos de código se aplicável
- Metadados (confiança, dependências, questões abertas, premissas)
</step>

<step name="confidence_gate">
Após criar o DISCOVERY.md, verificar nível de confiança.

Se a confiança for BAIXA:
Usar AskUserQuestion:

- header: "Conf. Baixa"
- question: "A confiança da descoberta é BAIXA: [motivo]. Como gostaria de prosseguir?"
- options:
  - "Aprofundar" — Fazer mais pesquisa antes de planejar
  - "Prosseguir mesmo assim" — Aceitar incerteza, planejar com ressalvas
  - "Pausar" — Preciso pensar sobre isso

Se a confiança for MÉDIA:
Inline: "Descoberta concluída (confiança média). [breve motivo]. Prosseguir para o planejamento?"

Se a confiança for ALTA:
Prosseguir diretamente, apenas registrar: "Descoberta concluída (alta confiança)."
</step>

<step name="open_questions_gate">
Se DISCOVERY.md tiver open_questions:

Apresentá-las inline:
"Questões abertas da descoberta:

- [Questão 1]
- [Questão 2]

Estas podem afetar a implementação. Reconhecer e prosseguir? (sim / resolver primeiro)"

Se "resolver primeiro": Coletar input do usuário sobre as questões, atualizar a descoberta.
</step>

<step name="offer_next">
```
Descoberta concluída: .planning/phases/XX-name/DISCOVERY.md
Recomendação: [em uma linha]
Confiança: [nível]

O que vem a seguir?

1. Discutir contexto da fase (/discutir-fase [fase-atual])
2. Criar plano da fase (/planejar-fase [fase-atual])
3. Refinar descoberta (aprofundar)
4. Revisar descoberta

```

NOTA: DISCOVERY.md NÃO é commitado separadamente. Será commitado com a conclusão da fase.
</step>

</process>

<success_criteria>
**Nível 1 (Verificação Rápida):**
- Context7 consultado para biblioteca/tópico
- Estado atual verificado ou preocupações escaladas
- Confirmação verbal para prosseguir (sem arquivos)

**Nível 2 (Padrão):**
- Context7 consultado para todas as opções
- Resultados do WebSearch verificados de forma cruzada
- DISCOVERY.md criado com recomendação
- Nível de confiança MÉDIO ou superior
- Pronto para informar a criação do PLAN.md

**Nível 3 (Mergulho Profundo):**
- Escopo de descoberta definido
- Context7 consultado de forma exaustiva
- Todos os resultados do WebSearch verificados contra fontes autoritativas
- DISCOVERY.md criado com análise abrangente
- Relatório de qualidade com atribuição de fontes
- Se descobertas com confiança BAIXA → pontos de verificação definidos
- Portão de confiança passado
- Pronto para informar a criação do PLAN.md
</success_criteria>

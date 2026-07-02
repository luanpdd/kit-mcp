# Template de Discovery

Template para `.planning/phases/XX-name/DISCOVERY.md` - pesquisa rasa para decisões de biblioteca/opção.

**Propósito:** Responder perguntas "qual biblioteca/opção devemos usar" durante a discovery obrigatória no plan-phase.

Para pesquisa profunda de ecossistema ("como especialistas constroem isso"), use `/research-phase` que produz RESEARCH.md.

---

## Template do Arquivo

```markdown
---
phase: XX-name
type: discovery
topic: [discovery-topic]
---

<session_initialization>
Before beginning discovery, verify today's date:
!`date +%Y-%m-%d`

Use this date when searching for "current" or "latest" information.
Example: If today is 2025-11-22, search for "2025" not "2024".
</session_initialization>

<discovery_objective>
Discover [topic] to inform [phase name] implementation.

Purpose: [What decision/implementation this enables]
Scope: [Boundaries]
Output: DISCOVERY.md with recommendation
</discovery_objective>

<discovery_scope>
<include>
- [Question to answer]
- [Area to investigate]
- [Specific comparison if needed]
</include>

<exclude>
- [Out of scope for this discovery]
- [Defer to implementation phase]
</exclude>
</discovery_scope>

<discovery_protocol>

**Source Priority:**
1. **Context7 MCP** - For library/framework documentation (current, authoritative)
2. **Official Docs** - For platform-specific or non-indexed libraries
3. **WebSearch** - For comparisons, trends, community patterns (verify all findings)

**Quality Checklist:**
Before completing discovery, verify:
- [ ] All claims have authoritative sources (Context7 or official docs)
- [ ] Negative claims ("X is not possible") verified with official documentation
- [ ] API syntax/configuration from Context7 or official docs (never WebSearch alone)
- [ ] WebSearch findings cross-checked with authoritative sources
- [ ] Recent updates/changelogs checked for breaking changes
- [ ] Alternative approaches considered (not just first solution found)

**Confidence Levels:**
- HIGH: Context7 or official docs confirm
- MEDIUM: WebSearch + Context7/official docs confirm
- LOW: WebSearch only or training knowledge only (mark for validation)

</discovery_protocol>


<output_structure>
Create `.planning/phases/XX-name/DISCOVERY.md`:

```markdown
# Descoberta: [Tópico]

## Resumo
[Resumo executivo de 2-3 parágrafos — o que foi pesquisado, o que foi encontrado, o que é recomendado]

## Recomendação Principal
[O que fazer e por quê — seja específico e acionável]

## Alternativas Consideradas
[O que mais foi avaliado e por que não foi escolhido]

## Descobertas Chave

### [Categoria 1]
- [Descoberta com URL de fonte e relevância para nosso caso]

### [Categoria 2]
- [Descoberta com URL de fonte e relevância]

## Exemplos de Código
[Padrões de implementação relevantes, se aplicável]

## Metadados

<metadata>
<confidence level="high|medium|low">
[Por que este nível de confiança — baseado na qualidade das fontes e verificação]
</confidence>

<sources>
- [Fontes autoritativas primárias usadas]
</sources>

<open_questions>
[O que não pôde ser determinado ou precisa de validação durante a implementação]
</open_questions>

<validation_checkpoints>
[Se a confiança for LOW ou MEDIUM, liste coisas específicas a verificar durante a implementação]
</validation_checkpoints>
</metadata>
```
</output_structure>

<success_criteria>
- All scope questions answered with authoritative sources
- Quality checklist items completed
- Clear primary recommendation
- Low-confidence findings marked with validation checkpoints
- Ready to inform PLAN.md creation
</success_criteria>

<guidelines>
**Quando usar discovery:**
- Escolha de tecnologia incerta (biblioteca A vs B)
- Melhores práticas necessárias para integração desconhecida
- Investigação de API/biblioteca necessária
- Decisão única pendente

**Quando NÃO usar:**
- Padrões estabelecidos (CRUD, auth com biblioteca conhecida)
- Detalhes de implementação (diferir para execução)
- Perguntas respondíveis a partir do contexto existente do projeto

**Quando usar RESEARCH.md em vez disso:**
- Domínios niche/complexos (3D, jogos, áudio, shaders)
- Necessidade de conhecimento de ecossistema, não apenas escolha de biblioteca
- Perguntas "como especialistas constroem isso"
- Use `/research-phase` para esses casos
</guidelines>

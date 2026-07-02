---
phase: 39
plan: 01
title: Patch event-based-slos — bloco "Risk continuum" cross-ref sre-risk-management
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/event-based-slos/SKILL.md
requirements: [INT-OBS-01]
status: ready
---

# Plan 01 — Patch `kit/skills/event-based-slos/SKILL.md`

## Goal

Adicionar bloco editorial "Risk continuum" na skill `event-based-slos` (v1.9) cross-referenciando a skill `sre-risk-management` (v1.10 / Phase 36). O bloco deve explicitar que **SLO target NÃO é meta arbitrária** — é uma escolha consciente no continuum risk × innovation, com sabedoria 99.99% e tabela de tolerância → custo. Frontmatter (`description`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-OBS-01**.

## Files to create

(nenhum — apenas patch em arquivo existente)

## Files to modify

- `D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `description` (`Use ao definir SLO — SLI event-based...`) preservado byte-a-byte (anti-pitfall A2)
- **Cross-ref Markdown ATIVO** — `[sre-risk-management](../sre-risk-management/SKILL.md)` (relative link real, não placeholder)
- **Posicionamento editorial** — bloco entra logo após `## Regras absolutas` e antes de `## Patterns canônicos` (lugar natural — risk continuum é regra fundacional do target)
- **Sem mover/deletar conteúdo existente** — apenas inserção
- **Tom canônico** — manter mesmo registro PT-BR + em-dashes + tabelas markdown da skill original
- **Sem alterar regras existentes** — regra "Target ≤ 99.95%" continua intacta; bloco apenas explica POR QUÊ via continuum

## Tasks

<task id="39-01-T1" name="Verificar estado pré-patch e ler cross-ref">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (arquivo target — confirmar frontmatter atual e localizar âncora `## Patterns canônicos`)
    - D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md (linhas 30-60 — capturar a tabela canônica do continuum para citar resumidamente)
  </read_first>
  <action>
    1. Capturar conteúdo atual do frontmatter (linhas 1-4) — usar como referência para diff pós-patch.
    2. Localizar linha exata da heading `## Patterns canônicos` (esperada ~linha 30).
    3. Não escrever ainda — esta é validação preparatória.
  </action>
  <acceptance_criteria>
    - Frontmatter atual confirmado: `name: event-based-slos` + description começa com `Use ao definir SLO`
    - Heading `## Patterns canônicos` localizada
    - Skill `sre-risk-management` confirmada existir em `kit/skills/sre-risk-management/SKILL.md`
  </acceptance_criteria>
</task>

<task id="39-01-T2" name="Inserir bloco Risk continuum">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (re-leitura focada em `## Regras absolutas` linha final + `## Patterns canônicos` primeira linha)
    - D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md (tabela "risk continuum como decisão explícita")
  </read_first>
  <action>
    Usar Edit para inserir o bloco abaixo **imediatamente antes** da linha `## Patterns canônicos`. O bloco deve preservar marcação "exata" (line endings, espaços) — nenhuma edição em qualquer outro ponto do arquivo:

    ```markdown
    ## Risk continuum — SLO target é decisão explícita

    > Cross-ref canônico: [sre-risk-management](../sre-risk-management/SKILL.md) (cap 3 do livro Google SRE — Embracing Risk).

    SLO target NÃO é meta arbitrária ("queremos 99.99% porque soa bom"). É uma escolha consciente no **continuum risk × innovation**: cada nove adicional **multiplica custo** mas **divide benefício marginal** percebido pelo cliente.

    | Target | Tolerância 30d | User-perceptible? | Quando faz sentido |
    |---|---|---|---|
    | 99% | 7.2 h | Sim, notável | Tier free, beta features, internal tools |
    | 99.5% | 3.6 h | Notável em paths críticos | Tier free de produção |
    | 99.9% | 43.2 min | Aceitável para maior parte de UX | Tier paid default |
    | 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical |
    | 99.99% | 4.3 min | Imperceptível em smartphone (~99% no canal do user) | Apenas se justificado por user perception (raro) |

    **Sabedoria 99.99%** — cliente final acessa via smartphone (~99% disponibilidade) com ISP residencial (~99%). Serviço 99.99% **não é distinguível** de 99.999% nesse contexto: ambos parecem "sempre funcionando". Esforço além de 99.95% para serviço user-facing é tipicamente desperdício.

    **Error budget é o instrumento contábil dessa decisão.** Para SLO 99.9% em 30d com 10M eventos: budget = `0.001 × 10M = 10k bad events`. Esse 10k é orçamento explícito para gastar em deploys arriscados, experimentos, refactors. Quando esgota, releases freezam até regenerar — não como punição, mas como **balanço explícito risk × innovation**.

    **Diferentes tiers, diferentes targets** — `customer.tier='enterprise'` pode justificar 99.95%; `tier='free'` pode operar em 99.5%. Tratar todos como tier-1 desperdiça budget; tratar todos como tier-3 frustra clientes pagantes. A skill `sre-risk-management` documenta o framework completo de decisão.

    > Em resumo: a regra `Target ≤ 99.95%` desta skill (acima) é **consequência** do risk continuum, não restrição arbitrária. Para 99.99%+ trate como métrica informativa (dashboard), NÃO como SLO acionável (alerts).

    ```

    Após inserção, `## Patterns canônicos` permanece como heading subsequente — sem alteração.

    Comando concreto sugerido para o executor:
    - Localizar a linha que começa com `## Patterns canônicos`
    - Inserir o bloco completo acima imediatamente antes dessa linha (com 1 linha em branco antes e 1 linha em branco depois do bloco para preservar separação de seções markdown)
  </action>
  <acceptance_criteria>
    - Heading `## Risk continuum — SLO target é decisão explícita` existe **antes** de `## Patterns canônicos`
    - Bloco contém literal `[sre-risk-management](../sre-risk-management/SKILL.md)` (Markdown link ativo, relative path correto — `../sre-risk-management/SKILL.md` saindo de `event-based-slos/SKILL.md`)
    - Bloco contém tabela markdown com 5+ rows (99% até 99.99% mínimo) com 4 colunas (Target, Tolerância, User-perceptible, Quando faz sentido)
    - Bloco menciona literalmente "sabedoria 99.99%" (frase canônica do livro Google SRE)
    - Bloco menciona "error budget" como balanço risk × innovation
    - Heading `## Patterns canônicos` existente preservada (não duplicada, não removida)
  </acceptance_criteria>
</task>

<task id="39-01-T3" name="Diff frontmatter + validação smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 1-4 — verificar frontmatter pós-patch)
  </read_first>
  <action>
    Validação pós-patch — comandos shell:

    ```bash
    # 1. Frontmatter PRESERVADO byte-a-byte
    head -4 kit/skills/event-based-slos/SKILL.md
    # Esperado linhas exatas:
    # ---
    # name: event-based-slos
    # description: Use ao definir SLO — SLI event-based (não time-based), sliding window 30d, decouple what/why. SLO-based alerts substituem thresholds brutos como CPU/memória.
    # ---

    # 2. Heading nova existe e é única
    grep -c "^## Risk continuum" kit/skills/event-based-slos/SKILL.md   # esperado: 1
    grep -c "^## Patterns canônicos" kit/skills/event-based-slos/SKILL.md # esperado: 1 (preservado)
    grep -c "^## Regras absolutas" kit/skills/event-based-slos/SKILL.md  # esperado: 1 (preservado)

    # 3. Cross-ref ativo (Markdown link literal)
    grep -c "\[sre-risk-management\](../sre-risk-management/SKILL.md)" kit/skills/event-based-slos/SKILL.md  # esperado: ≥1

    # 4. Frase canônica
    grep -c "sabedoria 99.99%" kit/skills/event-based-slos/SKILL.md  # esperado: ≥1

    # 5. Smoke sync — patched file presente em .claude/skills/
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/skills/event-based-slos/SKILL.md" ] && grep -q "Risk continuum" "$TMP/.claude/skills/event-based-slos/SKILL.md" && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```

    Smoke E2E adicional — git diff validation:

    ```bash
    # Confirmar que apenas inserção ocorreu (linhas adicionadas; nenhuma deletada/modificada)
    git diff --numstat kit/skills/event-based-slos/SKILL.md
    # Esperado: insertions > 0, deletions == 0
    ```
  </action>
  <acceptance_criteria>
    - `head -4` mostra frontmatter idêntico ao pré-patch (description byte-a-byte)
    - `grep -c "^## Risk continuum"` == 1
    - `grep -c "^## Patterns canônicos"` == 1 (não removido nem duplicado)
    - `grep -c "\[sre-risk-management\](../sre-risk-management/SKILL.md)"` ≥ 1
    - `git diff --numstat` retorna `<insertions>\t0\t<path>` (zero deletions = patch puro de adição)
    - Smoke `kit sync claude-code` propaga patch para `.claude/skills/event-based-slos/SKILL.md`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Bloco `## Risk continuum — SLO target é decisão explícita` inserido antes de `## Patterns canônicos`
- [ ] Cross-ref Markdown literal `[sre-risk-management](../sre-risk-management/SKILL.md)` presente e válido (relative path resolve)
- [ ] Tabela continuum com 5+ rows (99% até 99.99%) presente
- [ ] Frase "sabedoria 99.99%" presente
- [ ] Frontmatter byte-idêntico ao pré-patch (`head -4` confirma)
- [ ] `git diff --numstat` mostra apenas insertions (zero deletions)
- [ ] Smoke sync propaga para `.claude/skills/`
- [ ] Cobre INT-OBS-01 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.9 (anti-pitfall A2)
2. Bloco editorial **explica** que SLO target é decisão no continuum, não meta arbitrária
3. Cross-ref ATIVO para `sre-risk-management` (link Markdown válido) — descoberta cross-skill
4. Tabela continuum referenciada (não duplicada — apenas resumo + ponteiro para skill canônica)
5. Frase canônica "sabedoria 99.99%" presente — vocabulary mapping com livro SRE
6. Patch puro de adição — zero modificação em conteúdo existente
7. Smoke sync valida descoberta em `.claude/skills/`

## Notes

- **Patch editorial puro** — sem mudança em frontmatter, sem mudança em regras/patterns existentes; apenas inserção de bloco contextual
- Tamanho esperado do patch: ~30-40 linhas adicionadas
- Cross-ref bidirecional: skill `sre-risk-management` já existe (Phase 36) e tem `## Ver também` — verificação manual opcional confirma loop fechado
- Esta skill é a **âncora editorial** de v1.9 onde SLO target é discutido; bloco aqui aproveita audiência natural sem requerer rewrite da skill v1.10

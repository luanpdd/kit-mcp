---
phase: 40
plan: 01
title: Patch /forense — sugerir chain /postmortem após Core Analysis Loop fechar
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/forense.md
requirements: [INT-FW-V2-01]
status: ready
---

# Plan 01 — Patch `kit/commands/forense.md`

## Goal

Adicionar bloco `<sre_integration>` ao comando `/forense` (v1.9) que **sugere chain automática `/postmortem`** após o Core Analysis Loop fechar com root cause confirmada (status `VALIDATED` em alguma hipótese principal). O bloco documenta o fluxo `forense → postmortem`: forense diagnostica (read-only, evidence-based, científico); postmortem documenta blameless para aprendizado organizacional (cap 15 livro Google SRE — *Postmortem Culture: Learning from Failure*). Frontmatter (`description`, `allowed-tools`) **inalterado** (anti-pitfall A2 preservado). Cobre **INT-FW-V2-01**.

## Files to modify

- `D:/projetos/opensource/mcp/kit/commands/forense.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter NÃO alterado** — `type: prompt`, `name: forense`, `description: Investigação post-mortem de workflows framework com falha — analisa histórico git, artefatos e estado para diagnosticar o que deu errado`, `argument-hint`, `allowed-tools` (`Read, Write, Bash, Grep, Glob`) preservados byte-a-byte
- **Workflow `.claude/framework/workflows/forensics.md` NÃO alterado** — patch é editorial no command em `kit/commands/`, lógica de execução do workflow continua intacta
- **Bloco `<observability_integration>` v1.9 PRESERVADO** — INT-FW-06 (Core Analysis Loop) continua funcional; novo bloco `<sre_integration>` é **adicionado** após `<observability_integration>`, não substitui
- **Cross-ref Markdown ATIVO** — `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)` + `[postmortem-writer](../agents/postmortem-writer.md)` + comando literal `/postmortem --from-investigation`
- **Posicionamento canônico** — bloco `<sre_integration>` inserido **após** o bloco `</observability_integration>` (linha ~75) como **última seção** do arquivo
- **Tom canônico** — manter mesmo registro PT-BR + en-dashes do command original

## Tasks

<task id="40-01-T1" name="Verificar estado e localizar âncora de patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/forense.md (frontmatter linhas 1-12 + bloco `<observability_integration>` linhas 58-75 + final do arquivo)
    - D:/projetos/opensource/mcp/kit/commands/postmortem.md (verificar comando existe — já confirmado em CONTEXT)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 1-30 — confirmar nome canônico da skill v1.10/Phase 36)
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (linhas 1-10 — confirmar nome canônico do agent v1.10/Phase 37)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar frontmatter atual byte-idêntico (`type: prompt`, `name: forense`, `description: Investigação post-mortem de workflows framework com falha — analisa histórico git, artefatos e estado para diagnosticar o que deu errado`, `argument-hint: "[descrição do problema]"`, `allowed-tools: [Read, Write, Bash, Grep, Glob]`)
    2. Localizar âncora `</observability_integration>` (esperada linha ~75, fim do arquivo) — bloco `<sre_integration>` será inserido **imediatamente após** essa tag de fechamento
    3. Confirmar que o arquivo `kit/commands/forense.md` termina com a tag `</observability_integration>` (não há outro conteúdo depois)
    4. Confirmar paths de cross-ref: `kit/skills/blameless-postmortems/SKILL.md` e `kit/agents/postmortem-writer.md` existem
  </action>
  <acceptance_criteria>
    - Frontmatter byte-a-byte confirmado (5 campos preservados)
    - `</observability_integration>` localizada como última tag do arquivo
    - Skill `blameless-postmortems` confirmada existir
    - Agent `postmortem-writer` confirmado existir
    - Comando `/postmortem` confirmado existir em `kit/commands/postmortem.md`
  </acceptance_criteria>
</task>

<task id="40-01-T2" name="Adicionar bloco <sre_integration> com chain /postmortem">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/forense.md (re-leitura final do arquivo)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** a linha `</observability_integration>` (última linha do arquivo), uma nova linha em branco e o seguinte bloco como **última seção** do arquivo:

    ```markdown
    <sre_integration>
    **Chain `/postmortem` após Core Analysis Loop (v1.10 — INT-FW-V2-01):**

    Forense é diagnóstico evidence-based read-only — identifica o **o que** e o **como** via método científico (sintoma → hipótese → query → status `VALIDATED | REFUTED | INCONCLUSIVE`). Quando o Core Analysis Loop fecha com pelo menos uma hipótese `VALIDATED` apontando para root cause, o próximo passo canônico é **postmortem blameless** (cap 15 livro Google SRE — *Postmortem Culture: Learning from Failure*).

    Distinção fundamental:

    | Etapa | Pergunta respondida | Output | Audiência |
    |---|---|---|---|
    | Forense | "O que aconteceu? Onde está a evidência?" | `.planning/forensics/report-<ts>.md` | Investigador (você) |
    | Postmortem | "O que aprendemos? O que mudaremos?" | `.planning/postmortems/<id>.md` | Organização inteira (no postmortem left unreviewed) |

    Forense **diagnostica**; postmortem **transforma diagnóstico em aprendizado durável**. Pular postmortem = perder aprendizado organizacional (anti-pattern hero culture: "fixei o bug, vamos seguir").

    **Trigger automático sugerido (não-bloqueante):**

    Quando o relatório forense conclui com:
    - ≥ 1 hipótese `VALIDATED` apontando root cause acionável, OU
    - Incident impactou usuário (não apenas dev experience), OU
    - Workflow framework crashou em produção (não dogfooding)

    O comando `/forense` **sugere ao usuário** ao final do relatório:

    ```text
    Próximo passo recomendado:
      /postmortem --from-investigation <forensic-id>
    Continua o blameless write-up com Summary + Impact + Root Causes + Action Items.
    Cross-ref canônico: [blameless-postmortems](../skills/blameless-postmortems/SKILL.md) skill + [postmortem-writer](../agents/postmortem-writer.md) agent.
    ```

    **Chain de fluxo canônico:**

    ```text
    Falha detectada
      ↓
    /forense "<descrição>"   ← diagnóstico evidence-based (este comando)
      ↓ (Core Analysis Loop fecha com VALIDATED)
    /postmortem --from-investigation <id>   ← blameless write-up (chain sugerido)
      ↓
    Action Items P0/P1 viram tarefas em milestone atual ou próximo
      ↓
    Wheel of Misfortune: postmortem vira treino de novos engineers (cap 15)
    ```

    **Quando NÃO sugerir chain `/postmortem`:**

    - Forense `INCONCLUSIVE` em todas as hipóteses (root cause não identificada — sugerir nova investigação ao invés)
    - Falha trivial documentada (typo em `.gitignore`) sem impacto a usuário
    - Investigação cancelada pelo user antes do Core Analysis Loop fechar

    **Cultura blameless é não-negociável:** o postmortem foca em **sistema** (controles ausentes, signals não monitorados, escalation paths frágeis), nunca em **pessoas** ("dev X esqueceu de testar"). Anti-pattern blame culture é explicitamente prevenido pelo template de `postmortem-writer` (cap 15 — *No postmortem left unreviewed*).

    **REQ:** INT-FW-V2-01.
    </sre_integration>
    ```

    Posicionamento exato: 1 linha em branco após `</observability_integration>`, depois `<sre_integration>` + conteúdo + `</sre_integration>` como **última seção** do arquivo. Garantir que a sintaxe XML-like das tags casa com o padrão usado em `<observability_integration>` no mesmo arquivo.
  </action>
  <acceptance_criteria>
    - Bloco `<sre_integration>` existe com tag de abertura e fechamento (count == 1 cada)
    - Heading "Chain `/postmortem` após Core Analysis Loop" presente
    - Tabela 2-row Forense vs Postmortem presente
    - Bloco "Trigger automático sugerido (não-bloqueante)" com 3 condições presente
    - Comando literal `/postmortem --from-investigation` mencionado ≥ 2× (no template + no fluxo canônico)
    - Cross-refs Markdown literais `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)` E `[postmortem-writer](../agents/postmortem-writer.md)` presentes
    - "Cultura blameless é não-negociável" frase presente
    - "cap 15" referenciado ≥ 1× (livro Google SRE)
    - Frase "REQ: INT-FW-V2-01" presente como rodapé
    - Bloco `<observability_integration>` v1.9 (INT-FW-06) preservado byte-a-byte
    - Frontmatter byte-idêntico ao pré-patch
  </acceptance_criteria>
</task>

<task id="40-01-T3" name="Validação smoke pós-patch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/forense.md (re-leitura completa pós-edit)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter PRESERVADO (12 primeiras linhas)
    head -12 kit/commands/forense.md
    # Esperado byte-idêntico ao pré-patch:
    # ---
    # type: prompt
    # name: forense
    # description: Investigação post-mortem de workflows framework com falha — analisa histórico git, artefatos e estado para diagnosticar o que deu errado
    # argument-hint: "[descrição do problema]"
    # allowed-tools:
    #   - Read
    #   - Write
    #   - Bash
    #   - Grep
    #   - Glob
    # ---

    # 2. Tag de abertura <sre_integration> existe exatamente 1×
    grep -c "^<sre_integration>$" kit/commands/forense.md  # esperado: 1

    # 3. Tag de fechamento </sre_integration> existe exatamente 1×
    grep -c "^</sre_integration>$" kit/commands/forense.md  # esperado: 1

    # 4. Bloco <observability_integration> v1.9 PRESERVADO
    grep -c "^<observability_integration>$" kit/commands/forense.md   # esperado: 1
    grep -c "^</observability_integration>$" kit/commands/forense.md  # esperado: 1
    grep -c "INT-FW-06" kit/commands/forense.md                       # esperado: ≥1 (preservado)

    # 5. Cross-refs ATIVOS
    grep -c "\[blameless-postmortems\](../skills/blameless-postmortems/SKILL.md)" kit/commands/forense.md  # esperado: ≥1
    grep -c "\[postmortem-writer\](../agents/postmortem-writer.md)" kit/commands/forense.md                # esperado: ≥1

    # 6. Comando literal /postmortem mencionado
    grep -c "/postmortem --from-investigation" kit/commands/forense.md  # esperado: ≥2

    # 7. Conteúdo canônico cap 15
    grep -c "cap 15" kit/commands/forense.md                  # esperado: ≥1
    grep -c "Postmortem Culture" kit/commands/forense.md      # esperado: ≥1
    grep -c "blameless" kit/commands/forense.md               # esperado: ≥2
    grep -c "no postmortem left unreviewed\|No postmortem left unreviewed" kit/commands/forense.md  # esperado: ≥1

    # 8. REQ-ID rodapé
    grep -c "INT-FW-V2-01" kit/commands/forense.md  # esperado: ≥1

    # 9. Tabela Forense vs Postmortem
    grep -c "Forense é diagnóstico evidence-based\|Forense.*diagnóstico" kit/commands/forense.md  # esperado: ≥1

    # 10. Diff puro de adição
    git diff --numstat kit/commands/forense.md
    # Esperado: insertions > 0; deletions == 0 (puro additive)

    # 11. Smoke sync — bloco propagado para .claude/commands/
    node bin/cli.js sync install claude-code --mode copy
    grep -c "<sre_integration>" .claude/commands/forense.md  # esperado: ≥1
    grep -c "INT-FW-V2-01" .claude/commands/forense.md       # esperado: ≥1
    ```
  </action>
  <acceptance_criteria>
    - `head -12` mostra frontmatter byte-idêntico ao pré-patch
    - `grep -c "^<sre_integration>$"` == 1 e `</sre_integration>` == 1
    - Bloco v1.9 `<observability_integration>` preservado (count == 1 cada tag)
    - `INT-FW-06` ainda presente (não removido)
    - 2 cross-refs Markdown ativos presentes
    - `/postmortem --from-investigation` mencionado ≥ 2×
    - Conteúdo canônico (cap 15, Postmortem Culture, blameless, no postmortem left unreviewed) presente
    - `INT-FW-V2-01` presente como rodapé do bloco
    - `git diff --numstat` mostra 0 deletions
    - Smoke sync propaga bloco para `.claude/commands/forense.md`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Frontmatter byte-idêntico (5 campos `type/name/description/argument-hint/allowed-tools`)
- [ ] Bloco `<sre_integration>` adicionado como **última seção** após `</observability_integration>`
- [ ] Tabela 2-row Forense vs Postmortem (output diferente, audiência diferente) presente
- [ ] Trigger automático com 3 condições (VALIDATED hipótese / impacto user / crash production) explícito
- [ ] Comando `/postmortem --from-investigation <id>` literal presente ≥ 2×
- [ ] Bloco "Quando NÃO sugerir chain" com 3 exceções (INCONCLUSIVE / trivial / cancelada) presente
- [ ] Cross-refs Markdown ATIVOS (skill `blameless-postmortems` + agent `postmortem-writer`)
- [ ] Conteúdo canônico cap 15 livro Google SRE explicitado
- [ ] "Cultura blameless é não-negociável" frase presente
- [ ] Bloco v1.9 `<observability_integration>` (INT-FW-06) preservado byte-a-byte
- [ ] Smoke sync valida bloco propagado para `.claude/commands/forense.md`
- [ ] Cobre INT-FW-V2-01 integralmente

## Must-haves (goal-backward)

1. Frontmatter inalterado — preserva contrato v1.9 (anti-pitfall A2)
2. Workflow `.claude/framework/workflows/forensics.md` continua funcional sem alteração (patch é editorial no command, não toca lógica)
3. Forense (diagnóstico) e postmortem (aprendizado) tratados como etapas distintas e complementares — não substitutos
4. Chain `/postmortem` é **sugestão** (não-bloqueante) — usuário decide se executa
5. 3 condições explícitas para sugerir chain (impedir trigger em INCONCLUSIVE / trivial)
6. 3 exceções explícitas para NÃO sugerir chain (impedir spam de postmortems vazios)
7. Cultura blameless explicitada — postmortem foca sistema, não pessoa
8. Cross-refs ATIVOS para skill (knowledge canônico cap 15) + agent (writer que executa) + command (`/postmortem` que invoca o agent)
9. Smoke sync valida descoberta em `.claude/commands/`

## Notes

- **Patch editorial puro additive** — adiciona ~60 linhas (1 bloco `<sre_integration>` completo); zero linhas removidas/modificadas
- v1.9 (`<observability_integration>` Core Analysis Loop) e v1.10 (`<sre_integration>` chain `/postmortem`) coexistem: v1.9 cobre **como diagnosticar** (método científico); v1.10 cobre **o que fazer com o diagnóstico** (postmortem blameless)
- Padrão de tag XML-like (`<sre_integration>...</sre_integration>`) já usado em `<observability_integration>` neste mesmo arquivo — consistência preservada
- Phase 41 vai criar gate `postmortem-template-required` (QA-SRE-02) que verifica em `/concluir-marco` se todo `.planning/investigations/<id>/` tem `.planning/postmortems/<id>.md` correspondente — chain sugerido aqui evita esse gate fail
- `/postmortem` (Phase 38 / CMD-SRE-03) suporta flag `--from-investigation <id>` que continua de investigation gerada por `/forense` — handoff é state-based via `forensic-id` no STATE.md

---
type: prompt
name: concluir-marco
description: Arquiva milestone concluído e prepara para próxima versão
argument-hint: "<version>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Marcar milestone {{version}} como completo, arquivar em milestones/ e atualizar ROADMAP.md e REQUIREMENTS.md.

Propósito: Criar registro histórico da versão entregue, arquivar artefatos do milestone (roadmap + requisitos) e preparar para o próximo milestone.
Saída: Milestone arquivado (roadmap + requisitos), PROJECT.md evoluído, tag git criado.
</objective>

<execution_context>
**Carregar estes arquivos AGORA (antes de prosseguir):**

- @./.claude/framework/workflows/complete-milestone.md (workflow principal)
- @./.claude/framework/templates/milestone-archive.md (template de arquivo)
  </execution_context>

<context>
**Arquivos do projeto:**
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`

**Entrada do usuário:**

- Versão: {{version}} (ex: "1.0", "1.1", "2.0")
  </context>

<process>

**Seguir o workflow complete-milestone.md:**

0. **Verificar auditoria:**

   - Procurar `.planning/v{{version}}-MILESTONE-AUDIT.md`
   - Se ausente ou desatualizado: recomendar `/auditar-marco` primeiro
   - Se status da auditoria for `gaps_found`: recomendar `/planejar-lacunas` primeiro
   - Se status da auditoria for `passed`: prosseguir para o passo 1

   ```markdown
   ## Verificação Pré-voo

   {Se não houver v{{version}}-MILESTONE-AUDIT.md:}
   ⚠ Nenhuma auditoria de milestone encontrada. Execute `/auditar-marco` primeiro para verificar
   cobertura de requisitos, integração entre fases e fluxos E2E.

   {Se a auditoria tiver lacunas:}
   ⚠ Auditoria de milestone encontrou lacunas. Execute `/planejar-lacunas` para criar
   fases que fechem as lacunas, ou prossiga assim mesmo para aceitar como dívida técnica.

   {Se a auditoria passou:}
   ✓ Auditoria de milestone aprovada. Prosseguindo com a conclusão.
   ```

1. **Verificar prontidão:**

   - Checar se todas as fases do milestone têm planos concluídos (SUMMARY.md existe)
   - Apresentar escopo e estatísticas do milestone
   - Aguardar confirmação

2. **Coletar estatísticas:**

   - Contar fases, planos, tarefas
   - Calcular intervalo git, alterações de arquivo, LOC
   - Extrair cronograma do git log
   - Apresentar resumo, confirmar

3. **Extrair realizações:**

   - Ler todos os arquivos SUMMARY.md das fases no intervalo do milestone
   - Extrair 4-6 realizações principais
   - Apresentar para aprovação

4. **Arquivar milestone:**

   - Criar `.planning/milestones/v{{version}}-ROADMAP.md`
   - Extrair detalhes completos das fases do ROADMAP.md
   - Preencher template milestone-archive.md
   - Atualizar ROADMAP.md para resumo de uma linha com link

5. **Arquivar requisitos:**

   - Criar `.planning/milestones/v{{version}}-REQUIREMENTS.md`
   - Marcar todos os requisitos v1 como completos (checkboxes marcados)
   - Registrar resultados dos requisitos (validado, ajustado, descartado)
   - Deletar `.planning/REQUIREMENTS.md` (novo será criado para o próximo milestone)

6. **Atualizar PROJECT.md:**

   - Adicionar seção "Estado Atual" com versão entregue
   - Adicionar seção "Objetivos do Próximo Milestone"
   - Arquivar conteúdo anterior em `<details>` (se v1.1+)

7. **Commit e tag:**

   - Stagear: MILESTONES.md, PROJECT.md, ROADMAP.md, STATE.md, arquivos de arquivo
   - Commit: `chore: archive v{{version}} milestone`
   - Tag: `git tag -a v{{version}} -m "[resumo do milestone]"`
   - Perguntar sobre push da tag

8. **Oferecer próximos passos:**
   - `/novo-marco` — iniciar próximo milestone (questionamento → pesquisa → requisitos → roadmap)

</process>

<success_criteria>

- Milestone arquivado em `.planning/milestones/v{{version}}-ROADMAP.md`
- Requisitos arquivados em `.planning/milestones/v{{version}}-REQUIREMENTS.md`
- `.planning/REQUIREMENTS.md` deletado (novo para próximo milestone)
- ROADMAP.md colapsado para entrada de uma linha
- PROJECT.md atualizado com estado atual
- Tag git v{{version}} criado
- Commit bem-sucedido
- Usuário conhece os próximos passos (incluindo necessidade de novos requisitos)
  </success_criteria>

<critical_rules>

- **Carregar workflow primeiro:** Ler complete-milestone.md antes de executar
- **Verificar conclusão:** Todas as fases devem ter arquivos SUMMARY.md
- **Confirmação do usuário:** Aguardar aprovação nos checkpoints de verificação
- **Arquivar antes de deletar:** Sempre criar arquivos de arquivo antes de atualizar/deletar originais
- **Resumo de uma linha:** Milestone colapsado no ROADMAP.md deve ser uma única linha com link
- **Eficiência de contexto:** Arquivo mantém ROADMAP.md e REQUIREMENTS.md com tamanho constante por milestone
- **Novos requisitos:** Próximo milestone começa com `/novo-marco` que inclui definição de requisitos
  </critical_rules>

<observability_integration>
**OMM no-regression gate (v1.9 — INT-FW-05):**

Quando `workflow.complete_milestone_omm_gate = true` (default), o workflow inclui passo OMM regression check antes de arquivar:

1. Procurar `.planning/OMM-REPORT.md` atual. Se ausente: rodar `/auditar-observabilidade` primeiro.
2. Comparar scores das 5 capacidades com `.planning/milestones/<previous>/OMM-REPORT.md`.
3. Se alguma capacidade regrediu E `workflow.omm_no_regression = true`: BLOQUEAR conclusion.
4. Se regression detectada mas `workflow.omm_no_regression = false`: WARN explícito; user decide entre aceitar ou pausar.
5. OMM-REPORT.md final é arquivado em `.planning/milestones/v<version>/OMM-REPORT.md`.

Gate executável: `gates/omm-no-regression.md`.

Skill consultada: [`observability-maturity-model`](../skills/observability-maturity-model/SKILL.md).

**REQ:** INT-FW-05.
</observability_integration>
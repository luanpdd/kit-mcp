---
name: auditar-marco
description: Audita a conclusão do milestone contra a intenção original antes de arquivar
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---
<objective>
Verificar se o milestone alcançou sua definição de pronto. Checar cobertura de requisitos, integração entre fases e fluxos de ponta a ponta.

**Este comando É o orquestrador.** Lê os arquivos VERIFICATION.md existentes (fases já verificadas durante o executar-fase), agrega dívidas técnicas e lacunas adiadas, então invoca o verificador de integração para a fiação entre fases.
</objective>

<execution_context>
@./.claude/framework/workflows/audit-milestone.md
</execution_context>

<context>
Versão: $ARGUMENTS (opcional — padrão para o milestone atual)

Arquivos principais de planejamento são resolvidos no workflow (`init milestone-op`) e carregados apenas quando necessário.

**Trabalho Concluído:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
Execute o workflow audit-milestone de @./.claude/framework/workflows/audit-milestone.md do início ao fim.
Preserve todos os checkpoints do workflow (determinação de escopo, leitura de verificações, checagem de integração, cobertura de requisitos, roteamento).
</process>
<purpose>
Auditoria cross-fase de todos os arquivos UAT e de verificação. Encontra todos os itens pendentes (pending, skipped, blocked, human_needed), opcionalmente verifica na base de código para detectar documentação obsoleta e produz um plano de testes humano priorizado.
</purpose>

<process>

<step name="initialize">
Executar a auditoria via CLI:

```bash
AUDIT=$(node "./.claude/framework/bin/tools.cjs" audit-uat --raw)
```

Analisar JSON para array `results` e objeto `summary`.

Se `summary.total_items` for 0:
```
## Tudo Limpo

Nenhum item pendente de UAT ou verificação encontrado em todas as fases.
Todos os testes estão passando, resolvidos ou diagnosticados com planos de correção.
```
Parar aqui.
</step>

<step name="categorize">
Agrupar itens pelo que pode ser feito AGORA vs. o que precisa de pré-requisitos:

**Testável Agora** (sem dependências externas):
- `pending` — testes nunca executados
- `human_uat` — itens de verificação humana
- `skipped_unresolved` — pulados sem motivo claro de bloqueio

**Precisa de Pré-requisitos:**
- `server_blocked` — precisa de servidor externo rodando
- `device_needed` — precisa de dispositivo físico (não simulador)
- `build_needed` — precisa de build de release/preview
- `third_party` — precisa de configuração de serviço externo

Para cada item em "Testável Agora", use Grep/Read para verificar se o recurso subjacente ainda existe na base de código:
- Se o teste referencia um componente/função que não existe mais → marcar como `stale`
- Se o teste referencia código que foi significativamente reescrito → marcar como `needs_update`
- Caso contrário → marcar como `active`
</step>

<step name="present">
Apresentar o relatório de auditoria:

```
## Relatório de Auditoria UAT

**{total_items} itens pendentes em {total_files} arquivos em {phase_count} fases**

### Testável Agora ({contagem})

| # | Fase | Teste | Descrição | Status |
|---|------|-------|-----------|--------|
| 1 | {fase} | {nome_do_teste} | {esperado} | {active/stale/needs_update} |
...

### Precisa de Pré-requisitos ({contagem})

| # | Fase | Teste | Bloqueado Por | Descrição |
|---|------|-------|---------------|-----------|
| 1 | {fase} | {nome_do_teste} | {categoria} | {esperado} |
...

### Obsoleto (pode ser fechado) ({contagem})

| # | Fase | Teste | Por Que Obsoleto |
|---|------|-------|------------------|
| 1 | {fase} | {nome_do_teste} | {motivo} |
...

---

## Ações Recomendadas

1. **Fechar itens obsoletos:** `/verificar-trabalho {fase}` — marcar testes obsoletos como resolvidos
2. **Executar testes ativos:** Plano de teste UAT humano abaixo
3. **Quando pré-requisitos forem atendidos:** Retestar itens bloqueados com `/verificar-trabalho {fase}`
```
</step>

<step name="test_plan">
Gerar um plano de teste UAT humano apenas para itens "Testável Agora" + "active":

Agrupar pelo que pode ser testado junto (mesma tela, mesma feature, mesmo pré-requisito):

```
## Plano de Teste UAT Humano

### Grupo 1: {categoria — ex: "Fluxo de Cobrança"}
Pré-requisitos: {o que precisa estar rodando/configurado}

1. **{Nome do teste}** (Fase {N})
   - Navegar para: {onde}
   - Fazer: {ação}
   - Esperado: {comportamento esperado}

2. **{Nome do teste}** (Fase {N})
   ...

### Grupo 2: {categoria}
...
```
</step>

</process>

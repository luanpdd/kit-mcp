# Template de UAT

Template para `.planning/phases/XX-name/{phase_num}-UAT.md` — rastreamento persistente de sessão UAT.

---

## Template do Arquivo

```markdown
---
status: testing | partial | complete | diagnosed
phase: XX-name
source: [lista de arquivos SUMMARY.md testados]
started: [timestamp ISO]
updated: [timestamp ISO]
---

## Teste Atual
<!-- SOBRESCREVER a cada teste - mostra onde estamos -->

number: [N]
name: [nome do teste]
expected: |
  [o que o usuário deve observar]
awaiting: user response

## Testes

### 1. [Nome do Teste]
expected: [comportamento observável - o que o usuário deve ver]
result: [pending]

### 2. [Nome do Teste]
expected: [comportamento observável]
result: pass

### 3. [Nome do Teste]
expected: [comportamento observável]
result: issue
reported: "[resposta verbatim do usuário]"
severity: major

### 4. [Nome do Teste]
expected: [comportamento observável]
result: skipped
reason: [por que foi pulado]

### 5. [Nome do Teste]
expected: [comportamento observável]
result: blocked
blocked_by: server | physical-device | release-build | third-party | prior-phase
reason: [por que está bloqueado]

...

## Resumo

total: [N]
passed: [N]
issues: [N]
pending: [N]
skipped: [N]
blocked: [N]

## Gaps

<!-- Formato YAML para consumo por /planejar-fase --gaps -->
- truth: "[comportamento esperado do teste]"
  status: failed
  reason: "User reported: [resposta verbatim]"
  severity: blocker | major | minor | cosmetic
  test: [N]
  root_cause: ""     # Preenchido pelo diagnóstico
  artifacts: []      # Preenchido pelo diagnóstico
  missing: []        # Preenchido pelo diagnóstico
  debug_session: ""  # Preenchido pelo diagnóstico
```

---

<section_rules>

**Frontmatter:**
- `status`: SOBRESCREVER - "testing", "partial" ou "complete"
- `phase`: IMUTÁVEL - definido na criação
- `source`: IMUTÁVEL - arquivos SUMMARY sendo testados
- `started`: IMUTÁVEL - definido na criação
- `updated`: SOBRESCREVER - atualizar a cada mudança

**Teste Atual:**
- SOBRESCREVER completamente a cada transição de teste
- Mostra qual teste está ativo e o que está aguardando
- Na conclusão: "[testing complete]"

**Testes:**
- Cada teste: SOBRESCREVER campo result quando o usuário responde
- Valores de `result`: [pending], pass, issue, skipped, blocked
- Se issue: adicionar `reported` (verbatim) e `severity` (inferido)
- Se skipped: adicionar `reason` se fornecida
- Se blocked: adicionar `blocked_by` (tag) e `reason` (se fornecida)

**Resumo:**
- SOBRESCREVER contagens após cada resposta
- Rastreia: total, passed, issues, pending, skipped

**Gaps:**
- APENAS APPEND quando issue encontrado (formato YAML)
- Após diagnóstico: preencher `root_cause`, `artifacts`, `missing`, `debug_session`
- Esta seção alimenta diretamente /planejar-fase --gaps

</section_rules>

<diagnosis_lifecycle>

**Após teste completo (status: complete), se existirem gaps:**

1. Usuário executa diagnóstico (da oferta de verify-work ou manualmente)
2. Workflow diagnose-issues spawna agentes de debug em paralelo
3. Cada agente investiga um gap, retorna causa raiz
4. Seção Gaps do UAT.md é atualizada com diagnóstico:
   - Cada gap recebe `root_cause`, `artifacts`, `missing`, `debug_session` preenchidos
5. status → "diagnosed"
6. Pronto para /planejar-fase --gaps com causas raiz

**Após diagnóstico:**
```yaml
## Gaps

- truth: "Comentário aparece imediatamente após envio"
  status: failed
  reason: "User reported: funciona mas não aparece até eu recarregar a página"
  severity: major
  test: 2
  root_cause: "useEffect em CommentList.tsx com dependência commentCount faltando"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect com dependência faltando"
  missing:
    - "Adicionar commentCount ao array de dependências do useEffect"
  debug_session: ".planning/debug/comment-not-refreshing.md"
```

</diagnosis_lifecycle>

<lifecycle>

**Criação:** Quando /verificar-trabalho inicia nova sessão
- Extrair testes dos arquivos SUMMARY.md
- Definir status como "testing"
- Teste Atual aponta para teste 1
- Todos os testes têm result: [pending]

**Durante teste:**
- Apresentar teste da seção Teste Atual
- Usuário responde com confirmação de pass ou descrição de issue
- Atualizar result do teste (pass/issue/skipped)
- Atualizar contagens de Resumo
- Se issue: append à seção Gaps (formato YAML), inferir severity
- Mover Teste Atual para o próximo teste pendente

**Na conclusão:**
- status → "complete"
- Teste Atual → "[testing complete]"
- Commit do arquivo
- Apresentar resumo com próximos passos

**Conclusão parcial:**
- status → "partial" (se testes pendentes, bloqueados ou pulados não resolvidos restarem)
- Teste Atual → "[testing paused — {N} items outstanding]"
- Commit do arquivo
- Apresentar resumo com itens pendentes destacados

**Retomando sessão parcial:**
- `/verificar-trabalho {fase}` retoma a partir do primeiro teste pendente/bloqueado
- Quando todos os itens forem resolvidos, status avança para "complete"

**Retomar após /clear:**
1. Ler frontmatter → saber fase e status
2. Ler Teste Atual → saber onde estamos
3. Encontrar primeiro result [pending] → continuar a partir daí
4. Resumo mostra progresso até agora

</lifecycle>

<severity_guide>

A severity é INFERIDA da linguagem natural do usuário, nunca perguntada.

| Usuário descreve | Inferir |
|----------------|-------|
| Crash, erro, exception, falha completa, inutilizável | blocker |
| Não funciona, nada acontece, comportamento errado, faltando | major |
| Funciona mas..., lento, estranho, menor, pequeno problema | minor |
| Cor, fonte, espaçamento, alinhamento, visual, parece errado | cosmetic |

Padrão: **major** (padrão seguro, usuário pode corrigir se errado)

</severity_guide>

<good_example>
```markdown
---
status: diagnosed
phase: 04-comments
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2025-01-15T10:30:00Z
updated: 2025-01-15T10:45:00Z
---

## Teste Atual

[testing complete]

## Testes

### 1. Visualizar Comentários no Post
expected: Seção de comentários expande, mostra contagem e lista de comentários
result: pass

### 2. Criar Comentário de Nível Superior
expected: Enviar comentário via editor de texto rico, aparece na lista com info do autor
result: issue
reported: "funciona mas não aparece até eu recarregar a página"
severity: major

### 3. Responder a um Comentário
expected: Clicar em Responder, compositor inline aparece, envio mostra resposta aninhada
result: pass

### 4. Aninhamento Visual
expected: Thread de 3+ níveis mostra indentação, bordas laterais, limita em profundidade razoável
result: pass

### 5. Excluir Próprio Comentário
expected: Clicar em excluir no próprio comentário, removido ou mostra [deleted] se tiver respostas
result: pass

### 6. Contagem de Comentários
expected: Post mostra contagem precisa, incrementa ao adicionar comentário
result: pass

## Resumo

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Comentário aparece imediatamente após envio na lista"
  status: failed
  reason: "User reported: funciona mas não aparece até eu recarregar a página"
  severity: major
  test: 2
  root_cause: "useEffect em CommentList.tsx com dependência commentCount faltando"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect com dependência faltando"
  missing:
    - "Adicionar commentCount ao array de dependências do useEffect"
  debug_session: ".planning/debug/comment-not-refreshing.md"
```
</good_example>

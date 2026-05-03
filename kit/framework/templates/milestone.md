# Template de Entrada de Milestone

Adicione esta entrada em `.planning/MILESTONES.md` ao completar um milestone:

```markdown
## v[X.Y] [Nome] (Entregue: YYYY-MM-DD)

**Entregue:** [Uma frase descrevendo o que foi lançado]

**Fases concluídas:** [X-Y] ([Z] planos no total)

**Principais conquistas:**
- [Grande conquista 1]
- [Grande conquista 2]
- [Grande conquista 3]
- [Grande conquista 4]

**Estatísticas:**
- [X] arquivos criados/modificados
- [Y] linhas de código (linguagem principal)
- [Z] fases, [N] planos, [M] tarefas
- [D] dias do início ao lançamento (ou de milestone a milestone)

**Intervalo git:** `feat(XX-XX)` → `feat(YY-YY)`

**O que vem a seguir:** [Breve descrição dos objetivos do próximo milestone, ou "Projeto concluído"]

---
```

<structure>
Se MILESTONES.md não existir, crie-o com o cabeçalho:

```markdown
# Milestones do Projeto: [Nome do Projeto]

[Entradas em ordem cronológica inversa — mais recente primeiro]
```
</structure>

<guidelines>
**Quando criar milestones:**
- MVP v1.0 inicial lançado
- Lançamentos de versão major (v2.0, v3.0)
- Milestones de funcionalidades significativas (v1.1, v1.2)
- Antes de arquivar o planejamento (capturar o que foi lançado)

**Não criar milestones para:**
- Conclusões de fases individuais (workflow normal)
- Trabalho em andamento (aguardar até ser lançado)
- Correções de bugs menores que não constituem um lançamento

**Estatísticas a incluir:**
- Contar arquivos modificados: `git diff --stat feat(XX-XX)..feat(YY-YY) | tail -1`
- Contar LOC: `find . -name "*.swift" -o -name "*.ts" | xargs wc -l` (ou extensão relevante)
- Contagens de fase/plano/tarefa do ROADMAP
- Cronograma do primeiro commit da fase ao último commit da fase

**Formato do intervalo git:**
- Primeiro commit do milestone → último commit do milestone
- Exemplo: `feat(01-01)` → `feat(04-01)` para fases 1-4
</guidelines>

<example>
```markdown
# Milestones do Projeto: WeatherBar

## v1.1 Segurança & Polimento (Entregue: 2025-12-10)

**Entregue:** Hardening de segurança com integração ao Keychain e tratamento abrangente de erros

**Fases concluídas:** 5-6 (3 planos no total)

**Principais conquistas:**
- Migrou armazenamento de chave API de texto plano para macOS Keychain
- Implementou tratamento abrangente de erros para falhas de rede
- Adicionou integração de relatório de crashes com Sentry
- Corrigiu vazamento de memória no timer de auto-refresh

**Estatísticas:**
- 23 arquivos modificados
- 650 linhas de Swift adicionadas
- 2 fases, 3 planos, 12 tarefas
- 8 dias do v1.0 ao v1.1

**Intervalo git:** `feat(05-01)` → `feat(06-02)`

**O que vem a seguir:** redesign SwiftUI v2.0 com suporte a widgets

---

## v1.0 MVP (Entregue: 2025-11-25)

**Entregue:** App de clima na barra de menu com condições atuais e previsão de 3 dias

**Fases concluídas:** 1-4 (7 planos no total)

**Principais conquistas:**
- App na barra de menu com UI popover (AppKit)
- Integração com OpenWeather API com auto-refresh
- Exibição do clima atual com ícone de condições
- Lista de previsão de 3 dias com temperaturas máx/mín
- Assinado e notarizado para distribuição

**Estatísticas:**
- 47 arquivos criados
- 2.450 linhas de Swift
- 4 fases, 7 planos, 28 tarefas
- 12 dias do início ao lançamento

**Intervalo git:** `feat(01-01)` → `feat(04-01)`

**O que vem a seguir:** auditoria de segurança e hardening para v1.1
```
</example>

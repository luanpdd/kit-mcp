<ui_patterns>

Padrões visuais para saída framework voltada ao usuário. Orquestradores referenciam este arquivo com @.

## Banners de Etapa

Use para transições importantes de workflow.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► {NOME DA ETAPA}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Nomes de etapa (maiúsculas):**
- `QUESTIONANDO`
- `PESQUISANDO`
- `DEFININDO REQUISITOS`
- `CRIANDO ROTEIRO`
- `PLANEJANDO FASE {N}`
- `EXECUTANDO ONDA {N}`
- `VERIFICANDO`
- `FASE {N} CONCLUÍDA ✓`
- `MARCO CONCLUÍDO 🎉`

---

## Caixas de Checkpoint

Ação do usuário necessária. Largura de 62 caracteres.

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: {Tipo}                                          ║
╚══════════════════════════════════════════════════════════════╝

{Conteúdo}

──────────────────────────────────────────────────────────────
→ {PROMPT DE AÇÃO}
──────────────────────────────────────────────────────────────
```

**Tipos:**
- `CHECKPOINT: Verificação Necessária` → `→ Digite "aprovado" ou descreva os problemas`
- `CHECKPOINT: Decisão Necessária` → `→ Selecione: opção-a / opção-b`
- `CHECKPOINT: Ação Necessária` → `→ Digite "feito" quando concluído`

---

## Símbolos de Status

```
✓  Concluído / Passou / Verificado
✗  Falhou / Ausente / Bloqueado
◆  Em Andamento
○  Pendente
⚡ Auto-aprovado
⚠  Aviso
🎉 Marco concluído (apenas em banner)
```

---

## Exibição de Progresso

**Nível de fase/marco:**
```
Progresso: ████████░░ 80%
```

**Nível de tarefa:**
```
Tarefas: 2/4 concluídas
```

**Nível de plano:**
```
Planos: 3/5 concluídos
```

---

## Indicadores de Spawning

```
◆ Spawnando pesquisador...

◆ Spawnando 4 pesquisadores em paralelo...
  → Pesquisa de stack
  → Pesquisa de funcionalidades
  → Pesquisa de arquitetura
  → Pesquisa de armadilhas

✓ Pesquisador concluído: STACK.md escrito
```

---

## Bloco Próximo Passo

Sempre ao final de conclusões importantes.

```
───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**{Identificador}: {Nome}** — {descrição em uma linha}

`{comando para copiar-colar}`

<sub>`/clear` primeiro → contexto limpo</sub>

───────────────────────────────────────────────────────────────

**Também disponível:**
- `/alternativa-1` — descrição
- `/alternativa-2` — descrição

───────────────────────────────────────────────────────────────
```

---

## Caixa de Erro

```
╔══════════════════════════════════════════════════════════════╗
║  ERRO                                                        ║
╚══════════════════════════════════════════════════════════════╝

{Descrição do erro}

**Para corrigir:** {Passos para resolução}
```

---

## Tabelas

```
| Fase | Status | Planos | Progresso |
|------|--------|--------|-----------|
| 1    | ✓      | 3/3    | 100%      |
| 2    | ◆      | 1/4    | 25%       |
| 3    | ○      | 0/2    | 0%        |
```

---

## Anti-Padrões

- Variar larguras de caixa/banner
- Misturar estilos de banner (`===`, `---`, `***`)
- Omitir o prefixo `framework ►` nos banners
- Emoji aleatório (`🚀`, `✨`, `💫`)
- Omitir o bloco Próximo Passo após conclusões

</ui_patterns>

<purpose>

Central de comando interativa para gerenciar um milestone a partir de um único terminal. Mostra um dashboard de todas as fases com status visual, despacha discuss inline e plan/execute como agentes em background, e volta ao dashboard após cada ação. Permite trabalho paralelo de fases a partir de um terminal.

</purpose>

<required_reading>

Leia todos os arquivos referenciados pelo execution_context do prompt que invocou antes de começar.

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Inicializar

Bootstrap via manager init:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analisar JSON para: `milestone_version`, `milestone_name`, `phase_count`, `completed_count`, `in_progress_count`, `phases`, `recommended_actions`, `all_complete`, `waiting_signal`.

**Se erro:** Exibir a mensagem de erro e sair.

Exibir banner de inicialização:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► GERENCIADOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {phase_count} fases · {completed_count} concluídas

 ✓ Discutir → inline    ◆ Planejar/Executar → background
 Dashboard atualiza automaticamente quando há trabalho em background.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Prosseguir para o passo dashboard.

</step>

<step name="dashboard">

## 2. Dashboard (Ponto de Atualização)

**Cada vez que este passo é atingido**, re-ler estado do disco para capturar mudanças de agentes em background:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Analisar o JSON completo. Construir a exibição do dashboard.

Construir dashboard a partir do JSON. Símbolos: `✓` concluído, `◆` ativo, `○` pendente, `·` na fila. Barra de progresso: 20 caracteres `█░`.

**Mapeamento de status** (disk_status → D P E Status):

- `complete` → `✓ ✓ ✓` `✓ Concluído`
- `partial` → `✓ ✓ ◆` `◆ Executando...`
- `planned` → `✓ ✓ ○` `○ Pronto para executar`
- `discussed` → `✓ ○ ·` `○ Pronto para planejar`
- `researched` → `◆ · ·` `○ Pronto para planejar`
- `empty`/`no_directory` + `is_next_to_discuss` → `○ · ·` `○ Pronto para discutir`
- `empty`/`no_directory` caso contrário → `· · ·` `· Próximo na fila`
- Se `is_active`, substituir ícone de status por `◆` e anexar `(ativo)`

Se alguma fase `is_active`, mostrar: `◆ Background: {ação} Fase {N}, ...` acima da grade.

Usar `display_name` (não `name`) para a coluna Fase — é pré-truncado a 20 caracteres com `…` se cortado. Alinhar todos os nomes de fase com a mesma largura.

Usar `deps_display` do JSON de init para a coluna Deps — mostra de quais fases esta fase depende (ex: `1,3`) ou `—` para nenhuma.

Exemplo de saída:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ████████████░░░░░░░░ 60%  (3/5 fases)
 ◆ Background: Planejando Fase 4
 | # | Fase                 | Deps | D | P | E | Status              |
 |---|----------------------|------|---|---|---|---------------------|
 | 1 | Foundation           | —    | ✓ | ✓ | ✓ | ✓ Concluído         |
 | 2 | API Layer            | 1    | ✓ | ✓ | ◆ | ◆ Executando (ativo)|
 | 3 | Auth System          | 1    | ✓ | ✓ | ○ | ○ Pronto p/ executar|
 | 4 | Dashboard UI & Set…  | 1,2  | ✓ | ◆ | · | ◆ Planejando (ativo)|
 | 5 | Notifications        | —    | ○ | · | · | ○ Pronto p/ discutir|
 | 6 | Polish & Final Mail… | 1-5  | · | · | · | · Próximo na fila   |
```

**Seção de recomendações:**

Se `all_complete` for verdadeiro:

```
╔══════════════════════════════════════════════════════════════╗
║  MILESTONE CONCLUÍDO                                         ║
╚══════════════════════════════════════════════════════════════╝

Todas as {phase_count} fases concluídas. Pronto para etapas finais:
  → /verificar-trabalho — executar testes de aceitação
  → /concluir-marco — arquivar e encerrar
```

Perguntar ao usuário via AskUserQuestion:
- **question:** "Todas as fases concluídas. O que fazer a seguir?"
- **options:** "Verificar trabalho" / "Concluir milestone" / "Sair do gerenciador"

Tratar respostas:
- "Verificar trabalho": `Skill(skill="framework:verificar-trabalho")` então voltar ao dashboard.
- "Concluir milestone": `Skill(skill="framework:concluir-marco")` então sair.
- "Sair do gerenciador": Ir para o passo de saída.

**Se NÃO all_complete**, construir opções compostas a partir de `recommended_actions`:

**Lógica de opção composta:** Agrupar ações em background (plan/execute) juntas, e combiná-las com a ação inline única (discuss) quando existir. O objetivo é apresentar o menor número possível de opções — uma opção pode despachar múltiplos agentes em background mais uma ação inline.

**Construindo opções:**

1. Coletar todas as ações em background (recomendações de execute e plan) — pode haver múltiplas de cada.
2. Coletar a ação inline (recomendação de discuss, se houver — haverá no máximo uma já que discuss é sequencial).
3. Construir opções compostas:

   **Se houver QUAISQUER ações recomendadas (background, inline, ou ambas):**
   Criar UMA opção primária "Continuar" que despacha TODAS juntas:
   - Rótulo: `"Continuar"` — sempre esta palavra exata
   - Abaixo do rótulo, listar cada ação que acontecerá. Enumerar TODAS as ações recomendadas — não limitar ou truncar:
     ```
     Continuar:
       → Executar Fase 32 (background)
       → Planejar Fase 34 (background)
       → Discutir Fase 35 (inline)
     ```
   - Isso despacha todos os agentes em background primeiro, então executa o discuss inline (se houver).
   - Se não houver discuss inline, o dashboard atualiza após criar os agentes em background.

   **Importante:** A opção Continuar deve incluir CADA ação de `recommended_actions` — não apenas 2. Se houver 3 ações, listar 3. Se houver 5, listar 5.

4. Sempre adicionar:
   - `"Atualizar dashboard"`
   - `"Sair do gerenciador"`

Exibir recomendações de forma compacta:

```
───────────────────────────────────────────────────────────────
▶ Próximos Passos
───────────────────────────────────────────────────────────────

Continuar:
  → Executar Fase 32 (background)
  → Planejar Fase 34 (background)
  → Discutir Fase 35 (inline)
```

**Auto-atualização:** Se agentes em background estiverem rodando (`is_active` é verdadeiro para alguma fase), definir um ciclo de auto-atualização de 60 segundos. Após apresentar o menu de ação, se nenhum input do usuário for recebido em 60 segundos, atualizar automaticamente o dashboard. Este intervalo é configurável via `manager_refresh_interval` na config framework (padrão: 60 segundos, definir como 0 para desabilitar).

Apresentar via AskUserQuestion:
- **question:** "O que você gostaria de fazer?"
- **options:** (opções compostas como construídas acima + atualizar + sair, AskUserQuestion adiciona automaticamente "Outro")

**Em "Outro" (texto livre):** Analisar intenção — se mencionar número de fase e ação, despachar adequadamente. Se incerto, exibir ações disponíveis e voltar ao action_menu.

Prosseguir para o passo handle_action com a ação selecionada.

</step>

<step name="handle_action">

## 4. Tratar Ação

### Atualizar Dashboard

Voltar ao passo dashboard.

### Sair do Gerenciador

Ir para o passo de saída.

### Ação Composta (background + inline)

Quando o usuário seleciona uma opção composta:

1. **Criar todos os agentes em background primeiro** (plan/execute) — despachá-los em paralelo usando os handlers de Plan Phase N / Execute Phase N abaixo.
2. **Então executar o discuss inline:**

```
Skill(skill="framework:discutir-fase", args="{PHASE_NUM}")
```

Após o discuss concluir, voltar ao passo dashboard (agentes em background continuam rodando).

### Discutir Fase N

A discussão é interativa — precisa de input do usuário. Executar inline:

```
Skill(skill="framework:discutir-fase", args="{PHASE_NUM}")
```

Após o discuss concluir, voltar ao passo dashboard.

### Planejar Fase N

O planejamento roda autonomamente. Criar um agente em background:

```
Task(
  description="Planejar fase {N}: {phase_name}",
  run_in_background=true,
  prompt="Você está executando o workflow framework plan-phase para a fase {N} do projeto.

Diretório de trabalho: {cwd}
Fase: {N} — {phase_name}
Objetivo: {goal}

Passos:
1. Ler o workflow plan-phase: cat ./.claude/framework/workflows/plan-phase.md
2. Executar: node \"./.claude/framework/bin/tools.cjs\" init plan-phase {N}
3. Seguir os passos do workflow para produzir arquivos PLAN.md para esta fase.
4. Se pesquisa estiver habilitada na config, executar o passo de pesquisa primeiro.
5. Criar um subagente planner via Task() para criar os planos.
6. Se plan-checker estiver habilitado, criar um subagente plan-checker para verificar.
7. Commitar arquivos de plano quando concluído.

Importante: Você está rodando em background. NÃO use AskUserQuestion — tome decisões autônomas baseadas no contexto do projeto. Se encontrar um bloqueio, escrevê-lo no STATE.md como bloqueio e parar. NÃO trabalhe silenciosamente em torno de erros de permissão ou acesso a arquivos — deixe-os falhar para que o gerenciador possa surfaçá-los com dicas de resolução."
)
```

Exibir:

```
◆ Criando planejador para Fase {N}: {phase_name}...
```

Voltar ao passo dashboard.

### Executar Fase N

A execução roda autonomamente. Criar um agente em background:

```
Task(
  description="Executar fase {N}: {phase_name}",
  run_in_background=true,
  prompt="Você está executando o workflow framework execute-phase para a fase {N} do projeto.

Diretório de trabalho: {cwd}
Fase: {N} — {phase_name}
Objetivo: {goal}

Passos:
1. Ler o workflow execute-phase: cat ./.claude/framework/workflows/execute-phase.md
2. Executar: node \"./.claude/framework/bin/tools.cjs\" init execute-phase {N}
3. Seguir os passos do workflow: descobrir planos, analisar dependências, agrupar em waves.
4. Para cada wave, criar subagentes executor via Task() para executar planos em paralelo.
5. Após todas as waves concluírem, criar um subagente verifier se verificador estiver habilitado.
6. Atualizar ROADMAP.md e STATE.md com progresso.
7. Commitar todas as mudanças.

Importante: Você está rodando em background. NÃO use AskUserQuestion — tome decisões autônomas. Use --no-verify em commits git. Se encontrar erro de permissão, trava de arquivo, ou qualquer problema de acesso, NÃO trabalhe em torno dele — deixe falhar e escreva o erro no STATE.md como bloqueio para que o gerenciador possa surfaçá-lo com orientação de resolução."
)
```

Exibir:

```
◆ Criando executor para Fase {N}: {phase_name}...
```

Voltar ao passo dashboard.

</step>

<step name="background_completion">

## 5. Conclusão de Agente em Background

Quando notificado que um agente em background concluiu:

1. Ler a mensagem de resultado do agente.
2. Exibir uma notificação breve:

```
✓ {description}
  {breve resumo do resultado do agente}
```

3. Voltar ao passo dashboard.

**Se o agente reportou um erro ou bloqueio:**

Classificar o erro:

**Erro de permissão / acesso a ferramenta** (ex: ferramenta não permitida, permissão negada, restrição de sandbox):
- Analisar o erro para identificar qual ferramenta ou comando foi bloqueado.
- Exibir o erro claramente, então oferecer para corrigir:
  - **question:** "Fase {N} falhou — permissão negada para `{tool_or_command}`. Quer que eu adicione ao settings.local.json para que seja permitido?"
  - **options:** "Adicionar permissão e tentar novamente" / "Executar esta fase inline em vez disso" / "Pular e continuar"
  - "Adicionar permissão e tentar novamente": Usar `Skill(skill="update-config")` para adicionar a permissão ao `settings.local.json`, então recriar o agente em background. Voltar ao dashboard.
  - "Executar esta fase inline em vez disso": Despachar a mesma ação (plan/execute) inline via `Skill()` em vez de um Task em background. Voltar ao dashboard após.
  - "Pular e continuar": Voltar ao dashboard (fase permanece no estado atual).

**Outros erros** (trava git, conflito de arquivo, erro de lógica, etc.):
- Exibir o erro, então oferecer opções via AskUserQuestion:
  - **question:** "Agente em background para Fase {N} encontrou um problema: {error}. O que fazer?"
  - **options:** "Tentar novamente" / "Executar inline em vez disso" / "Pular e continuar" / "Ver detalhes"
  - "Tentar novamente": Recriar o mesmo agente em background. Voltar ao dashboard.
  - "Executar inline em vez disso": Despachar a ação inline via `Skill()`. Voltar ao dashboard após.
  - "Pular e continuar": Voltar ao dashboard (fase permanece no estado atual).
  - "Ver detalhes": Ler seção de bloqueios do STATE.md, exibir, então reapresentar opções.

</step>

<step name="exit">

## 6. Saída

Exibir status final com barra de progresso:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► FIM DA SESSÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {PROGRESS_BAR} {progress_pct}%  ({completed_count}/{phase_count} fases)

 Retome a qualquer momento: /gerenciador
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Nota:** Quaisquer agentes em background ainda rodando continuarão até a conclusão. Seus resultados serão visíveis na próxima invocação de `/gerenciador` ou `/progresso`.

</step>

</process>

<success_criteria>
- [ ] Dashboard exibe todas as fases com indicadores de status corretos (colunas D/P/E/V)
- [ ] Barra de progresso mostra percentual de conclusão preciso
- [ ] Resolução de dependências: fases bloqueadas mostram quais deps estão faltando
- [ ] Recomendações priorizam: executar > planejar > discutir
- [ ] Fases de discuss executam inline via Skill() — perguntas interativas funcionam
- [ ] Fases de plan criam agentes Task em background — retornam ao dashboard imediatamente
- [ ] Fases de execute criam agentes Task em background — retornam ao dashboard imediatamente
- [ ] Atualizações do dashboard capturam mudanças de agentes em background via estado do disco
- [ ] Conclusão de agente em background aciona notificação e atualização do dashboard
- [ ] Erros de agente em background apresentam opções de tentar novamente/pular
- [ ] Estado de todos-concluídos oferece verify-work e complete-milestone
- [ ] Saída mostra status final com instruções de retomada
- [ ] Input de texto livre "Outro" analisado para número de fase e ação
- [ ] Loop do gerenciador continua até o usuário sair ou o milestone concluir
</success_criteria>

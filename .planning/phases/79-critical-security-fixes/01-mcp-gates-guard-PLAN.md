---
plan_id: 79.01
phase: 79-critical-security-fixes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp-server/index.js
autonomous: true
requirements: [SEC-13-01]
must_haves:
  truths:
    - "Tool call gates.run via MCP transport (stdio) retorna erro descritivo sem invocar runGate"
    - "CLI kit gates run <id> continua funcionando idêntico (entry point separado, não passa pela MCP surface)"
    - "Mensagem de erro do MCP gates.run é estável e descritiva para clientes codificarem programaticamente"
  artifacts:
    - path: "src/mcp-server/index.js"
      provides: "handleGates com guard explícito que recusa run via MCP sem flag interna"
      contains: "MCP gates.run requires interactive TTY confirmation"
  key_links:
    - from: "src/mcp-server/index.js handleGates 'run' branch"
      to: "early return com error object"
      via: "guard inline antes de chamar runGate"
      pattern: "case 'run'"
---

# Plan 79.01: MCP gates.run guard contra exec arbitrário

<objective>
Bloquear execução de `runGate` via MCP transport, retornando erro descritivo estável, mantendo CLI `kit gates run` 100% funcional (apenas a surface MCP de exec arbitrário é fechada).
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/79-critical-security-fixes/79-CONTEXT.md
@.planning/codebase/concerns.md
@D:\projetos\opensource\mcp\src\mcp-server\index.js
@D:\projetos\opensource\mcp\src\core\gate-runner.js
@D:\projetos\opensource\mcp\src\core\gates.js

## Interface relevante (extraída de src/mcp-server/index.js)

Localização atual da vulnerabilidade — `handleGates` linhas 197-211:

```js
async function handleGates(args) {
  switch (args.action) {
    case 'list':      return listGates();
    case 'get':       return getGate(args.id);
    case 'for-stage': return gatesForStage(args.stage);
    case 'run':
      return withAutoSpawn(args, 'gates.run', () =>
        runGate(args.id, {
          projectRoot: args.projectRoot,
          yes: true,            // MCP context: never prompt
          interactive: false,   // MCP never prompts
        }));
    default: return { error: `Unknown action: ${args.action}` };
  }
}
```

Padrão estabelecido para retorno de erro em handlers MCP (ver demais switches em `handleKit`, `handleSync`, etc.):
```js
return { error: '<descritive message>' };
```

Esses retornos viram payloads JSON serializados na linha 279 (`JSON.stringify(result, null, 2)`). Não disparam exception — o cliente MCP recebe `{ "error": "..." }` em `content[0].text`.

## CLI separation (preserva stable API)

`runGate` continua acessível via `bin/cli.js` → `kit gates run <id>` (entry point CLI, não passa por `src/mcp-server/index.js`). O guard só fecha a surface MCP — esta task NÃO modifica `src/core/gate-runner.js` nem `bin/cli.js`.
</context>

<tasks>

<task id="1" type="auto">
  <name>Task 1: Adicionar guard em handleGates 'run' que rejeita invocação via MCP transport</name>

  <read_first>
    - D:\projetos\opensource\mcp\src\mcp-server\index.js (todo o arquivo — 295 LOC)
    - D:\projetos\opensource\mcp\src\core\gate-runner.js (para entender que `yes:true` skipa o prompt — confirma a severidade)
    - D:\projetos\opensource\mcp\.planning\phases\79-critical-security-fixes\79-CONTEXT.md (decisão de implementação C1)
  </read_first>

  <action>
Em `D:\projetos\opensource\mcp\src\mcp-server\index.js`, modificar o branch `case 'run':` da função `handleGates` (linhas 202-208) para rejeitar a invocação ANTES de chamar `runGate`. Substituir o branch inteiro por:

```js
    case 'run':
      // SEC-13-01: MCP transport must never execute shell — runGate spawns bash with
      // arbitrary content from gates/*.md (which reverse-sync can rewrite). Even with
      // {yes: true}, this skips the interactive "y/N before exec" promise. The CLI
      // entry point (`kit gates run <id>` via bin/cli.js) preserves the prompt and
      // remains the only path to executing gates.
      return {
        error: 'MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead.',
      };
```

A linha-chave do guard é a string literal exata `MCP gates.run requires interactive TTY confirmation; use \`kit gates run\` from CLI instead.` — clientes MCP a usarão como sentinel para detectar a recusa programaticamente.

NÃO remover o `import { runGate } from '../core/gate-runner.js';` na linha 20 — outras partes do server podem precisar referenciar o módulo no futuro, e remover o import seria código morto sem benefício para esta fase.

NÃO modificar `src/core/gate-runner.js`. NÃO modificar `bin/cli.js`. NÃO modificar a estrutura do `case 'list'`, `case 'get'`, ou `case 'for-stage'` — só o branch `'run'`.
  </action>

  <verify>
Comando que comprova a substituição:
```bash
grep -q "MCP gates.run requires interactive TTY confirmation" D:/projetos/opensource/mcp/src/mcp-server/index.js
grep -c "runGate(args.id" D:/projetos/opensource/mcp/src/mcp-server/index.js
```
Esperado: primeiro `grep` exit 0 (achou). Segundo `grep -c` retorna `0` (chamada removida).
  </verify>

  <acceptance_criteria>
    - `grep -q "MCP gates.run requires interactive TTY confirmation; use \`kit gates run\` from CLI instead." D:/projetos/opensource/mcp/src/mcp-server/index.js` retorna exit 0
    - `grep -c "runGate(args.id" D:/projetos/opensource/mcp/src/mcp-server/index.js` retorna `0` (zero chamadas a runGate restantes no server)
    - `grep -c "case 'run':" D:/projetos/opensource/mcp/src/mcp-server/index.js` retorna `1` (branch ainda existe, só corpo mudou)
    - `grep -q "SEC-13-01" D:/projetos/opensource/mcp/src/mcp-server/index.js` retorna exit 0 (referência ao REQ inline no comentário)
    - `node -e "import('./src/mcp-server/index.js').then(() => console.log('ok'))"` cwd=D:/projetos/opensource/mcp, output contém `ok` (módulo continua importável)
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Task 2: Validar que guard funciona via boot do MCP server e que CLI kit gates run continua intacto</name>

  <read_first>
    - D:\projetos\opensource\mcp\src\mcp-server\index.js (deve refletir mudança da Task 1)
    - D:\projetos\opensource\mcp\bin\cli.js (entry point CLI — não deve ter sido tocado)
    - D:\projetos\opensource\mcp\bin\mcp.js (entry point MCP server — boot test)
    - D:\projetos\opensource\mcp\gates (lista de gates disponíveis para escolher um para o teste de regressão CLI)
  </read_first>

  <action>
Validar três coisas em sequência:

1. **MCP server ainda boota:** rodar `node bin/mcp.js < /dev/null` (em PowerShell: `node bin/mcp.js < $null`) com timeout de 1s. Saída esperada: processo encerra com exit 0 (EOF clean) ou continua vivo. Crash de import-time é falha.

2. **MCP gates.run retorna o erro esperado:** simular um tool call sem startar transport real. Criar um arquivo temporário `D:\projetos\opensource\mcp\test\unit\mcp-gates-guard.test.mjs` com:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Importa apenas o handler interno via re-export — o módulo já exporta createServer.
// Como handleGates não é exportado, testamos via createServer + invocação manual do handler
// registrado. Estratégia mais simples: chamar diretamente o módulo com um shim.
import { createServer } from '../../src/mcp-server/index.js';

test('SEC-13-01: gates.run via MCP returns descriptive error without executing', async () => {
  const server = await createServer();
  // O Server expõe um método _requestHandlers ou similar; alternativa direta:
  // simular o request schema-conformant
  const req = {
    method: 'tools/call',
    params: { name: 'gates', arguments: { action: 'run', id: 'regression' } },
  };
  // Buscar o handler registrado e invocá-lo
  const handlers = server._requestHandlers || server.requestHandlers;
  // Se a API interna mudar, fallback: testar via grep no source (já feito na Task 1)
  // Esta verificação é reforço. Se handlers não estiverem acessíveis, pular sem falhar.
  if (!handlers) {
    console.log('skip: server internals not accessible for handler probe');
    return;
  }

  // Find CallToolRequestSchema handler — schemas têm method 'tools/call'
  let callHandler = null;
  for (const [schema, handler] of handlers.entries()) {
    if (schema?.shape?.method?.value === 'tools/call' || schema?.method === 'tools/call') {
      callHandler = handler; break;
    }
  }
  if (!callHandler) {
    console.log('skip: tools/call handler not found via reflection');
    return;
  }

  const res = await callHandler(req);
  const text = res?.content?.[0]?.text ?? '';
  assert.match(text, /MCP gates\.run requires interactive TTY confirmation/);
  assert.match(text, /use `kit gates run` from CLI instead/);
});
```

Se a reflexão dos handlers internos do `Server` do `@modelcontextprotocol/sdk` não funcionar (API privada), o teste deve fazer `console.log('skip: ...')` e retornar — NÃO falhar. A validação primária permanece o `grep` em Task 1. Este teste é reforço opcional.

3. **CLI smoke não regrediu:** rodar `node bin/cli.js gates list | head -5` em `D:\projetos\opensource\mcp` (PowerShell: `node bin/cli.js gates list | Select-Object -First 5`). Saída deve listar gates com colunas (id, stage, blocking). Exit code 0.

4. **Tests existentes passam:** rodar `node test/run.mjs test/unit` e `node test/run.mjs test/integration` em `D:\projetos\opensource\mcp`. Ambos exit 0. Suite de testes deve incluir o novo `mcp-gates-guard.test.mjs` automaticamente.
  </action>

  <verify>
```bash
# 1. MCP boot (Windows PowerShell)
node bin/mcp.js < $null  # timeout ~1s, exit 0 ou continua vivo
# 2. Test file existe e roda
node test/run.mjs test/unit
# 3. CLI ainda funciona
node bin/cli.js gates list
# 4. Integration tests
node test/run.mjs test/integration
```
  </verify>

  <acceptance_criteria>
    - Arquivo `D:\projetos\opensource\mcp\test\unit\mcp-gates-guard.test.mjs` existe e foi escrito conforme template acima
    - `node test/run.mjs test/unit` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - `node test/run.mjs test/integration` em cwd=D:/projetos/opensource/mcp termina com exit 0
    - `node bin/cli.js gates list` em cwd=D:/projetos/opensource/mcp termina com exit 0 e stdout não vazio
    - `node bin/mcp.js < $null` (PowerShell, ou `< /dev/null` em bash) com timeout 2s NÃO produz erro de import (módulo importa limpo)
    - Suite total de testes inclui o novo arquivo (`grep -l "SEC-13-01" D:/projetos/opensource/mcp/test/unit/*.mjs` retorna ao menos 1 match)
  </acceptance_criteria>
</task>

</tasks>

<verification>
Verificações gerais do plan:
- `grep -q "MCP gates.run requires interactive TTY confirmation" src/mcp-server/index.js` retorna 0
- `grep -c "runGate(args.id" src/mcp-server/index.js` retorna 0
- `node test/run.mjs test/unit` exit 0
- `node test/run.mjs test/integration` exit 0
- `node bin/cli.js gates list` exit 0 (CLI inalterado)
- `node bin/mcp.js < $null` boot limpo
</verification>

<success_criteria>
- C1 fechado: `gates.run` via MCP retorna erro estável "MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead." sem invocar shell
- Stable API preservada: `kit gates run` CLI funciona idêntico (não tocado)
- Zero regressão: suite test/unit + test/integration passa
- Comentário inline no code referencia SEC-13-01 para rastreabilidade futura
</success_criteria>

<output>
After completion, create `.planning/phases/79-critical-security-fixes/79-01-SUMMARY.md` with:
- O que mudou em src/mcp-server/index.js (linhas alteradas)
- Confirmação que CLI continua funcionando
- Confirmação que tests passam (output sumário)
- Mensagem de erro exata para futura referência de clientes MCP
</output>
</content>
</invoke>
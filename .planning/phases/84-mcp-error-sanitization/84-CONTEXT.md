# Phase 84: MCP Error Sanitization - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)
**Depends on:** Phase 82 ✅ (separado por foco)

<domain>
## Limite da Fase

Fechar 1 vulnerabilidade HIGH onde error envelopes do MCP server vazam dados sensíveis ao client:

**SEC-14-06 — MCP error envelope leak:**

Dois problemas combinados:

1. **`src/mcp-server/index.js:281-285`** — handler central de exception serializa `err.message` AND `err.stack`. Stack traces vazam:
   - Paths absolutos do filesystem do user (ex: `D:\Users\victim\.ssh\...`)
   - Node version, internal module paths
   - Argumentos closure-captured (em alguns casos)
   - LLM prompt-injected pode usar info do stack para framing de exploits subsequentes.

2. **`src/core/reflect.js:63-69, 156-179`** — em chamadas Anthropic API:
   - Lê `process.env.ANTHROPIC_API_KEY` e usa como `x-api-key`
   - Em 4xx, `errBody` é re-throw com `\`Anthropic API ${res.status}: ${errBody}\``
   - Anthropic **pode** echo header em error response (raro mas observado)
   - Erro vai pro MCP error envelope → cliente recebe fragmento do API key
   - `recordReplay(payload)` (linha 226) também serializa payload verbatim em `.planning/replays/*.json` — pode incluir keys que callers passaram inadvertidamente

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — error envelope schema continua `{error: string, code?: string}` (drop apenas o `stack`).
- Zero regressão (240 baseline esperado pós-Phase 83).
- Logging stack completo em stderr CONTINUA (server-side debug). Só clientes não recebem.

### Diretrizes de implementação

**Helper central:**
- Novo `src/core/error-redaction.js`:
  - `redactSecrets(text)` — regex global aplicado: `/sk-ant-[A-Za-z0-9_-]{20,}/g → '[REDACTED:anthropic_key]'`, `/sk-[A-Za-z0-9]{20,}/g → '[REDACTED:openai_key]'`, `/x-api-key:\s*\S+/gi → 'x-api-key: [REDACTED]'`, `/Bearer\s+[A-Za-z0-9._-]{20,}/gi → 'Bearer [REDACTED]'`, paths absolutos `/[A-Z]:[\\\\\\/][^\s'"]+|\/(home|Users|root)\/[^\s'"]+/g → '[PATH]'`.
  - `sanitizeMcpError(e)` — retorna `{error: redactSecrets(e.message), code: e.code || 'MCP_INTERNAL_ERROR'}` (NUNCA inclui `e.stack`).

**`src/mcp-server/index.js`:**
- Substituir bloco que serializa `e.stack` (linhas 281-285) por:
  ```js
  console.error('[mcp-server] error in handler:', err.stack); // server-side log
  return { content: [{ type: 'text', text: JSON.stringify(sanitizeMcpError(err)) }], isError: true };
  ```
- Aplicar consistentemente em TODOS os handlers (handleSync, handleReverseSync, handleGates, handleForensics, handleReplays, etc.) — verificar TODOS sem deixar nenhum vazando.

**`src/core/reflect.js`:**
- Em error path da chamada Anthropic, antes de `throw`: `errBody = redactSecrets(errBody)`.
- `recordReplay(payload)`: aplicar `redactSecrets` ao payload (especialmente em `payload.args`, `payload.result`) antes de `JSON.stringify`.
- Cuidar com side-effect: redactSecrets ruim pode quebrar replay de fluxos legítimos. Garantir que regex match só padrões sensíveis (não mata texto normal).

</decisions>

<code_context>
## Insights do Código Existente

- `src/mcp-server/index.js` tem TODOS os handlers MCP — escopo amplo. Helper central crítico.
- `src/core/reflect.js` é menor (~200 LOC) — mudança localizada.
- Phase 82 introduziu requireAuth — não interfere com esta phase (requireAuth retorna 401 antes de chegar nos handlers; é error path diferente).
- Phase 83 introduziu `EMANIFESTMISMATCH` error code — verificar que sanitizeMcpError preserva o `code` field.

</code_context>

<specifics>
## Ideias Específicas

- **Test pattern error envelope:** spawn `node bin/mcp.js`, send malformed request causing exception, parse response, assert NÃO contém `D:\\` ou `/Users/` ou `e.stack` linhas.
- **Test pattern reflect.js:** mock fetch response com `{"error": {"message": "Invalid API key sk-ant-fake123"}}`, chamar reflect, assert error.message NÃO contém `sk-ant-`.
- **Test pattern recordReplay:** chamar recordReplay com payload contendo `Bearer abcdef123...`, ler arquivo gerado, assert arquivo NÃO contém o token.

</specifics>

<deferred>
## Ideias Adiadas

- Telemetria de quantas vezes redactSecrets matched (count métrica) — útil mas escopo paralelo (observability).
- Configurable redaction patterns via env var — over-engineering para esta fase.
- Integration test SDK Anthropic real (precisa key) — manter unit test com mock.

</deferred>

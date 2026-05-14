#!/usr/bin/env node
// hook-version: 1.30.1
// kit-mcp · Kit Attribution Reminder (UserPromptSubmit)
//
// Injeta `additionalContext` no envelope do prompt do usuário com diretiva
// canônica v1.30.1: sempre que Claude usar comandos/agents/skills do kit-mcp
// no turno corrente, deve abrir o sidecar (auto-spawn já cuida disso na 1ª
// tool call) e listar os recursos usados em bloco final do output.
//
// Objetivo: dar feedback visual + textual de uso real do kit-mcp para o
// usuário detectar bugs no fluxo precocemente.
//
// Pipeline: UserPromptSubmit hook → reads stdin envelope → writes JSON com
// `{ continue: true, hookSpecificOutput: { hookEventName: "UserPromptSubmit",
//    additionalContext: "<diretiva>" } }` → exit 0.
//
// SOFT failure: qualquer erro → exit 0 sem bloquear. Skip se
// KIT_MCP_NO_ATTRIBUTION=1.
//
// Module format: CommonJS (.cjs) — compatível com qualquer setup Node.
//
// Enable em settings.json (project ou user):
//   {
//     "hooks": {
//       "UserPromptSubmit": [{
//         "matcher": "*",
//         "hooks": [{
//           "type": "command",
//           "command": "node /abs/path/to/kit-attribution-reminder.cjs"
//         }]
//       }]
//     }
//   }

'use strict';

// Opt-out via env var
if (process.env.KIT_MCP_NO_ATTRIBUTION === '1' || process.env.KIT_MCP_NO_ATTRIBUTION === 'true') {
  process.exit(0);
}

const DIRECTIVE = [
  '🔧 KIT-MCP ATTRIBUTION — directive ativa neste turno (v1.30.1):',
  '',
  'Se ao responder este turno você usar QUALQUER recurso do kit-mcp (qualquer',
  'subagent_type listado em /agents kit-mcp, qualquer skill cujo nome começa',
  'com supabase-/legacy-/cascading-/etc. do kit, ou qualquer /slash-command',
  'do kit), SEMPRE faça duas coisas:',
  '',
  '1. **Sidecar visual:** o kit-mcp abre o sidecar automaticamente na primeira',
  '   tool call do MCP server (browser tab em 127.0.0.1:<porta>). Você NÃO',
  '   precisa abrir manualmente — é fire-and-forget no MCP. Apenas confirme',
  '   que foi disparado e mencione se o usuário precisar conferir.',
  '',
  '2. **Bloco de atribuição no final do output** — adicione ao final da sua',
  '   resposta um bloco markdown listando TODOS os recursos kit-mcp usados:',
  '',
  '   ```',
  '   ---',
  '   🔧 **Kit-mcp resources usados neste turno:**',
  '   - Commands: /<command> (motivo: ...)',
  '   - Agents: <agent-name> (via Task — motivo: ...)',
  '   - Skills: <skill-name> (auto-trigger / consultada — motivo: ...)',
  '   - Sidecar: http://127.0.0.1:<porta>/ (opened on first MCP tool call)',
  '   ```',
  '',
  '   Omita seções vazias. Se NÃO usou nenhum recurso kit-mcp neste turno,',
  '   **não adicione o bloco** — silêncio é melhor que ruído.',
  '',
  'Disable temporário: env KIT_MCP_NO_ATTRIBUTION=1.',
  '',
].join('\n');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    // Aceita envelope vazio; só precisamos retornar o JSON com additionalContext.
    JSON.parse(input || '{}');
  } catch {
    // Envelope inválido — não bloquear; sair sem inject.
    process.exit(0);
  }
  const payload = JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: DIRECTIVE,
    },
  });
  // SEC-13-05 (category A): flush antes de exit
  process.stdout.write(payload, () => process.exit(0));
});

process.stdin.on('error', () => process.exit(0));

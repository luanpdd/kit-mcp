#!/usr/bin/env node
// hook-version: 1.30.2
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
  '🔧 KIT-MCP ATTRIBUTION — directive ativa neste turno (v1.30.2):',
  '',
  'SEMPRE termine sua resposta com um bloco de atribuição kit-mcp.',
  'Sem exceção. O usuário precisa de confirmação POSITIVA em TODO turno',
  'sobre se kit-mcp foi usado ou não — silêncio é ambíguo (não dá pra',
  'distinguir "não usei" de "esqueci de citar").',
  '',
  '**Caso A — Você USOU recursos kit-mcp neste turno:**',
  '',
  '   ```',
  '   ---',
  '   🔧 **Kit-mcp resources usados neste turno:**',
  '   - Commands: /<command> (motivo: ...)',
  '   - Agents: <agent-name> (via Task — motivo: ...)',
  '   - Skills: <skill-name> (auto-trigger / consultada — motivo: ...)',
  '   - MCP tools: mcp__kit__<tool> (motivo: ...)',
  '   - Sidecar: http://127.0.0.1:<porta>/ (opened on first MCP tool call)',
  '   ```',
  '',
  '   Omita LINHAS vazias dentro do bloco. Inclua apenas categorias usadas.',
  '',
  '**Caso B — Você NÃO usou nenhum recurso kit-mcp neste turno:**',
  '',
  '   ```',
  '   ---',
  '   🔧 **Kit-mcp neste turno:** nenhum recurso usado (resposta puramente',
  '   inline / Bash / Edit / Read / Write / Grep / Glob direto sem',
  '   delegar para agents, skills ou commands do kit).',
  '   ```',
  '',
  'O que conta como "recurso kit-mcp":',
  '- subagent_types listados em /agents kit-mcp (delegação via Task)',
  '- skills cujo description começa com "Use ao..." e nome casa um do kit',
  '  (supabase-*, legacy-*, cascading-*, multi-tenant-*, etc.)',
  '- /slash-commands do kit (/supabase, /legacy, /multi-tenant, etc.)',
  '- MCP tools mcp__kit__* invocadas',
  '',
  'O que NÃO conta:',
  '- Tools nativos do Claude Code (Bash, Edit, Read, Write, Grep, Glob, Task',
  '  com general-purpose, etc.) sem ser instrução de um kit resource',
  '- Skills genéricas da Anthropic (anthropic-skills:*, engineering:*, etc.)',
  '',
  'Disable: env KIT_MCP_NO_ATTRIBUTION=1.',
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

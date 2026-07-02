#!/usr/bin/env node
// hook-version: 1.41.0
// kit-mcp · Kit Attribution Reminder (UserPromptSubmit)
//
// Injeta `additionalContext` no envelope do prompt do usuário com uma
// diretiva ENXUTA: pedir 1 linha de atribuição no fim da resposta.
//
// v1.30.3 (#3): diretiva reduzida de ~50 linhas para ~7 — o bloco longo
// anterior custava ~1,5 KB de ruído por prompt e treinava compliance
// theater. Mantém a confirmação positiva ("kit foi usado?") com fração
// do custo de contexto.
// v1.30.4: a linha agora AGRUPA por tipo (agents/skills/commands/mcp) e
// nomeia cada recurso — antes "<recursos usados>" era vago e escondia
// quais agents/subagents rodaram.
// v1.30.5: distinção explícita — rodar scripts/código do kit via `node`/Bash
// NÃO é uso de MCP tool. Só conta `mcp` se a tool mcp__kit__* foi invocada
// de fato. Corrige mis-atribuição ("mcp: kit" sem ter chamado a tool).
//
// Objetivo: feedback textual leve de uso real do kit-mcp.
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
  '🔧 kit-mcp — termine a resposta com UMA linha, agrupando por tipo e',
  'NOMEANDO cada recurso usado neste turno:',
  '  "🔧 kit-mcp · agents: <nomes> · skills: <nomes> · commands: <nomes> · mcp: <tools>"',
  'Conta SÓ o que você REALMENTE invocou neste turno:',
  '• agents   = Task(subagent_type="…") com um agent do kit.',
  '• skills   = skill do kit auto-triggada/consultada (supabase-*/legacy-*/…).',
  '• commands = /slash-command do kit executado.',
  '• mcp      = tool mcp__kit__* chamada de fato (a tool MCP em si).',
  'NÃO conta — reporte "nenhum recurso usado" se só fez isto:',
  '• Bash/Edit/Read/Write/Grep/Glob nativos.',
  '• rodar scripts ou o código do servidor kit via `node`/Bash — mesmo',
  '  sendo arquivos do kit, isso é Bash, NÃO é invocar a MCP tool.',
  '• skills genéricas da Anthropic (anthropic-skills:*, engineering:*, …).',
  'Nenhum recurso → "🔧 kit-mcp: nenhum recurso usado".',
  'Custo: se usou agents/skills de cost_tier medio/pesado neste turno, acrescente',
  'na MESMA linha " · custo: /custo-sessao" para o usuário ver o gasto real (USD/tokens).',
  'Disable: env KIT_MCP_NO_ATTRIBUTION=1.',
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

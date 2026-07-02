#!/usr/bin/env node
// hook-version: 1.30.1
// SEC-13-05: flush-before-exit category = A (stdout.write + immediate exit)
// Fix applied: process.stdout.write(payload, () => process.exit(0)) on warning path.
// framework Workflow Guard — PreToolUse hook
// Detects when Claude attempts file edits outside a framework workflow context
// (no active / command or Task subagent) and injects an advisory warning.
//
// This is a SOFT guard — it advises, not blocks. The edit still proceeds.
// The warning nudges Claude to use /quick or /fast instead of
// making direct edits that bypass state tracking.
//
// Enable via config: hooks.workflow_guard: true (default: false)
// Only triggers on Write/Edit tool calls to non-.planning/ files.

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;

    // Only guard Write and Edit tool calls
    if (toolName !== 'Write' && toolName !== 'Edit') {
      process.exit(0);
    }

    // Check if we're inside a framework workflow (Task subagent or / command)
    // Subagents have a session_id that differs from the parent
    // and typically have a description field set by the orchestrator
    if (data.tool_input?.is_subagent || data.session_type === 'task') {
      process.exit(0);
    }

    // Check the file being edited
    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';

    // Allow edits to .planning/ files (framework state management)
    if (filePath.includes('.planning/') || filePath.includes('.planning\\')) {
      process.exit(0);
    }

    // Allow edits to common config/docs files that don't need framework tracking
    const allowedPatterns = [
      /\.gitignore$/,
      /\.env/,
      /CLAUDE\.md$/,
      /AGENTS\.md$/,
      /GEMINI\.md$/,
      /settings\.json$/,
    ];
    if (allowedPatterns.some(p => p.test(filePath))) {
      process.exit(0);
    }

    // Check if workflow guard is enabled
    const cwd = data.cwd || process.cwd();
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.hooks?.workflow_guard) {
          process.exit(0); // Guard disabled (default)
        }
      } catch (e) {
        process.exit(0);
      }
    } else {
      process.exit(0); // No framework project — don't guard
    }

    // If we get here: framework project, guard enabled, file edit outside .planning/,
    // not in a subagent context. Inject advisory warning.
    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: `⚠️ AVISO DE FLUXO DE TRABALHO: Você está editando ${path.basename(filePath)} diretamente sem um comando do framework. ` +
          'Esta edição não será rastreada no STATE.md nem produzirá um SUMMARY.md. ' +
          'Considere usar /fast para correções triviais ou /quick para mudanças maiores ' +
          'para manter o rastreamento de estado do projeto. ' +
          'Se isso for intencional (ex.: usuário solicitou explicitamente uma edição direta), prossiga normalmente.'
      }
    };

    // SEC-13-05: aguardar flush do stdout antes do exit. Sem callback, em
    // pipes lentos (CI/Windows/Git Bash) o JSON pode ser dropado quando o
    // process termina antes do kernel drenar o buffer.
    process.stdout.write(JSON.stringify(output), () => {
      process.exit(0);
    });
  } catch (e) {
    // Silent fail — never block tool execution
    process.exit(0);
  }
});

#!/usr/bin/env node
// Dual-mode entrypoint for the `kit-mcp` binary.
//
// `npx @luanpdd/kit-mcp` resolves to THIS bin (the unscoped package name is
// `kit-mcp`). MCP clients launch it with NO extra args and speak JSON-RPC over
// stdio — so a bare invocation must start the stdio server (and emit nothing on
// stdout, per the MCP spec).
//
// But the README also documents CLI usage through the same binary
// (`npx -y @luanpdd/kit-mcp install claude-code`, `... sync ...`, `... pack list`,
// `kit-mcp logs/status/doctor`). When invoked WITH arguments we therefore
// dispatch to the CLI (src/cli/index.js parses process.argv on import) instead
// of starting the server — otherwise the args are ignored and the process hangs
// waiting for JSON-RPC, with no terminal output (looks like "nothing happened").
if (process.argv.length > 2) {
  // CLI mode — importing the module runs program.parseAsync(process.argv).
  await import('../src/cli/index.js');
} else {
  // Server mode — how MCP clients (Claude Code, Cursor, …) launch it.
  const { startStdio } = await import('../src/mcp-server/index.js');
  startStdio().catch((e) => {
    process.stderr.write(`kit-mcp failed to start: ${e.stack ?? e.message}\n`);
    process.exit(1);
  });
}

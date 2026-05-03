#!/usr/bin/env node
import { startStdio } from '../src/mcp-server/index.js';
startStdio().catch((e) => {
  process.stderr.write(`kit-mcp failed to start: ${e.stack ?? e.message}\n`);
  process.exit(1);
});

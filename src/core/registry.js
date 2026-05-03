// Single source of truth for IDE/agent targets.
// Adding support for a new IDE = add an entry below. No new code.
//
// Capability fields:
//   rules:    where the IDE expects "always-on" instructions (single file or multi-file dir)
//   agents:   where named subagents live (or null if unsupported)
//   commands: where slash-commands live (or null)
//   skills:   where skill packs live (multi-dir, one folder per skill)
//   mcpConfig: where the IDE stores MCP server registrations (or null)
//
// Mode legend:
//   single     → one aggregated file
//   multi      → one file per item, in a directory
//   multi-dir  → one subdirectory per item (skills typically)

export const TARGETS = {
  'claude-code': {
    label: 'Claude Code',
    rules:    { path: 'CLAUDE.md',                         mode: 'single' },
    agents:   { path: '.claude/agents/',                   mode: 'multi',     extension: '.md' },
    commands: { path: '.claude/commands/',                 mode: 'multi',     extension: '.md' },
    skills:   { path: '.claude/skills/',                   mode: 'multi-dir' },
    mcpConfig:{ path: '.mcp.json',                         strategy: 'merge-mcpServers-json',
                userPath: '~/.claude.json',                userKey: 'mcpServers' },
  },
  'cursor': {
    label: 'Cursor',
    rules:    { path: '.cursor/rules/',                    mode: 'multi',     extension: '.mdc' },
    agents:   { path: '.cursor/agents/',                   mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   null,
    mcpConfig:{ path: '.cursor/mcp.json',                  strategy: 'merge-mcpServers-json',
                userPath: '~/.cursor/mcp.json',            userKey: 'mcpServers' },
  },
  'codex': {
    label: 'OpenAI Codex',
    rules:    { path: 'AGENTS.md',                         mode: 'single' },
    agents:   null,
    commands: null,
    skills:   { path: '.codex/skills/',                    mode: 'multi-dir' },
    mcpConfig:{ path: null,
                userPath: '~/.codex/config.toml',          strategy: 'append-toml-snippet',
                userKey:  'mcp_servers' },
  },
  'gemini-cli': {
    label: 'Gemini CLI',
    rules:    { path: 'GEMINI.md',                         mode: 'single' },
    agents:   null,
    commands: null,
    skills:   { path: '.gemini/skills/',                   mode: 'multi-dir' },
    mcpConfig:{ path: null,
                userPath: '~/.gemini/settings.json',       strategy: 'merge-mcpServers-json',
                userKey:  'mcpServers' },
  },
  'copilot': {
    label: 'GitHub Copilot',
    rules:    { path: '.github/copilot-instructions.md',   mode: 'single' },
    agents:   { path: '.github/agents/',                   mode: 'multi',     extension: '.agent' },
    commands: null,
    skills:   { path: '.github/skills/',                   mode: 'multi-dir' },
    mcpConfig: null,
  },
  'windsurf': {
    label: 'Windsurf',
    rules:    { path: '.windsurf/rules/',                  mode: 'multi',     extension: '.md' },
    agents:   { path: '.windsurf/agents/',                 mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   { path: '.windsurf/skills/',                 mode: 'multi-dir' },
    mcpConfig:{ path: '.windsurf/mcp_config.json',         strategy: 'merge-mcpServers-json',
                userKey:  'mcpServers' },
  },
  'antigravity': {
    label: 'Google Antigravity',
    rules:    { path: '.agents/rules/',                    mode: 'multi',     extension: '.md' },
    agents:   { path: '.agents/agents/',                   mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   { path: '.agents/workflows/',                mode: 'multi-dir' },
    mcpConfig: null,
  },
  'trae': {
    label: 'Trae',
    rules:    { path: '.trae/rules/',                      mode: 'multi',     extension: '.md' },
    agents:   { path: '.trae/agents/',                     mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   null,
    mcpConfig: null,
  },
};

export function listTargets() {
  return Object.entries(TARGETS).map(([id, t]) => ({
    id,
    label: t.label,
    capabilities: {
      rules:    !!t.rules,
      agents:   !!t.agents,
      commands: !!t.commands,
      skills:   !!t.skills,
      mcpConfig:!!t.mcpConfig,
    },
  }));
}

export function getTarget(id) {
  const t = TARGETS[id];
  if (!t) throw new Error(`Unknown target: ${id}. Available: ${Object.keys(TARGETS).join(', ')}`);
  return t;
}

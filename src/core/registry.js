// Single source of truth for IDE/agent targets.
// Adding support for a new IDE = add an entry below. No new code.
//
// Capability fields:
//   rules:     where the IDE expects "always-on" instructions (single file or multi-file dir)
//   agents:    where named subagents live (or null if unsupported)
//   commands:  where slash-commands live (or null)
//   skills:    where skill packs live (multi-dir, one folder per skill)
//   workflows: where Dynamic Workflows scripts live (.workflow.js, Claude Code Opus 4.8+)
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
    workflows:{ path: '.claude/workflows/',                mode: 'multi',     extension: '.workflow.js',
                minPlan: 'max' },
    framework:{ path: '.claude/framework/',                mode: 'mirror-tree', source: 'framework' },
    hooks:    { path: '.claude/hooks/',                    mode: 'mirror-tree', source: 'hooks' },
    mcpConfig:{ path: '.mcp.json',                         strategy: 'merge-mcpServers-json',
                userPath: '~/.claude.json',                userKey: 'mcpServers' },
  },
  'cursor': {
    label: 'Cursor',
    rules:    { path: '.cursor/rules/',                    mode: 'multi',     extension: '.mdc' },
    agents:   { path: '.cursor/agents/',                   mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   null,
    workflows: null,
    mcpConfig:{ path: '.cursor/mcp.json',                  strategy: 'merge-mcpServers-json',
                userPath: '~/.cursor/mcp.json',            userKey: 'mcpServers' },
  },
  'codex': {
    label: 'OpenAI Codex',
    rules:    { path: 'AGENTS.md',                         mode: 'single' },
    agents:   null,
    commands: null,
    skills:   { path: '.codex/skills/',                    mode: 'multi-dir' },
    workflows: null,
    mcpConfig:{ path: null,
                userPath: '~/.codex/config.toml',          strategy: 'append-toml-snippet',
                userKey:  'mcp_servers' },
  },
  'copilot': {
    label: 'GitHub Copilot',
    rules:    { path: '.github/copilot-instructions.md',   mode: 'single' },
    agents:   { path: '.github/agents/',                   mode: 'multi',     extension: '.agent' },
    commands: null,
    skills:   { path: '.github/skills/',                   mode: 'multi-dir' },
    workflows: null,
    mcpConfig: null,
  },
  'windsurf': {
    label: 'Windsurf',
    rules:    { path: '.windsurf/rules/',                  mode: 'multi',     extension: '.md' },
    agents:   { path: '.windsurf/agents/',                 mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   { path: '.windsurf/skills/',                 mode: 'multi-dir' },
    workflows: null,
    mcpConfig:{ path: '.windsurf/mcp_config.json',         strategy: 'merge-mcpServers-json',
                userKey:  'mcpServers' },
  },
  'antigravity': {
    // Google Antigravity (IDE + CLI). Config conventions verified 2026-06 against
    // official Google codelabs (developer-knowledge-mcp / authoring-skills /
    // autonomous-pipelines), the Gemini API "Building Managed Agents" docs, and the
    // Google AI Developers Forum (Google staff). See CHANGELOG.
    label: 'Google Antigravity',
    // Per-file workspace rules in .agents/rules/ (plural is the 2.0 default;
    // legacy .agent/ singular is backward-compat only).
    rules:    { path: '.agents/rules/',                    mode: 'multi',     extension: '.md' },
    // agents: null by design — Antigravity has NO per-agent .md registry like
    // Claude's .claude/agents/. Its .agents/agents.md is a single fixed-persona
    // team file (@pm/@engineer/@qa/...), not a drop-in dir for the kit's agents.
    agents:   null,
    // Slash-commands live as flat .md in .agents/workflows/<name>.md, invoked as
    // /<name>. This is the IDE's slash-command surface — NOT Dynamic Workflows
    // (those stay Claude-Code-only; see workflows:null).
    commands: { path: '.agents/workflows/',                mode: 'multi',     extension: '.md' },
    // Skills: directory packages at .agents/skills/<name>/SKILL.md.
    skills:   { path: '.agents/skills/',                   mode: 'multi-dir' },
    workflows: null,
    // MCP: Antigravity 2.0 (IDE + CLI) reads the shared central user config
    // ~/.gemini/config/mcp_config.json (top-level key mcpServers; stdio servers
    // use command/args/env). Project scope is unreliable (antigravity-cli #60),
    // so we only write the user-level path.
    mcpConfig:{ path: null,
                userPath: '~/.gemini/config/mcp_config.json', strategy: 'merge-mcpServers-json',
                userKey:  'mcpServers' },
  },
  'trae': {
    label: 'Trae',
    rules:    { path: '.trae/rules/',                      mode: 'multi',     extension: '.md' },
    agents:   { path: '.trae/agents/',                     mode: 'multi',     extension: '.md' },
    commands: null,
    skills:   null,
    workflows: null,
    mcpConfig: null,
  },
};

export function listTargets() {
  return Object.entries(TARGETS).map(([id, t]) => ({
    id,
    label: t.label,
    capabilities: {
      rules:     !!t.rules,
      agents:    !!t.agents,
      commands:  !!t.commands,
      skills:    !!t.skills,
      workflows: !!t.workflows,
      framework: !!t.framework,
      hooks:     !!t.hooks,
      mcpConfig: !!t.mcpConfig,
    },
  }));
}

export function getTarget(id) {
  const t = TARGETS[id];
  if (!t) throw new Error(`Unknown target: ${id}. Available: ${Object.keys(TARGETS).join(', ')}`);
  return t;
}

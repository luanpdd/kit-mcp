// DIR-05 — MCP tool `projects` (list/get/doctor sobre o registro PROJETOS.md).
//
// Invariantes:
//  1. Tool `projects` presente em TOOLS (enum list|get|doctor) e em HANDLERS.
//  2. list sem PROJETOS.md → exists:false com hint de /base init (não lança).
//  3. list com registro válido → projetos (principal primeiro) + issues.
//  4. get acha por nome case-insensitive; nome desconhecido → error com
//     os nomes disponíveis; name ausente → error.
//  5. doctor valida existência dos paths locais via fs (pasta real ok:true,
//     path inexistente ok:false) e shape das URLs.
//  6. Unknown action → error (mesmo contrato dos demais handlers).
//
// Estratégia: mock de projectRoot em tmpdir com PROJETOS.md fixture, invocando
// o handler direto via HANDLERS (mesmo padrão de test/unit/mcp-pack.test.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TOOLS, HANDLERS, __TEST_HANDLERS } from '../../src/mcp-server/index.js';

const handleProjects = HANDLERS.projects;

async function makeWorkspace(name) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `kit-mcp-projects-${name}-`));
  return dir;
}

// Fixture com paths reais dentro do tmpdir — doctor precisa de dirs que existem.
async function writeRegistry(dir, { docsPath, connectedPastaExists = true } = {}) {
  const pastaPrincipal = dir; // o próprio tmpdir existe
  const docs = docsPath ?? path.join(dir, 'docs');
  await fs.mkdir(docs, { recursive: true });
  const pastaConectado = connectedPastaExists
    ? dir
    : path.join(dir, 'nao-existe-esta-pasta');
  const md = `# Registro de Projetos

## Projeto principal: kit-mcp

- **Pasta local do projeto** (obrigatório): \`${pastaPrincipal}\`
- **Repositório do projeto** (obrigatório): https://github.com/luanpdd/kit-mcp
- **Documentação local** (obrigatório): \`${docs}\`
- **Repositório da documentação** (opcional): —
- **Infra / VPS** (opcional): —
- **Notas** (opcional): —

## Projetos conectados

### Meu-Saas

- **Pasta local do projeto** (obrigatório): \`${pastaConectado}\`
- **Repositório do projeto** (obrigatório): https://github.com/luanpdd/meu-saas
- **Documentação local** (obrigatório): \`${docs}\`
- **Repositório da documentação** (opcional): —
- **Infra / VPS** (opcional): —
- **Notas** (opcional): —
`;
  await fs.writeFile(path.join(dir, 'PROJETOS.md'), md, 'utf8');
}

test('projects tool — registrada em TOOLS com actions list|get|doctor e em HANDLERS', () => {
  const tool = TOOLS.find((t) => t.name === 'projects');
  assert.ok(tool, 'TOOLS deve conter a tool projects');
  assert.deepEqual(tool.inputSchema.properties.action.enum, ['list', 'get', 'doctor']);
  assert.deepEqual(tool.inputSchema.required, ['action']);
  assert.match(tool.description, /registro de projetos/);
  assert.match(tool.description, /projetos conectados/);
  assert.match(tool.description, /\/base/);
  assert.equal(typeof HANDLERS.projects, 'function');
  assert.equal(typeof __TEST_HANDLERS.handleProjects, 'function');
});

test('projects tool — list sem PROJETOS.md retorna exists:false com hint de /base init', async () => {
  const dir = await makeWorkspace('sem-arquivo');
  try {
    const r = await handleProjects({ action: 'list', projectRoot: dir });
    assert.equal(r.exists, false);
    assert.equal(r.projectRoot, dir);
    assert.match(r.error, /\/base init/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — list retorna principal primeiro + conectados com completude', async () => {
  const dir = await makeWorkspace('list');
  try {
    await writeRegistry(dir);
    const r = await handleProjects({ action: 'list', projectRoot: dir });
    assert.equal(r.exists, true);
    assert.equal(r.projetos.length, 2);
    assert.equal(r.projetos[0].nome, 'kit-mcp');
    assert.equal(r.projetos[0].principal, true);
    assert.equal(r.projetos[0].completo, true);
    assert.equal(r.projetos[1].nome, 'Meu-Saas');
    assert.equal(r.projetos[1].principal, false);
    assert.deepEqual(r.issues, []);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — get acha projeto por nome case-insensitive', async () => {
  const dir = await makeWorkspace('get');
  try {
    await writeRegistry(dir);
    const r = await handleProjects({ action: 'get', name: 'meu-saas', projectRoot: dir });
    assert.ok(r.projeto, 'get deve retornar o projeto');
    assert.equal(r.projeto.nome, 'Meu-Saas');
    assert.equal(r.projeto.campos.repositorio, 'https://github.com/luanpdd/meu-saas');
    assert.deepEqual(r.issues, []);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — get com nome desconhecido lista os disponíveis; sem name → error', async () => {
  const dir = await makeWorkspace('get-erro');
  try {
    await writeRegistry(dir);
    const r = await handleProjects({ action: 'get', name: 'nope', projectRoot: dir });
    assert.match(r.error, /não encontrado/);
    assert.match(r.error, /kit-mcp/);
    assert.match(r.error, /Meu-Saas/);
    const r2 = await handleProjects({ action: 'get', projectRoot: dir });
    assert.match(r2.error, /requer name/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — doctor aprova registro com paths reais', async () => {
  const dir = await makeWorkspace('doctor-ok');
  try {
    await writeRegistry(dir);
    const r = await handleProjects({ action: 'doctor', projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.projetos.length, 2);
    for (const p of r.projetos) {
      assert.equal(p.ok, true);
      assert.ok(p.checks.some((c) => c.tipo === 'path' && c.campo === 'pasta_local' && c.ok));
      assert.ok(p.checks.some((c) => c.tipo === 'url' && c.campo === 'repositorio' && c.ok));
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — doctor reprova pasta local inexistente no disco', async () => {
  const dir = await makeWorkspace('doctor-path');
  try {
    await writeRegistry(dir, { connectedPastaExists: false });
    const r = await handleProjects({ action: 'doctor', projectRoot: dir });
    assert.equal(r.ok, false);
    const conectado = r.projetos.find((p) => p.nome === 'Meu-Saas');
    assert.equal(conectado.ok, false);
    const check = conectado.checks.find((c) => c.tipo === 'path' && c.campo === 'pasta_local');
    assert.equal(check.ok, false);
    assert.match(check.detalhe, /não encontrado no disco/);
    // O parser não flagra path inexistente (função pura) — issues seguem vazias.
    assert.deepEqual(r.issues, []);
    // Principal segue aprovado.
    assert.equal(r.projetos.find((p) => p.nome === 'kit-mcp').ok, true);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — doctor reporta obrigatório vazio (placeholder) sem check de path', async () => {
  const dir = await makeWorkspace('doctor-placeholder');
  try {
    const md = [
      '## Projeto principal: alpha',
      '- **Pasta local do projeto** (obrigatório): `<caminho absoluto>`',
      '- **Repositório do projeto** (obrigatório): github.com/x/alpha',
      `- **Documentação local** (obrigatório): \`${dir}\``,
    ].join('\n');
    await fs.writeFile(path.join(dir, 'PROJETOS.md'), md, 'utf8');
    const r = await handleProjects({ action: 'doctor', projectRoot: dir });
    assert.equal(r.ok, false);
    const alpha = r.projetos[0];
    const obrig = alpha.checks.find((c) => c.tipo === 'obrigatorio' && c.campo === 'pasta_local');
    assert.equal(obrig.ok, false);
    // Campo vazio não gera check de path (nada a stat-ar).
    assert.ok(!alpha.checks.some((c) => c.tipo === 'path' && c.campo === 'pasta_local'));
    // URL sem shape https?:// reprovada.
    const url = alpha.checks.find((c) => c.tipo === 'url' && c.campo === 'repositorio');
    assert.equal(url.ok, false);
    assert.ok(r.issues.some((i) => i.code === 'campo_obrigatorio_vazio'));
    assert.ok(r.issues.some((i) => i.code === 'url_invalida'));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('projects tool — unknown action retorna error', async () => {
  const dir = await makeWorkspace('unknown');
  try {
    await writeRegistry(dir);
    const r = await handleProjects({ action: 'nope', projectRoot: dir });
    assert.match(r.error, /Unknown action/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

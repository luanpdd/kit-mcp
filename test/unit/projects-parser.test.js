// DIR-05 — parser puro do registro canônico PROJETOS.md (src/core/projects.js).
//
// Invariantes:
//  - Registro completo → principal + conectados com os 6 campos normalizados,
//    completo:true e issues vazio.
//  - Campos obrigatórios vazios ('—') ou placeholders de template intactos
//    ('<caminho absoluto>') contam como null → campo_obrigatorio_vazio.
//  - URL sem shape https?:// → url_invalida (repositorio derruba completo;
//    repositorio_documentacao só gera issue).
//  - String vazia / sem seção principal → sem_projeto_principal.
//  - Labels sem acento ("Repositorio do projeto") são aceitas.
//  - CRLF handling.
//  - Função pura: NUNCA toca no fs (paths inexistentes não geram issue aqui).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProjects,
  isPlaceholderValue,
  isValidRepoUrl,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
} from '../../src/core/projects.js';

// --- fixtures inline ---

const COMPLETO = `# Registro de Projetos

> Registro canônico exigido pela regra global do kit-mcp.

## Projeto principal: kit-mcp

- **Pasta local do projeto** (obrigatório): \`D:\\projetos\\kit-mcp-main\`
- **Repositório do projeto** (obrigatório): https://github.com/luanpdd/kit-mcp
- **Documentação local** (obrigatório): \`D:\\projetos\\kit-mcp-main\\docs\`
- **Repositório da documentação** (opcional): —
- **Infra / VPS** (opcional): —
- **Notas** (opcional): stack Node 22, zero-build

## Projetos conectados

<!-- Cada projeto adicional DEVE preencher todos os campos obrigatórios. -->

### meu-saas

- **Pasta local do projeto** (obrigatório): \`D:\\projetos\\meu-saas\`
- **Repositório do projeto** (obrigatório): https://github.com/luanpdd/meu-saas
- **Documentação local** (obrigatório): \`D:\\cofres\\obsidian\\meu-saas\`
- **Repositório da documentação** (opcional): https://github.com/luanpdd/meu-saas-docs
- **Infra / VPS** (opcional): vps-01.hetzner
- **Notas** (opcional): —
`;

const INCOMPLETO = `# Registro de Projetos

## Projeto principal: alpha

- **Pasta local do projeto** (obrigatório): \`<caminho absoluto>\`
- **Repositório do projeto** (obrigatório): github.com/luanpdd/alpha
- **Documentação local** (obrigatório): —
- **Repositório da documentação** (opcional): <URL ou "—">
- **Infra / VPS** (opcional): —
- **Notas** (opcional): —

## Projetos conectados

### beta

- **Pasta local do projeto** (obrigatório): \`D:\\projetos\\beta\`
- **Repositório do projeto** (obrigatório): https://github.com/luanpdd/beta
- **Documentação local** (obrigatório): \`D:\\projetos\\beta\\docs\`
`;

test('registro completo — principal + conectado, 6 campos, completo:true, zero issues', () => {
  const r = parseProjects(COMPLETO);
  assert.ok(r.principal);
  assert.equal(r.principal.nome, 'kit-mcp');
  assert.equal(r.principal.principal, true);
  assert.equal(r.principal.completo, true);
  assert.deepEqual(r.principal.faltantes, []);
  assert.equal(r.principal.campos.pasta_local, 'D:\\projetos\\kit-mcp-main');
  assert.equal(r.principal.campos.repositorio, 'https://github.com/luanpdd/kit-mcp');
  assert.equal(r.principal.campos.documentacao_local, 'D:\\projetos\\kit-mcp-main\\docs');
  assert.equal(r.principal.campos.repositorio_documentacao, null); // '—' → null
  assert.equal(r.principal.campos.infra_vps, null);
  assert.equal(r.principal.campos.notas, 'stack Node 22, zero-build');

  assert.equal(r.conectados.length, 1);
  const c = r.conectados[0];
  assert.equal(c.nome, 'meu-saas');
  assert.equal(c.principal, false);
  assert.equal(c.completo, true);
  assert.equal(c.campos.repositorio_documentacao, 'https://github.com/luanpdd/meu-saas-docs');
  assert.equal(c.campos.infra_vps, 'vps-01.hetzner');

  assert.deepEqual(r.issues, []);
});

test('registro incompleto — placeholders e "—" viram null e geram campo_obrigatorio_vazio', () => {
  const r = parseProjects(INCOMPLETO);
  assert.equal(r.principal.completo, false);
  // '<caminho absoluto>' (placeholder) e '—' (vazio) → null.
  assert.equal(r.principal.campos.pasta_local, null);
  assert.equal(r.principal.campos.documentacao_local, null);
  assert.deepEqual(r.principal.faltantes.sort(), ['documentacao_local', 'pasta_local']);
  // '<URL ou "—">' placeholder de opcional → null SEM issue de URL.
  assert.equal(r.principal.campos.repositorio_documentacao, null);

  const vazios = r.issues.filter((i) => i.code === 'campo_obrigatorio_vazio');
  assert.deepEqual(vazios.map((i) => i.campo).sort(), ['documentacao_local', 'pasta_local']);
  assert.ok(vazios.every((i) => i.projeto === 'alpha'));

  // Conectado com só os 3 obrigatórios preenchidos é completo (opcionais ausentes).
  assert.equal(r.conectados[0].completo, true);
  assert.deepEqual(r.conectados[0].faltantes, []);
});

test('URL sem shape https?:// no repositorio → url_invalida e completo:false', () => {
  const r = parseProjects(INCOMPLETO);
  const urls = r.issues.filter((i) => i.code === 'url_invalida');
  assert.equal(urls.length, 1);
  assert.equal(urls[0].campo, 'repositorio');
  assert.equal(urls[0].projeto, 'alpha');
  assert.equal(r.principal.completo, false);
});

test('url_invalida em repositorio_documentacao gera issue mas NÃO derruba completo', () => {
  const md = [
    '## Projeto principal: gama',
    '- **Pasta local do projeto** (obrigatório): `D:\\p\\gama`',
    '- **Repositório do projeto** (obrigatório): https://github.com/x/gama',
    '- **Documentação local** (obrigatório): `D:\\p\\gama\\docs`',
    '- **Repositório da documentação** (opcional): git@github.com:x/gama-docs.git',
  ].join('\n');
  const r = parseProjects(md);
  assert.equal(r.principal.completo, true);
  const urls = r.issues.filter((i) => i.code === 'url_invalida');
  assert.equal(urls.length, 1);
  assert.equal(urls[0].campo, 'repositorio_documentacao');
});

test('string vazia → principal null + sem_projeto_principal', () => {
  const r = parseProjects('');
  assert.equal(r.principal, null);
  assert.deepEqual(r.conectados, []);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].code, 'sem_projeto_principal');
});

test('input não-string (undefined) é tolerado como registro vazio', () => {
  const r = parseProjects(undefined);
  assert.equal(r.principal, null);
  assert.equal(r.issues[0].code, 'sem_projeto_principal');
});

test('labels sem acento e marcador (obrigatorio) sem acento são aceitos', () => {
  const md = [
    '## Projeto principal: delta',
    '- **Pasta local do projeto** (obrigatorio): `D:\\p\\delta`',
    '- **Repositorio do projeto** (obrigatorio): https://github.com/x/delta',
    '- **Documentacao local** (obrigatorio): `D:\\p\\delta\\docs`',
  ].join('\n');
  const r = parseProjects(md);
  assert.equal(r.principal.completo, true);
  assert.equal(r.principal.campos.repositorio, 'https://github.com/x/delta');
});

test('CRLF handling — parse idêntico ao LF', () => {
  const rLf = parseProjects(COMPLETO);
  const rCrlf = parseProjects(COMPLETO.replace(/\n/g, '\r\n'));
  assert.deepEqual(rCrlf, rLf);
});

test('H3 fora de "Projetos conectados" não vira projeto', () => {
  const md = [
    '## Projeto principal: eps',
    '- **Pasta local do projeto** (obrigatório): `D:\\p\\eps`',
    '- **Repositório do projeto** (obrigatório): https://github.com/x/eps',
    '- **Documentação local** (obrigatório): `D:\\p\\eps\\docs`',
    '',
    '## Notas gerais',
    '',
    '### isto-nao-e-projeto',
    '- **Pasta local do projeto** (obrigatório): `D:\\nope`',
  ].join('\n');
  const r = parseProjects(md);
  assert.equal(r.conectados.length, 0);
  assert.equal(r.principal.completo, true);
});

test('segunda seção "Projeto principal" é ignorada com issue projeto_principal_duplicado', () => {
  const md = [
    '## Projeto principal: a',
    '- **Pasta local do projeto** (obrigatório): `D:\\a`',
    '- **Repositório do projeto** (obrigatório): https://github.com/x/a',
    '- **Documentação local** (obrigatório): `D:\\a\\docs`',
    '## Projeto principal: b',
    '- **Pasta local do projeto** (obrigatório): `D:\\b`',
  ].join('\n');
  const r = parseProjects(md);
  assert.equal(r.principal.nome, 'a');
  assert.ok(r.issues.some((i) => i.code === 'projeto_principal_duplicado' && i.projeto === 'b'));
});

test('pureza — parser não valida existência de paths (path inexistente não gera issue)', () => {
  const md = [
    '## Projeto principal: zeta',
    '- **Pasta local do projeto** (obrigatório): `Z:\\caminho\\que\\nao\\existe\\em\\lugar\\nenhum`',
    '- **Repositório do projeto** (obrigatório): https://github.com/x/zeta',
    '- **Documentação local** (obrigatório): `Z:\\outro\\que\\nao\\existe`',
  ].join('\n');
  const r = parseProjects(md);
  assert.equal(r.principal.completo, true);
  assert.deepEqual(r.issues, []);
});

test('helpers — isPlaceholderValue e isValidRepoUrl', () => {
  assert.equal(isPlaceholderValue(''), true);
  assert.equal(isPlaceholderValue('—'), true);
  assert.equal(isPlaceholderValue('-'), true);
  assert.equal(isPlaceholderValue('<caminho absoluto>'), true);
  assert.equal(isPlaceholderValue('<URL ou "—">'), true);
  assert.equal(isPlaceholderValue('D:\\projetos\\x'), false);
  assert.equal(isValidRepoUrl('https://github.com/x/y'), true);
  assert.equal(isValidRepoUrl('http://gitlab.local/x'), true);
  assert.equal(isValidRepoUrl('github.com/x/y'), false);
  assert.equal(isValidRepoUrl('git@github.com:x/y.git'), false);
});

test('constantes do schema — 3 obrigatórios + 3 opcionais', () => {
  assert.deepEqual(REQUIRED_FIELDS, ['pasta_local', 'repositorio', 'documentacao_local']);
  assert.deepEqual(OPTIONAL_FIELDS, ['repositorio_documentacao', 'infra_vps', 'notas']);
});

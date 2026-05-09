# Phase 83: Core Filesystem Hardening - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)
**Depends on:** Phase 82 ✅

<domain>
## Limite da Fase

Fechar 3 vulnerabilidades HIGH na surface core de filesystem identificadas pela auditoria de segurança da v1.13:

**SEC-14-03 — reverse-sync.apply trust de projectRoot via MCP:**
- `src/core/sync.js:21-103` e `src/core/reverse-sync.js:25-46, 195-248` aceitam `projectRoot` arbitrário do MCP message.
- Atacante via MCP envia `projectRoot=\\evil-host\share` ou path do AppData → server escreve com permissões do user.
- walkTree `isSafeRel` valida nomes de SOURCE mas projectRoot DESTINO é unconstrained.

**SEC-14-04 — gate-runner tmpdir predictable (symlink TOCTOU):**
- `src/core/gate-runner.js:137-138`: `path.join(os.tmpdir(), \`kit-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.sh\`)`.
- `Math.random()` não-crypto + filename predictable.
- Em multi-user `/tmp` shared (Linux/macOS), atacante pré-cria symlink no path predicted antes do `fs.writeFile`.
- writeFile mode 0o700 só aplica a arquivo NOVO; symlink existente não.
- spawn(bash, [tmp]) executa o conteúdo do symlink target.

**SEC-14-05 — file-manifest.json não verificado em sync:**
- `kit/file-manifest.json` é shipped com SHA256 hashes mas NENHUM código em `src/` lê.
- Sync (sync.js) faz `fs.copyFile` direto sem verificar.
- Reverse-sync.apply --strategy=overwrite pode reescrever `kit/agents/executor.md` adversarialmente.
- Próximo `kit sync install` propaga agent malicioso para todas IDEs sem detecção.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado por configuração.

### Restrições absolutas
- Stable API v1.0+ preservada — `kit sync install` continua funcionando para projetos legítimos com manifest válido.
- Zero regressão em testes (222 baseline pós-Phase 82).
- Budget 6/6 deps mantido.
- Validação manifest deve ter opt-out via env var `KIT_MCP_SKIP_MANIFEST_CHECK=1` para dev workflow (editar kit/ localmente sem regenerar manifest a cada save).

### Diretrizes de implementação

**SEC-14-03 (projectRoot validation):**
- Em `src/mcp-server/index.js` handlers `handleSync` e `handleReverseSync`: antes de chamar `sync.js`/`reverse-sync.js`, validar `projectRoot`:
  - Se path absoluto E existe E contém `.git/` (allowlist heurístico) → aceitar
  - Senão → recusar com erro descritivo "MCP sync requires projectRoot to be a git workspace; got <projectRoot>"
- CLI continua aceitando qualquer dir (pattern existente preservado).
- Caso edge: monorepo com `.git/` no parent — aceitar se algum ancestor tem `.git/`. Walk-up até root.

**SEC-14-04 (gate-runner tmpdir):**
- Substituir Date.now+Math.random tmpfile por `fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'))` (cria diretório único per-run com permissão 0700 derivada da umask).
- Write script DENTRO do dir único (não no /tmp pelado).
- spawn(bash, [path/inside/dir]) — atacante não pode pre-criar dir antes do mkdtemp porque mkdtemp gera nome random crypto-safe.
- Cleanup com `fs.rm(dir, {recursive: true, force: true})` em finally block (mesmo se script error).

**SEC-14-05 (manifest verification):**
- Novo helper `src/core/manifest-verify.js`:
  - `verifyManifest(kitRoot)` — lê kit/file-manifest.json, computa SHA256 de cada arquivo listado, compara.
  - Retorna `{ok: true}` ou `{ok: false, mismatches: [{path, expected, actual}]}`.
  - Skip se `process.env.KIT_MCP_SKIP_MANIFEST_CHECK === '1'` (warn em stderr).
- Chamar em `src/core/sync.js` no início de `syncTo()` (path de install, não de remove).
- Se mismatch: throw error com mensagem listando primeiros 3 mismatches.
- Em CLI: erro chega via `kit sync install` exit 1.
- Em MCP: erro chega via error envelope (já sanitizado pós-Phase 84).

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/sync.js` syncTo() está em wave de fix da Phase 79 (npm ci) + Phase 80 (slim cap). Preservar mudanças.
- `src/core/gate-runner.js` runShellGate em ~linha 47-75; tmp script write em ~134-156. Phase 79.01 adicionou guard MCP — preservar.
- `kit/file-manifest.json` tem ~328 entries. Computar SHA256 de todas pode ser caro — considerar cache.
- Helper deve ser puro (testável sem filesystem real via temp fixture).

</code_context>

<specifics>
## Ideias Específicas

- **Manifest cache:** computar hashes lazy (só dos arquivos que sync vai tocar). Premature optimization se for rápido o suficiente — medir.
- **Test pattern projectRoot:** unit test passa fake `\\evil` projectRoot, assert error.message contém "git workspace"; integration test usa repo real.
- **Test pattern gate-runner:** spawn shell que tenta criar symlink no /tmp matching pattern, then trigger gate-runner — assert symlink target NÃO foi executado (verifyable via marker file que symlink-target tentaria criar).
- **Test pattern manifest:** integration test cria temp kit/ dir com manifest, modifica 1 arquivo, chama syncTo, assert error.

</specifics>

<deferred>
## Ideias Adiadas

- Manifest auto-regen em `prepublishOnly` script — facilita dev workflow mas escopo paralelo (DRIFT-15-XX).
- Manifest signing (não só hash) — overkill para package npm; dependeria de signing infra.
- File integrity em RUNTIME (verifyManifest em cada `bin/cli.js` boot) — overhead, baixo benefício; deixar só em sync paths.

</deferred>

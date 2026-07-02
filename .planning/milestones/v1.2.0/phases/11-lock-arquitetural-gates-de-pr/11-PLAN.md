# Phase 11: Lock arquitetural & gates de PR — PLAN

**Tipo:** Infraestrutura pura (decisão + CI gates, sem código de runtime)
**REQs cobertos:** SEC-04, DOC-03 (rascunho)
**Dependências:** nenhuma — primeira fase do milestone

## Estratégia

Quatro entregáveis atômicos:

1. **ADR** em `.planning/decisions.md` — registra as 6 decisões trade-off já fechadas (porta, lockfile, idle, lifecycle, auto-spawn scope, sem-auth).
2. **Threat model rascunho** em `docs/sidecar-security.md` — enumera trust boundary, ataques mitigados (DNS rebinding, path leak, stdout poisoning), trade-offs aceitos, melhorias futuras (v1.3+).
3. **Gate CI stdout discipline** — step novo em `.github/workflows/ci.yml` que falha PR se `console.log` ou `process.stdout.write` aparecer em qualquer arquivo dentro de `src/ui/`.
4. **Gate CI dep growth** — step novo em `.github/workflows/ci.yml` que falha PR se runtime deps crescer >+1 vs baseline (5 deps de v1.1.0).

## Tasks

### T1 — Escrever ADR consolidado

**Arquivo:** `.planning/decisions.md`
**Conteúdo:** 6 ADR entries (formato Status/Context/Decision/Consequences) cobrindo:
- ADR-01: Porta 7100-7199 com auto-fallback
- ADR-02: Lockfile em os.tmpdir() keyed por sha1(projectRoot), via O_EXCL
- ADR-03: Idle shutdown 30min default, flag `--idle-ms`
- ADR-04: `kit ui start` foreground default
- ADR-05: `--auto-spawn` em 3 tools MCP (sync, reverse-sync, gates run); explicit-out em list/search/get/forensics/install
- ADR-06: Sem auth no v1.2 (mitigação por bind 127.0.0.1 + Host/Origin + CSP + path scrub)

### T2 — Escrever threat model rascunho

**Arquivo:** `docs/sidecar-security.md`
**Conteúdo:**
- Trust boundary: localhost only, single-user, dev workstation
- Ataques mitigados: DNS rebinding (Host/Origin check), stdout poisoning (audit gate), path leak (redactPath central), CSP estrito
- Ataques fora-de-escopo: man-in-the-middle (sem TLS — localhost), DOS local (kit-mcp já trustado), supply-chain attack (todas as deps são revisáveis)
- Trade-offs aceitos: sem auth (bem documentado, mitigação compensatória), sem TLS, persistência efêmera
- Melhorias futuras (v1.3+): token-based auth via lockfile, opt-in TLS via mkcert

### T3 — Estender ci.yml com gate stdout

**Arquivo:** `.github/workflows/ci.yml`
**Mudança:** adicionar step "Audit: stdout discipline in src/ui/" no job principal:

```yaml
- name: Audit — stdout discipline in src/ui/
  shell: bash
  run: |
    if [ -d src/ui ]; then
      if grep -rn "console\.log\|process\.stdout\.write" src/ui/ 2>/dev/null; then
        echo "::error::REQ SEC-04 violated: console.log/process.stdout.write found in src/ui/"
        echo "Sidecar logs must go to stderr or to a file, never stdout (collides with MCP JSON-RPC)."
        exit 1
      fi
    fi
```

Roda em todas as combinações da matrix (Ubuntu/macOS/Windows × Node 20/22). Se `src/ui/` não existir ainda, step passa silenciosamente — fica armado pra Phase 12+.

### T4 — Estender ci.yml com gate dep growth

**Arquivo:** `.github/workflows/ci.yml`
**Mudança:** adicionar step "Audit: runtime deps size":

```yaml
- name: Audit — runtime deps size (max +1 from v1.1.0 baseline of 5)
  shell: bash
  run: |
    BASELINE=5  # v1.1.0: @modelcontextprotocol/sdk, commander, chokidar, picocolors, @inquirer/prompts
    CURRENT=$(node -e "console.log(Object.keys(require('./package.json').dependencies || {}).length)")
    MAX=$((BASELINE + 1))
    if [ "$CURRENT" -gt "$MAX" ]; then
      echo "::error::Runtime deps grew to $CURRENT — v1.2 budget is $MAX (baseline $BASELINE + 1 for open@11)"
      exit 1
    fi
    echo "Runtime deps: $CURRENT / $MAX"
```

Roda só em Ubuntu Node 20 (não precisa repetir matrix — counts são determinísticos).

## Critérios de sucesso (observáveis)

1. `cat .planning/decisions.md` exibe 6 ADR entries
2. `cat docs/sidecar-security.md` exibe threat model com seções enumeradas
3. PR de teste com `console.log("x")` em `src/ui/dummy.js` → CI falha com erro claro citando REQ SEC-04
4. PR de teste adicionando `lodash` (não justificado) sem remover outra dep → CI falha com erro citando budget de deps

## Riscos

- ci.yml já tem matrix pesada — adicionar 2 steps em todos os jobs adiciona ~5s. Aceitável.
- Gate de stdout pode ter falso positivo se um comentário ou string contém `console.log`. Mitigar usando regex que ignora linhas comentadas, OU aceitar que comentários com `console.log` literal são raros e mitigáveis no PR.

## Verificação

Manualmente:
- `cat .planning/decisions.md` → 6 entries presentes
- `cat docs/sidecar-security.md` → seções esperadas
- `grep -A20 "stdout discipline" .github/workflows/ci.yml` → step presente
- `grep -A15 "runtime deps size" .github/workflows/ci.yml` → step presente
- Smoke local: criar `src/ui/dummy.js` com `console.log` → step do CI rodado localmente via `act` ou `bash` direto → falha
- Smoke local: rodar dep counter no node baseline → 5 → passa

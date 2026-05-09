---
name: hermetic-builds
description: Use ao desenhar/auditar pipeline de build — reproducibility + isolation + provenance + lockfiles + frozen-install + SLSA framework. Cap 8 livro Google SRE.
---

# SRE — Hermetic Builds

## Quando usar

LLM carrega esta skill ao desenhar/auditar CI/CD ou ao investigar discrepância "no meu ambiente roda". Trigger phrases:

- "hermetic build", "reproducible build"
- "build cache", "lockfile"
- "frozen-lockfile", "npm ci", "pnpm install --frozen-lockfile"
- "build provenance", "SLSA"
- "config drift entre environments"
- "cap 8 Google SRE"

## Regras absolutas

- **Hermetic = mesmo input → mesmo output, qualquer máquina, qualquer momento.** Sem essa propriedade, build não é determinístico → forensics impossível.
- **Lockfile commitado SEMPRE.** `package-lock.json`, `pnpm-lock.yaml`, `deno.lock`, `Cargo.lock`, `go.sum`, `Pipfile.lock`. Sem lockfile = não-reproducible.
- **CI usa `frozen-lockfile` mode.** `npm ci` (não `npm install`), `pnpm install --frozen-lockfile`, `cargo install --locked`, `pip install --require-hashes`. Modo CI FALHA se lockfile não-sincronizado.
- **Sem network durante build (após install step).** Build hermético: depois de baixar deps, build OFFLINE. Network durante build = não-reprodutível.
- **Sem timestamps em output.** `--no-timestamps` em compilers; SOURCE_DATE_EPOCH em outros. Output bit-idêntico entre runs.
- **Build provenance gerada (SLSA framework).** Metadata: commit SHA + builder ID + deps versions + signatures. Cada artefato tem proveniência.
- **Build cache require hermeticidade.** Cache hit baseado em hash de input; só funciona se output é determinístico.

## Patterns canônicos

### Pattern 1: Lockfile workflow canônico (JS/TS)

```bash
# DEV — adicionando dep
pnpm add zod                         # atualiza package.json + lockfile
git add package.json pnpm-lock.yaml
git commit -m "deps: add zod"

# CI — install
pnpm install --frozen-lockfile       # falha se lockfile dessincronizado
                                      # (= alguém esqueceu de commitar lockfile)

# OUTROS LOCKS canônicos:
# Node/npm:    npm ci  (npm 7+, requer package-lock.json)
# Node/yarn:   yarn install --immutable  (yarn 2+)
# Node/pnpm:   pnpm install --frozen-lockfile
# Deno:        deno install --frozen
# Python/pip:  pip install --require-hashes -r requirements.txt
# Python/poetry: poetry install --no-interaction
# Rust:        cargo install --locked  (locked == respect Cargo.lock)
# Go:          go mod download   (go.sum acts como lockfile)
# Ruby:        bundle install --frozen
```

### Pattern 2: GitHub Actions hermetic recipe

```yaml
# .github/workflows/build.yml — hermetic build
name: Build & Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          # PT-BR: full clone para git provenance
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: '24'           # ← VERSÃO PINADA
          cache: 'pnpm'

      # PT-BR: pnpm cache sincronizado com lockfile hash
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0              # ← VERSÃO PINADA

      # PT-BR: install com frozen-lockfile (falha se desync)
      - run: pnpm install --frozen-lockfile

      # PT-BR: build OFFLINE — sem rede após install
      - run: pnpm build
        env:
          # disable any network call
          NODE_OPTIONS: '--no-network-family-autoselection'

      # PT-BR: tests
      - run: pnpm test

      # PT-BR: provenance attestation (SLSA Level 3)
      - uses: actions/attest-build-provenance@v3
        if: github.event_name == 'push'
        with:
          subject-path: 'dist/**/*'
```

### Pattern 3: Dockerfile hermetic

```dockerfile
# PT-BR: Dockerfile reprodutível
# Versão de base PINADA por hash, não por tag mutável
FROM node:24-alpine@sha256:abc123def456...

WORKDIR /app

# PT-BR: lockfile copiado primeiro para cache hit
COPY package.json pnpm-lock.yaml ./

# PT-BR: install determinístico
RUN corepack enable && \
    pnpm install --frozen-lockfile --prod

# PT-BR: copiar source DEPOIS para cache de install
COPY . .

# PT-BR: build sem timestamps
ENV SOURCE_DATE_EPOCH=0
RUN pnpm build

# Runtime stage
FROM node:24-alpine@sha256:abc123def456...
COPY --from=0 /app/dist /app/dist
COPY --from=0 /app/node_modules /app/node_modules
COPY --from=0 /app/package.json /app/

CMD ["node", "/app/dist/index.js"]
```

**Key:** image base PINADA por SHA, não tag. Tag `node:24-alpine` muta; SHA é imutável.

### Pattern 4: Build provenance via SLSA

SLSA (Supply chain Levels for Software Artifacts) tem 4 níveis:

```text
SLSA Level 1 — basic
  - source/build documentado
  - provenance gerada (algum metadata)

SLSA Level 2 — hosted build
  - build em CI hosted (não local)
  - provenance assinada por builder
  - source version controlled

SLSA Level 3 — non-falsifiable provenance
  - builder isolado, não controlável por dev
  - provenance includes: source SHA, build env, deps
  - cryptographically signed

SLSA Level 4 — hermetic + 2-party review
  - hermetic build (esta skill)
  - 2 reviewers required
  - reproducible: 2 builders independentes produzem hash igual
```

GitHub Actions tem `actions/attest-build-provenance` para SLSA Level 3.

### Pattern 5: Detectando builds não-hermético

Heurísticas para detectar:

```bash
# 1. Build referencia variáveis de tempo
grep -rE "Date\.now|new Date|time\.Now|datetime\.now" Dockerfile build.sh
# OK em runtime; problema se em build step (timestamp em output)

# 2. Build faz network calls após install
strace -f -e trace=network make build 2>&1 | grep -E "connect|sendto"
# Esperado: zero output após "install" step

# 3. Build depende de env var não-pinada
env | grep -E "BUILD_|RELEASE_" | grep -v -E "VERSION=|HASH="
# Vars dinâmicas = build difere entre runs

# 4. Lockfile dessincronizado
pnpm install --frozen-lockfile --offline
# Falha se lockfile desync; sucesso = OK

# 5. 2 builds consecutivos produzem mesmo hash?
hash1=$(make build && sha256sum dist/main.js)
make clean && hash2=$(make build && sha256sum dist/main.js)
[ "$hash1" = "$hash2" ] && echo "hermetic" || echo "non-hermetic"
```

### Pattern 6: Common pitfalls

```text
PITFALL 1: Floating tags em base images
  FROM node:latest          ← muta toda hora
  FROM node:24              ← muta minor versions
  FROM node:24-alpine       ← muta patch versions
  FROM node:24-alpine@sha256:abc...  ← imutável (DESEJADO)

PITFALL 2: env vars dinâmicas em build
  RUN echo "BUILD_TIME=$(date)" > /app/build-info  ← timestamp variável
  RUN echo "BUILD_TIME=$BUILD_TIME" > /app/build-info  ← OK se passa em arg pinado

PITFALL 3: random ports/UUIDs em build
  RUN node -e "fs.writeFileSync('id.txt', crypto.randomUUID())"
  ← cada build = id diferente. Anti-hermético.

PITFALL 4: dependências baixadas em build, não install
  RUN apk add curl && curl https://example.com/script.sh | sh
  ← não-deterministic. Vendor pode mudar script.

PITFALL 5: __pycache__ / .DS_Store em image
  ← pode invalidar cache; varia entre OS de dev
```

### Pattern 7: Build cache (hermetic permits caching)

```text
Build cache só funciona com hermeticidade:

cache_key = hash(source_files + deps_lockfile + build_config)

Se hermético:
  same input → same output
  cache_key colide → reuse output (10-100× faster)

Se não-hermético:
  same input → different output
  cache cant be trusted; always rebuild

GitHub Actions cache action exemplo:
  - uses: actions/cache@v4
    with:
      path: |
        ~/.pnpm-store
        node_modules
      key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
      restore-keys: |
        ${{ runner.os }}-pnpm-
```

## Anti-patterns

### ANTI: lockfile não commitado

```text
ANTI: pnpm-lock.yaml em .gitignore. "Cada dev resolve sozinho".

PROBLEMA: builds não-reprodutíveis. Bugs irrelacionáveis ao código.
          "No meu ambiente funciona" eternal.

CERTO: lockfile SEMPRE commitado. Single source of truth de dep
       versions. CI valida sincronia via --frozen-lockfile.
```

### ANTI: `npm install` em CI

```text
ANTI: CI roda `npm install` (não `npm ci`).

PROBLEMA: install pode resolver versions diferentemente entre CI runs.
          Bug que aparece "às vezes".

CERTO: `npm ci` (CI mode) — falha se lockfile desync; install
       puramente determinístico.
```

### ANTI: image base por tag mutável

```text
ANTI: FROM node:24-alpine

PROBLEMA: cada rebuild puxa versão diferente quando Alpine atualiza.
          Build de hoje !== build de amanhã.

CERTO: FROM node:24-alpine@sha256:abc...
       Imutável. Update explicitamente trocando SHA.
```

### ANTI: build sem provenance

```text
ANTI: artefato em prod sem metadata sobre origem.

PROBLEMA: incident — qual commit? que deps? quem buildou? Sem provenance,
          forensics chaves manuais.

CERTO: attest-build-provenance ativa SLSA. Cada artefato tem JSON
       attestado: source SHA, build env, deps, signatures.
```

### ANTI: build cache em ambiente não-hermético

```text
ANTI: cache hit em build não-deterministic. Output cacheado pode estar
      bugged.

PROBLEMA: bug "cacheado", aparece intermitente.

CERTO: hermeticidade primeiro, cache depois. Se 2 builds não produzem
       mesmo hash, cache é inválido.
```

## Verificação

1. Lockfile commitado para cada package manager usado
2. CI usa frozen-lockfile mode (`npm ci`, `--frozen-lockfile`, `--locked`, `--require-hashes`)
3. Image base pinada por SHA (não tag mutável)
4. Sem network calls após install step
5. Sem timestamps/UUIDs/random gerados em build
6. SOURCE_DATE_EPOCH=0 ou similar em compilers
7. Build provenance gerada (SLSA Level 3 mínimo)
8. 2 builds consecutivos produzem hash igual

---

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — vocabulário (hermetic, lockfile, SLSA, etc.)
- [`release-engineering`](../release-engineering/SKILL.md) (v1.11) — pipeline orchestration; hermetic é fundação
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 5 verifica hermeticidade
- [`prr-conductor`](../../agents/prr-conductor.md) (v1.10 + patch v1.11) — Axe 5 ganha checks de hermeticidade
- [`release-pipeline-auditor`](../../agents/release-pipeline-auditor.md) (v1.11) — agent que audita
- [`/auditar-release`](../../commands/auditar-release.md) (v1.11) — comando

*Material-fonte: Site Reliability Engineering — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) — Cap 8 (subsection sobre hermetic builds, build orchestration). Plus SLSA framework (slsa.dev).*

---
name: paperclip-create-plugin
description: >
  Create new Paperclip plugins with the current alpha SDK/runtime. Use when
  scaffolding a plugin package, adding a new example plugin, or updating plugin
  authoring docs. Covers the supported worker/UI surface, route conventions,
  scaffold flow, and verification steps.
---

# Criar um Plugin Paperclip

Use esta skill quando a tarefa for criar, fazer scaffolding ou documentar um plugin Paperclip.

## 1. Regras básicas

Leia primeiro quando necessário:

1. `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
2. `packages/plugins/sdk/README.md`
3. `doc/plugins/PLUGIN_SPEC.md` apenas para contexto de planos futuros

Suposições do runtime atual:

- workers de plugin são código confiável
- UI de plugin é código host confiável de mesma origem
- APIs de worker são gated por capabilities
- UI de plugin não é sandboxed por capabilities de manifest
- ainda não há um kit compartilhado de componentes UI fornecido pelo host
- `ctx.assets` não é suportado no runtime atual

## 2. Workflow preferido

Use o pacote de scaffold em vez de escrever o boilerplate à mão:

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js <npm-package-name> --output <target-dir>
```

Para um plugin que vive fora do repo Paperclip, passe `--sdk-path` e deixe o scaffold copiar o snapshot do SDK/pacotes compartilhados locais para `.paperclip-sdk/`:

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @acme/plugin-name \
  --output /absolute/path/to/plugin-repos \
  --sdk-path /absolute/path/to/paperclip/packages/plugins/sdk
```

Destino recomendado dentro deste repo:

- `packages/plugins/examples/` para plugins de exemplo
- outra pasta `packages/plugins/<name>/` se estiver virando um pacote de verdade

## 3. Após o scaffold

Verifique e ajuste:

- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `tests/plugin.spec.ts`
- `package.json`

Garanta que o plugin:

- declara apenas capabilities suportadas
- não usa `ctx.assets`
- não importa stubs de componentes UI do host
- mantém a UI auto-contida
- usa `routePath` apenas em slots `page`
- é instalado no Paperclip a partir de um caminho local absoluto durante o desenvolvimento

## 4. Se o plugin deve aparecer no app

Para comportamento de exemplo bundled/discoverable, atualize o wiring relevante do host:

- lista de exemplos bundled em `server/src/routes/plugins.ts`
- quaisquer docs que listem exemplos in-repo

Faça isso apenas se o usuário quiser o plugin exposto como exemplo bundled.

## 5. Verificação

Sempre rode:

```bash
pnpm --filter <plugin-package> typecheck
pnpm --filter <plugin-package> test
pnpm --filter <plugin-package> build
```

Se você também alterou código do SDK/host/runtime de plugin, rode também checks mais amplos do repo conforme apropriado.

## 6. Expectativas de documentação

Ao escrever ou atualizar docs de plugin:

- distinga implementação atual de ideias de spec futura
- seja explícito sobre o modelo de código confiável
- não prometa componentes UI do host ou APIs de assets
- prefira orientação de deploy via npm-package em vez de workflows repo-local para produção

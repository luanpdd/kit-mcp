<purpose>
Verifica atualizações do framework via npm, exibe o changelog para versões entre a instalada e a mais recente, obtém confirmação do usuário e executa uma instalação limpa com limpeza de cache.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<process>

<step name="get_installed_version">
Detecte se o framework está instalado localmente ou globalmente verificando ambos os locais e validando a integridade da instalação.

Primeiro, derive `PREFERRED_RUNTIME` do caminho `execution_context` do prompt invocador:
- Caminho contém `/.codex/` -> `codex`
- Caminho contém `/.gemini/` -> `gemini`
- Caminho contém `/.config/opencode/` ou `/.opencode/` -> `opencode`
- Caso contrário -> `claude`

Use `PREFERRED_RUNTIME` como o primeiro runtime verificado para que `/atualizar` direcione o runtime que o invocou.

```bash
# Runtime candidates: "<runtime>:<config-dir>" stored as an array.
# Using an array instead of a space-separated string ensures correct
# iteration in both bash and zsh (zsh does not word-split unquoted
# variables by default). Fixes #1173.
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "codex:.codex" )

# PREFERRED_RUNTIME should be set from execution_context before running this block.
# If not set, infer from runtime env vars; fallback to claude.
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then
    PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="gemini"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then
    PREFERRED_RUNTIME="opencode"
  elif [ -n "$CLAUDE_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="claude"
  else
    PREFERRED_RUNTIME="claude"
  fi
fi

# Reorder entries so preferred runtime is checked first.
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done

# Check local first (takes priority only if valid and distinct from global)
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "./$dir/framework/VERSION" ] || [ -f "./$dir/framework/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"
    LOCAL_VERSION_FILE="./$dir/framework/VERSION"
    LOCAL_MARKER_FILE="./$dir/framework/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"
    break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "$HOME/$dir/framework/VERSION" ] || [ -f "$HOME/$dir/framework/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"
    GLOBAL_VERSION_FILE="$HOME/$dir/framework/VERSION"
    GLOBAL_MARKER_FILE="$HOME/$dir/framework/workflows/update.md"
    GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"
    break
  fi
done

# Only treat as LOCAL if the resolved paths differ (prevents misdetection when CWD=$HOME)
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  # Runtime detected but VERSION missing/corrupt: treat as unknown version, keep runtime target
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="UNKNOWN"
  TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"
echo "$INSTALL_SCOPE"
echo "$TARGET_RUNTIME"
```

Analise a saída:
- Linha 1 = versão instalada (`0.0.0` significa versão desconhecida)
- Linha 2 = escopo de instalação (`LOCAL`, `GLOBAL` ou `UNKNOWN`)
- Linha 3 = runtime alvo (`claude`, `opencode`, `gemini` ou `codex`)
- Se o escopo for `UNKNOWN`, prossiga para o passo de instalação usando o fallback `--claude --global`.

Se várias instalações de runtime forem detectadas e o runtime invocador não puder ser determinado a partir do execution_context, pergunte ao usuário qual runtime atualizar antes de executar a instalação.

**Se o arquivo VERSION estiver ausente:**
```
## Atualização do framework

**Versão instalada:** Desconhecida

Sua instalação não inclui rastreamento de versão.

Executando instalação limpa...
```

Prossiga para o passo de instalação (trate como versão 0.0.0 para comparação).
</step>

<step name="check_latest_version">
Verifique a versão mais recente no npm:

```bash
npm view framework-cc version 2>/dev/null
```

**Se a verificação npm falhar:**
```
Não foi possível verificar atualizações (offline ou npm indisponível).

Para atualizar manualmente: `npx framework-cc --global`
```

Encerre.
</step>

<step name="compare_versions">
Compare instalada vs. mais recente:

**Se instalada == mais recente:**
```
## Atualização do framework

**Instalada:** X.Y.Z
**Mais recente:** X.Y.Z

Você já está na versão mais recente.
```

Encerre.

**Se instalada > mais recente:**
```
## Atualização do framework

**Instalada:** X.Y.Z
**Mais recente:** A.B.C

Você está à frente da versão mais recente (versão de desenvolvimento?).
```

Encerre.
</step>

<step name="show_changes_and_confirm">
**Se houver atualização disponível**, busque e mostre o que há de novo ANTES de atualizar:

1. Busque o changelog da URL raw do GitHub
2. Extraia as entradas entre as versões instalada e mais recente
3. Exiba a prévia e peça confirmação:

```
## Atualização do framework Disponível

**Instalada:** 1.5.10
**Mais recente:** 1.5.15

### O Que Há de Novo
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Adicionado
- Funcionalidade X

## [1.5.14] - 2026-01-18

### Corrigido
- Correção de bug Y

────────────────────────────────────────────────────────────

⚠️  **Nota:** O instalador realiza uma instalação limpa das pastas framework:
- `commands/` será apagada e substituída
- `framework/` será apagada e substituída
- Arquivos `agents/framework-*` serão substituídos

(Os caminhos são relativos ao local de instalação do runtime detectado:
global: `./.claude/`, `~/.config/opencode/`, `~/.opencode/`, `~/.gemini/`, ou `~/.codex/`
local: `./.claude/`, `./.config/opencode/`, `./.opencode/`, `./.gemini/`, ou `./.codex/`)

Seus arquivos personalizados em outros locais são preservados:
- Comandos personalizados não em `commands/` ✓
- Agentes personalizados sem prefixo `framework-` ✓
- Hooks personalizados ✓
- Seus arquivos CLAUDE.md ✓

Se você modificou algum arquivo framework diretamente, eles serão automaticamente salvos em `local-patches/` e podem ser reaplicados com `/reaplicar-patches` após a atualização.
```

Use AskUserQuestion:
- Pergunta: "Prosseguir com a atualização?"
- Opções:
  - "Sim, atualizar agora"
  - "Não, cancelar"

**Se o usuário cancelar:** Encerre.
</step>

<step name="run_update">
Execute a atualização usando o tipo de instalação detectado no passo 1:

Construa o flag de runtime do passo 1:
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
```

**Se instalação LOCAL:**
```bash
npx -y framework-cc@latest "$RUNTIME_FLAG" --local
```

**Se instalação GLOBAL:**
```bash
npx -y framework-cc@latest "$RUNTIME_FLAG" --global
```

**Se instalação UNKNOWN:**
```bash
npx -y framework-cc@latest --claude --global
```

Capture a saída. Se a instalação falhar, mostre o erro e encerre.

Limpe o cache de atualização para que o indicador de statusline desapareça:

```bash
# Clear update cache across all runtime directories
for dir in .claude .config/opencode .opencode .gemini .codex; do
  rm -f "./$dir/cache/update-check.json"
  rm -f "$HOME/$dir/cache/update-check.json"
done
```

O hook SessionStart (`check-update.js`) escreve no diretório de cache do runtime detectado, portanto todos os caminhos devem ser limpos para evitar indicadores de atualização obsoletos.
</step>

<step name="display_result">
Formate a mensagem de conclusão (o changelog já foi exibido no passo de confirmação):

```
╔═══════════════════════════════════════════════════════════╗
║  framework Atualizado: v1.5.10 → v1.5.15                        ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Reinicie seu runtime para carregar os novos comandos.

[Ver changelog completo](https://github.com/build/framework/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
Após a conclusão da atualização, verifique se o instalador detectou e fez backup de arquivos modificados localmente:

Verifique local-patches/backup-meta.json no diretório de config.

**Se patches encontrados:**

```
Patches locais foram salvos antes da atualização.
Execute /reaplicar-patches para mesclar suas modificações na nova versão.
```

**Se nenhum patch:** Continue normalmente.
</step>
</process>

<success_criteria>
- [ ] Versão instalada lida corretamente
- [ ] Versão mais recente verificada via npm
- [ ] Atualização pulada se já estiver atualizado
- [ ] Changelog buscado e exibido ANTES da atualização
- [ ] Aviso de instalação limpa mostrado
- [ ] Confirmação do usuário obtida
- [ ] Atualização executada com sucesso
- [ ] Lembrete de reinicialização exibido
</success_criteria>

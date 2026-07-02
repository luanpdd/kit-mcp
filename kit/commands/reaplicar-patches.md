---
name: reaplicar-patches
description: Reaplicar modificações locais após uma atualização do framework
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Após uma atualização do framework limpar e reinstalar arquivos, este comando mescla as modificações locais salvas anteriormente pelo usuário de volta para a nova versão. Usa comparação inteligente para tratar casos onde o arquivo upstream também foi alterado.
</purpose>

<process>

## Passo 1: Detectar patches com backup

Verificar diretório de patches locais:

```bash
# Instalação global — detectar diretório de config do runtime
if [ -d "$HOME/.config/opencode/local-patches" ]; then
  PATCHES_DIR="$HOME/.config/opencode/local-patches"
elif [ -d "$HOME/.opencode/local-patches" ]; then
  PATCHES_DIR="$HOME/.opencode/local-patches"
elif [ -d "$HOME/.gemini/local-patches" ]; then
  PATCHES_DIR="$HOME/.gemini/local-patches"
else
  PATCHES_DIR="./.claude/local-patches"
fi
# Fallback para instalação local — verificar todos os diretórios de runtime
if [ ! -d "$PATCHES_DIR" ]; then
  for dir in .config/opencode .opencode .gemini .claude; do
    if [ -d "./$dir/local-patches" ]; then
      PATCHES_DIR="./$dir/local-patches"
      break
    fi
  done
fi
```

Ler `backup-meta.json` do diretório de patches.

**Se nenhum patch encontrado:**
```
Nenhum patch local encontrado. Nada a reaplicar.

Patches locais são salvos automaticamente quando você executa /atualizar
após modificar qualquer workflow, comando ou arquivo de agente do framework.
```
Sair.

## Passo 2: Mostrar resumo de patches

```
## Patches Locais para Reaplicar

**Backup de:** v{from_version}
**Versão atual:** {ler arquivo VERSION}
**Arquivos modificados:** {contagem}

| # | Arquivo | Status |
|---|---------|--------|
| 1 | {file_path} | Pendente |
| 2 | {file_path} | Pendente |
```

## Passo 3: Mesclar cada arquivo

Para cada arquivo em `backup-meta.json`:

1. **Ler a versão com backup** (cópia modificada pelo usuário de `local-patches/`)
2. **Ler a versão recém-instalada** (arquivo atual após atualização)
3. **Comparar e mesclar:**

   - Se o novo arquivo for idêntico ao arquivo com backup: pular (modificação foi incorporada upstream)
   - Se o novo arquivo diferir: identificar as modificações do usuário e aplicá-las à nova versão

   **Estratégia de mesclagem:**
   - Ler ambas as versões completamente
   - Identificar seções que o usuário adicionou ou modificou (procurar por adições, não apenas diferenças de substituição de caminho)
   - Aplicar adições/modificações do usuário à nova versão
   - Se uma seção que o usuário modificou também foi alterada upstream: sinalizar como conflito, mostrar ambas as versões, perguntar ao usuário qual manter

4. **Escrever resultado mesclado** no local instalado
5. **Reportar status:**
   - `Mesclado` — modificações do usuário aplicadas corretamente
   - `Pulado` — modificação já está upstream
   - `Conflito` — usuário escolheu resolução

## Passo 4: Atualizar manifesto

Após reaplicar, regenerar o manifesto de arquivo para que futuras atualizações detectem corretamente estes como modificações do usuário:

```bash
# O manifesto será regenerado no próximo /atualizar
# Por agora, apenas registrar quais arquivos foram modificados
```

## Passo 5: Opção de limpeza

Perguntar ao usuário:
- "Manter backups de patch para referência?" → preservar `local-patches/`
- "Limpar backups de patch?" → remover diretório `local-patches/`

## Passo 6: Relatório

```
## Patches Reaplicados

| # | Arquivo | Status |
|---|---------|--------|
| 1 | {file_path} | ✓ Mesclado |
| 2 | {file_path} | ○ Pulado (já está upstream) |
| 3 | {file_path} | ⚠ Conflito resolvido |

{contagem} arquivo(s) atualizado(s). Suas modificações locais estão ativas novamente.
```

</process>

<success_criteria>
- [ ] Todos os patches com backup processados
- [ ] Modificações do usuário mescladas na nova versão
- [ ] Conflitos resolvidos com entrada do usuário
- [ ] Status reportado para cada arquivo
</success_criteria>

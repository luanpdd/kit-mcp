---
name: atualizar
description: Atualiza o framework para a versão mais recente com exibição de changelog
allowed-tools:
  - Bash
  - AskUserQuestion
---

<objective>
Verifica atualizações do framework, instala se disponível e exibe o que mudou.

Roteia para o workflow update que trata:
- Detecção de versão (instalação local vs global)
- Verificação de versão no npm
- Busca e exibição do changelog
- Confirmação do usuário com aviso de instalação limpa
- Execução da atualização e limpeza de cache
- Lembrete de reinicialização
</objective>

<execution_context>
@./.claude/framework/workflows/update.md
</execution_context>

<process>
**Seguir o workflow update** de `@./.claude/framework/workflows/update.md`.

O workflow trata toda a lógica incluindo:
1. Detecção de versão instalada (local/global)
2. Verificação da versão mais recente via npm
3. Comparação de versões
4. Busca e extração do changelog
5. Exibição do aviso de instalação limpa
6. Confirmação do usuário
7. Execução da atualização
8. Limpeza de cache
</process>

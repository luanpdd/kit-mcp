---
name: fio
description: Gerencia threads de contexto persistentes para trabalho entre sessões
argument-hint: [nome | descrição]
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Criar, listar ou retomar threads de contexto persistentes. Threads são armazenamentos leves
de conhecimento entre sessões para trabalho que abrange múltiplas sessões mas
não pertence a nenhuma fase específica.
</objective>

<process>

**Analisar $ARGUMENTS para determinar o modo:**

<mode_list>
**Se sem argumentos ou $ARGUMENTS estiver vazio:**

Listar todos os threads:
```bash
ls .planning/threads/*.md 2>/dev/null
```

Para cada thread, ler as primeiras linhas para mostrar título e status:
```
## Threads Ativos

| Thread | Status | Última Atualização |
|--------|--------|--------------------|
| fix-deploy-key-auth | ABERTO | 2026-03-15 |
| pasta-tcp-timeout | RESOLVIDO | 2026-03-12 |
| perf-investigation | EM ANDAMENTO | 2026-03-17 |
```

Se não existirem threads, mostrar:
```
Nenhum thread encontrado. Crie um com: /fio <descrição>
```
</mode_list>

<mode_resume>
**Se $ARGUMENTS corresponder a um nome de thread existente (arquivo existe):**

Retomar o thread — carregar seu contexto na sessão atual:
```bash
cat ".planning/threads/${THREAD_NAME}.md"
```

Exibir o conteúdo do thread e perguntar ao usuário o que deseja trabalhar a seguir.
Atualizar o status do thread para `IN PROGRESS` se estava `OPEN`.
</mode_resume>

<mode_create>
**Se $ARGUMENTS for uma nova descrição (nenhum arquivo de thread correspondente):**

Criar um novo thread:

1. Gerar slug a partir da descrição:
   ```bash
   SLUG=$(node "./.claude/framework/bin/tools.cjs" generate-slug "$ARGUMENTS")
   ```

2. Criar o diretório de threads se necessário:
   ```bash
   mkdir -p .planning/threads
   ```

3. Escrever o arquivo do thread:
   ```bash
   cat > ".planning/threads/${SLUG}.md" << 'EOF'
   # Thread: {descrição}

   ## Status: OPEN

   ## Objetivo

   {descrição}

   ## Contexto

   *Criado a partir de conversa em {data de hoje}.*

   ## Referências

   - *(adicionar links, caminhos de arquivo ou números de issue)*

   ## Próximos Passos

   - *(o que a próxima sessão deve fazer primeiro)*
   EOF
   ```

4. Se houver contexto relevante na conversa atual (trechos de código,
   mensagens de erro, resultados de investigação), extrair e adicionar à seção Contexto.

5. Commitar:
   ```bash
   node "./.claude/framework/bin/tools.cjs" commit "docs: criar thread — ${ARGUMENTS}" --files ".planning/threads/${SLUG}.md"
   ```

6. Reportar:
   ```
   ## Thread Criado

   Thread: {slug}
   Arquivo: .planning/threads/{slug}.md

   Retome a qualquer momento com: /fio {slug}
   ```
</mode_create>

</process>

<notes>
- Threads NÃO têm escopo de fase — existem independentemente do roadmap
- Mais leve que /pausar-trabalho — sem estado de fase, sem contexto de plano
- O valor está em Contexto e Próximos Passos — uma sessão fria pode começar imediatamente
- Threads podem ser promovidos para fases ou itens de backlog quando amadurecem:
  /adicionar-fase ou /adicionar-backlog com contexto do thread
- Arquivos de thread ficam em .planning/threads/ — sem colisão com fases ou outras estruturas framework
</notes>

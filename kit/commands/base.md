---
name: base
description: Gerencia o registro canônico de projetos (PROJETOS.md) — listar, adicionar, editar ou remover projetos e links, com validação dos campos obrigatórios e bootstrap da regra global.
argument-hint: "[listar | adicionar <nome> | editar <nome> [campo] | remover <nome> | init]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Gerenciar a **configuração base** do projeto — o arquivo `PROJETOS.md` na raiz, registro
canônico exigido pela regra global do kit-mcp (`~/.claude/CLAUDE.md`). É o único ponto de
edição para os links de contexto que conectam projetos entre si: pasta local, repositório,
documentação local (pasta `docs/` ou cofre Obsidian) e repositório da documentação.

Subcomandos:
- **listar** (padrão, sem argumentos): mostra o registro atual com status de completude
  por projeto (✅ completo / ⚠️ incompleto — qual campo falta).
- **adicionar `<nome>`**: registra um novo projeto (o primeiro vira "Projeto principal";
  os demais entram em "Projetos conectados").
- **editar `<nome>` `[campo]`**: altera campos de um projeto existente.
- **remover `<nome>`**: remove um projeto conectado do registro.
- **init**: cria `PROJETOS.md` do template quando ausente E garante que a regra global
  existe em `~/.claude/CLAUDE.md` (cria se faltar).

## Quando usar

- ✅ Novo projeto na máquina — `/base init` para criar o registro
- ✅ Adicionar um projeto conectado (multi-repo, VPS, docs separados) — `/base adicionar`
- ✅ Link de repo/docs mudou — `/base editar`
- ❌ Editar campos à mão sem validação — o comando valida obrigatórios e formatos

O registro também é consumível em runtime pela MCP tool `projects` do kit
(`mcp__kit__projects`): `list` retorna os projetos com status de completude,
`get` busca um projeto pelo nome e `doctor` gera o relatório de validação
(obrigatórios, existência das pastas locais, shape das URLs) — útil quando
agents precisam resolver contexto de projetos conectados sem parsear o markdown.
</objective>

<schema>
Campos por projeto (regra de integridade — TODO projeto registrado, principal ou
conectado, DEVE ter os obrigatórios preenchidos; registro incompleto = ⚠️):

| Campo | Obrigatório | Validação |
|---|---|---|
| Pasta local do projeto | ✅ | Caminho absoluto; deve existir no disco |
| Repositório do projeto | ✅ | URL http(s) da página do repositório |
| Documentação local | ✅ | Caminho de pasta docs/ ou cofre Obsidian; deve existir |
| Repositório da documentação | ⬜ | URL http(s) ou "—" |
| Infra / VPS | ⬜ | Texto livre ou "—" |
| Notas | ⬜ | Texto livre ou "—" |
</schema>

<context>
$ARGUMENTS
</context>

<process>

## 1. Localizar o registro

Ler `PROJETOS.md` na raiz do projeto atual. Se não existir e o subcomando não for
`init`, avisar e oferecer rodar o fluxo de `init` primeiro.

## 2. Despachar por subcomando

### listar (padrão)

Parsear cada projeto (seções `## Projeto principal:` e `### <nome>` sob
`## Projetos conectados`). Para cada um, exibir tabela com os 6 campos e o status:
- ✅ completo — todos os obrigatórios preenchidos e válidos
- ⚠️ incompleto — listar exatamente quais campos obrigatórios faltam ou falharam validação

Validar de fato: caminhos com `test -d` (Bash), URLs pelo formato `https?://`.

### adicionar <nome>

1. **Nunca inventar valores.** Perguntar ao usuário (AskUserQuestion ou conversa) os
   campos obrigatórios que não forem verificáveis automaticamente.
2. Auto-preencher SOMENTE o que for verificável — e confirmar com o usuário:
   - `Repositório` — do `package.json` (`repository.url`) da pasta informada, se houver
   - `Documentação local` — pasta `docs/` existente dentro da pasta informada
3. Validar todos os campos (schema acima) antes de gravar.
4. Se `PROJETOS.md` não tem projeto principal, gravar como principal; senão, adicionar
   em `## Projetos conectados` seguindo o template. Opcionais vazios viram "—".

### editar <nome> [campo]

1. Localizar a seção do projeto. Se `campo` foi passado, editar só ele; senão, mostrar
   os 6 campos atuais e perguntar quais alterar.
2. Validar o novo valor pelo schema antes de aplicar (Edit cirúrgico na linha do campo).

### remover <nome>

1. Se for o **projeto principal**, avisar que remover o principal invalida o registro —
   exigir confirmação explícita e sugerir promover um conectado a principal.
2. Remover a seção inteira do projeto e confirmar com diff resumido.

### init

1. Se `PROJETOS.md` já existe, informar e cair no fluxo `listar`.
2. Coletar os campos obrigatórios do projeto principal (mesmas regras do `adicionar`).
3. Gravar `PROJETOS.md` a partir do template:

```markdown
# Registro de Projetos

> Registro canônico exigido pela regra global do kit-mcp.
> Campos marcados com (obrigatório) não podem ficar vazios.

## Projeto principal: <nome>

- **Pasta local do projeto** (obrigatório): `<caminho absoluto>`
- **Repositório do projeto** (obrigatório): <URL>
- **Documentação local** (obrigatório): `<pasta docs/ ou cofre Obsidian>`
- **Repositório da documentação** (opcional): <URL ou "—">
- **Infra / VPS** (opcional): <hosts ou "—">
- **Notas** (opcional): <texto ou "—">

## Projetos conectados

<!-- Cada projeto adicional DEVE preencher todos os campos obrigatórios. -->
```

4. Verificar `~/.claude/CLAUDE.md` (global): se a seção
   `## REGRA OBRIGATÓRIA: Registro de Projetos (kit-mcp)` não existir, oferecer criá-la
   (regra que exige PROJETOS.md em todo projeto, schema e template — sem sobrescrever
   conteúdo existente do arquivo; apenas append da seção).

## 3. Confirmação

Toda mutação termina com uma linha de confirmação + o status de completude do registro
(mesma saída do `listar`), para o usuário ver imediatamente se algo ficou pendente.

</process>

<success_criteria>
- [ ] $ARGUMENTS parseado (listar default, adicionar/editar/remover/init com nome)
- [ ] Nunca inventa valores — pergunta ao usuário; auto-preenche só o verificável e confirma
- [ ] Valida obrigatórios (pasta existe, URL http(s)) antes de qualquer gravação
- [ ] Projeto principal protegido contra remoção acidental (confirmação explícita)
- [ ] `init` cria PROJETOS.md do template e garante a regra global em ~/.claude/CLAUDE.md
- [ ] Toda mutação termina com status de completude (✅/⚠️ por projeto)
</success_criteria>

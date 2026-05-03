---
name: sync-main
description: Atualiza a branch local com os commits da main. Se houver conflitos, pergunta qual priorizar.
allowed-tools:
  - Bash
---

<safety_rules>
NUNCA execute git push para main ou origin/main.
NUNCA mude para a branch main (git checkout main / git switch main).
Este comando só traz código da main para a branch local — nunca o contrário.
</safety_rules>

<process>

## 1 — Proteção: bloquear se estiver na main

```bash
git branch --show-current
```

Se a branch atual for `main`, encerre com:
> "⛔ Você está na branch main. Mude para uma branch de feature antes de continuar."

## 2 — Buscar atualizações e verificar se há algo novo

```bash
git fetch origin
git log --oneline origin/main ^HEAD
```

Se não houver nenhum commit novo em `origin/main`, informe:
> "Sua branch já está atualizada com a main."
E encerre.

## 3 — Aplicar os commits da main na branch local

```bash
git merge origin/main
```

### Se não houver conflitos:
Mostre um resumo com:
- Quantos commits foram integrados
- Lista dos arquivos modificados (`git diff --name-only HEAD~1 HEAD` ou similar)

Encerre.

### Se houver conflitos:

Liste os arquivos conflitantes e pergunte:
> "Encontrei conflitos nos arquivos abaixo. Qual é a prioridade?
> [1] main — usa o código da main nos conflitos
> [2] local — mantém o seu código nos conflitos"

Aguarde a resposta.

**Se [1] main:**
Para cada arquivo conflitante: `git checkout --theirs <arquivo>`
Depois: `git add . && git commit`

**Se [2] local:**
Para cada arquivo conflitante: `git checkout --ours <arquivo>`
Depois: `git add . && git commit`

Mostre o resumo final: branch atual, status limpo, commits integrados.

</process>

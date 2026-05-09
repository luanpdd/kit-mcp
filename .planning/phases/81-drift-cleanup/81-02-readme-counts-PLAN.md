---
phase: 81-drift-cleanup
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements:
  - DRIFT-13-02

must_haves:
  truths:
    - "README.md tem '47 agents' onde antes tinha '19 agents' (5 ocorrências corrigidas)"
    - "README.md tem '87 commands' / '87 slash-commands' onde antes tinha '60 commands' / '60 slash-commands'"
    - "README.md tem '49 skills' onde antes tinha '1 skill (example only)' na linha 244"
    - "README.md tem '20 gates' onde antes tinha '5 gates' na linha 632"
    - "Linha 62 do README atualizada de '60+ slash-commands, 24+ agents' para '87+ slash-commands, 47+ agents'"
    - "grep -c sobre os contadores velhos no README retorna 0"
  artifacts:
    - path: "README.md"
      provides: "Contadores hardcoded refletindo estado real do kit (47/87/49/20)"
      contains: "47 agents, 87 commands, 49 skills, 20 gates"
  key_links: []
---

<objective>
Substituir contadores hardcoded em 9+ ocorrências do README.md (drift +147% / +45% / +4800% / +300%) pelos valores reais do filesystem (47 agents, 87 commands, 49 skills, 20 gates). Esse plan fecha DRIFT-13-02.

Purpose: README é a primeira impressão de quem chega via npm/GitHub. Contadores errados degradam confiança (especialmente "1 skill" quando há 49 — sugere projeto morto/incipiente). Substituição estática é decisão CONTEXT.md ("abordagem 1") — auto-gen via script é v1.14.

Output: README.md com todos os contadores refletindo estado real, drift documentado em SUMMARY como item recorrente para v1.14 automatizar.

Risco conhecido: vai driftar de novo no próximo release que adicionar/remover artefato. SUMMARY explicita esse fato + ticket v1.14 para auto-gen com bloco `<!-- AUTOGEN-COUNTS-START -->`.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/81-drift-cleanup/81-CONTEXT.md
@README.md

<interfaces>
## Contagens reais (filesystem source-of-truth)

Confirmadas via `ls kit/agents/ | wc -l` etc:
- **47 agents** (kit/agents/*.md, era 19)
- **87 commands** (kit/commands/*.md, era 60)
- **49 skills** (kit/skills/*/, era 1)
- **20 gates** (gates/*.md, era 5)
- **8 IDEs** (não muda — mantém)

## Ocorrências hardcoded a corrigir (grep result)

Localizações exatas (linha → conteúdo a substituir):

| Linha | Conteúdo atual | Conteúdo novo |
|-------|----------------|---------------|
| 31 | `│   ├── agents/                 19 agents (planner, executor, verifier, debugger,` | `│   ├── agents/                 47 agents (planner, executor, verifier, debugger,` |
| 33 | `│   ├── commands/               60 slash-commands (/novo-marco, /planejar-fase,` | `│   ├── commands/               87 slash-commands (/novo-marco, /planejar-fase,` |
| 62 | `gives you all 60+ slash-commands, 24+ agents, plus the framework templates that they delegate into.` | `gives you all 87+ slash-commands, 47+ agents, plus the framework templates that they delegate into.` |
| 178 | `npx -y @luanpdd/kit-mcp kit list-agents     # 19 agents` | `npx -y @luanpdd/kit-mcp kit list-agents     # 47 agents` |
| 179 | `npx -y @luanpdd/kit-mcp kit list-commands   # 60 commands` | `npx -y @luanpdd/kit-mcp kit list-commands   # 87 commands` |
| 242 | `kit kit list-agents               # 19 agents (bundled workflow)` | `kit kit list-agents               # 47 agents (bundled workflow)` |
| 243 | `kit kit list-commands             # 60 commands (bundled workflow)` | `kit kit list-commands             # 87 commands (bundled workflow)` |
| 244 | `kit kit list-skills               # 1 skill (example only — bring your own)` | `kit kit list-skills               # 49 skills (bundled workflow)` |
| 630 | `node bin/cli.js kit list-agents | head -5         # 19 bundled agents` | `node bin/cli.js kit list-agents | head -5         # 47 bundled agents` |
| 632 | `node bin/cli.js gates list                        # 5 gates` | `node bin/cli.js gates list                        # 20 gates` |

Total: **10 substituições** em 1 arquivo.

## NÃO TOCAR

- Linha 5 sobre "60 commands" SE ela existir como exemplo numérico genérico (não foi encontrada — toda referência atual a "60 commands" está nos contextos acima).
- Linha 295 sobre "8 IDEs" — preservar (8 IDEs é correto, listado nas tabelas).
- Linhas 70-90 sobre "11 skills" da Suíte Observabilidade (v1.9) — esses são contadores de SUITE, não totais. Idem "6 skills SRE" da v1.10. Esses contadores são corretos e específicos por suíte.
- Caminhos numéricos em URLs (ex: `127.0.0.1:7100`) — irrelevantes.
- Códigos de exemplo (ex: `await fs.access(...)`) — irrelevantes.

## Linhas que podem CAUSAR FALSO POSITIVO em greps

Cuidado ao validar com `grep "60"`:
- linha 390 sobre `127.0.0.1:7100` — porta, não count
- linha 24 sobre "Inspired by [vinilana/dotcontext]" — sem números relevantes

Validação correta usa o regex específico do `done` abaixo.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Substituir 10 contadores hardcoded em README.md</name>
  <files>README.md</files>
  <action>
Editar README.md fazendo as 10 substituições EXATAMENTE conforme tabela em `<interfaces>`. Use a ferramenta Edit (uma chamada por substituição, ou múltiplas chamadas em paralelo se old_string for único).

**Substituições a fazer (use Edit tool com old_string completo + new_string completo):**

1. Linha 31:
   - old: `│   ├── agents/                 19 agents (planner, executor, verifier, debugger,`
   - new: `│   ├── agents/                 47 agents (planner, executor, verifier, debugger,`

2. Linha 33:
   - old: `│   ├── commands/               60 slash-commands (/novo-marco, /planejar-fase,`
   - new: `│   ├── commands/               87 slash-commands (/novo-marco, /planejar-fase,`

3. Linha 62:
   - old: `gives you all 60+ slash-commands, 24+ agents, plus the framework templates that they delegate into.`
   - new: `gives you all 87+ slash-commands, 47+ agents, plus the framework templates that they delegate into.`

4. Linha 178:
   - old: `npx -y @luanpdd/kit-mcp kit list-agents     # 19 agents`
   - new: `npx -y @luanpdd/kit-mcp kit list-agents     # 47 agents`

5. Linha 179:
   - old: `npx -y @luanpdd/kit-mcp kit list-commands   # 60 commands`
   - new: `npx -y @luanpdd/kit-mcp kit list-commands   # 87 commands`

6. Linha 242:
   - old: `kit kit list-agents               # 19 agents (bundled workflow)`
   - new: `kit kit list-agents               # 47 agents (bundled workflow)`

7. Linha 243:
   - old: `kit kit list-commands             # 60 commands (bundled workflow)`
   - new: `kit kit list-commands             # 87 commands (bundled workflow)`

8. Linha 244:
   - old: `kit kit list-skills               # 1 skill (example only — bring your own)`
   - new: `kit kit list-skills               # 49 skills (bundled workflow)`

9. Linha 630:
   - old: `node bin/cli.js kit list-agents | head -5         # 19 bundled agents`
   - new: `node bin/cli.js kit list-agents | head -5         # 47 bundled agents`

10. Linha 632:
    - old: `node bin/cli.js gates list                        # 5 gates`
    - new: `node bin/cli.js gates list                        # 20 gates`

**Notas operacionais:**
- TODAS as 10 substituições preservam exatamente o whitespace circundante (espaços, alinhamento de comentário `#`).
- Cada `old_string` é único no arquivo — Edit tool aceita-os sem precisar de mais contexto.
- POR QUÊ Edit (não Write): preserva 33 KB de README byte-a-byte fora dessas 10 linhas.
- POR QUÊ não tocar "11 skills" (linha 70) ou "6 skills" (linha 108): esses são contadores POR SUÍTE (Observabilidade v1.9 = 11 skills; SRE v1.10 = 6 skills) — corretos e estáveis. Drift está nos contadores TOTAIS do kit, não nos contadores por-suíte.
- POR QUÊ "(bundled workflow)" no skills (item 8) em vez de "(example only — bring your own)": frase original sugeria que só havia 1 skill exemplo. Realidade: kit ships 49 skills foundationais. Mantém paridade com agents/commands ("bundled workflow").
  </action>
  <verify>
    <automated>node -e "const md = require('node:fs').readFileSync('README.md','utf8'); const oldPatterns = [/19 agents/,/60 commands/,/60 slash-commands/,/24\+ agents/,/60\+ slash-commands/,/1 skill \\(example only/,/5 gates/]; const found = oldPatterns.filter(p => p.test(md)); if (found.length) { console.error('STILL PRESENT:', found.map(p => p.source)); process.exit(1); } const newPatterns = [/47 agents/,/87 commands/,/87 slash-commands/,/47\+ agents/,/87\+ slash-commands/,/49 skills/,/20 gates/]; const missing = newPatterns.filter(p => !p.test(md)); if (missing.length) { console.error('NEW MISSING:', missing.map(p => p.source)); process.exit(1); } console.log('OK: all counters updated');"</automated>
  </verify>
  <done>
- README.md `grep -cE "19 agents|60 commands|60 slash-commands|24\+ agents|60\+ slash-commands|1 skill \(example only|5 gates"` retorna 0 (todos os contadores antigos sumiram)
- README.md `grep -cE "47 agents|87 commands|87 slash-commands|47\+ agents|87\+ slash-commands|49 skills|20 gates"` retorna ≥ 7 (todos os novos presentes)
- Contagens "11 skills" / "6 skills" da Suíte Obs v1.9 / SRE v1.10 PRESERVADAS (são contadores por-suíte corretos)
- Contagem "8 IDEs" PRESERVADA
- Resto do README (33 KB) byte-idêntico fora das 10 linhas alteradas
- Comando do automated verify retorna `OK: all counters updated` exit 0
  </done>
</task>

<task type="auto">
  <name>Tarefa 2: Documentar drift recorrente como ticket v1.14 no SUMMARY</name>
  <files>(documentação no SUMMARY pós-execução; sem mudança de código)</files>
  <action>
**Pure documentation task** — sem código. Quando o executor escrever o `81-02-readme-counts-SUMMARY.md` (output trailing), incluir explicitamente uma seção `## Drift recorrente (deferido a v1.14)` com:

- **Problema:** Substituição estática vai driftar novamente no próximo release que adicionar/remover artefato em `kit/agents/`, `kit/commands/`, `kit/skills/`, ou `gates/`.
- **Solução proposta v1.14 (auto-gen):**
  - Adicionar bloco `<!-- AUTOGEN-COUNTS-START --> ... <!-- AUTOGEN-COUNTS-END -->` em README.md envelopando todas as ocorrências de contadores.
  - Criar `scripts/update-readme-counts.js` que lê `kit/agents/*.md | wc -l` (etc.) e regex-replaces o bloco.
  - Chamar via `prepublishOnly` em `package.json` (já existe — só adicionar `&& node scripts/update-readme-counts.js`).
  - Validation: gate em CI confere que counts hardcoded no README batem com filesystem.
- **Estimated effort:** 2-3 hours (1 plan onda 1).
- **Trigger:** próximo milestone v1.14 deve incluir REQ explícito tipo `DRIFT-14-01: README counts auto-gen`.

**Notas operacionais:**
- Esta task NÃO toca arquivos. É instrução para o executor incluir essa seção no SUMMARY ao final do plan.
- O executor já vai criar `81-02-readme-counts-SUMMARY.md` por padrão; este action garante que a seção "Drift recorrente" existe nele.
- POR QUÊ não criar ticket via /adicionar-backlog agora: backlog é gerenciado pelo user via `/revisar-backlog` antes do próximo milestone. SUMMARY é o canal correto para "este drift vai voltar — endereçar em v1.14".
  </action>
  <verify>
    <automated>test -f .planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md && grep -q "Drift recorrente" .planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md && grep -q "v1.14" .planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md && echo "OK"</automated>
  </verify>
  <done>
- `.planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md` existe (gerado pelo executor ao final do plan)
- SUMMARY contém seção `## Drift recorrente (deferido a v1.14)` ou similar
- SUMMARY menciona explicitamente: (a) o problema vai recorrer, (b) auto-gen via bloco AUTOGEN-COUNTS é a solução, (c) prepublishOnly hook é o gancho correto, (d) estimated 2-3h em v1.14
- Verify command retorna `OK` exit 0
  </done>
</task>

</tasks>

<verification>
- `grep -cE "19 agents|60 commands|24\+ agents|1 skill \(example only|5 gates" README.md` retorna 0
- `grep -cE "47 agents|87 commands|49 skills|20 gates" README.md` retorna ≥ 4
- `npm test` continua exit 0 (nenhum test mudou — README é doc puro)
- README.md tamanho total varia em < 200 bytes (apenas alterações de count)
</verification>

<success_criteria>
- 10 contadores hardcoded substituídos com valores corretos do filesystem
- Zero contadores antigos remanescentes em README
- Contadores de suítes específicas (11 skills v1.9, 6 skills v1.10) preservados — não eram drift
- "8 IDEs" preservado — não era drift
- Drift recorrente documentado em SUMMARY com plano explícito para v1.14 (auto-gen)
- Suite de testes baseline (137 unit + 71 integration) inalterada — README é doc, não código
</success_criteria>

<output>
After completion, create `.planning/phases/81-drift-cleanup/81-02-readme-counts-SUMMARY.md`
</output>

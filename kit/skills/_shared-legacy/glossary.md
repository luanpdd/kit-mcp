# Glossário Legacy Code — Termos, Técnicas e Patterns Canônicos

> Arquivo de referência compartilhado pelas skills `legacy-*` e `pre-refactor-characterization`. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas skills via Markdown link relativo.

> **Material-fonte:** *Working Effectively with Legacy Code* — Michael C. Feathers (Prentice Hall / Robert C. Martin Series, 2004). ISBN 978-0-13-117705-5.

---

## (a) Termos PT-BR ↔ EN

### Definições fundacionais

> Vocabulário do prefácio + cap 1 (Changing Software). A definição de Feathers é deliberadamente operacional, não emocional — "legacy code" não significa "código antigo" ou "código feio", significa **código sem testes**. Essa redefinição muda completamente a estratégia: o problema é falta de cobertura comportamental, não estética.

| EN | PT-BR / Significado |
|---|---|
| **legacy code** | Código legado — para Feathers: **código sem testes**, independente de idade ou qualidade. Sem testes, qualquer mudança é "edit and pray" — você modifica e reza. |
| **edit and pray** | Editar e rezar — o modo default em legacy code. Você muda, lê o diff, deploya, espera. Confiança vem de inspeção visual + sorte. |
| **cover and modify** | Cobrir e modificar — o modo desejado. Primeiro adicione cobertura (tests), depois modifique. Confiança vem do safety net. |
| **change point** | Ponto de mudança — local específico onde a alteração será feita. Tipicamente uma linha, método ou bloco. |
| **inflection point** | Ponto de inflexão — junção estreita por onde os efeitos da mudança fluem. Testar aqui cobre múltiplos change points downstream. |
| **pinch point** | Funil estreito (sinônimo de inflection point usado em cap 11) — interface natural na qual concentrar testes. |
| **safety net** | Rede de segurança — suite de testes que detecta regressão imediatamente após edição. Cap 1 é todo sobre construir isso. |
| **legacy code dilemma** | Dilema do código legado — para mudar com segurança preciso testar; para testar preciso refatorar; para refatorar preciso testar. Quebrado por **dependency-breaking techniques** (cap 25). |

### Seams e Test Harness

> Vocabulário do cap 4 (The Seam Model). Conceito central. Seam = lugar onde você pode alterar comportamento **sem editar naquele lugar**. Sem seams, o código está "fundido" — toda mudança requer modificação direta, sem possibilidade de substituição em teste.

| EN | PT-BR / Significado |
|---|---|
| **seam** | Costura — local onde se pode alterar comportamento sem editar ali. Tipicamente onde existe ponto de extensibilidade que pode ser exercitado por testes. |
| **enabling point** | Ponto habilitador — mecanismo concreto que ativa a substituição naquela costura (subclasse, link table, build flag, parâmetro). |
| **preprocessing seam** | Costura de pré-processamento — substituição via macros/preprocessor (C/C++). Raríssima em runtimes modernos. |
| **link seam** | Costura de link — substituição via linker (DLL/object/jar) ou loader (require/import shim). Útil em código sem orientação a objetos. |
| **object seam** | Costura de objeto — substituição via polimorfismo (interface, classe abstrata, duck typing). A mais comum e poderosa em OO. |
| **test harness** | Arnês de teste — infraestrutura mínima para fazer um pedaço de código rodar isolado em testes. Cap 9-10 inteiro é sobre construir isso. |
| **dependency** | Dependência — qualquer entidade externa que o código sob teste invoca. Bloqueia testes quando incontrolável (DB real, rede, clock, FS). |
| **collaborator** | Colaborador — instância concreta de uma dependência. Ex.: `EmailSender` vs concept "envio de email". |
| **fake** | Fake — implementação substituta de uma dependência que satisfaz a interface mas não faz o trabalho real (ex: `FakeEmailSender` que só salva em lista). |
| **sensing** | Sensoriamento — observar via testes que algo aconteceu (assertion sobre `fake.sentEmails.length`). |
| **separation** | Separação — quebrar a dependência para que o código rode sem o colaborador real. Pré-requisito de sensing. |
| **break dependencies** | Quebrar dependências — aplicar uma das ~24 técnicas do cap 25 para tornar testável o que não era. |

### Characterization Tests

> Vocabulário do cap 13 (Characterization Tests). **A skill foundacional**. Characterization test não verifica se o código está certo — verifica **o que o código atualmente faz**. É um snapshot comportamental que vira oracle imutável durante o refactor.

| EN | PT-BR / Significado |
|---|---|
| **characterization test** | Teste de caracterização — teste que captura o comportamento **atual** do código (não o desejado). Não pergunta "está certo?" — pergunta "o que faz?". |
| **golden master** | Mestre dourado — output capturado de uma execução real, salvo em arquivo, que vira oracle. Subsequentes execuções comparam contra ele (snapshot test). |
| **golden snapshot** | Snapshot dourado — sinônimo de golden master, terminologia mais comum em frameworks modernos (Jest, Vitest, Pytest). |
| **expected behavior trap** | Armadilha do "comportamento esperado" — escrever testes do que o código **deveria** fazer em vez do que **faz**. Resultado: teste falha imediatamente porque o bug atual é o estado atual. Sempre comece pelo atual. |
| **bug preservation** | Preservação de bug — characterization tests preservam bugs existentes. Refactor não muda comportamento, então o bug deve continuar reproduzível. Bug fix é outra mudança, separada. |
| **observation point** | Ponto de observação — saída capturada (return value, side effect, log, DB write). Cada ponto vira uma asserção. |
| **input enumeration** | Enumeração de entradas — cobrir caminhos via grupos de equivalência: input nulo, vazio, válido típico, válido extremo, inválido recoverable, inválido fatal. |
| **behavioral coverage** | Cobertura comportamental — não % de linhas executadas, mas % de **branches** + observation points. Métrica para liberar refactor é cobertura comportamental, não code coverage. |
| **edit-then-characterize** | Editar-então-caracterizar — anti-pattern. Você muda, depois escreve teste do "novo" comportamento. Não há baseline para detectar quebra. |

### Sprout / Wrap Techniques

> Vocabulário do cap 6 (I Don't Have Much Time and I Have to Change It). Quando você não tem tempo para colocar legado em test harness, mas precisa adicionar comportamento novo. Estratégia: adicionar código novo **isolado** e testado, conectado ao legado por chamada mínima.

| EN | PT-BR / Significado |
|---|---|
| **sprout method** | Método broto — extrair a nova lógica para método novo (tipicamente `static` ou injetável), testar isolado, chamar do método legado em 1 linha. |
| **sprout class** | Classe broto — quando o sprout method cresce, externalize para classe nova com test harness próprio. |
| **wrap method** | Método invólucro — renomeie o método legado (`foo` → `fooLegacy`), crie `foo` novo que chama `fooLegacy` + nova lógica. Novo `foo` é testável. |
| **wrap class** | Classe invólucro — análogo ao wrap method em escala de classe. Decorator pattern aplicado pragmaticamente. |
| **boy scout rule (sprout edition)** | Regra do escoteiro (versão sprout) — deixe o código mais limpo do que encontrou ao **adicionar** novo, mesmo sem refatorar o velho. Sprout/wrap concretiza isso. |

### Effect Analysis

> Vocabulário do cap 11 (I Need to Make a Change. What Methods Should I Test?) e cap 12 (I Need to Make Many Changes in One Area). Sem testes, qual é o subset mínimo de coisas a testar para sentir-se seguro? Resposta: rastreie efeitos do change point para fora, encontre inflection points, teste lá.

| EN | PT-BR / Significado |
|---|---|
| **effect sketch** | Esboço de efeitos — diagrama (papel mesmo) com setas do change point para tudo que muda. Variáveis afetadas, retornos, side effects, callbacks. |
| **effect propagation** | Propagação de efeito — como um change ripple através do código. Cap 11 lista 4 vetores: return value, parâmetros mutados, globals, side effects via colaborador. |
| **interception point** | Ponto de interceptação — local onde inserir teste para observar efeitos. Idealmente coincide com inflection point. |
| **effect-narrowing** | Estreitamento de efeito — refatorar para reduzir o número de pontos afetados (encapsular variáveis, eliminar globals). Pré-trabalho para tornar effect sketch menor. |
| **shotgun surgery** | Cirurgia espalhada — anti-pattern (cap 21): mesma mudança espalhada em N lugares; cada incidência é um change point separado. Effect sketch detecta. |

### Monster Methods

> Vocabulário do cap 22 (I Need to Change a Monster Method and I Can't Write Tests for It). Métodos absurdamente longos (> 200 linhas) onde você não consegue nem entender o que faz, muito menos testar. Estratégia: scratch refactoring + single-goal editing + extrair pedacinhos sem mudar comportamento.

| EN | PT-BR / Significado |
|---|---|
| **monster method** | Método monstro — método com várias páginas de código, múltiplos níveis de aninhamento, múltiplas responsabilidades. Heurística: > 100 linhas ou > 5 níveis de indent. |
| **bulleted method** | Método com bullets — variante: linhas longas mas planas (sem nesting). Mais fácil de domar. |
| **snarled method** | Método emaranhado — variante: nesting profundo, condicionais aninhadas, control flow espaguete. Mais difícil. |
| **scratch refactoring** | Refactor de rascunho — quebra estética sem commitar. Use uma branch lixo, refatore para entender, descarte. Conhecimento adquirido vai para a refatoração real. |
| **single-goal editing** | Edição com objetivo único — mudar UMA coisa por vez. Renomear OU extrair OU mover, nunca os 3 juntos. Cada mudança é um diff legível. |
| **safe extraction** | Extração segura — extrair método sem mover lógica entre escopos. Apenas levantar bloco contíguo + capturar variáveis usadas como parâmetros. |
| **method blob** | Blob de método — sinônimo informal de monster method. |

### Dependency-Breaking Techniques

> Vocabulário do cap 25 (Dependency-Breaking Techniques) — o catálogo principal. ~24 técnicas para tornar testável o que não era. Cada técnica tem trade-offs diferentes (segurança, custo, mecanização).

| EN | PT-BR / Significado |
|---|---|
| **subclass and override method** | Subclassificar e sobrescrever método — criar subclasse de teste que substitui método problemático. Funciona em qualquer linguagem com herança virtual. |
| **extract interface** | Extrair interface — criar interface a partir da classe concreta, fazer cliente depender da interface, fornecer fake implementation em teste. |
| **adapt parameter** | Adaptar parâmetro — quando parâmetro tem tipo difícil de criar (ex: `HttpServletRequest`), envolver em interface mais simples e fazer cliente depender dela. |
| **introduce static setter** | Introduzir setter estático — adicionar setter para singleton/global; teste injeta fake; teardown restaura. **Risk: thread safety** — só em ambientes single-threaded de teste. |
| **encapsulate global references** | Encapsular referências globais — substituir acesso direto a variáveis globais por método de instância da classe. Permite override em teste. |
| **expose static method** | Expor método estático — promover método de instância a estático para testar sem instanciar a classe inteira (quando construtor é caro). |
| **break out method object** | Quebrar para method object — extrair método grande para classe com `run()`. Variáveis locais viram fields, fácil de testar. |
| **parameterize constructor** | Parametrizar construtor — passar dependência via construtor (DI manual) em vez de criar dentro. Default constructor mantém retrocompatibilidade. |
| **parameterize method** | Parametrizar método — passar dependência como argumento da chamada. Útil quando dependency só é usada num método específico. |
| **pull up feature** | Subir feature — mover método/field para superclasse para que subclasse de teste possa override. |
| **push down dependency** | Empurrar dependência — mover dependência problemática para subclasse, fazer base abstrata sem ela; teste usa subclasse de teste sem dependência real. |
| **replace function with function pointer** | Substituir função por ponteiro de função — em C, substituir chamada estática por ponteiro que teste pode reapontar. |
| **introduce instance delegator** | Introduzir delegador de instância — método estático vira fino wrapper que chama método de instância injetada. Permite mock. |
| **link substitution** | Substituição de link — providenciar `.so`/`.dll`/`.jar` alternativo em test classpath/library path. |
| **definition completion** | Completar definição (C/C++) — fornecer `.cpp` alternativo no link de teste para sobrescrever função declarada em `.h`. |

---

## (b) Patterns canônicos

### Pattern: Algoritmo de mudança em legacy code (cap 1)

```text
1. Identify change points         (onde mudar)
2. Find test points               (onde testar — idealmente nas inflection points)
3. Break dependencies             (cap 25 — aplicar técnica adequada)
4. Write characterization tests   (cap 13 — congelar comportamento atual)
5. Make changes and refactor      (cover and modify, não edit and pray)
```

**Insight central:** os passos 1-4 são **investimento prévio à mudança**. Quem pula direto ao passo 5 está em "edit and pray" — pode ter sorte 9 vezes em 10 mas a 10ª vez é incident SEV1.

### Pattern: identificar legacy code via critérios

```text
Um arquivo/módulo é "legacy" no sentido Feathers se:

1. Cobertura de testes < 60%? → SIM → legacy
2. Existem branches sem teste algum? → SIM → legacy
3. Mudanças recentes (último mês) não tiveram teste novo correspondente? → SIM → legacy
4. Faz parte de contrato externo (webhook, API pública, integração)? → SIM → legacy MESMO COM testes (porque consumer breakage é pior)
5. Tem mais de 500 linhas em arquivo único? → SIM → legacy candidate (pelo menos suspeito)
6. Tem métodos > 100 linhas? → SIM → monster methods, candidato a cap 22

Heurística agregada: se 2+ critérios = legacy → exigir characterization tests antes de qualquer refactor.
```

### Pattern: decision tree para escolher técnica de quebra de dependência

```text
Posso modificar o código? (acesso write?)
├─ Não → preprocessing seam (C/C++) ou link seam (qualquer linguagem)
└─ Sim →
   ├─ Linguagem tem herança/polimorfismo? (Java, C#, Python, Ruby, TS...)
   │  ├─ Sim → object seam (preferred)
   │  │   ├─ Dependência é classe? → extract interface OU subclass and override
   │  │   ├─ Dependência é singleton/global? → encapsulate global references OU introduce static setter
   │  │   ├─ Dependência é tipo de framework? (HttpServletRequest, Context) → adapt parameter
   │  │   └─ Dependência é construído internamente? → parameterize constructor / parameterize method
   │  └─ Não (C, COBOL, código procedural) → link seam OU function pointer substitution
   └─ Construtor da classe é caro? → expose static method (testar sem instanciar)
```

### Pattern: Sprout decision tree (cap 6)

```text
Tenho que adicionar comportamento a método não testado.

Tenho tempo para colocar o método inteiro sob test harness primeiro?
├─ Sim → técnicas do cap 25 (preferencial)
└─ Não →
   ├─ Comportamento novo é coeso e separável? → SPROUT METHOD
   │   1. Escrever método novo (static ou de classe nova) — testável
   │   2. Chamar do método legado em 1 linha
   │   3. Test do sprout via test harness próprio
   │   4. Método legado permanece untested mas o NOVO comportamento está coberto
   ├─ Comportamento novo é grande (>30 linhas)? → SPROUT CLASS
   │   1. Criar classe nova encapsulando o novo comportamento
   │   2. Construir + chamar a classe do método legado
   │   3. Test class isoladamente
   └─ Preciso modificar pré ou pós-condição do método legado? → WRAP METHOD
       1. Renomear `foo` → `fooLegacy` (apenas mecânico)
       2. Criar novo `foo` que chama `fooLegacy` + adiciona comportamento
       3. Testes do `foo` cobrem composição; `fooLegacy` ainda untested mas chamável
```

### Pattern: characterization tests workflow (cap 13)

```text
1. Escolher input typical                    → rodar código → capturar output
2. Escrever teste assertando output capturado (mesmo se output for um bug)
3. Repetir para 5-10 inputs cobrindo grupos de equivalência:
   - null/vazio
   - válido típico
   - válido extremo (boundaries)
   - inválido recoverable
   - inválido fatal
4. Rodar todos verde → BASELINE estabelecido
5. AGORA refactor pode começar — qualquer test que vire vermelho = regressão real
```

**Anti-pattern:** começar a "consertar" o teste para o output "correto". Isso destrói o oracle. Bug → preserve, fix em commit separado depois do refactor.

### Pattern: 6 níveis de "está testável?" (cap 9-10)

| Nível | Sintoma | Solução |
|---|---|---|
| **L0** | Não consigo construir a classe (construtor irritado, faz I/O, throws) | Cap 9 técnicas — fake constructor parameters, expose static method |
| **L1** | Classe constrói mas método não roda isolado (depende de globals) | Encapsulate global references |
| **L2** | Método roda mas dependências reais (DB, rede, clock) executam | Inject collaborator OR subclass and override |
| **L3** | Dependências stubadas mas effects spread (DB grava, email envia) | Sense via fake (verify-no-side-effect) |
| **L4** | Roda isolado, mas saída não-determinística (random, datetime.now) | Inject clock/random como dependência |
| **L5** | Roda isolado e determinístico mas eu não entendo o que testa | Characterization tests para descobrir |

Meta é L5+. Antes de refatorar, código deve estar em L4 ou melhor.

---

## (c) Anti-patterns canônicos

### ANTI: refactor sem characterization tests

```text
ANTI: "vou refatorar esse método de 200 linhas, depois adiciono testes do
       novo design".

PROBLEMA: você não sabe o que está preservando. O método tem branches que
          você não sabe que existem. Bugs antigos que clientes dependem
          (Hyrum's Law) somem silenciosamente. Resultado típico: incident
          em prod 2 semanas depois quando edge case dispara.

CERTO: characterize first (cap 13), refactor second. Pelo menos 5-10
       inputs cobrindo grupos de equivalência ANTES de mover qualquer
       linha. Se o método é de 200 linhas, esse trabalho leva 1-2 dias.
       Aceite o custo — alternativa é o incident.
```

### ANTI: edit and pray (cap 1)

```text
ANTI: "vou modificar essa linha, rodar smoke test, dar push e ver no
       monitoring".

PROBLEMA: smoke test cobre golden path. Branches raras (1% do tráfego)
          escapam silenciosamente. Bugs em borda manifestam horas/dias
          depois. Forensics fica difícil porque change set tem N edits
          no mesmo PR.

CERTO: cover and modify. Antes de modificar, encontre o seam e adicione
       teste que exercita a branch específica. Se não há seam, primeiro
       adicione um (cap 25). Investimento de 1-4h vs incident de 4-40h.
```

### ANTI: fix bug ANTES do characterization

```text
ANTI: "ah, esse método tem um bug óbvio na linha 42, vou consertar
       enquanto refatoro".

PROBLEMA: characterization test capturou o bug como comportamento
          esperado. Você consertou → teste fica vermelho → você
          "atualiza o teste" → oracle morto → não há baseline mais.

CERTO: 2 commits separados. (1) characterize + refactor preservando
       bug. (2) bug fix com teste novo do comportamento correto. Aplique
       o fix DEPOIS, com seu próprio test antes (TDD agora possível
       porque você tem test harness funcionando).
```

### ANTI: golden master sem revisão humana

```text
ANTI: rodar code → capturar output → commitar como `expected.txt` sem
      ler. "É o que o código produz, deve estar certo".

PROBLEMA: output captura inclui bugs já existentes. Sem revisão, você
          congela bugs como contrato. Se o output incluir PII, secret,
          UUID local — você acabou de commitar dado sensível.

CERTO: ler o output capturado linha por linha antes de salvar. Marcar
       expectativas conhecidas-buggy com comentário inline (`// BUG #123:
       deveria ser X, é Y`). Redact PII/secret/UUID via post-processing
       deterministic (hash, mask). Commit do golden é uma decisão, não
       um copy-paste.
```

### ANTI: monster method "limpado" em 1 PR

```text
ANTI: PR com 800 linhas de diff: extract method × 12, rename × 5, move
      logic × 3, fix off-by-one × 2 — tudo junto.

PROBLEMA: PR não-revisável. Reviewer não consegue separar refactor
          (nullable) de fix (semântico). Se algo quebra, bisect aponta
          para o PR inteiro. CI verde não significa nada — branch
          coverage caiu silenciosa.

CERTO: 1 PR por single-goal edit (cap 22). Sequência típica:
       PR1 — extract method (3 helpers, mecânico, comportamento idêntico)
       PR2 — extract class (mover helpers para nova classe)
       PR3 — invert dependency (constructor injection)
       PR4 — fix bug X (com teste novo, semântico)
       Cada PR ≤ 100 linhas. Cada um é revisável e revertível.
```

### ANTI: substituir testes "falhos" sem investigar

```text
ANTI: characterization test virou vermelho após refactor. "Provavelmente
      o teste estava errado, vou atualizar o expected".

PROBLEMA: você acabou de pintar "Vermelho → verde" em cima de regressão
          real. Comportamento mudou e você passou por cima da rede de
          segurança. Próximo bug em prod vem por essa porta.

CERTO: vermelho de characterization test = regressão até prova ao
       contrário. Investigue: o que no refactor mudou comportamento?
       Reverte aquele pedaço, refatore de outra forma. Só atualize o
       golden APÓS confirmar que o novo comportamento É o desejado e
       documentar no commit (`// behavior change: rounds half-up; was
       half-even`).
```

### ANTI: confiar em coverage % como proxy de safety

```text
ANTI: "linha de coverage está em 85%, posso refatorar tranquilo".

PROBLEMA: coverage % = "linha foi executada", não "comportamento foi
          observado". Teste pode entrar na linha sem assertar. 85%
          line coverage com 10% behavioral coverage é frágil mesmo.

CERTO: behavioral coverage = % de branches × observation points
       cobertos por characterization tests. Pelo menos 70-80% antes de
       refactor pesado. Use mutation testing (stryker, mutmut, pitest)
       para confirmar — survived mutants = pontos cegos não cobertos.
```

---

## (d) Mapa de capítulos do livro

> Capa-índice para localizar qual skill consultar dado um sintoma específico. Skills cobrem capítulos do livro Feathers.

| Capítulo | Tema | Skill no kit |
|---|---|---|
| Cap 1 | Changing Software (edit and pray vs cover and modify) | `legacy-characterization-tests` (intro) |
| Cap 2 | Working with Feedback | `legacy-characterization-tests` (rationale) |
| Cap 3 | Sensing and Separation | `legacy-seams-and-test-harness` |
| Cap 4 | The Seam Model | `legacy-seams-and-test-harness` (foundation) |
| Cap 5 | Tools | (tooling — não é skill, mencionado em refs) |
| Cap 6 | I Don't Have Much Time and I Have to Change It | `legacy-sprout-wrap-techniques` |
| Cap 7-8 | It Takes Forever / How Do I Add a Feature | (gerais — disseminados em skills) |
| Cap 9-10 | I Can't Get This Class/Method into a Test Harness | `legacy-seams-and-test-harness` |
| Cap 11 | What Methods Should I Test? | `legacy-effect-analysis` |
| Cap 12 | Many Changes in One Area | `legacy-effect-analysis` |
| Cap 13 | What Tests to Write — **Characterization Tests** | `legacy-characterization-tests` ⭐ |
| Cap 14-15 | Libraries / API Calls | (caso especial — refs em sprout-wrap) |
| Cap 16 | I Don't Understand the Code | `legacy-effect-analysis` (sketches) |
| Cap 17 | Application Has No Structure | (refactor de larga escala — fora de scope) |
| Cap 18-21 | Test code in the way / Procedural / Big classes / Shotgun | (referências) |
| Cap 22 | Monster Method | `legacy-monster-methods` |
| Cap 23 | How Do I Know I'm Not Breaking Anything | `legacy-characterization-tests` |
| Cap 24 | Overwhelmed | (cultural — refs em commands) |
| Cap 25 | **Dependency-Breaking Techniques** (catálogo) | `legacy-seams-and-test-harness` |

---

## (e) Cross-references

- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — cap 13 + 23, foundational
- [`legacy-seams-and-test-harness`](../legacy-seams-and-test-harness/SKILL.md) — cap 3-4 + 9-10 + 25
- [`legacy-sprout-wrap-techniques`](../legacy-sprout-wrap-techniques/SKILL.md) — cap 6
- [`legacy-effect-analysis`](../legacy-effect-analysis/SKILL.md) — cap 11-12 + 16
- [`legacy-monster-methods`](../legacy-monster-methods/SKILL.md) — cap 22
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — auto-trigger gate (workflow integration)

### Cross-suite

- [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — characterization tests defendem SLO durante refactor; behavioral diff = budget burn
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 5 (Change Management) consume characterization status
- [`blameless-postmortems`](../blameless-postmortems/SKILL.md) (v1.10) — postmortems pós-refactor sem characterization viram lesson learned canônica
- [`observability-driven-development`](../observability-driven-development/SKILL.md) (v1.9) — characterization + ODD instrumentation = safety + visibility durante refactor

*Material-fonte: Working Effectively with Legacy Code — Feathers, 2004. ISBN 978-0-13-117705-5.*

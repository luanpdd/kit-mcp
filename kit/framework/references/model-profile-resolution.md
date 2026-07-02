# Resolução de Perfil de Modelo

Resolva o perfil de modelo uma vez no início da orquestração, depois use-o para todos os spawns de Task.

## Padrão de Resolução

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Padrão: `balanced` se não configurado ou config ausente.

## Tabela de Consulta

@./.claude/framework/references/model-profiles.md

Consulte o agente na tabela para o perfil resolvido. Passe o parâmetro model para chamadas Task:

```
Task(
  prompt="...",
  subagent_type="planner",
  model="{resolved_model}"  # "inherit", "sonnet", ou "haiku"
)
```

**Nota:** Agentes de nível Opus resolvem para `"inherit"` (não `"opus"`). Isso faz o agente usar o modelo da sessão pai, evitando conflitos com políticas organizacionais que podem bloquear versões específicas do opus.

Se `model_profile` for `"inherit"`, todos os agentes resolvem para `"inherit"` (útil para `/model` do OpenCode).

## Uso

1. Resolva uma vez no início da orquestração
2. Armazene o valor do perfil
3. Consulte o modelo de cada agente na tabela ao spawnar
4. Passe o parâmetro model para cada chamada Task (valores: `"inherit"`, `"sonnet"`, `"haiku"`)

## Override pontual por execução (despacho inline)

Absorvido do `execute <plano> <modelo>` do padrão `improve`: além do perfil global, um plano específico pode ser despachado a um modelo **nomeado no ato**. Em `/executar-fase` e `/expresso`, um token de modelo (`opus|sonnet|haiku|inherit` ou um id de modelo do runtime) após o id do plano — ex.: `/executar-fase 3 02 haiku` ou `/expresso "ajuste trivial" haiku` — vira um override de **prioridade máxima** só para aquele despacho.

**Precedência:** token inline na invocação **>** `model_overrides` (config) **>** tabela de perfil.

Use para baratear execuções triviais (executor → `haiku`) ou encarecer pontualmente (debugger → `opus`) sem mexer no perfil do projeto. O override vale só para o(s) Task() daquela invocação; não persiste.

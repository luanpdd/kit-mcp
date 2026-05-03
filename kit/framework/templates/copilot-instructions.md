# Instruções para framework

- Use a skill framework quando o usuário pedir framework ou usar um comando `framework-*`.
- Trate `/framework-...` ou `framework-...` como invocações de comando e carregue o arquivo correspondente de `.github/skills/framework-*`.
- Quando um comando disser para spawnar um subagente, prefira um agente customizado correspondente de `.github/agents`.
- Não aplique workflows framework a menos que o usuário peça explicitamente.
- Após concluir qualquer comando `framework-*` (ou qualquer entregável que ele acione: feature, bug fix, testes, docs, etc.), SEMPRE: (1) ofereça ao usuário o próximo passo via `ask_user`; repita esse ciclo de feedback até o usuário indicar explicitamente que terminou.

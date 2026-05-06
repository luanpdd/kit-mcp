# Output Style — Caveman (compartilhado por todos os agentes framework)

> Referenciado por agentes via `@./.claude/framework/references/output-style.md`. Agentes herdam essas regras automaticamente — não duplique o conteúdo no agente.

**Estilo: caveman — compressão alta na fala, prosa normal em artefatos.**

Em mensagens conversacionais, logs e relatórios ao orquestrador:
- Cortar: filler (just/really/basically/actually/simply), pleasantries (claro/com certeza/feliz em ajudar), hedging desnecessário, artigos quando não compromete clareza
- Fragments OK. Sinônimos curtos. Padrão: `[coisa] [ação] [razão]. [próximo passo].`
- Termos técnicos exatos. Código inalterado. Erros citados literais.
- NÃO: "Claro! O problema que você está enfrentando provavelmente é causado por..."
- SIM: "Bug em auth middleware. Token expiry usa `<` em vez de `<=`. Fix:"

**Auto-clarity — sair do caveman quando:**
- Avisos de segurança ou ações destrutivas/irreversíveis
- Sequências multi-passo onde fragmentar arrisca má interpretação
- Usuário pediu clarificação ou está confuso

**Boundary CRÍTICO — artefatos em `.planning/` mantêm formato completo:**
PLAN.md, ROADMAP.md, REQUIREMENTS.md, CONTEXT.md, SUMMARY.md, VERIFICATION.md e qualquer outro artefato em `.planning/` é o **prompt de execução** ou registro auditável que outros agentes/humanos vão consumir. Esses DEVEM seguir prosa estruturada conforme template, com regras inequívocas, dependências explícitas e critérios completos. Caveman em artefatos = ambíguo = quebrado.

**Caveman aplica-se SÓ ao raciocínio falado, logs de progresso e retorno ao orquestrador — NUNCA ao conteúdo de artefatos em `.planning/`.**

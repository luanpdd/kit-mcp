# Pesquisa de Armadilhas — kit-mcp v1.21 Suíte Multi-Tenant SaaS B2B

**Domínio:** Multi-Tenant SaaS B2B adicionado a app existente React + Supabase + Vercel — hierarquia firm→department→leader→collaborator com RBAC, WhatsApp via Evolution Go, CRM pipeline, LGPD compliance.
**Pesquisado:** 2026-05-10
**Confiança:** HIGH — web research em fontes oficiais (Meta Developers, Supabase Docs, ANPD/LGPD, Evolution API docs), post-mortems públicos, GitHub Issues Supabase 2025-2026.

> **Escopo:** Pitfalls ESPECÍFICOS de multi-tenancy em Supabase + React + Vercel. NÃO duplica pitfalls genéricos de RLS (user_metadata, (select auth.uid()) wrapper, for all) já cobertos em `supabase-rls-policies/SKILL.md` e `supabase-rls-writer.md`. Cada pitfall mapeia para skill, agent e gate que devem preveni-lo, além de detecção tardia e severity.

---

## CATEGORIA A — Tenant Isolation

### A1. Tabela nova sem RLS habilitado — cross-tenant data leak silencioso

**Sintoma em produção:** Query de usuário da Org X retorna registros da Org Y. Pode passar meses sem detecção se ambas as orgs têm dados similares ou se não há auditoria ativa. Normalmente detectado por usuário confuso vendo dados de outro cliente, ou via teste de penetração.

**Causa raiz:** Developer adiciona tabela nova (`notifications`, `attachments`, `webhooks_log`) em migration e esquece de chamar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Sem RLS habilitado, Postgres ignora todas as policies definidas — `SELECT * FROM notifications` retorna TUDO de TODOS os tenants para qualquer usuário autenticado.

**Prevenção:**
- Skill `multi-tenant-rls-hierarchy` deve documentar: toda migration que cria tabela nova PRECISA de `ENABLE ROW LEVEL SECURITY` + policy `tenant_isolation` imediatamente no mesmo arquivo SQL.
- Agent `multi-tenant-isolation-auditor` deve rodar:
  ```sql
  -- detecta tabelas sem RLS em schema public
  SELECT relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false;
  ```
  e ABORTAR plano se resultado não-vazio.
- Gate CI: `multi-tenant-rls-coverage` — toda migration que contém `CREATE TABLE` deve conter `ENABLE ROW LEVEL SECURITY` no mesmo arquivo. Linter regex: `CREATE TABLE` sem `ENABLE ROW LEVEL SECURITY` subsequente = BLOCK.
- Ferramenta externa: [Splinter linter](https://supabase.github.io/splinter/) — regra `0001_rls_enabled_on_table` detecta exatamente isso.

**Detecção tardia:** Se já está em prod — `SELECT relname FROM pg_class WHERE relrowsecurity = false AND relkind = 'r'` no Supabase Studio SQL Editor. Para cada tabela encontrada, verificar se tem dados multi-tenant via `SELECT COUNT(DISTINCT org_id) FROM <table>`. Se > 1, incidente P0.

**Severity:** P0 catastrófico — data leak imediato entre todos os tenants.

---

### A2. JOIN cross-tenant — RLS da tabela A não filtra tenant_id da tabela B

**Sintoma em produção:** Query legítima retorna dados corretos para o usuário mas inclui colunas de outros tenants via JOIN. Exemplo: `SELECT n.*, o.amount FROM notifications n JOIN orders o ON n.order_id = o.id` — `notifications` tem RLS por `tenant_id`, mas se `orders` não tem policy correta OU a policy de `orders` não verifica `tenant_id` (só verifica `user_id`), o JOIN pode retornar `amount` de pedidos de outro tenant. Usuário da Org X vê valor monetário de pedido da Org Y.

**Causa raiz:** Developer escreve RLS em cada tabela isoladamente sem testar JOINs. Postgres avalia a policy de cada tabela independentemente — se `orders` tem policy `WHERE user_id = auth.uid()` mas `notifications` referencia `orders` via `order_id` sem constraint de tenant, o JOIN atravessa tenant boundary.

**Prevenção:**
- Skill `multi-tenant-rls-hierarchy` deve incluir seção "JOIN safety": toda tabela que pode ser JOINada precisa de `tenant_id` indexado + policy que filtra por `tenant_id`, não apenas por `user_id`.
- Padrão canônico: todas as tabelas de dados do tenant carregam `org_id` explícito. JOINs sempre incluem `AND a.org_id = b.org_id`.
- Agent `multi-tenant-isolation-auditor` deve detectar queries de Edge Functions que JOINam tabelas sem verificar que ambas têm `org_id` na cláusula WHERE.

**Detecção tardia:** Revisar Edge Functions buscando padrões JOIN sem `org_id` explícito em ambos os lados: `grep -r "JOIN.*ON.*\.id\b" supabase/functions/` — se há JOINs sem `AND.*org_id`, investigar.

**Severity:** P1 sério — vaza dados específicos (valores, status) mas não dump completo.

---

### A3. `is_super_admin()` sem audit log e sem confirmation step

**Sintoma em produção:** Super-admin vê dados de qualquer tenant para fins de suporte. Sem log, quando cliente reclamar de "alguém acessou meus dados", não há evidência. Ou super-admin comete erro operacional (deleta registros do tenant errado) sem rastreamento.

**Causa raiz:** Super-admin bypass é implementado como "se `is_super_admin()` retornar true, RLS não filtra por `org_id`". Conveniente para suporte, mas sem accountability. Muitos implementam sem pensar que o próprio super-admin é vetor de risco (conta comprometida, insider threat).

**Prevenção:**
- Skill `super-admin-platform-pattern` deve documentar:
  1. Todo acesso cross-tenant por super-admin DEVE gerar entrada em `audit_log` com `actor_type = 'super_admin'`, `target_org_id`, `action`, `reason` (campo obrigatório: motivo do acesso).
  2. Impersonation (agir como usuário de outro tenant) deve exigir confirmation step com TTL curto (15 min) — token gerado pelo próprio super-admin, registrado em log.
  3. `is_super_admin()` deve ser `SECURITY DEFINER` function que lê de `app_metadata` (imutável pelo user).
- Agent `super-admin-implementer` deve ABORTAR se super-admin bypass não inclui trigger de audit.

```sql
-- pattern correto: super-admin policy com audit automático via trigger
CREATE POLICY "super_admin_select_all"
  ON public.org_data
  FOR SELECT TO authenticated
  USING (
    (SELECT (auth.jwt()->'app_metadata'->>'is_super_admin')::boolean)
    -- trigger AFTER SELECT via view auditada — não via policy (Postgres não suporta trigger em SELECT diretamente)
    -- usar view super_admin_org_data_view com INSTEAD OF trigger ou log via Edge Function wrapper
  );
```

**Detecção tardia:** `SELECT * FROM audit_log WHERE actor_type = 'super_admin'` — se tabela não tem essa coluna ou está vazia mas super-admin usou o sistema, auditoria inexistente. Cruzar com logs de acesso do Supabase Studio.

**Severity:** P1 sério — não é leak imediato, mas elimina accountability e cria risco regulatório LGPD (Art. 37: registro de operações de tratamento).

---

### A4. Service role em Edge Function user-facing — RLS bypassado

**Sintoma em produção:** Edge Function retorna dados de todos os tenants. `console.log(data)` em dev mostra todos os registros do banco. Usuário em staging consegue fazer requisição para `/api/messages` e receber mensagens de outra empresa.

**Causa raiz:** Developer usa `createClient(supabaseUrl, SERVICE_ROLE_KEY)` em Edge Function pública "para facilitar" — evita ter que passar o JWT do usuário. Service role bypassa RLS completamente. Combinado com ausência de tenant_id filter manual no código, torna-se dump completo do banco.

**Prevenção:**
- Skill `multi-tenant-rls-hierarchy` deve ter WARNING em destaque: Edge Functions user-facing NUNCA usam service_role. Usar `createClient(url, ANON_KEY, { auth: { persistSession: false } })` com o JWT do usuário extraído do header `Authorization`.
- Agent `evolution-go-integrator` e `crm-pipeline-implementer` devem verificar qual key está sendo usada: se `SERVICE_ROLE_KEY` em variável usada em função user-facing → ABORTAR.
- Exceção legítima: Edge Functions server-to-server (cron jobs, webhooks de terceiros após validação de assinatura) podem usar service_role, mas DEVEM incluir `tenant_id` filter manual explícito.

```typescript
// ERRADO — em função user-facing
const supabase = createClient(url, Deno.env.get('SERVICE_ROLE_KEY')!);

// CERTO — passa JWT do usuário, RLS aplica automaticamente
const authHeader = req.headers.get('Authorization');
const supabase = createClient(url, Deno.env.get('ANON_KEY')!, {
  global: { headers: { Authorization: authHeader! } },
});
```

**Detecção tardia:** Revisar todas as Edge Functions: `grep -r "SERVICE_ROLE_KEY\|service_role" supabase/functions/` — para cada match, verificar se a função tem rota pública ou recebe JWT de usuário. Se sim, avaliar como P0.

**Severity:** P0 catastrófico — equivale a desligar RLS em toda a aplicação.

---

### A5. RLS testada com 1 tenant em dev, quebra com 2+ tenants em prod

**Sintoma em produção:** Em staging com 1 organização, tudo funciona. Primeiro cliente real onboardado — dados do segundo cliente vazam para o primeiro, ou primeiro não vê seus próprios dados, ou ambos vêem os mesmos dados duplicados.

**Causa raiz:** Developer só tem uma conta/org em ambiente de desenvolvimento. Testa como "admin da Org X" e verifica que vê os dados certos — mas nunca testa como "usuário da Org Y tentando acessar dados da Org X". Policy com `user_id = auth.uid()` passa, mas se não inclui `org_id`, qualquer usuário com acesso à tabela pode ver todos os registros de outros tenants que referenciam o mesmo objeto.

**Prevenção:**
- Skill `multi-tenant-rls-hierarchy` deve incluir seção "Multi-tenant test matrix": antes de qualquer deploy, criar pelo menos 2 usuários em 2 orgs distintas e executar matrix:
  - User A (Org 1) tenta SELECT dados Org 1 → deve retornar dados
  - User A (Org 1) tenta SELECT dados Org 2 → deve retornar vazio (não erro 403, mas zero rows)
  - User B (Org 2) tenta SELECT dados Org 1 → deve retornar vazio
  - User B (Org 2) tenta INSERT com `org_id` = Org 1 → deve retornar erro de policy violation
- Agent `multi-tenant-isolation-auditor` deve gerar script de teste com seeds para 2 orgs e verificar essa matrix.
- Gate: test suite de isolamento deve ser executada em cada PR que toca tabelas multi-tenant.

**Detecção tardia:** Criar dois usuários de teste em prod em orgs distintas e executar a matrix manualmente. Se qualquer cross-tenant SELECT retorna dados — incidente ativo.

**Severity:** P0 se testa-se e confirma-se leak; P1 se é risco latente não confirmado.

---

## CATEGORIA B — Hierarchy Pitfalls

### B6. Department member sem org_member — usuário "órfão" de hierarquia

**Sintoma em produção:** Usuário consegue acessar recursos do department mas, quando a aplicação tenta verificar permissões no nível da organização, retorna "não é membro" — exibindo páginas de erro 403 para operações que deveriam funcionar, ou inversamente, pulando verificações de org-level que assumem que dept member implica org member.

**Causa raiz:** Fluxo de convite permite adicionar usuário diretamente ao department sem passar pelo membership da organização pai. Ou migration adicionou FK de `dept_members.user_id` → `users.id` mas não FK de `dept_members.org_id` → `org_members(org_id, user_id)`.

**Prevenção:**
- Skill `b2b-saas-architecture` deve documentar constraint obrigatória:
  ```sql
  -- constraint: dept member deve existir como org member
  ALTER TABLE dept_members
    ADD CONSTRAINT dept_members_must_be_org_member
    FOREIGN KEY (org_id, user_id)
    REFERENCES org_members (org_id, user_id)
    ON DELETE CASCADE;
  ```
- Agent `b2b-saas-architect` deve incluir essa constraint em todo schema de hierarquia.
- Trigger alternativo se FK composta não é viável:
  ```sql
  CREATE OR REPLACE FUNCTION check_dept_member_is_org_member()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = NEW.org_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'user % must be org member before being added to department', NEW.user_id;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

**Detecção tardia:**
```sql
-- encontra dept_members sem org_member correspondente
SELECT dm.user_id, dm.org_id, dm.dept_id
FROM dept_members dm
LEFT JOIN org_members om ON om.org_id = dm.org_id AND om.user_id = dm.user_id
WHERE om.user_id IS NULL;
```

**Severity:** P1 sério — quebra hierarquia de autorização, pode criar bypass de permissões.

---

### B7. Permission inheritance ambígua — conflito dept role vs org role

**Sintoma em produção:** Usuário que é `viewer` na organização mas `manager` no department consegue executar ações que deveriam ser restringidas ao nível org. Ou inversamente, usuário `admin` da org mas sem role no dept não consegue acessar recursos do dept esperando herdar permissão.

**Causa raiz:** Sistema de RBAC não define explicitamente se dept-level roles são aditivas (somam com org roles), substitutas (substituem org roles no contexto do dept) ou restritivas (a mais restritiva prevalece). Cada developer que implementa uma feature decide sozinho, criando comportamento inconsistente.

**Prevenção:**
- Skill `rbac-permissions-matrix-supabase` deve definir o modelo canônico com decisão explícita. Recomendação: **modelo aditivo com escopo** — dept roles adicionam permissões apenas dentro do dept scope; org roles definem o teto máximo. Org admin sempre pode tudo nos depts. Dept manager pode tudo apenas dentro do dept.
- Implementação via helper function:
  ```sql
  CREATE OR REPLACE FUNCTION has_permission(
    p_user_id UUID,
    p_org_id UUID,
    p_dept_id UUID,  -- NULL = verifica apenas org level
    p_permission TEXT
  ) RETURNS BOOLEAN
  STABLE LANGUAGE sql AS $$
    SELECT EXISTS (
      -- org-level permission (aplica a todos os depts)
      SELECT 1 FROM org_role_permissions orp
      JOIN org_members om ON om.role_id = orp.role_id
      WHERE om.user_id = p_user_id AND om.org_id = p_org_id
        AND orp.permission = p_permission
      UNION ALL
      -- dept-level permission (aplica apenas quando p_dept_id especificado)
      SELECT 1 FROM dept_role_permissions drp
      JOIN dept_members dm ON dm.role_id = drp.role_id
      WHERE p_dept_id IS NOT NULL
        AND dm.user_id = p_user_id AND dm.dept_id = p_dept_id
        AND drp.permission = p_permission
    );
  $$;
  ```
- Decisão deve ser documentada em `GLOSSARY.md` da suíte e comunicada a todos os agents.

**Detecção tardia:** Teste de matriz de permissões: criar usuário com conflito deliberado (org viewer + dept manager) e verificar qual comportamento se manifesta em cada endpoint.

**Severity:** P1 sério — pode resultar em privilege escalation se aditivo não é limitado por teto.

---

### B8. Recursive department hierarchy — parent_id loop

**Sintoma em produção:** Query que traversa hierarquia de departamentos entra em loop infinito. Timeout de banco após 30s. Aplicação retorna 504 em qualquer página que renderiza estrutura de depts.

**Causa raiz:** API de criação/edição de dept permite setar `parent_id` apontando para um filho (direto ou indireto), criando ciclo. Sem cycle detection, `WITH RECURSIVE` entra em loop. Exemplo: Dept A → Dept B → Dept C → Dept A.

**Prevenção:**
- Constraint via trigger antes de UPDATE/INSERT:
  ```sql
  CREATE OR REPLACE FUNCTION check_no_dept_cycle()
  RETURNS TRIGGER AS $$
  DECLARE
    cycle_check UUID;
  BEGIN
    IF NEW.parent_id IS NULL THEN
      RETURN NEW;
    END IF;
    -- verifica se NEW.id já aparece como ancestral de NEW.parent_id
    SELECT dept_id INTO cycle_check
    FROM (
      WITH RECURSIVE ancestors AS (
        SELECT dept_id, parent_id FROM departments WHERE dept_id = NEW.parent_id
        UNION ALL
        SELECT d.dept_id, d.parent_id
        FROM departments d
        JOIN ancestors a ON d.dept_id = a.parent_id
      )
      SELECT dept_id FROM ancestors
    ) tree
    WHERE dept_id = NEW.id
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'circular reference detected in department hierarchy';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER dept_cycle_prevention
    BEFORE INSERT OR UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION check_no_dept_cycle();
  ```
- Skill `b2b-saas-architecture` deve documentar esse trigger como obrigatório.
- Queries recursivas DEVEM ter `CYCLE dept_id SET is_cycle USING cycle_path` (PostgreSQL 14+) como safety net adicional.

**Detecção tardia:**
```sql
-- detecta ciclos existentes em prod
WITH RECURSIVE tree AS (
  SELECT dept_id, parent_id, ARRAY[dept_id] AS path, FALSE AS is_cycle
  FROM departments WHERE parent_id IS NULL
  UNION ALL
  SELECT d.dept_id, d.parent_id,
         path || d.dept_id,
         d.dept_id = ANY(path)
  FROM departments d
  JOIN tree t ON t.dept_id = d.parent_id
  WHERE NOT is_cycle
)
SELECT dept_id FROM tree WHERE is_cycle;
```

**Severity:** P0 catastrófico — trava queries, potencialmente trava o banco inteiro se connection pool esgota esperando timeout.

---

### B9. Member com zero roles após remoção — acesso ambíguo

**Sintoma em produção:** Usuário que teve última role removida ainda aparece como "membro ativo" na lista de membros, mas não consegue fazer nada. Confusão para o admin ("por que esse usuário não consegue acessar?") e para o próprio usuário. Em alguns sistemas, membro sem role herda política default permissiva.

**Causa raiz:** Remoção de role é feita sem verificar se é a última role. Sistema não define o que significa "membro sem role" — pode ser tratado como "acesso zero" (correto) ou como "acesso default" (perigoso).

**Prevenção:**
- Trigger que ao remover última role executa uma das opções (documentar escolha):
  - **Opção A (recomendada):** Remove automaticamente o membership e notifica admin + user.
  - **Opção B:** Mantém como "suspended member" — sem acesso, mas listado para re-ativar.
  ```sql
  CREATE OR REPLACE FUNCTION handle_last_role_removal()
  RETURNS TRIGGER AS $$
  BEGIN
    -- verifica se era a última role
    IF NOT EXISTS (
      SELECT 1 FROM member_roles
      WHERE org_id = OLD.org_id AND user_id = OLD.user_id
        AND role_id != OLD.role_id
    ) THEN
      -- Opção A: remove membership
      DELETE FROM org_members WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
      -- ou Opção B: suspende
      -- UPDATE org_members SET status = 'suspended' WHERE ...
    END IF;
    RETURN OLD;
  END;
  $$ LANGUAGE plpgsql;
  ```
- Skill `org-onboarding-flow` deve documentar esse comportamento e forçar escolha explícita durante design.

**Detecção tardia:**
```sql
-- membros sem nenhuma role ativa
SELECT om.user_id, om.org_id FROM org_members om
LEFT JOIN member_roles mr ON mr.user_id = om.user_id AND mr.org_id = om.org_id
WHERE mr.user_id IS NULL;
```

**Severity:** P2 incômodo (se zero access é o behavior) ou P1 (se acesso default existe).

---

## CATEGORIA C — Invite Flow Pitfalls

### C10. Token replay — invite aceito duas vezes em race condition

**Sintoma em produção:** Dois cliques rápidos no link do convite (ou dois navegadores abrindo o mesmo link) criam dois memberships duplicados para o mesmo usuário. Ou: atacante captura token e o usa após vítima já ter aceito — dependendo da implementação, pode criar segunda sessão em org diferente.

**Causa raiz:** Aceitação de invite não usa transação atômica com lock. Fluxo: (1) buscar invite por token, (2) verificar se não foi aceito, (3) criar membership, (4) marcar invite como aceito — sem SELECT FOR UPDATE no passo 1, dois requests concorrentes passam pela verificação do passo 2 simultaneamente.

**Prevenção:**
- Skill `member-invite-flow` deve documentar: usar `UPDATE invites SET accepted_at = NOW() WHERE token = $1 AND accepted_at IS NULL RETURNING *` — UPDATE atômico que só retorna linha se ela ainda não foi aceita. Zero rows = replay attempt.
  ```sql
  -- operação atômica: só processa se accepted_at ainda é NULL
  WITH claimed AS (
    UPDATE invites
    SET accepted_at = NOW(), accepted_by = $user_id
    WHERE token = $token
      AND accepted_at IS NULL
      AND expires_at > NOW()
    RETURNING *
  )
  INSERT INTO org_members (org_id, user_id, role_id)
  SELECT org_id, $user_id, role_id FROM claimed;
  -- se 0 rows afetadas = token já usado ou expirado
  ```
- Token deve ter TTL curto (24-72h) e ser single-use por design.

**Detecção tardia:** `SELECT COUNT(*) FROM org_members WHERE (org_id, user_id) IN (SELECT org_id, user_id FROM org_members GROUP BY org_id, user_id HAVING COUNT(*) > 1)` — duplicatas indicam race condition aconteceu.

**Severity:** P1 sério — pode criar inconsistência de dados ou abrir org para usuário não autorizado.

---

### C11. Invite token vazado em URL/logs — token no querystring

**Sintoma em produção:** Token de convite aparece em: (a) logs de servidor (Vercel access logs incluem query params por padrão), (b) `Referer` header quando usuário clica link externo após aceitar, (c) histórico do browser, (d) analytics tools (GA, Hotjar capturam URL).

**Causa raiz:** Link de convite gerado como `https://app.com/invite?token=abc123` — token no querystring. Padrão comum mas perigoso em ambiente com qualquer forma de logging de URL.

**Prevenção:**
- Skill `member-invite-flow` deve documentar padrão correto:
  - Token no **path**: `https://app.com/invite/abc123` — ainda aparece em logs, mas menos inferível.
  - Melhor: token **curto e ofuscado** (8-16 chars hex), **HMAC-signed** (para validar sem lookup de banco), **short-lived** (24h max).
  - Configuração Vercel: desabilitar request logging para path `/invite/*` via `vercel.json` ou middleware que redact antes de log.
  - Não incluir token em `Set-Cookie` (aparece em logs de resposta).
  - Token DEVE ser hash único não-derivável do email/user (não usar UUID do usuário como token).
- Agent `invite-flow-implementer` deve verificar que token não está em query param.

**Detecção tardia:** Verificar Vercel access logs na dashboard — se `/invite?token=` aparece, token está sendo logado. Revisar se analytics tools estão capturando URLs de `/invite`.

**Severity:** P1 sério — token vazado permite acesso não autorizado à organização.

---

### C12. Email enumeration via endpoint `/invite`

**Sintoma em produção:** Atacante envia `POST /invite` com emails aleatórios e, baseado na resposta diferente para "email já existe" vs "email não cadastrado", mapeia quais emails têm contas no sistema.

**Causa raiz:** Endpoint retorna mensagens distintas: `{"error": "usuário já é membro"}` vs `{"success": "convite enviado"}` — revelando se o email existe no banco.

**Prevenção:**
- Skill `member-invite-flow` deve documentar: **sempre retornar a mesma resposta** independente de o email existir ou não. `{"success": "se esse email tiver uma conta, receberá o convite"}`.
- Internamente, se email existe: criar membership direto (se domínio confiado) ou enviar email de convite. Se não existe: enviar email com link de signup + convite em um fluxo único.
- Rate limit no endpoint: max 10 invites/min por organização (previne enumeration em escala).

**Detecção tardia:** Revisar código do endpoint de invite — se tem branch distinto para "email exists" vs "not found" com mensagem diferente, está vulnerável. Teste: enviar request com email existente e inexistente, comparar respostas.

**Severity:** P2 incômodo (sozinho), mas P1 combinado com outros vetores de reconhecimento.

---

### C13. Invite para usuário deletado — acesso a org antiga

**Sintoma em produção:** Usuário A tinha conta com email `x@empresa.com`, foi membro da Org X, deletou conta. Novo usuário B se registra com o mesmo email (possível em sistemas que permitem re-registro). Admin da Org Y convida `x@empresa.com`. Novo usuário B aceita convite e descobre que, em alguns sistemas, tem acesso a dados da Org X (antiga) via registros órfãos que referenciavam o email, não o UUID.

**Causa raiz:** Sistema de convite e membership usa email como chave de identidade em vez de UUID do usuário. Registros históricos referenciam `email` em vez de `user_id`.

**Prevenção:**
- Skill `member-invite-flow`: memberships SEMPRE referenciam `user_id` (UUID do auth.users), nunca email. Invite armazena email como destino do envio, mas ao aceitar, vincula ao UUID do usuário que aceitou.
- Ao deletar conta: `DELETE FROM auth.users WHERE id = $user_id` (via admin API) automaticamente invalida todas as sessions. Dados de membership devem ter `ON DELETE CASCADE` ou `ON DELETE SET NULL` dependendo do tipo de dado.
- Convite enviado para email de conta deletada: verificar na aceitação se `auth.uid()` da sessão atual corresponde ao email do invite.

**Detecção tardia:**
```sql
-- memberships referenciando emails em vez de user_ids
SELECT COUNT(*) FROM org_members WHERE user_id IS NULL AND email IS NOT NULL;
```

**Severity:** P1 sério — potencial acesso não autorizado a dados históricos de org.

---

## CATEGORIA D — Audit Log Pitfalls

### D14. Audit log sem `tenant_id` indexado — table scan em queries de compliance

**Sintoma em produção:** Operações de compliance ("mostrar todos os eventos da Org X nos últimos 30 dias") levam 10-60 segundos. Relatórios de auditoria para clientes enterprise se tornam inviáveis. Queries de investigação de incidente travam o banco.

**Causa raiz:** `audit_log` cresce com dados de TODOS os tenants. Query `WHERE tenant_id = $org_id AND created_at > $start` faz sequential scan se não há índice composto em `(tenant_id, created_at)`.

**Prevenção:**
- Skill `audit-log-multi-tenant` deve documentar schema obrigatório:
  ```sql
  CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID        NOT NULL REFERENCES organizations(id),
    actor_id    UUID,                           -- NULL = system action
    actor_type  TEXT        NOT NULL,           -- 'user' | 'super_admin' | 'system'
    action      TEXT        NOT NULL,           -- 'member.invited' | 'lead.stage_changed' etc.
    resource_id UUID,
    resource_type TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  -- índices obrigatórios
  CREATE INDEX audit_log_tenant_created_idx ON audit_log (tenant_id, created_at DESC);
  CREATE INDEX audit_log_actor_idx          ON audit_log (actor_id)       WHERE actor_id IS NOT NULL;
  CREATE INDEX audit_log_resource_idx       ON audit_log (resource_type, resource_id);
  ```
- Agent `audit-log-implementer` deve incluir esses índices como parte da migration obrigatória.

**Detecção tardia:** `EXPLAIN ANALYZE SELECT * FROM audit_log WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days'` — se retornar `Seq Scan`, índice ausente. Em prod com >100k rows, isso é crítico.

**Severity:** P1 sério — não é leak, mas torna compliance impraticável e pode causar timeout em prod.

---

### D15. Retention naive — deletar tudo > 90d sem distinguir legal hold

**Sintoma em produção:** Job de retenção deleta registros de audit que estão em período de investigação ativa (incidente em curso, processo judicial, LGPD DSR pendente). Evidências destruídas. Compliance officer descobre que eventos de 6 meses atrás foram deletados, exatamente o período que o cliente enterprise está auditando.

**Causa raiz:** Política de retenção implementada como `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'` sem verificar se tenant tem legal hold ativo.

**Prevenção:**
- Skill `audit-log-multi-tenant` deve documentar:
  - Coluna `legal_hold` em `organizations` (boolean, default false) — quando true, nenhum dado daquela org é deletado por jobs de retenção.
  - Coluna `retention_days` por org (enterprise pode ter 365 dias, básico 90 dias).
  - Job de retenção:
    ```sql
    DELETE FROM audit_log al
    USING organizations o
    WHERE al.tenant_id = o.id
      AND o.legal_hold = false
      AND al.created_at < NOW() - (o.retention_days || ' days')::INTERVAL;
    ```
  - LGPD DSR erasure pendente: marcar org com `lgpd_erasure_pending = true` — suspende retenção automática até DSR processado.

**Detecção tardia:** Verificar se job de retenção tem cláusula de legal hold. Se não tem, é risco latente. Verificar se há orgs com `legal_hold = true` que já passaram pelo job — se sim, dados podem ter sido deletados erroneamente.

**Severity:** P1 sério — destruição de evidências tem implicações legais e de compliance enterprise.

---

### D16. Admin deleta evidência de audit log — tampering possível

**Sintoma em produção:** Admin da Org X deleta registros de audit_log que mostram suas próprias ações irregulares (ex: exfiltração de dados, modificação de leads de outros membros). Impossível investigar sem evidências.

**Causa raiz:** `audit_log` tratada como tabela normal com permissão de DELETE para roles admin. Admin tem permissão de "gerenciar dados da org" que inclui DELETE em audit_log.

**Prevenção:**
- Skill `audit-log-multi-tenant` deve documentar padrão append-only obrigatório:
  ```sql
  -- revogar DELETE e UPDATE de audit_log para todos os roles, incluindo org admins
  REVOKE DELETE, UPDATE ON audit_log FROM authenticated;
  REVOKE DELETE, UPDATE ON audit_log FROM service_role; -- exceto super_admin via função dedicada
  ```
  - Alternativa mais robusta: particionar audit_log por mês, e quando o mês fecha, ATTACH partition como READ-ONLY (sem suporte nativo no Postgres — emular via revoke em tabela particionada).
  - Alternativa enterprise: usar `pgaudit` extension + exportar para immudb ou S3 com Object Lock (WORM — Write Once Read Many).
  - Super-admin pode marcar registros como `archived` mas nunca deletar.
- RLS na `audit_log`: org admins podem SELECT apenas os da própria org, mas NENHUM DELETE/UPDATE.

**Detecção tardia:** `SELECT has_table_privilege('authenticated', 'audit_log', 'delete')` — se retornar true, tabela está vulnerável a tampering.

**Severity:** P1 sério — destrói accountability e pode violar LGPD Art. 37 (registro de operações).

---

### D17. PII em audit log — payload completo registrado

**Sintoma em produção:** Audit log inclui campos como `{"cpf": "123.456.789-00", "email": "x@y.com", "phone": "+5511..."}` no `metadata` JSONB. Quando cliente solicita LGPD DSR de erasure, não é possível anonimizar apenas os dados do usuário sem quebrar o trail de auditoria.

**Causa raiz:** Trigger de audit log captura `row_to_json(OLD)` ou `row_to_json(NEW)` — snapshot completo da linha antes/depois da operação. Inclui todos os campos PII sem sanitização.

**Prevenção:**
- Skill `audit-log-multi-tenant` deve documentar padrão de sanitização:
  - Audit log registra REFERÊNCIAS (IDs), não valores PII diretos.
  - `metadata` deve conter apenas campos diff (quais campos mudaram, não os valores originais de PII).
  - Para campos PII necessários (ex: email do convidado), usar hash: `sha256(email)` — permite correlação sem expor PII em claro.
  ```sql
  -- trigger sanitizado
  CREATE OR REPLACE FUNCTION audit_sanitized()
  RETURNS TRIGGER AS $$
  DECLARE
    pii_fields TEXT[] := ARRAY['email', 'cpf', 'phone', 'name', 'address'];
    sanitized JSONB;
  BEGIN
    -- captura diff sem campos PII em claro
    sanitized := to_jsonb(NEW) - pii_fields;
    INSERT INTO audit_log(tenant_id, action, resource_id, metadata)
    VALUES (NEW.org_id, TG_OP, NEW.id, sanitized);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

**Detecção tardia:** Amostrar 10 registros de `audit_log.metadata` e verificar se contêm campos como `email`, `cpf`, `phone`, `name`. Se sim, PII está em claro em logs de auditoria.

**Severity:** P1 sério — cria conflito direto com LGPD Art. 18 (direito ao apagamento).

---

## CATEGORIA E — LGPD Pitfalls

### E18. DSR de erasure quebra audit trail — user_id como FK em audit_log

**Sintoma em produção:** Usuário solicita LGPD erasure (Art. 18, VI). Sistema deleta `auth.users` → CASCADE deleta ou NULLifica referências em `audit_log.actor_id`. Trial de auditoria perde contexto de "quem fez o quê" — registros mostram `NULL` como ator.

**Causa raiz:** Tensão real entre LGPD (direito ao apagamento de dados pessoais) e necessidade de audit trail para compliance/segurança. Sistema não tratou esse conflito.

**Prevenção:**
- Skill `lgpd-multi-tenant-compliance` deve documentar padrão de anonymization:
  - **Não deletar**: Ao processar DSR erasure, **anonimizar** o usuário em vez de deletar:
    ```sql
    UPDATE auth.users SET
      email    = 'anonymized_' || id || '@deleted.local',
      raw_user_meta_data = '{}',
      raw_app_meta_data  = '{}',
      phone    = NULL
    WHERE id = $user_id;
    -- audit_log.actor_id ainda aponta para o UUID, mas usuário foi anonimizado
    ```
  - Audit log retém `actor_id` (UUID) — UUID sozinho não é PII diretamente identificável após anonimização do usuário correspondente.
  - Documentar base legal para retenção de audit log após erasure: Art. 16 LGPD permite retenção para "exercício regular de direitos em processo judicial, administrativo ou arbitral".
- Agent `lgpd-compliance-auditor` deve verificar se DSR flow usa hard delete ou anonymization.

**Detecção tardia:** `SELECT COUNT(*) FROM audit_log WHERE actor_id IS NOT NULL` após processar DSR — se referências foram NULLificadas mas audit_log permanece, significa ON DELETE SET NULL foi usado (aceitável). Se registros foram deletados via CASCADE, trail foi destruído.

**Severity:** P1 sério — pode resultar em violação de LGPD (ambas as direções: excesso de dados OU destruição de evidências).

---

### E19. Consent management default opt-in — ilegal LGPD

**Sintoma em produção:** Formulário de signup tem checkbox de marketing pré-marcado (opt-in padrão). Ou usuário é inscrito em newsletter automaticamente ao criar conta. ANPD aplica multa ou requer reprocessamento de dados de todos os usuários cadastrados com consentimento inválido.

**Causa raiz:** Developer segue padrão de e-commerce americano (opt-in padrão = mais conversões) sem saber que LGPD Art. 8 §5 exige consentimento "livre, informado e inequívoco" — implica que checkbox NÃO pode ser pré-marcado.

**Prevenção:**
- Skill `lgpd-multi-tenant-compliance` deve documentar:
  - Todos os checkboxes de consentimento: `defaultChecked = false` — obrigatório.
  - Consentimento deve ser granular: um checkbox por finalidade (marketing, analytics, WhatsApp notifications).
  - Armazenar timestamp e versão do texto de consentimento aceito — não apenas boolean.
  ```sql
  CREATE TABLE user_consents (
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    purpose         TEXT NOT NULL, -- 'marketing' | 'analytics' | 'whatsapp'
    granted         BOOLEAN NOT NULL,
    consent_version TEXT NOT NULL, -- versão do texto legal
    granted_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    PRIMARY KEY (user_id, purpose)
  );
  ```
- Agent `org-onboarding-implementer` deve verificar que signup flow tem checkboxes desmarcados por padrão.

**Detecção tardia:** Revisar componentes de signup no React — qualquer `defaultChecked={true}` ou `checked={true}` sem interação do usuário em checkbox de consentimento é violação. Em banco: `SELECT COUNT(*) FROM user_consents WHERE granted = true AND granted_at IS NULL` — consentimentos sem timestamp são suspeitos de opt-in automático.

**Severity:** P1 sério — multa ANPD de até 2% faturamento BR, limitado a R$50M por infração.

---

### E20. Data export incompleto — tabela "messages" esquecida no DSR

**Sintoma em produção:** Usuário solicita portabilidade (Art. 18, V LGPD). Sistema exporta dados de `profiles`, `org_members`, `leads` mas esquece `whatsapp_messages`, `crm_activities`, `audit_log_entries`. Usuário ou ANPD identifica incompletude.

**Causa raiz:** Export implementado manualmente com lista hardcoded de tabelas. Quando novas features adicionam tabelas com dados pessoais, ninguém atualiza o export. Sem inventário formal de PII.

**Prevenção:**
- Skill `lgpd-multi-tenant-compliance` deve documentar: manter inventário de PII via comentário em tabela:
  ```sql
  COMMENT ON TABLE whatsapp_messages IS 'contains_pii:true, pii_fields:sender_name,content, lgpd_subject:org_member';
  ```
  Export query dinâmica via `INFORMATION_SCHEMA` + comentários:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND obj_description(
      (table_schema || '.' || table_name)::regclass, 'pg_class'
    ) LIKE '%contains_pii:true%';
  ```
- Agent `lgpd-compliance-auditor` deve executar essa query e listar tabelas PII não cobertas pelo export.

**Detecção tardia:** Comparar lista de tabelas com `contains_pii:true` no comment com lista de tabelas no código de export. Qualquer tabela não coberta = gap de compliance.

**Severity:** P1 sério — incompleto. Art. 18 LGPD exige export de TODOS os dados do titular.

---

### E21. Cross-border transfer sem base legal — Vercel/Supabase em US, dados de brasileiros

**Sintoma em produção:** ANPD inicia investigação. App processa dados de brasileiros em servidores no exterior (AWS us-east-1 via Supabase, Vercel Edge nos EUA) sem Standard Contractual Clauses assinadas com os subprocessadores.

**Causa raiz:** Deploy padrão de Vercel e Supabase aponta para regiões norte-americanas. LGPD Art. 33 exige base legal para transferência internacional — adequacy decision, SCCs, ou BCRs.

**Prevenção:**
- Skill `lgpd-multi-tenant-compliance` deve documentar:
  - **Supabase**: selecionar região `sa-east-1` (São Paulo) para o projeto Supabase — dados do banco ficam no Brasil. Disponível na dashboard Supabase.
  - **Vercel**: configurar `regions: ["gru1"]` no `vercel.json` para Edge Functions (GRU1 = São Paulo). Para Serverless Functions, adicionar região SA ao pool.
  - **Fallback**: se dados precisam sair do Brasil, implementar SCCs com cada subprocessador (Supabase Inc., Vercel Inc.) via Data Processing Agreements (DPAs) — ambos oferecem DPAs padrão.
  - Após agosto 2025: Brasil exige SCCs aprovadas pela ANPD (Resolução CD/ANPD No. 19/2024) para transfers internacionais.
  - Exceção: Brasil-UE — adequacy decision mútua desde Jan 2026 (Mayer Brown, 2026).
- Agent `lgpd-compliance-auditor` deve verificar configuração de região do projeto Supabase e `vercel.json`.

**Detecção tardia:** `supabase projects list` — verificar `region` do projeto. Em Vercel: `vercel env ls` + `vercel.json` — verificar se `regions` inclui `gru1`. Se ambos apontam para US e não há DPA documentado, risco ativo.

**Severity:** P1 sério — multa ANPD + risco de suspensão de processamento (precedente: Meta, X Corp em 2024-2025).

---

## CATEGORIA F — Evolution Go / WhatsApp Pitfalls

### F22. Webhook sem validação de assinatura — spoofing de mensagens

**Sintoma em produção:** Atacante envia `POST /webhook/whatsapp` com payload fabricado simulando mensagem de cliente. Sistema responde automaticamente, cria lead falso, ou executa ação de negócio (ex: muda status de pedido) sem que mensagem real tenha sido enviada.

**Causa raiz:** Endpoint de webhook aceita qualquer POST sem verificar header `X-Hub-Signature-256`. Meta/WhatsApp assina cada payload com HMAC-SHA256 usando o App Secret — se não validar, qualquer um pode fabricar requisições.

**Prevenção:**
- Skill `evolution-go-whatsapp-integration` deve documentar:
  ```typescript
  // validação obrigatória — SEMPRE antes de processar
  async function validateWhatsAppSignature(req: Request, appSecret: string): Promise<boolean> {
    const signature = req.headers.get('X-Hub-Signature-256');
    if (!signature) return false;

    const rawBody = await req.arrayBuffer(); // RAW body antes de qualquer parse
    const expectedSig = 'sha256=' + await hmacSha256Hex(appSecret, rawBody);

    // timing-safe comparison obrigatório (previne timing attacks)
    return timingSafeEqual(signature, expectedSig);
  }
  ```
  - Atenção: Meta usa Unicode escaped encoding no payload — calcular HMAC sobre o body raw ANTES de qualquer JSON.parse().
  - Evolution API: configurar `WEBHOOK_HMAC_SECRET` na instância — Evolution valida por você quando configurado corretamente.
- Agent `evolution-go-integrator` deve ABORTAR se endpoint de webhook não tem validação de assinatura.

**Detecção tardia:** Enviar um POST manual com payload qualquer para o endpoint de webhook da app. Se processar sem erro 401/403, validação está ausente.

**Severity:** P0 catastrófico — qualquer pessoa pode injetar mensagens, criar leads falsos, manipular state machine de conversação.

---

### F23. Webhook duplicado processado duas vezes — sem idempotency key

**Sintoma em produção:** Meta retenta webhook após timeout (5-10s de processamento sem resposta 200). Lead criado duas vezes. Mensagem automática enviada duas vezes para o cliente. Cobrança processada em duplicidade.

**Causa raiz:** Meta entrega webhooks "at-least-once" — duplicatas são comportamento normal, não exceção. Endpoint processa de forma síncrona (demora > 5s) e Meta retry. Sem deduplication por `message_id`.

**Prevenção:**
- Skill `evolution-go-whatsapp-integration` deve documentar padrão obrigatório:
  1. **Responder 200 imediatamente** antes de qualquer processamento.
  2. **Enfileirar** mensagem para processamento assíncrono.
  3. **Deduplicar por `messages[].id`** (message_id é único por mensagem, mesmo em retries):
  ```typescript
  // Edge Function: aceita imediatamente, enfileira
  serve(async (req) => {
    const body = await req.json();
    const messageId = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;

    // dedup check — tenta inserir, ignora se duplicado
    const { error } = await supabase.from('processed_webhooks')
      .insert({ message_id: messageId, processed_at: new Date() })
      .onConflict('message_id')
      .ignore();

    if (!error) {
      // enfileirar para processamento assíncrono (pgmq, inngest, etc.)
      await enqueueForProcessing(body);
    }

    return new Response('ok', { status: 200 }); // sempre responde 200
  });
  ```
  - TTL da tabela `processed_webhooks`: 7 dias (Meta nunca retenta além disso).

**Detecção tardia:** `SELECT message_id, COUNT(*) FROM crm_activities WHERE source = 'whatsapp' GROUP BY message_id HAVING COUNT(*) > 1` — duplicatas indicam que dedup não está funcionando.

**Severity:** P1 sério — duplicatas visíveis para cliente (mensagem duplicada) e internamente (lead/cobrança duplicada).

---

### F24. Rate limit Meta atingido — fila sem throttle leva a ban de 24h

**Sintoma em produção:** Campanha de disparos envia mensagens mais rápido que 80 msg/s por número. Meta bloqueia o número por 24h. Todas as conversas daquele número ficam silenciosas — clientes não recebem resposta, atendentes não conseguem enviar.

**Causa raiz:** Sistema de disparo não implementa throttling — envia todas as mensagens da fila em burst. Taxa padrão do WhatsApp Business API é 80 msg/s (pode subir a 1000 msg/s em tier ilimitado). Exceder resulta em rate limit error (código 131056) que pode escalar para suspensão temporária do número.

**Prevenção:**
- Skill `evolution-go-whatsapp-integration` deve documentar:
  - Throttle obrigatório: max 70 msg/s (buffer de segurança vs limite de 80).
  - Implementar com `pgmq` (pg_queue) + cron job que processa a fila com rate limiting:
    ```sql
    -- cron: a cada segundo, processa no máximo 70 mensagens da fila
    SELECT cron.schedule('whatsapp-send', '* * * * *', $$
      SELECT pgmq.send_batch(
        'whatsapp_outbound',
        (SELECT ARRAY_AGG(msg) FROM pgmq.read('whatsapp_outbound', 60, 70) msg)
      );
    $$);
    ```
  - Backoff exponencial em rate limit error (código 131056) — não retente imediatamente.
  - Monitorar qualidade do número: rating "red" previne upgrade de tier e pode levar a downgrade.
- Agent `evolution-go-integrator` deve incluir throttle como componente obrigatório do queue design.

**Detecção tardia:** Verificar Evolution API logs por erros 131056 (rate limit). Verificar quality rating do número no Meta Business Manager — rating "yellow" ou "red" indica histórico de abuso de rate.

**Severity:** P0 para o número afetado — 24h sem comunicação WhatsApp é crítico para negócio de atendimento.

---

### F25. Phone number → tenant mapping ambíguo — número compartilhado

**Sintoma em produção:** Empresa tem 1 número WhatsApp para 2 departamentos (vendas + suporte). Webhook chega com mensagem de cliente — qual tenant/dept recebe? Sistema roteia para o errado, lead vai para pipeline errado, resposta automática é de contexto incorreto.

**Causa raiz:** Evolution API cria uma "instance" por número WhatsApp. Se arquitetura prevê compartilhamento de número entre múltiplos tenants/departments, não há mapping claro de `instance_name → tenant_id + dept_id`.

**Prevenção:**
- Skill `evolution-go-whatsapp-integration` deve documentar:
  - **Padrão recomendado**: 1 número WhatsApp por tenant (isolamento completo). Registrar `phone_number → org_id` em tabela `whatsapp_instances(instance_name, phone_number, org_id, dept_id)`.
  - Se compartilhamento é necessário: roteamento por palavra-chave inicial ("VENDAS" vs "SUPORTE") ou por contexto da conversa anterior.
  - Webhook handler SEMPRE verifica `instance_name` no payload e faz lookup de tenant:
    ```typescript
    const instance = payload.instance; // Evolution API inclui instance_name
    const { data: tenantMapping } = await supabase
      .from('whatsapp_instances')
      .select('org_id, dept_id')
      .eq('instance_name', instance)
      .single();
    if (!tenantMapping) throw new Error(`Unknown WhatsApp instance: ${instance}`);
    ```

**Detecção tardia:** `SELECT instance_name, COUNT(DISTINCT org_id) FROM whatsapp_instances GROUP BY instance_name HAVING COUNT(DISTINCT org_id) > 1` — instâncias mapeadas para múltiplos tenants.

**Severity:** P1 sério — dados de clientes roteados para tenant errado.

---

### F26. Conversation state stale — state machine não persistida

**Sintoma em produção:** Bot WhatsApp conduz fluxo de atendimento com múltiplos passos (coletando nome → CPF → motivo). Usuário fecha o WhatsApp e retorna 10 minutos depois. Bot reinicia do zero ("Olá! Qual seu nome?") — usuário já informou nome, fica frustrado. Ou pior: state em memória foi perdido e bot entra em estado inconsistente.

**Causa raiz:** Estado da conversa armazenado apenas em memória (variável no processo da Edge Function) ou em Redis com TTL muito curto. Edge Functions são stateless por design — cada invocação é independente.

**Prevenção:**
- Skill `whatsapp-conversation-state-machine` deve documentar:
  - Estado SEMPRE persistido em banco (`conversation_state` table):
    ```sql
    CREATE TABLE conversation_states (
      id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id         UUID REFERENCES organizations(id),
      phone_number   TEXT NOT NULL,
      current_state  TEXT NOT NULL,  -- 'collecting_name' | 'collecting_cpf' | 'completed'
      context        JSONB,           -- dados coletados até agora
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX conv_state_phone_org ON conversation_states(org_id, phone_number);
    ```
  - TTL de estado: configurar `pg_cron` para expirar conversas inativas > 24h (reset para `initial`).
  - State machine explícita com transições válidas documentadas — impede estados inválidos.

**Detecção tardia:** Verificar se `conversation_states` existe e tem dados recentes. Se ausente, state é in-memory ou ausente. Testar manualmente: iniciar conversa, aguardar 5min, retomar — verificar se contexto foi preservado.

**Severity:** P1 sério — UX péssima, frustração do cliente, perda de conversão.

---

## CATEGORIA G — CRM Pitfalls

### G27. Lead duplicado por phone/email — sem dedup key

**Sintoma em produção:** Mesmo cliente contacta empresa via WhatsApp (cria lead A) e preenche formulário web (cria lead B). Sales pipeline tem dois leads do mesmo prospect, vendedores trabalham em paralelo sem saber, cliente recebe duas ligações. Relatórios de conversão contam dobrado.

**Causa raiz:** Criação de lead não verifica existência prévia por `phone_number` ou `email`. Sem constraint UNIQUE ou dedup logic, cada canal cria lead independente.

**Prevenção:**
- Skill `crm-lead-pipeline-patterns` deve documentar dedup obrigatório:
  ```sql
  -- unique constraint composta por tenant
  ALTER TABLE leads ADD CONSTRAINT leads_org_phone_unique
    UNIQUE (org_id, phone_number) DEFERRABLE INITIALLY DEFERRED;
  ALTER TABLE leads ADD CONSTRAINT leads_org_email_unique
    UNIQUE (org_id, email) DEFERRABLE INITIALLY DEFERRED;
  ```
  - Para merge de leads duplicados: criar `lead_merge_log(primary_lead_id, merged_lead_id, merged_at)`.
  - Upsert pattern: `INSERT INTO leads(...) ON CONFLICT (org_id, phone_number) DO UPDATE SET last_contact_at = NOW()`.
- Agent `crm-pipeline-implementer` deve incluir unique constraints e upsert pattern por padrão.

**Detecção tardia:**
```sql
-- duplicatas por phone em mesma org
SELECT org_id, phone_number, COUNT(*) as count
FROM leads
GROUP BY org_id, phone_number
HAVING COUNT(*) > 1;
```

**Severity:** P2 incômodo — mas P1 se relatórios de negócio são usados para decisões financeiras.

---

### G28. Stage transition sem audit — lead vai de "qualified" para "won" sem rastro

**Sintoma em produção:** Manager pergunta "por que esse lead foi marcado como ganho antes de passar por demo?" — sem audit trail, impossível responder. Ou lead foi movido por engano e não há como reverter com contexto.

**Causa raiz:** Mudança de `stage` no lead é um simples UPDATE sem trigger de auditoria. Histórico de transições não é registrado.

**Prevenção:**
- Skill `crm-lead-pipeline-patterns` deve documentar trigger obrigatório:
  ```sql
  CREATE OR REPLACE FUNCTION audit_lead_stage_change()
  RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.stage != NEW.stage THEN
      INSERT INTO lead_stage_history(lead_id, from_stage, to_stage, changed_by, changed_at)
      VALUES (NEW.id, OLD.stage, NEW.stage, (SELECT auth.uid()), NOW());
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER lead_stage_audit
    AFTER UPDATE ON leads
    FOR EACH ROW
    WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
    EXECUTE FUNCTION audit_lead_stage_change();
  ```
- Agent `crm-pipeline-implementer` deve incluir esse trigger como parte da migration obrigatória de leads.

**Detecção tardia:** `SELECT COUNT(*) FROM leads WHERE stage != 'new'` vs `SELECT COUNT(*) FROM lead_stage_history` — se leads avançaram de stage mas history está vazio, audit está ausente.

**Severity:** P2 incômodo para relatórios, P1 se há disputas de comissão ou compliance de vendas.

---

### G29. Ownership transfer sem notificação — lead reassigned silenciosamente

**Sintoma em produção:** Manager reatribui lead de Vendedor A para Vendedor B. Vendedor A continua trabalhando no lead sem saber que foi transferido. Vendedor B não sabe que tem um novo lead. Cliente fica sem atendimento por dias.

**Causa raiz:** UPDATE em `leads.owner_id` sem notificação para owner antigo ou novo.

**Prevenção:**
- Skill `crm-lead-pipeline-patterns` deve documentar trigger de notificação:
  ```sql
  CREATE OR REPLACE FUNCTION notify_lead_ownership_change()
  RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      -- notificar via pg_notify (consome via Realtime ou worker)
      PERFORM pg_notify('lead_ownership_changed', json_build_object(
        'lead_id', NEW.id,
        'org_id', NEW.org_id,
        'from_owner', OLD.owner_id,
        'to_owner', NEW.owner_id,
        'changed_by', current_setting('app.current_user_id', true)
      )::text);
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
  - Edge Function consome `pg_notify` via Realtime e envia notificação in-app + email/WhatsApp.
- Agent `crm-pipeline-implementer` deve incluir esse trigger.

**Detecção tardia:** Verificar se existe trigger em `leads` para `owner_id` changes. Se ausente, transfers são silenciosos. `SELECT * FROM pg_trigger WHERE tgrelid = 'leads'::regclass` — se vazio de ownership triggers, issue confirmada.

**Severity:** P2 incômodo — leads perdidos por falta de handoff custam negócio real.

---

### G30. Lead deletado — pipeline activities órfãs

**Sintoma em produção:** Lead deletado por engano (ou por cleanup). Tabela `crm_activities` tem centenas de registros com `lead_id` apontando para lead inexistente — `ON DELETE` não definido, FK viola ou retorna NULL em JOINs. Relatórios de atividade ficam inconsistentes.

**Causa raiz:** FK `crm_activities.lead_id REFERENCES leads(id)` sem `ON DELETE` clause definida explicitamente. Comportamento default do Postgres é `NO ACTION` (erro ao deletar lead com activities). Developer força delete sem entender consequência.

**Prevenção:**
- Skill `crm-lead-pipeline-patterns` deve documentar decisão explícita:
  - **Se activities são históricas (manter):** `ON DELETE SET NULL` + `deleted_at TIMESTAMPTZ` em `leads` (soft delete).
  - **Se activities são descartáveis:** `ON DELETE CASCADE`.
  - Recomendação: **soft delete em leads** — nunca deletar fisicamente, usar `deleted_at`. Isso preserva o trail completo.
  ```sql
  -- soft delete recomendado
  ALTER TABLE leads ADD COLUMN deleted_at TIMESTAMPTZ;
  CREATE INDEX leads_active_idx ON leads(org_id) WHERE deleted_at IS NULL;
  -- todos os queries de negócio incluem WHERE deleted_at IS NULL
  ```
  - `ON DELETE CASCADE` apenas para dados verdadeiramente efêmeros (rascunhos, sessões).

**Detecção tardia:**
```sql
-- activities sem lead pai (FK violada ou SET NULL)
SELECT COUNT(*) FROM crm_activities ca
LEFT JOIN leads l ON l.id = ca.lead_id
WHERE l.id IS NULL AND ca.lead_id IS NOT NULL;
```

**Severity:** P2 incômodo — dados históricos perdidos, relatórios quebrados.

---

## CATEGORIA H — React Patterns Pitfalls

### H31. Org switcher race condition — resposta chega para org errada

**Sintoma em produção:** Usuário troca de Org X para Org Y rapidamente. Request para buscar dados da Org X ainda está em voo quando troca acontece. Response da Org X chega e popula o estado — usuário está vendo Org Y mas os dados exibidos são da Org X. Raro, mas quando acontece, é confuso e pode expor dados de org errada na tela.

**Causa raiz:** Múltiplos requests em flight sem cancelamento ao trocar de org. `useEffect` que busca dados não cancela requests anteriores.

**Prevenção:**
- Skill `org-switcher-react-pattern` deve documentar padrão com `AbortController`:
  ```typescript
  // hook com cancelamento de requests anteriores
  function useOrgData(orgId: string) {
    const [data, setData] = useState(null);

    useEffect(() => {
      const controller = new AbortController();

      fetchOrgData(orgId, { signal: controller.signal })
        .then(setData)
        .catch(err => {
          if (err.name === 'AbortError') return; // ignorar cancelamentos
          handleError(err);
        });

      return () => controller.abort(); // cleanup: cancela ao trocar org
    }, [orgId]);

    return data;
  }
  ```
  - Verificar `currentOrgId` antes de usar response: se `orgId !== currentOrgId` ao receber response, descartar dados.
  - Com React Query / TanStack Query: `queryKey: ['org-data', orgId]` — queries de org diferente ficam em cache separado e não conflitam.

**Detecção tardia:** Simular: trocar de org rapidamente 10 vezes enquanto página carrega — verificar no Network tab se requests são cancelados. Se não, race condition é potencial.

**Severity:** P2 incômodo em condições normais, P1 se exibe dados de org errada (confidencialidade).

---

### H32. Permission gate client-only — `<PermissionGate>` esconde UI mas API processa mesmo assim

**Sintoma em produção:** Usuário `viewer` da Org X não vê botão "Deletar Lead" na UI (PermissionGate funciona). Mas usuário descobre a API, faz `DELETE /api/leads/123` diretamente — API não verifica permissão server-side, executa delete. Security by obscurity.

**Causa raiz:** Developer implementa `<PermissionGate permission="leads.delete">` no frontend para esconder UI, mas Edge Function `/api/leads/[id]` não verifica permissão — assume que se chegou ao endpoint, usuário tem permissão.

**Prevenção:**
- Skill `permission-gate-react-pattern` deve ter WARNING em destaque: `<PermissionGate>` é UX, não segurança. **TODA** operação destrutiva ou privilegiada DEVE ter verificação server-side.
  ```typescript
  // Edge Function — verificação obrigatória server-side
  serve(async (req) => {
    const supabase = createAuthenticatedClient(req); // usa JWT do usuário
    const leadId = req.params.id;

    // verificar permissão server-side ANTES de executar
    const { data: hasPermission } = await supabase
      .rpc('has_permission', {
        p_user_id: userId,
        p_org_id: orgId,
        p_permission: 'leads.delete'
      });

    if (!hasPermission) {
      return new Response('Forbidden', { status: 403 });
    }

    // agora executar a operação
    await supabase.from('leads').delete().eq('id', leadId);
  });
  ```
- Agent `multi-tenant-rls-writer` deve incluir verificação de permissão em Edge Functions que escrevem dados.

**Detecção tardia:** Pegar JWT de um usuário `viewer`, usar Postman/curl para chamar endpoints de escrita — se retornar 200, server-side check está ausente.

**Severity:** P0 catastrófico se operações destrutivas ou de acesso cruzado não têm server-side check.

---

### H33. JWT stale após mudança de role — usuário com JWT antigo válido por 1h

**Sintoma em produção:** Admin promove usuário B de `viewer` para `admin`. Usuário B não faz logout/login. Pelo próximo 1h (TTL padrão do JWT Supabase), usuário B ainda tem JWT com `role: viewer` no `app_metadata`. Não consegue executar ações de admin mesmo após promoção. Ou: admin rebaixa usuário comprometido de `admin` para `viewer` — mas usuário comprometido ainda tem JWT válido de admin por até 1h.

**Causa raiz:** JWT é stateless — claims estão no token, não consultados no banco a cada request. Mudança de role no banco não invalida JWTs existentes. TTL padrão do access token Supabase é 1h (configurável mas não zero).

**Prevenção:**
- Skill `permission-gate-react-pattern` deve documentar estratégias:
  1. **Forçar refresh após role change**: ao alterar role de usuário, sinalizar via Realtime channel que o usuário deve refrescar token. No cliente:
     ```typescript
     // listener de role change via Realtime
     supabase.channel('role-changes')
       .on('broadcast', { event: 'role_updated' }, ({ payload }) => {
         if (payload.user_id === currentUser.id) {
           supabase.auth.refreshSession(); // força novo JWT com role atualizado
         }
       })
       .subscribe();
     ```
  2. **TTL reduzido**: configurar `JWT_EXPIRY` para 300s (5min) em vez de 3600s — tradeoff: mais refresh overhead vs janela menor de staleness.
  3. **Permission check server-side no banco** (não no JWT): função `has_permission()` que consulta `member_roles` table diretamente — ignora claims do JWT para autorização crítica.
- Opção 3 é a mais robusta mas tem custo de query extra por request. Recomendada para ações de alta criticidade (delete, billing).

**Detecção tardia:** Mudar role de usuário de test, aguardar 2min (sem logout), tentar ação privilegiada — se funciona com role antigo, JWT staleness é ativo.

**Severity:** P1 sério — janela de 1h onde revogação de privilégio não tem efeito imediato.

---

## CATEGORIA I — Performance Pitfalls Multi-Tenant

### I34. Connection pool sem Supavisor — cada tenant abre N conexões diretas

**Sintoma em produção:** Com 50 tenants simultâneos, cada rodando 5 queries paralelas = 250 conexões diretas ao Postgres. Postgres default `max_connections = 100`. Novas conexões falham com "FATAL: sorry, too many clients already". App para de responder.

**Causa raiz:** Usar connection string direta (`postgresql://...`) em vez da connection string via Supavisor (porta 6543 em transaction mode). Cada cliente abre conexão direta ao Postgres sem pooling.

**Prevenção:**
- Skill `multi-tenant-performance-scaling` deve documentar:
  - Sempre usar Supavisor (connection pooler): `postgresql://[user]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` (porta 6543 = transaction mode, porta 5432 = session mode).
  - Transaction mode para Edge Functions (stateless, sem prepared statements com nomes).
  - Session mode apenas para operações que precisam de estado de sessão (SET LOCAL, advisory locks).
  - Pool size configuração: default 10 por role/database/mode. Para multi-tenant com muitos tenants simultâneos, considerar aumentar via dashboard.
  - Supavisor pode escalar para 1M conexões externas → N conexões ao Postgres (N = pool_size configurado).

**Detecção tardia:** `SELECT COUNT(*) FROM pg_stat_activity` — se próximo de `max_connections`, pool está esgotando. Configurar alerta: `SELECT count FROM pg_stat_activity WHERE count > 80`.

**Severity:** P0 catastrófico — esgotamento de conexões para toda a app, não apenas um tenant.

---

### I35. N+1 queries multiplicadas por tenant — 100 tenants × 10 queries = 1000 queries

**Sintoma em produção:** Dashboard de admin lista 50 orgs. Para cada org, faz query separada para buscar `member_count`, `lead_count`, `message_count`. 50 orgs × 3 queries = 150 queries. Com RLS habilitado, cada query passa por evaluation de policy. Tempo de resposta: 5-15s.

**Causa raiz:** N+1 problem clássico amplificado pelo contexto multi-tenant. Em single-tenant, N+1 com 100 registros é ruim. Em multi-tenant com 100 orgs × 100 registros = 10.000 queries.

**Prevenção:**
- Skill `multi-tenant-performance-scaling` deve documentar:
  - Consolidar queries com JOINs ou subqueries:
    ```sql
    -- errado: N+1 (1 query por org para member_count)
    SELECT * FROM organizations; -- retorna 50 orgs
    -- depois: para cada org: SELECT COUNT(*) FROM org_members WHERE org_id = $1

    -- certo: tudo em uma query
    SELECT o.id, o.name,
           COUNT(DISTINCT om.user_id) AS member_count,
           COUNT(DISTINCT l.id) AS lead_count
    FROM organizations o
    LEFT JOIN org_members om ON om.org_id = o.id
    LEFT JOIN leads l ON l.org_id = o.id
    GROUP BY o.id, o.name;
    ```
  - Para super-admin dashboard com dados de TODOS os tenants: Materialized View atualizada periodicamente em vez de query em tempo real.
  - Usar `EXPLAIN ANALYZE` para identificar N+1 — buscar `Seq Scan` repetido na mesma tabela em plano de execução.

**Detecção tardia:** Monitorar com `pg_stat_statements`: `SELECT query, calls, total_exec_time FROM pg_stat_statements ORDER BY calls DESC LIMIT 20` — queries idênticas com alto `calls` indicam N+1.

**Severity:** P2 incômodo em pequena escala, P1 com muitos tenants ativos simultâneos.

---

### I36. RLS function não STABLE/IMMUTABLE — re-execução por linha

**Sintoma em produção:** Helper functions de RLS (`is_member_of_org()`, `get_user_tenant_id()`) definidas como VOLATILE (default). Com tabela de 10.000 rows e policy que usa essas functions, Postgres executa a function 10.000 vezes por query — uma vez por linha. Query que deveria levar 10ms leva 2s.

**Causa raiz:** Postgres reavalia funções VOLATILE a cada linha (assume que podem ter efeitos colaterais). Funções que apenas consultam dados de sessão ou fazem lookup estático podem ser marcadas como STABLE — Postgres as executa apenas uma vez por statement.

**Prevenção:**
- Skill `multi-tenant-rls-hierarchy` deve documentar: helper functions de RLS DEVEM ser `STABLE`:
  ```sql
  -- ERRADO: VOLATILE (default) — re-executa por linha
  CREATE OR REPLACE FUNCTION get_user_org_id()
  RETURNS UUID LANGUAGE sql AS $$
    SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
  $$;

  -- CERTO: STABLE — executa uma vez por statement
  CREATE OR REPLACE FUNCTION get_user_org_id()
  RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT org_id FROM org_members WHERE user_id = (SELECT auth.uid()) LIMIT 1;
  $$;

  -- MELHOR: usar set_config + current_setting para custo zero
  -- (tenant_id setado no início da request via Edge Function)
  CREATE OR REPLACE FUNCTION current_tenant_id()
  RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.tenant_id', true)::UUID;
  $$;
  ```
  - `IMMUTABLE`: apenas para funções que não acessam banco (puro cálculo). Não usar para lookups de dados.
  - `STABLE`: para funções que consultam dados mas retornam mesmo resultado dentro de uma transaction.

**Detecção tardia:** `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM leads WHERE org_id = current_tenant_id()` — se plano mostra `Function Scan` repetido ou high `actual time`, function é VOLATILE. Comparar com STABLE: diferença de 10-1000× em performance.

**Severity:** P1 sério — queries lentas em todas as operações multi-tenant em tabelas grandes.

---

## Padrões de Dívida Técnica

| Atalho | Benefício Imediato | Custo a Longo Prazo | Quando É Aceitável |
|--------|--------------------|---------------------|--------------------|
| Service role em Edge Functions | Elimina necessidade de passar JWT, código mais simples | Bypass de RLS — data leak entre tenants se filtro manual falhar | Nunca em funções user-facing; apenas em cron jobs com filtro explícito |
| RLS apenas com `user_id` (sem `org_id`) | Menos colunas, menos indexes | Funciona com 1 tenant, falha silenciosamente com 2+ | Nunca para dados multi-tenant |
| Audit log com payload completo | Fácil de implementar, rich context | PII em claro, conflito com LGPD erasure | Nunca para campos PII; apenas para IDs e metadados não-PII |
| `for all` em RLS (sem granularidade) | 1 policy em vez de 4 | Semântica confusa em UPDATE; difícil auditar | Nunca — já coberto em supabase-rls-policies skill |
| Deletar leads em vez de soft-delete | Schema mais limpo | Perde histórico de atividades, dificulta análise | MVP/demo apenas; nunca em prod com clientes reais |
| `DEFAULT opt-in` em consent | Maior taxa de consentimento | Ilegal LGPD Art. 8 | Nunca — zero exceções |
| Verificação de permissão apenas no frontend | Menos código backend, mais rápido de desenvolver | Security by obscurity — qualquer chamada direta à API bypassa | Nunca para operações destrutivas ou de acesso cross-tenant |

## Armadilhas de Integração

| Integração | Erro Comum | Abordagem Correta |
|------------|------------|-------------------|
| Meta / WhatsApp Cloud API | Não validar `X-Hub-Signature-256` | HMAC-SHA256 sobre raw body, antes de JSON.parse |
| Meta / WhatsApp Cloud API | Processar webhook síncrono (timeout > 5s) | Responder 200 imediatamente, enfileirar para processamento assíncrono |
| Meta / WhatsApp Cloud API | Sem dedup por `message_id` | Tabela `processed_webhooks` com UNIQUE em `message_id` |
| Evolution API | Instância global sem mapping tenant | Tabela `whatsapp_instances(instance_name → org_id)` com lookup em cada webhook |
| Supabase Auth | Hard delete de usuário quebra audit trail | Anonymization: update email/metadata, manter UUID |
| Vercel | Deploy em us-east-1 para dados de brasileiros | Configurar `regions: ["gru1"]` + DPA com Vercel para LGPD compliance |
| Supabase Realtime | Channel sem `private: true` para dados multi-tenant | Sempre `private: true` + RLS no canal = dados isolados por tenant |

## Armadilhas de Performance

| Armadilha | Sintomas | Prevenção | Quando Quebra |
|-----------|----------|-----------|---------------|
| RLS functions VOLATILE | Queries 10-1000× mais lentas em tabelas grandes | Marcar helpers como STABLE; usar `current_setting` | Com tabelas > 10k rows |
| Conexões diretas sem Supavisor | "too many clients" errors, 503s | Usar porta 6543 (Supavisor transaction mode) | Com 20+ tenants ativos simultâneos |
| N+1 × N tenants | Dashboard de admin leva 5-15s | JOINs consolidados, Materialized Views para super-admin | Com 10+ tenants × 50+ registros |
| Audit log sem índice (tenant_id, created_at) | Queries de compliance levam 30-60s | Índice composto obrigatório desde dia 1 | Com > 100k registros de audit |
| `WITH RECURSIVE` sem cycle guard | Timeout de banco, 504 em hierarquia | Trigger de cycle detection + CYCLE clause PG14+ | Qualquer ciclo introduzido |

## Erros de Segurança

| Erro | Risco | Prevenção |
|------|-------|-----------|
| Service role em funções user-facing | Bypass completo de RLS — dump de todos os tenants | NUNCA usar service_role em endpoints que recebem JWT de usuário |
| `<PermissionGate>` sem server-side check | Qualquer usuário pode chamar API diretamente | Verificação server-side em toda Edge Function que escreve dados |
| Invite token em query param | Token em logs Vercel, Referer, analytics | Token no path ou body; configurar log redaction |
| Super-admin sem audit obrigatório | Acesso cross-tenant sem rastreamento | Trigger de audit em TODA query de super-admin |
| Audit log com DELETE permission | Admin pode apagar evidências de suas próprias ações | REVOKE DELETE, UPDATE em audit_log para authenticated role |
| JWT stale após revogação de role | 1h de acesso após rebaixamento | Forçar refresh via Realtime ao mudar role |
| Sem HMAC validation em webhook WhatsApp | Injeção de mensagens fabricadas | Validar `X-Hub-Signature-256` obrigatoriamente |

## Checklist "Parece Pronto Mas Não Está"

- [ ] **RLS habilitado:** Toda tabela nova tem `ENABLE ROW LEVEL SECURITY` + policy com `org_id`. Verificar: `SELECT relname FROM pg_class WHERE relrowsecurity = false`
- [ ] **Isolamento testado com 2 tenants:** Criados 2 usuários em 2 orgs distintas; matrix 4 cenários executada antes de deploy
- [ ] **Service role auditado:** Nenhuma Edge Function user-facing usa `SERVICE_ROLE_KEY`
- [ ] **Webhook HMAC validado:** Endpoint WhatsApp valida `X-Hub-Signature-256` antes de processar
- [ ] **Webhook idempotente:** Tabela `processed_webhooks` com UNIQUE em `message_id`; resposta 200 imediata
- [ ] **RLS functions STABLE:** Helpers `is_member_of_org()`, `get_user_tenant_id()` têm `STABLE` ou usam `current_setting`
- [ ] **Consent opt-out por padrão:** Nenhum checkbox de consentimento com `defaultChecked=true`
- [ ] **Supabase em sa-east-1:** Projeto configurado na região São Paulo para LGPD compliance
- [ ] **Audit log append-only:** `REVOKE DELETE, UPDATE ON audit_log FROM authenticated`
- [ ] **Audit log sem PII em claro:** `metadata` JSONB não inclui `cpf`, `email`, `phone`, `name` em claro
- [ ] **Invite token single-use:** UPDATE atômico com `WHERE accepted_at IS NULL`
- [ ] **Dept member implica org member:** FK composta ou trigger de validação
- [ ] **Cycle detection em hierarquia dept:** Trigger antes de INSERT/UPDATE em `departments`
- [ ] **Conexão via Supavisor:** String de conexão usa porta 6543, não 5432 direto
- [ ] **DSR flow usa anonymization:** Delete de usuário anonimiza, não apaga; UUID preservado em audit trail

## Estratégias de Recuperação

| Armadilha | Custo de Recuperação | Passos de Recuperação |
|-----------|----------------------|----------------------|
| Tabela sem RLS descoberta em prod (A1) | HIGH | 1. Habilitar RLS imediatamente; 2. Auditoria de quais tenants viram dados de quem; 3. Notificação de incidente; 4. DPO LGPD notificar ANPD se dados sensíveis |
| Cross-tenant JOIN leak (A2) | MEDIUM | 1. Corrigir query/policy; 2. Identificar período de exposure; 3. Verificar se dados exibidos eram de contextos sensíveis |
| Service role em Edge Function (A4) | HIGH | 1. Substituir por client com JWT imediatamente; 2. Auditar logs de acesso para detectar queries sem filtro tenant_id; 3. Avaliar se leak ocorreu |
| Webhook sem HMAC (F22) | MEDIUM | 1. Adicionar validação; 2. Verificar logs por requests suspeitos sem signature válida; 3. Invalidar dados criados por webhooks não-autenticados |
| Rate limit Meta (F24) | MEDIUM | 1. Aguardar 24h para desbloqueio; 2. Implementar throttle; 3. Comunicar clientes sobre indisponibilidade; 4. Verificar quality rating do número |
| Connection pool esgotado (I34) | HIGH | 1. Matar conexões ociosas: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle'`; 2. Migrar para Supavisor; 3. Aumentar compute se necessário |
| PII em audit log (D17) | HIGH | 1. Criar migration para sanitizar campos PII existentes (pseudonymization); 2. Atualizar trigger para não capturar PII; 3. Documentar como base legal para dados já capturados |
| Sem consent válido (E19) | HIGH | 1. Recoletar consentimento de todos os usuários; 2. Suspender uso de dados de marketing até consentimento recoletado; 3. Documentar para ANPD |

## Mapeamento de Armadilhas por Fase (orientação para roadmapper)

| Armadilha | Severity | Fase de Prevenção Recomendada | Verificação |
|-----------|----------|-------------------------------|-------------|
| A1 — Tabela sem RLS | P0 | Schema/architecture phase (primeira fase) | `SELECT relname FROM pg_class WHERE relrowsecurity = false` |
| A4 — Service role user-facing | P0 | Architecture phase + gate CI | `grep SERVICE_ROLE_KEY supabase/functions/*` |
| H32 — Permission gate client-only | P0 | RLS + auth phase | Teste direto de API com viewer JWT |
| F22 — Webhook sem HMAC | P0 | Evolution Go integration phase | POST manual sem signature |
| F24 — Rate limit Meta | P0 | Evolution Go integration phase | Throttle configurado e documentado |
| I34 — Connection pool | P0 | Architecture phase | String de conexão usa porta 6543 |
| B8 — Cycle detection dept | P0 | Schema phase | Trigger instalado; teste de ciclo |
| A2 — JOIN cross-tenant | P1 | RLS phase | Test matrix cross-tenant com JOINs |
| A3 — Super-admin sem audit | P1 | Super-admin phase | Audit trigger present; test log entry |
| A5 — RLS com 1 tenant | P1 | Test phase (early) | 2-tenant matrix executada |
| B6 — Dept sem org member | P1 | Schema phase | FK composta ou trigger instalado |
| B7 — Permission inheritance | P1 | RBAC design phase | Decision documentada e testada |
| C10 — Token replay | P1 | Invite flow phase | UPDATE atômico; load test de concorrência |
| C11 — Token em URL | P1 | Invite flow phase | Verificar que token não está em query param |
| C13 — Invite para usuário deletado | P1 | Invite flow phase | Verificar vinculação por UUID, não email |
| D14 — Audit sem índice | P1 | Audit log phase | EXPLAIN ANALYZE em query de compliance |
| D15 — Retention sem legal hold | P1 | Audit log phase | Job de retenção tem cláusula legal_hold |
| D16 — Tampering audit | P1 | Audit log phase | `has_table_privilege('authenticated', 'audit_log', 'delete')` = false |
| D17 — PII em audit log | P1 | Audit log phase | Amostra de metadata JSONB sem PII |
| E18 — DSR quebra audit trail | P1 | LGPD compliance phase | DSR flow usa anonymization |
| E19 — Consent opt-in | P1 | Onboarding phase | Code review: nenhum checkbox pré-marcado |
| E20 — Export incompleto | P1 | LGPD compliance phase | Inventário PII via INFORMATION_SCHEMA |
| E21 — Cross-border sem base legal | P1 | Architecture phase | Supabase region = sa-east-1; DPA documentado |
| F23 — Webhook duplicado | P1 | Evolution Go phase | Test de retry: 2 posts idênticos = 1 processamento |
| F25 — Phone → tenant ambíguo | P1 | Evolution Go phase | Tabela whatsapp_instances com mapping único |
| F26 — State machine stale | P1 | WhatsApp bot phase | Conversation_states table; TTL configurado |
| H31 — Org switcher race | P1/P2 | React patterns phase | AbortController em useEffect; test rápido de switch |
| H33 — JWT stale | P1 | Auth phase | Refresh via Realtime após role change |
| I36 — RLS functions VOLATILE | P1 | Performance phase | `EXPLAIN ANALYZE` mostra function uma vez |
| G27 — Lead duplicate | P2 | CRM phase | UNIQUE constraint instalada |
| G28 — Stage sem audit | P2 | CRM phase | Trigger de stage_history present |
| G29 — Ownership sem notificação | P2 | CRM phase | Trigger de pg_notify instalado |
| G30 — Lead deletado orphans | P2 | CRM phase | Soft delete; ON DELETE defined |
| B9 — Member zero roles | P2 | RBAC phase | Trigger de cleanup de membership |
| C12 — Email enumeration | P2 | Invite flow phase | Mesma resposta para email exist/not-exist |
| I35 — N+1 × tenants | P2 | Performance phase | EXPLAIN ANALYZE dashboard queries |

## Fontes

- [Meta Developers — Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)
- [Meta Developers — Messaging Limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- [Evolution API Documentation — Webhooks](https://doc.evolution-api.com/v2/en/configuration/webhooks)
- [Supabase — RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase — Supavisor Scaling to 1M Connections](https://supabase.com/blog/supavisor-1-million)
- [Splinter Linter — 0001 RLS Enabled on Table](https://supabase.github.io/splinter/0001_rls_enabled_on_table/)
- [AWS — Multi-tenant Data Isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Hookdeck — WhatsApp Webhooks Guide](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- [ANPD — Resolução CD/ANPD No. 19/2024 — International Data Transfers](https://www.mydata-trust.com/2025/08/19/brazil-data-transfers-deadline/)
- [Mayer Brown — Brazil-EU Adequacy Decision 2026](https://www.mayerbrown.com/en/insights/publications/2026/02/a-new-era-for-personal-data-transfers-brazil-and-european-union-establish-mutual-adequacy-decision)
- [LGPD Brazil — Art. 8, 16, 18, 33, 37](https://lgpd-brazil.info/)
- [Medium — Handling Duplicate Webhooks WhatsApp Redis](https://medium.com/@nkangprecious26/handling-duplicate-webhooks-in-whatsapp-api-using-redis-d7d117731f95)
- [Permit.io — Postgres RLS Implementation Guide](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Frontegg — Securing Multi-Tenant SaaS Credentials](https://frontegg.com/blog/how-to-secure-user-credentials-on-multi-tenant-saas-applications)

---
*Pesquisa de armadilhas para: Multi-Tenant SaaS B2B — React + Supabase + Vercel*
*Pesquisado: 2026-05-10*

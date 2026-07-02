// DIR-05 (multi-projeto como produto) — parser puro do registro canônico
// PROJETOS.md criado pelo comando /base (kit/commands/base.md, v1.45.0).
//
// Formato esperado (template da regra global em ~/.claude/CLAUDE.md):
//
//   ## Projeto principal: <nome>
//
//   - **Pasta local do projeto** (obrigatório): `<caminho absoluto>`
//   - **Repositório do projeto** (obrigatório): <URL>
//   - **Documentação local** (obrigatório): `<pasta docs/ ou cofre Obsidian>`
//   - **Repositório da documentação** (opcional): <URL ou "—">
//   - **Infra / VPS** (opcional): <hosts ou "—">
//   - **Notas** (opcional): <texto ou "—">
//
//   ## Projetos conectados
//
//   ### <nome do projeto conectado>
//   - (mesmos 6 campos)
//
// Contrato deste módulo: FUNÇÃO PURA, SEM I/O. Recebe o markdown como string e
// devolve estrutura normalizada + issues de validação estática (obrigatórios
// presentes/não-vazios/não-placeholder, shape https?:// das URLs). A existência
// dos paths no disco NÃO é validada aqui — isso é responsabilidade da action
// doctor da MCP tool `projects` (src/mcp-server/index.js), que tem fs.

/** Chaves normalizadas dos 3 campos obrigatórios do schema. */
export const REQUIRED_FIELDS = ['pasta_local', 'repositorio', 'documentacao_local'];

/** Chaves normalizadas dos 3 campos opcionais do schema. */
export const OPTIONAL_FIELDS = ['repositorio_documentacao', 'infra_vps', 'notas'];

// Mapa label-do-bullet → chave normalizada. As labels são comparadas sem
// acentos e em lowercase (via stripDiacritics) para tolerar edições manuais
// sem acento ("Repositorio do projeto") e variações de caixa.
const FIELD_LABELS = {
  'pasta local do projeto':       'pasta_local',
  'repositorio do projeto':       'repositorio',
  'documentacao local':           'documentacao_local',
  'repositorio da documentacao':  'repositorio_documentacao',
  'infra / vps':                  'infra_vps',
  'notas':                        'notas',
};

function stripDiacritics(s) {
  // Faixa de combining marks U+0300–U+036F (acentos decompostos pelo NFD).
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Remove backticks/aspas envolventes e trim. `D:\x` → D:\x ; "x" → x.
function unwrapValue(raw) {
  let v = String(raw ?? '').trim();
  const wrappers = [['`', '`'], ['"', '"'], ["'", "'"]];
  for (const [open, close] of wrappers) {
    if (v.length >= 2 && v.startsWith(open) && v.endsWith(close)) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}

/**
 * Um valor conta como vazio quando é '', travessão ('—'/'-') ou placeholder
 * de template intacto (ex.: '<caminho absoluto>', '<URL>', '<URL ou "—">').
 * @param {string} value - Valor já normalizado (unwrapValue).
 * @returns {boolean} true quando o campo deve ser tratado como não preenchido.
 */
export function isPlaceholderValue(value) {
  const v = String(value ?? '').trim();
  if (v === '' || v === '—' || v === '-') return true;
  return /^<[^>]*>$/.test(v);
}

/**
 * Shape mínimo de URL de repositório aceito pelo schema: https?://<algo>.
 * Não faz DNS nem HTTP — validação puramente sintática.
 * @param {string} value - Candidato a URL.
 * @returns {boolean} true quando o valor tem shape http(s)://.
 */
export function isValidRepoUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value ?? '').trim());
}

function newProject(nome, principal) {
  return {
    nome,
    principal,
    campos: {
      pasta_local: null,
      repositorio: null,
      documentacao_local: null,
      repositorio_documentacao: null,
      infra_vps: null,
      notas: null,
    },
    completo: false,
    faltantes: [],
  };
}

// Valida um projeto in-place (completo/faltantes) e acumula issues.
function validateProject(project, issues) {
  for (const field of REQUIRED_FIELDS) {
    if (project.campos[field] === null) {
      project.faltantes.push(field);
      issues.push({
        projeto: project.nome,
        campo: field,
        code: 'campo_obrigatorio_vazio',
        message: `Campo obrigatório vazio ou placeholder: ${field}`,
      });
    }
  }
  let repoUrlOk = true;
  for (const field of ['repositorio', 'repositorio_documentacao']) {
    const v = project.campos[field];
    if (v !== null && !isValidRepoUrl(v)) {
      if (field === 'repositorio') repoUrlOk = false;
      issues.push({
        projeto: project.nome,
        campo: field,
        code: 'url_invalida',
        message: `URL sem shape https?:// em ${field}: ${v}`,
      });
    }
  }
  project.completo = project.faltantes.length === 0 && repoUrlOk;
}

/**
 * Parseia o conteúdo markdown de um PROJETOS.md no shape canônico.
 *
 * Função pura — sem fs, sem rede. Placeholders de template e '—' viram null;
 * a validação estática (obrigatórios + shape de URL) alimenta `issues`.
 *
 * @param {string} markdown - Conteúdo do PROJETOS.md (CRLF ou LF).
 * @returns {{ principal: object|null, conectados: object[], issues: object[] }}
 *   principal/conectados têm { nome, principal, campos, completo, faltantes };
 *   issues têm { projeto, campo, code, message }.
 */
export function parseProjects(markdown) {
  const issues = [];
  let principal = null;
  const conectados = [];

  const text = typeof markdown === 'string' ? markdown : '';
  // section: onde bullets devem ser anexados — null | 'principal' | 'conectados' | 'outra'
  let section = null;
  let current = null; // projeto recebendo bullets

  for (const line of text.split(/\r?\n/)) {
    const h2Principal = line.match(/^##\s+Projeto principal:\s*(.+?)\s*$/);
    if (h2Principal) {
      section = 'principal';
      current = newProject(h2Principal[1], true);
      if (principal === null) {
        principal = current;
      } else {
        // Segunda seção principal — registra e ignora (a primeira prevalece).
        issues.push({
          projeto: h2Principal[1],
          campo: null,
          code: 'projeto_principal_duplicado',
          message: `Mais de uma seção '## Projeto principal:' — '${h2Principal[1]}' ignorado`,
        });
        current = null;
      }
      continue;
    }
    if (/^##\s+Projetos conectados\s*$/.test(line)) {
      section = 'conectados';
      current = null;
      continue;
    }
    if (/^##\s+/.test(line)) {
      // Qualquer outro H2 encerra a seção corrente.
      section = 'outra';
      current = null;
      continue;
    }
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      if (section === 'conectados') {
        current = newProject(h3[1], false);
        conectados.push(current);
      } else {
        current = null; // H3 fora de 'Projetos conectados' não é projeto
      }
      continue;
    }
    if (!current) continue;
    // Bullet de campo: - **Label** (obrigatório|opcional): valor
    const bullet = line.match(/^-\s+\*\*(.+?)\*\*\s*(?:\((?:obrigat[oó]rio|opcional)\))?\s*:\s*(.*)$/);
    if (!bullet) continue;
    const key = FIELD_LABELS[stripDiacritics(bullet[1]).toLowerCase().trim()];
    if (!key) continue; // label fora do schema — ignorada
    const value = unwrapValue(bullet[2]);
    current.campos[key] = isPlaceholderValue(value) ? null : value;
  }

  if (principal === null) {
    issues.push({
      projeto: null,
      campo: null,
      code: 'sem_projeto_principal',
      message: "Nenhuma seção '## Projeto principal: <nome>' encontrada no registro",
    });
  } else {
    validateProject(principal, issues);
  }
  for (const p of conectados) validateProject(p, issues);

  return { principal, conectados, issues };
}

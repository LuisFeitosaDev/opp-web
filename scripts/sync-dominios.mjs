/**
 * Sincroniza os domínios (combos) do OPP a partir do banco do SysPlan Web.
 *
 *   npm run sync:dominios
 *
 * Origem (SysPlan):
 *   - prm_combos          → CANAL, GRIFFE, FORNECEDOR, SEXO, SUB GRUPO, ATRIBUTO 1/2
 *   - prm_grupo           → GRUPO
 *   - prm_grupo_planejamento → GRUPO_PLANEJAMENTO
 *
 * Destino (OPP): tabela dominios (tipo, valor) — insere apenas o que não
 * existe (on_conflict ignore); nada é apagado ou desativado aqui.
 * Credenciais em .env.migration (nunca vão para o navegador).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// parse simples do .env.migration (sem dependências)
const env = {};
for (const linha of readFileSync(resolve(raiz, '.env.migration'), 'utf8').split('\n')) {
  const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && !linha.trim().startsWith('#')) env[m[1]] = m[2];
}

const OPP_URL = env.OPP_SUPABASE_URL;
const OPP_KEY = env.OPP_SERVICE_ROLE_KEY;
const SYS_URL = env.SYSPLAN_SUPABASE_URL;
const SYS_KEY = env.SYSPLAN_SERVICE_ROLE_KEY;

if (!OPP_URL || !OPP_KEY || !SYS_URL || !SYS_KEY) {
  console.error('Preencha OPP_* e SYSPLAN_* no .env.migration');
  process.exit(1);
}

async function rest(base, key, caminho, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${caminho}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${caminho}: HTTP ${res.status} — ${await res.text()}`);
  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

/** Busca todas as linhas paginando (PostgREST limita 1000 por request) */
async function buscarTudo(base, key, caminho) {
  const todas = [];
  for (let offset = 0; ; offset += 1000) {
    const pagina = await rest(base, key, `${caminho}${caminho.includes('?') ? '&' : '?'}limit=1000&offset=${offset}`);
    todas.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return todas;
}

// ---------------------------------------------------------------------
// 1. Lê a origem (SysPlan)
// ---------------------------------------------------------------------
console.log('Lendo combos do SysPlan...');
const [combos, grupos, gruposPlan] = await Promise.all([
  buscarTudo(SYS_URL, SYS_KEY, 'prm_combos?select=dc_tipo_combo,dc_combo'),
  buscarTudo(SYS_URL, SYS_KEY, 'prm_grupo?select=dc_grupo'),
  buscarTudo(SYS_URL, SYS_KEY, 'prm_grupo_planejamento?select=dc_grupo_planejamento'),
]);
console.log(`  prm_combos: ${combos.length} linhas | prm_grupo: ${grupos.length} | prm_grupo_planejamento: ${gruposPlan.length}`);

// ---------------------------------------------------------------------
// 2. Mapeia tipo SysPlan → tipo OPP e remove duplicados/vazios
// ---------------------------------------------------------------------
const MAPA_TIPO = {
  'CANAL': 'CANAL',
  'GRIFFE': 'GRIFFE',
  'FORNECEDOR': 'FORNECEDOR',
  'SEXO': 'SEXO',
  'SUB GRUPO': 'SUBGRUPO',
  'ATRIBUTO 1': 'ATRIBUTO_1',
  'ATRIBUTO 2': 'ATRIBUTO_2',
};

const conjunto = new Map(); // `${tipo}|${valor}` -> {tipo, valor}
const adiciona = (tipo, valor) => {
  const v = String(valor ?? '').trim().toUpperCase();
  if (!v) return;
  conjunto.set(`${tipo}|${v}`, { tipo, valor: v });
};

for (const c of combos) {
  const tipo = MAPA_TIPO[c.dc_tipo_combo];
  if (tipo) adiciona(tipo, c.dc_combo);
}
for (const g of grupos) adiciona('GRUPO', g.dc_grupo);
for (const gp of gruposPlan) adiciona('GRUPO_PLANEJAMENTO', gp.dc_grupo_planejamento);

const linhas = [...conjunto.values()];
const porTipo = {};
for (const l of linhas) porTipo[l.tipo] = (porTipo[l.tipo] ?? 0) + 1;
console.log('Valores distintos a sincronizar:', porTipo);

// ---------------------------------------------------------------------
// 3. Insere no OPP (ignora duplicados pela unique tipo+valor)
// ---------------------------------------------------------------------
for (let i = 0; i < linhas.length; i += 500) {
  const lote = linhas.slice(i, i + 500);
  await rest(OPP_URL, OPP_KEY, 'dominios?on_conflict=tipo,valor', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(lote),
  });
}

const depois = await buscarTudo(OPP_URL, OPP_KEY, 'dominios?select=tipo');
const totalPorTipo = {};
for (const d of depois) totalPorTipo[d.tipo] = (totalPorTipo[d.tipo] ?? 0) + 1;

console.log('\nSincronização concluída ✔');
console.log(`Total de domínios no OPP: ${depois.length}`);
console.log('Por tipo:', totalPorTipo);

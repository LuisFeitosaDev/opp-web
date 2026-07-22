/**
 * Espelha os PRMs do SysPlan Web no banco do OPP (reflexo 1:1).
 *
 *   npm run sync:prm
 *
 * Copia prm_grupo, prm_combos e prm_grupo_planejamento do SysPlan para o
 * OPP, apagando o conteúdo anterior — inclusões, alterações e exclusões
 * feitas no SysPlan são refletidas integralmente. No OPP essas tabelas são
 * somente leitura (sem política de escrita no RLS); apenas este script
 * (service_role) as atualiza. Credenciais em .env.migration.
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

async function inserirLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += 500) {
    await rest(OPP_URL, OPP_KEY, tabela, {
      method: 'POST',
      body: JSON.stringify(linhas.slice(i, i + 500)),
      headers: { Prefer: 'return=minimal' },
    });
  }
}

// ---------------------------------------------------------------------
// 1. Lê tudo do SysPlan
// ---------------------------------------------------------------------
console.log('Lendo PRMs do SysPlan...');
const [grupos, combos, gruposPlan] = await Promise.all([
  buscarTudo(SYS_URL, SYS_KEY, 'prm_grupo?select=cd_grupo,dc_grupo&order=cd_grupo'),
  buscarTudo(SYS_URL, SYS_KEY, 'prm_combos?select=cd_combo,cd_grupo,dc_tipo_combo,dc_combo&order=cd_combo'),
  buscarTudo(SYS_URL, SYS_KEY, 'prm_grupo_planejamento?select=dc_grupo,dc_subgrupo,dc_sexo,dc_formato,dc_grupo_planejamento'),
]);
console.log(`  prm_grupo: ${grupos.length} | prm_combos: ${combos.length} | prm_grupo_planejamento: ${gruposPlan.length}`);

// ---------------------------------------------------------------------
// 2. Espelha no OPP (apaga e recarrega, respeitando as FKs)
// ---------------------------------------------------------------------
console.log('Espelhando no OPP...');
await rest(OPP_URL, OPP_KEY, 'prm_combos?cd_combo=gte.-2147483648', { method: 'DELETE' });
await rest(OPP_URL, OPP_KEY, 'prm_grupo_planejamento?dc_grupo=neq.__nunca__', { method: 'DELETE' });
await rest(OPP_URL, OPP_KEY, 'prm_grupo?cd_grupo=gte.-2147483648', { method: 'DELETE' });

await inserirLotes('prm_grupo', grupos);
await inserirLotes('prm_combos', combos);
await inserirLotes('prm_grupo_planejamento', gruposPlan);

// ---------------------------------------------------------------------
// 3. Confere
// ---------------------------------------------------------------------
const tipos = {};
for (const c of combos) tipos[c.dc_tipo_combo] = (tipos[c.dc_tipo_combo] ?? 0) + 1;

console.log('\nEspelho concluído ✔');
console.log(`prm_grupo: ${grupos.length} grupos —`, grupos.map((g) => g.dc_grupo).join(', '));
console.log(`prm_combos: ${combos.length} linhas por tipo:`, tipos);
console.log(`prm_grupo_planejamento: ${gruposPlan.length} combinações`);

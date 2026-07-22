-- =====================================================================
-- AJUSTE: espelho dos PRMs do SysPlan (rodar no SQL Editor do OPP)
-- Os combos passam a ser um reflexo 1:1 do SysPlan Web — toda alteração
-- é feita exclusivamente lá; o OPP apenas consome (via npm run sync:prm).
-- =====================================================================

-- Espelho de prm_grupo (ids preservados do SysPlan; GERAL = cd_grupo 2)
create table if not exists prm_grupo (
  cd_grupo integer primary key,
  dc_grupo text not null unique
);

-- Espelho de prm_combos (subgrupo, atributos, canal, griffe... por grupo)
create table if not exists prm_combos (
  cd_combo integer primary key,
  cd_grupo integer not null references prm_grupo (cd_grupo),
  dc_tipo_combo text not null,
  dc_combo text not null
);
create index if not exists idx_prm_combos_tipo on prm_combos (cd_grupo, dc_tipo_combo);

-- Espelho de prm_grupo_planejamento
create table if not exists prm_grupo_planejamento (
  dc_grupo text not null,
  dc_subgrupo text not null,
  dc_sexo text not null,
  dc_formato text not null,
  dc_grupo_planejamento text,
  primary key (dc_grupo, dc_subgrupo, dc_sexo, dc_formato)
);

-- RLS: somente leitura para usuários autenticados.
-- NÃO há política de escrita — nem admin altera pelo app; apenas o
-- service_role (script de sincronização) grava, pois ignora RLS.
alter table prm_grupo enable row level security;
alter table prm_combos enable row level security;
alter table prm_grupo_planejamento enable row level security;

drop policy if exists prm_grupo_sel on prm_grupo;
drop policy if exists prm_combos_sel on prm_combos;
drop policy if exists prm_gp_sel on prm_grupo_planejamento;

create policy prm_grupo_sel on prm_grupo for select to authenticated using (true);
create policy prm_combos_sel on prm_combos for select to authenticated using (true);
create policy prm_gp_sel on prm_grupo_planejamento for select to authenticated using (true);

-- A tabela dominios sai de cena (substituída pelos espelhos)
drop table if exists dominios;

-- Nome da tela de parâmetros reflete a nova função (visualização)
update telas set nome = 'Parâmetros (SysPlan)' where codigo = 'admin_parametros';

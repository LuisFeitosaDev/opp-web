-- =====================================================================
-- AJUSTE: etapa acompanha as datas "de trás para frente"
-- (rodar no SQL Editor do OPP)
-- A etapa atual passa a ser a etapa MAIS AVANÇADA que tenha qualquer
-- data preenchida — ex.: preencheu qualquer data de protótipo, a demanda
-- está em PROTOTIPO, mesmo sem aprovação do desenho técnico.
-- =====================================================================

create or replace function fn_calcula_etapa(d demandas) returns text
language sql immutable as $$
  select case
    when d.status = 'ENCERRADO' then 'ENCERRADA'
    when d.solicitacao_sf is not null
      or d.recebimento_foto_sf is not null
      or d.recebimento_fisico_sf is not null
      or d.aprovacao_licenca_sf is not null
      then 'SET_FINAL'
    when d.solicitacao_cs is not null
      or d.recebimento_foto_cs is not null
      or d.recebimento_fisico_cs is not null
      or d.aprovacao_cs is not null
      or d.aprovacao_licenca_cs is not null
      then 'COLOR_SAMPLE'
    when d.solicitacao_prototipo is not null
      or d.recebimento_prototipo is not null
      or d.aprovacao_prototipo is not null
      or d.aprovacao_licenca_proto is not null
      then 'PROTOTIPO'
    when d.recebimento_dt is not null
      or d.aprovacao_dt is not null
      then 'DESENHO_TECNICO'
    when d.desenvolvimento is not null
      or d.aprovacao_desenvolvimento is not null
      or d.envio_desenvolvimento is not null
      then 'DESENVOLVIMENTO'
    else 'MIX'
  end;
$$;

-- Recalcula a etapa de todas as demandas existentes com a regra nova
-- (o trigger before update refaz o cálculo linha a linha)
update demandas set etapa_atual = etapa_atual;

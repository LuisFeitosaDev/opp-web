// =====================================================================
// Tipos das entidades do OPP (espelham o supabase/schema.sql)
// =====================================================================

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'usuario';
  bloqueado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Tela {
  codigo: string;
  nome: string;
  grupo: string;
  ordem: number;
}

export interface Permissao {
  usuario_id: string;
  tela_codigo: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
}

export interface LogTransacao {
  cd_transacao: number;
  usuario_id: string | null;
  transacao: string;
  cd_item_transacao: number;
  dt_transacao: string;
  info_anterior: string | null;
  info_atual: string | null;
  campo_editado: string | null;
}

export interface Dominio {
  cd_dominio: number;
  tipo: string;
  valor: string;
  ordem: number;
  ativo: boolean;
}

export type StatusDemanda = 'ATIVO' | 'ENCERRADO' | 'CANCELADO' | 'EXCLUIDO';

export type Etapa =
  | 'MIX'
  | 'DESENVOLVIMENTO'
  | 'DESENHO_TECNICO'
  | 'PROTOTIPO'
  | 'COLOR_SAMPLE'
  | 'SET_FINAL'
  | 'ENCERRADA';

export const ETAPAS: Etapa[] = [
  'MIX', 'DESENVOLVIMENTO', 'DESENHO_TECNICO', 'PROTOTIPO', 'COLOR_SAMPLE', 'SET_FINAL', 'ENCERRADA',
];

export const ETAPA_LABEL: Record<Etapa, string> = {
  MIX: 'Mix',
  DESENVOLVIMENTO: 'Desenvolvimento',
  DESENHO_TECNICO: 'Desenho Técnico',
  PROTOTIPO: 'Protótipo',
  COLOR_SAMPLE: 'Color Sample',
  SET_FINAL: 'Set Final',
  ENCERRADA: 'Encerrada',
};

/** Cores dos chips de etapa (classes Tailwind) */
export const ETAPA_COR: Record<Etapa, string> = {
  MIX: 'bg-blue-600 text-white',
  DESENVOLVIMENTO: 'bg-purple-700 text-white',
  DESENHO_TECNICO: 'bg-yellow-500 text-black',
  PROTOTIPO: 'bg-orange-600 text-white',
  COLOR_SAMPLE: 'bg-lime-700 text-white',
  SET_FINAL: 'bg-green-800 text-white',
  ENCERRADA: 'bg-slate-500 text-white',
};

/**
 * Demanda de desenvolvimento (tabela larga — classificação + datas de todas
 * as etapas, no padrão do controle_compras do SysPlan).
 */
export interface Demanda {
  cd_demanda: number;

  // Classificação
  canal: string | null;
  griffe: string | null;
  grupo: string | null;
  subgrupo: string | null;
  fornecedor: string | null;
  grupo_planejamento: string | null;
  sexo: string | null;
  atributo_1: string | null;
  atributo_2: string | null;
  preco_varejo: number | null;
  lente_antecipada: boolean;

  // Códigos
  cod_1: string | null;
  cod_2: string | null;
  cod_3_licenca: string | null;
  sku: string | null;
  data_compra: string | null;

  // Controle
  status: StatusDemanda;
  etapa_atual: Etapa;
  ficha_url: string | null;

  // MIX
  recebimento_mix: string | null;
  selecao_amostras: string | null;
  aprovacao_mix: string | null;

  // DESENVOLVIMENTO
  desenvolvimento: string | null;
  aprovacao_desenvolvimento: string | null;
  envio_desenvolvimento: string | null;

  // DESENHO TÉCNICO
  recebimento_dt: string | null;
  aprovacao_dt: string | null;
  comentarios_dt: string | null;

  // PROTÓTIPO
  solicitacao_prototipo: string | null;
  recebimento_prototipo: string | null;
  aprovacao_prototipo: string | null;
  aprovacao_licenca_proto: string | null;
  comentarios_proto: string | null;

  // COLOR SAMPLE
  solicitacao_cs: string | null;
  recebimento_foto_cs: string | null;
  recebimento_fisico_cs: string | null;
  aprovacao_cs: string | null;
  aprovacao_licenca_cs: string | null;
  comentarios_cs: string | null;

  // SET FINAL
  solicitacao_sf: string | null;
  recebimento_foto_sf: string | null;
  recebimento_fisico_sf: string | null;
  aprovacao_licenca_sf: string | null;
  comentarios_sf: string | null;

  // LICENÇA GERAL
  comentarios_licenca: string | null;

  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Tipos de domínio (combos) do OPP */
export const TIPOS_DOMINIO = [
  'CANAL', 'GRIFFE', 'GRUPO', 'SUBGRUPO', 'FORNECEDOR',
  'GRUPO_PLANEJAMENTO', 'ATRIBUTO_1', 'ATRIBUTO_2', 'SEXO',
] as const;

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PencilRuler, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GRUPO_GERAL, useCombos, useGrupos, useGruposPlanejamento } from '@/services/combos';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { Input, Label, Select } from '@/components/ui/input';

/**
 * Edição em massa direto na lista: seleciona as linhas, escolhe o campo e o
 * novo valor. Os combos são o reflexo do SysPlan; campos que dependem do
 * grupo (subgrupo, atributos, grupo planejamento) só ficam disponíveis
 * quando todas as linhas selecionadas são do mesmo grupo.
 * Cada alteração é auditada campo a campo pelo trigger do banco.
 */
interface CampoMassa {
  campo: string;
  label: string;
  tipo: 'texto' | 'numero' | 'data' | 'combo' | 'simnao' | 'grupoplan';
  /** Tipo do combo no prm_combos (ex.: 'CANAL', 'SUB GRUPO') */
  comboTipo?: string;
  /** Combo filtrado pelo grupo das linhas selecionadas (exige grupo único) */
  porGrupo?: boolean;
  /** Opções fixas (ex.: status) */
  opcoesFixas?: string[];
}

const CAMPOS: CampoMassa[] = [
  { campo: 'canal', label: 'Canal', tipo: 'combo', comboTipo: 'CANAL' },
  { campo: 'griffe', label: 'Griffe', tipo: 'combo', comboTipo: 'GRIFFE' },
  { campo: 'subgrupo', label: 'Subgrupo', tipo: 'combo', comboTipo: 'SUB GRUPO', porGrupo: true },
  { campo: 'fornecedor', label: 'Fornecedor', tipo: 'combo', comboTipo: 'FORNECEDOR' },
  { campo: 'grupo_planejamento', label: 'Grupo Planejamento', tipo: 'grupoplan' },
  { campo: 'sexo', label: 'Sexo', tipo: 'combo', comboTipo: 'SEXO' },
  { campo: 'atributo_1', label: 'Atributo 1', tipo: 'combo', comboTipo: 'ATRIBUTO 1', porGrupo: true },
  { campo: 'atributo_2', label: 'Atributo 2', tipo: 'combo', comboTipo: 'ATRIBUTO 2', porGrupo: true },
  { campo: 'preco_varejo', label: 'Preço Varejo', tipo: 'numero' },
  { campo: 'lente_antecipada', label: 'Lente Antecipada', tipo: 'simnao' },
  { campo: 'cod_1', label: '1º Código', tipo: 'texto' },
  { campo: 'cod_2', label: '2º Código', tipo: 'texto' },
  { campo: 'cod_3_licenca', label: '3º Código (Licença)', tipo: 'texto' },
  { campo: 'sku', label: 'SKU', tipo: 'texto' },
  { campo: 'data_compra', label: 'Data de Compra', tipo: 'data' },
  { campo: 'status', label: 'Status', tipo: 'combo', opcoesFixas: ['ATIVO', 'ENCERRADO', 'CANCELADO'] },
  { campo: 'recebimento_mix', label: 'Mix: Recebimento', tipo: 'data' },
  { campo: 'selecao_amostras', label: 'Mix: Seleção Amostras', tipo: 'data' },
  { campo: 'aprovacao_mix', label: 'Mix: Aprovação', tipo: 'data' },
  { campo: 'desenvolvimento', label: 'Desenvolvimento', tipo: 'data' },
  { campo: 'aprovacao_desenvolvimento', label: 'Desenv.: Aprovação', tipo: 'data' },
  { campo: 'envio_desenvolvimento', label: 'Desenv.: Envio', tipo: 'data' },
  { campo: 'recebimento_dt', label: 'DT: Recebimento', tipo: 'data' },
  { campo: 'aprovacao_dt', label: 'DT: Aprovação', tipo: 'data' },
  { campo: 'solicitacao_prototipo', label: 'Protótipo: Solicitação', tipo: 'data' },
  { campo: 'recebimento_prototipo', label: 'Protótipo: Recebimento', tipo: 'data' },
  { campo: 'aprovacao_prototipo', label: 'Protótipo: Aprovação', tipo: 'data' },
  { campo: 'aprovacao_licenca_proto', label: 'Protótipo: Aprov. Licença', tipo: 'data' },
  { campo: 'solicitacao_cs', label: 'CS: Solicitação', tipo: 'data' },
  { campo: 'recebimento_foto_cs', label: 'CS: Receb. Foto', tipo: 'data' },
  { campo: 'recebimento_fisico_cs', label: 'CS: Receb. Físico', tipo: 'data' },
  { campo: 'aprovacao_cs', label: 'CS: Aprovação', tipo: 'data' },
  { campo: 'aprovacao_licenca_cs', label: 'CS: Aprov. Licença', tipo: 'data' },
  { campo: 'solicitacao_sf', label: 'SF: Solicitação', tipo: 'data' },
  { campo: 'recebimento_foto_sf', label: 'SF: Receb. Foto', tipo: 'data' },
  { campo: 'recebimento_fisico_sf', label: 'SF: Receb. Físico', tipo: 'data' },
  { campo: 'aprovacao_licenca_sf', label: 'SF: Aprov. Licença', tipo: 'data' },
];

export function EdicaoMassaCampo({
  selecionadas,
  grupos,
  onAplicado,
  onLimparSelecao,
}: {
  selecionadas: Set<number>;
  /** Grupos distintos das linhas selecionadas (para os combos cascateados) */
  grupos: string[];
  onAplicado: () => void;
  onLimparSelecao: () => void;
}) {
  const { registraLog } = useAuth();
  const { opcoes } = useCombos();
  const { data: gruposPrm } = useGrupos();
  const { opcoesGP } = useGruposPlanejamento();
  const [campo, setCampo] = useState(CAMPOS[0].campo);
  const [valor, setValor] = useState('');

  const grupoUnico = grupos.length === 1 ? grupos[0] : null;
  const cdGrupoUnico = useMemo(
    () => gruposPrm?.find((g) => g.dc_grupo === grupoUnico)?.cd_grupo ?? GRUPO_GERAL,
    [gruposPrm, grupoUnico],
  );

  // Campos cascateados por grupo só entram com grupo único na seleção
  const camposDisponiveis = useMemo(
    () => CAMPOS.filter((c) => !c.porGrupo || grupoUnico),
    [grupoUnico],
  );

  const def = useMemo(
    () => camposDisponiveis.find((c) => c.campo === campo) ?? camposDisponiveis[0],
    [camposDisponiveis, campo],
  );

  const opcoesCombo = useMemo(() => {
    if (def.tipo === 'grupoplan') return opcoesGP(grupoUnico);
    if (def.tipo !== 'combo') return [];
    if (def.opcoesFixas) return def.opcoesFixas;
    return opcoes(def.comboTipo!, def.porGrupo ? cdGrupoUnico : GRUPO_GERAL);
  }, [def, opcoes, opcoesGP, grupoUnico, cdGrupoUnico]);

  const aplicar = useMutation({
    mutationFn: async () => {
      if (valor === '' && def.tipo !== 'texto' && def.tipo !== 'data') {
        throw new Error('Informe o novo valor.');
      }
      const novoValor =
        def.tipo === 'numero'
          ? Number(valor) || 0
          : def.tipo === 'simnao'
            ? valor === 'SIM'
            : valor || null;
      const { error } = await supabase
        .from('demandas')
        .update({ [campo]: novoValor })
        .in('cd_demanda', [...selecionadas]);
      if (error) throw error;
      registraLog('EdicaoDemanda - Alteracao Massa', 0, '', String(novoValor ?? ''), campo);
    },
    onSuccess: () => {
      toast.success(`${def.label} atualizado em ${selecionadas.size} linha(s).`);
      setValor('');
      onAplicado();
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  return (
    <div className="ml-auto flex flex-wrap items-end gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
      <div>
        <Label className="flex items-center gap-1">
          <PencilRuler className="h-3 w-3" /> Edição em massa ({selecionadas.size} linhas
          {grupoUnico ? ` · ${grupoUnico}` : ` · ${grupos.length} grupos`})
        </Label>
        <div className="flex gap-2">
          <Select
            className="w-52"
            value={campo}
            onChange={(e) => {
              setCampo(e.target.value);
              setValor('');
            }}
          >
            {camposDisponiveis.map((c) => (
              <option key={c.campo} value={c.campo}>{c.label}</option>
            ))}
          </Select>
          {def.tipo === 'combo' || def.tipo === 'grupoplan' ? (
            <Select className="w-48" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="" options={opcoesCombo} />
          ) : def.tipo === 'simnao' ? (
            <Select className="w-48" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="" options={['SIM', 'NAO']} />
          ) : (
            <Input
              className="w-48"
              type={def.tipo === 'data' ? 'date' : def.tipo === 'numero' ? 'number' : 'text'}
              step={def.tipo === 'numero' ? '0.01' : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          )}
        </div>
      </div>
      <Button
        size="sm"
        loading={aplicar.isPending}
        onClick={async () => {
          if (
            await confirmar({
              titulo: 'Aplicar em massa',
              mensagem: `Aplicar "${def.label}" em ${selecionadas.size} linha(s)?`,
              textoConfirmar: 'Aplicar',
            })
          )
            aplicar.mutate();
        }}
      >
        Aplicar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Limpar seleção (desmarcar todas as linhas)"
        onClick={onLimparSelecao}
      >
        <X />
      </Button>
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, Layers, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, fetchAll } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useDominios } from '@/services/dominios';
import { DataTable, type Coluna } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { PainelFiltros } from '@/components/ui/painel-filtros';
import { confirmar } from '@/components/ui/confirm';
import { Badge } from '@/components/ui/misc';
import { exportarExcel, exportarPdf, type ColunaExport } from '@/lib/exportar';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { miniaturaUrl } from '@/lib/cloudinary';
import { ETAPAS, ETAPA_COR, ETAPA_LABEL, type Demanda, type Etapa } from '@/types';
import { CadastroMassa } from './CadastroMassa';
import { EdicaoDemanda } from './EdicaoDemanda';
import { EdicaoMassaCampo } from './EdicaoMassaCampo';

export default function ListaDemandas() {
  const { podeEditar, registraLog } = useAuth();
  const qc = useQueryClient();
  const editavel = podeEditar('lista_demandas');
  const { opcoes } = useDominios();

  // Filtros rápidos
  const [fStatus, setFStatus] = useState('ATIVO');
  const [fCanal, setFCanal] = useState('');
  const [fGriffe, setFGriffe] = useState('');
  const [fGrupo, setFGrupo] = useState('');
  const [fSubgrupo, setFSubgrupo] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fEtapa, setFEtapa] = useState('');
  const [fCodigo, setFCodigo] = useState('');

  // Seleção para edição em massa:
  //  - clique simples alterna a linha (marca/desmarca)
  //  - Shift+clique seleciona o intervalo na ordem visível da tabela
  //  - duplo clique abre a edição individual
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const ultimoClicado = useRef<number | null>(null);

  const [cdEdicao, setCdEdicao] = useState<number | null>(null);
  const [cadastroMassa, setCadastroMassa] = useState(false);

  const { data: demandas, isLoading, refetch } = useQuery({
    queryKey: ['demandas_lista', fStatus],
    staleTime: 60_000,
    queryFn: async () =>
      fetchAll<Demanda>((inicio, fim) => {
        let q = supabase
          .from('demandas')
          .select('*')
          .neq('status', 'EXCLUIDO')
          .order('cd_demanda', { ascending: false })
          .range(inicio, fim);
        if (fStatus) q = q.eq('status', fStatus);
        return q;
      }),
  });

  const filtrados = useMemo(() => {
    let r = demandas ?? [];
    if (fCanal) r = r.filter((d) => d.canal === fCanal);
    if (fGriffe) r = r.filter((d) => d.griffe === fGriffe);
    if (fGrupo) r = r.filter((d) => d.grupo === fGrupo);
    if (fSubgrupo) r = r.filter((d) => d.subgrupo === fSubgrupo);
    if (fFornecedor) r = r.filter((d) => d.fornecedor === fFornecedor);
    if (fEtapa) r = r.filter((d) => d.etapa_atual === fEtapa);
    if (fCodigo) {
      const v = fCodigo.toLowerCase();
      r = r.filter(
        (d) =>
          (d.cod_1 ?? '').toLowerCase().includes(v) ||
          (d.cod_2 ?? '').toLowerCase().includes(v) ||
          (d.cod_3_licenca ?? '').toLowerCase().includes(v) ||
          (d.sku ?? '').toLowerCase().includes(v),
      );
    }
    return r;
  }, [demandas, fCanal, fGriffe, fGrupo, fSubgrupo, fFornecedor, fEtapa, fCodigo]);

  const excluir = useMutation({
    mutationFn: async (cd: number) => {
      const { error } = await supabase
        .from('demandas')
        .update({ status: 'EXCLUIDO' })
        .eq('cd_demanda', cd);
      if (error) throw error;
      registraLog('EdicaoDemanda - Excluir', cd);
    },
    onSuccess: () => {
      toast.success('Demanda excluída.');
      qc.invalidateQueries({ queryKey: ['demandas_lista'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const colunas: Coluna<Demanda>[] = [
    {
      key: '__foto',
      titulo: 'Ficha',
      ordenavel: false,
      render: (d) =>
        d.ficha_url ? (
          <img src={miniaturaUrl(d.ficha_url)} alt="" loading="lazy" className="h-10 w-14 rounded border object-contain" />
        ) : (
          <div className="h-10 w-14 rounded border border-dashed opacity-30" />
        ),
    },
    { key: 'cd_demanda', titulo: 'CD' },
    { key: 'canal', titulo: 'Canal' },
    { key: 'griffe', titulo: 'Griffe', className: 'font-semibold' },
    { key: 'grupo', titulo: 'Grupo' },
    { key: 'subgrupo', titulo: 'Subgrupo' },
    { key: 'fornecedor', titulo: 'Fornecedor' },
    { key: 'grupo_planejamento', titulo: 'Grupo Plan.' },
    { key: 'cod_1', titulo: '1º Código', className: 'font-mono text-xs' },
    { key: 'cod_2', titulo: '2º Código', className: 'font-mono text-xs' },
    {
      key: 'preco_varejo',
      titulo: 'Preço',
      render: (d) => (d.preco_varejo != null ? formatNumber(d.preco_varejo) : ''),
      valor: (d) => d.preco_varejo,
    },
    {
      key: 'lente_antecipada',
      titulo: 'Lente Ant.',
      render: (d) => (d.lente_antecipada ? 'SIM' : ''),
      valor: (d) => (d.lente_antecipada ? 'SIM' : 'NAO'),
    },
    {
      key: 'etapa_atual',
      titulo: 'Etapa',
      render: (d) => (
        <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', ETAPA_COR[d.etapa_atual as Etapa] ?? '')}>
          {ETAPA_LABEL[d.etapa_atual as Etapa] ?? d.etapa_atual}
        </span>
      ),
      valor: (d) => d.etapa_atual,
    },
    {
      key: 'status',
      titulo: 'Status',
      render: (d) =>
        d.status === 'ATIVO' ? (
          <Badge variant="success">Ativo</Badge>
        ) : d.status === 'ENCERRADO' ? (
          <Badge variant="secondary">Encerrado</Badge>
        ) : (
          <Badge variant="destructive">{d.status}</Badge>
        ),
      valor: (d) => d.status,
    },
    {
      key: 'data_compra',
      titulo: 'Data Compra',
      render: (d) => formatDate(d.data_compra),
      valor: (d) => d.data_compra,
    },
    ...(editavel
      ? [{
          key: '__acoes',
          titulo: '',
          ordenavel: false,
          render: (d: Demanda) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              title="Excluir (lógico)"
              onClick={async (e) => {
                e.stopPropagation();
                if (
                  await confirmar({
                    titulo: 'Excluir demanda',
                    mensagem: `A demanda ${d.cd_demanda} será marcada como EXCLUIDO. Continuar?`,
                    variante: 'destructive',
                    textoConfirmar: 'Excluir',
                  })
                ) {
                  excluir.mutate(d.cd_demanda);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ),
        } as Coluna<Demanda>]
      : []),
  ];

  const colunasExport: ColunaExport[] = colunas
    .filter((c) => !c.key.startsWith('__'))
    .map((c) => ({ key: c.key, titulo: c.titulo }));
  const dadosExport = filtrados.map((r: any) => {
    const o: Record<string, any> = {};
    for (const c of colunasExport) o[c.key] = r[c.key];
    return o;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lista de Demandas</h1>
            <p className="text-sm text-muted-foreground">
              Desenvolvimento de produto — clique seleciona, Shift+clique intervalo, duplo clique edita
            </p>
          </div>
          {selecionadas.size >= 2 && editavel && (
            <EdicaoMassaCampo
              selecionadas={selecionadas}
              onLimparSelecao={() => setSelecionadas(new Set())}
              onAplicado={() => {
                setSelecionadas(new Set());
                qc.invalidateQueries({ queryKey: ['demandas_lista'] });
              }}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editavel && (
            <>
              <Button onClick={() => setCdEdicao(0)}>
                <Plus /> Nova Demanda
              </Button>
              <Button variant="secondary" onClick={() => setCadastroMassa(true)}>
                <Layers /> Inclusão em Massa
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw /> Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              exportarExcel(colunasExport, dadosExport, 'OPP_ListaDemandas');
              registraLog('ListaDemandas - Exportacao Excel');
            }}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              exportarPdf(colunasExport, dadosExport, 'OPP_ListaDemandas', 'OPP — Lista de Demandas');
              registraLog('ListaDemandas - Exportacao PDF');
            }}
          >
            <FileText /> PDF
          </Button>
        </div>
      </div>

      <PainelFiltros>
        <div className="w-36">
          <Label>Status</Label>
          <Select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            placeholder="Todos"
            options={['ATIVO', 'ENCERRADO', 'CANCELADO']}
          />
        </div>
        <div className="w-40">
          <Label>Canal</Label>
          <Select value={fCanal} onChange={(e) => setFCanal(e.target.value)} placeholder="Todos" options={opcoes('CANAL')} />
        </div>
        <div className="w-44">
          <Label>Griffe</Label>
          <Select value={fGriffe} onChange={(e) => setFGriffe(e.target.value)} placeholder="Todas" options={opcoes('GRIFFE')} />
        </div>
        <div className="w-40">
          <Label>Grupo</Label>
          <Select value={fGrupo} onChange={(e) => setFGrupo(e.target.value)} placeholder="Todos" options={opcoes('GRUPO')} />
        </div>
        <div className="w-40">
          <Label>Subgrupo</Label>
          <Select value={fSubgrupo} onChange={(e) => setFSubgrupo(e.target.value)} placeholder="Todos" options={opcoes('SUBGRUPO')} />
        </div>
        <div className="w-44">
          <Label>Fornecedor</Label>
          <Select value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)} placeholder="Todos" options={opcoes('FORNECEDOR')} />
        </div>
        <div className="w-44">
          <Label>Etapa</Label>
          <Select value={fEtapa} onChange={(e) => setFEtapa(e.target.value)} placeholder="Todas">
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{ETAPA_LABEL[e]}</option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Label>Código / SKU</Label>
          <SearchInput value={fCodigo} onChange={(e) => setFCodigo(e.target.value)} onClear={() => setFCodigo('')} />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setFStatus('ATIVO');
            setFCanal('');
            setFGriffe('');
            setFGrupo('');
            setFSubgrupo('');
            setFFornecedor('');
            setFEtapa('');
            setFCodigo('');
          }}
        >
          Limpar filtros
        </Button>
      </PainelFiltros>

      <DataTable
        colunas={colunas}
        dados={filtrados}
        carregando={isLoading}
        rowKey={(d) => d.cd_demanda}
        selecionadas={selecionadas}
        onRowClick={(row, e, visiveis) => {
          setSelecionadas((s) => {
            const n = new Set(s);
            // Shift+clique: seleciona o intervalo entre o último clique e a linha
            // atual, na ordem visível (com ordenação e filtros aplicados)
            if (e.shiftKey && ultimoClicado.current != null) {
              const i1 = visiveis.findIndex((v) => v.cd_demanda === ultimoClicado.current);
              const i2 = visiveis.findIndex((v) => v.cd_demanda === row.cd_demanda);
              if (i1 >= 0 && i2 >= 0) {
                for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
                  n.add(visiveis[i].cd_demanda);
                }
                ultimoClicado.current = row.cd_demanda;
                return n;
              }
            }
            // Clique simples: alterna a seleção da linha (marca/desmarca)
            if (n.has(row.cd_demanda)) n.delete(row.cd_demanda);
            else n.add(row.cd_demanda);
            ultimoClicado.current = row.cd_demanda;
            return n;
          });
        }}
        onRowDoubleClick={(row) => {
          if (editavel) setCdEdicao(row.cd_demanda);
        }}
        autofiltro
        rodape={
          selecionadas.size > 0 ? (
            <span className="ml-3">
              <b>{selecionadas.size}</b> selecionada(s)
              <button className="ml-2 text-primary hover:underline" onClick={() => setSelecionadas(new Set())}>
                limpar seleção
              </button>
            </span>
          ) : null
        }
      />

      {cdEdicao !== null && (
        <EdicaoDemanda
          cdDemanda={cdEdicao}
          onFechar={(salvou) => {
            setCdEdicao(null);
            if (salvou) qc.invalidateQueries({ queryKey: ['demandas_lista'] });
          }}
        />
      )}

      {cadastroMassa && (
        <CadastroMassa
          onFechar={(criou) => {
            setCadastroMassa(false);
            if (criou) qc.invalidateQueries({ queryKey: ['demandas_lista'] });
          }}
        />
      )}
    </div>
  );
}

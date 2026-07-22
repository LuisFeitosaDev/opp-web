import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GRUPO_GERAL, useCombos, useGrupos, useGruposPlanejamento } from '@/services/combos';
import { uploadFicha, otimizarUrl } from '@/lib/cloudinary';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { cn, formatDateTime } from '@/lib/utils';
import { ETAPA_COR, ETAPA_LABEL, type Demanda, type Etapa, type LogTransacao } from '@/types';
import { Bloco, CampoLinha, CTRL, type CorBloco } from './Bloco';

interface CampoData {
  campo: keyof Demanda;
  label: string;
}

const BLOCOS_ETAPA: { titulo: string; cor: CorBloco; datas: CampoData[]; comentarios?: keyof Demanda }[] = [
  {
    titulo: 'Mix',
    cor: 'azul',
    datas: [
      { campo: 'recebimento_mix', label: 'Recebimento' },
      { campo: 'selecao_amostras', label: 'Seleção Amostras' },
      { campo: 'aprovacao_mix', label: 'Aprovação' },
    ],
  },
  {
    titulo: 'Desenvolvimento',
    cor: 'violeta',
    datas: [
      { campo: 'desenvolvimento', label: 'Desenvolvimento' },
      { campo: 'aprovacao_desenvolvimento', label: 'Aprovação' },
      { campo: 'envio_desenvolvimento', label: 'Envio' },
    ],
  },
  {
    titulo: 'Desenho Técnico',
    cor: 'ambar',
    datas: [
      { campo: 'recebimento_dt', label: 'Recebimento' },
      { campo: 'aprovacao_dt', label: 'Aprovação' },
    ],
    comentarios: 'comentarios_dt',
  },
  {
    titulo: 'Protótipo',
    cor: 'marrom',
    datas: [
      { campo: 'solicitacao_prototipo', label: 'Solicitação' },
      { campo: 'recebimento_prototipo', label: 'Recebimento' },
      { campo: 'aprovacao_prototipo', label: 'Aprovação' },
      { campo: 'aprovacao_licenca_proto', label: 'Aprov. Licença' },
    ],
    comentarios: 'comentarios_proto',
  },
  {
    titulo: 'Color Sample',
    cor: 'verde',
    datas: [
      { campo: 'solicitacao_cs', label: 'Solicitação' },
      { campo: 'recebimento_foto_cs', label: 'Receb. Foto' },
      { campo: 'recebimento_fisico_cs', label: 'Receb. Físico' },
      { campo: 'aprovacao_cs', label: 'Aprovação' },
      { campo: 'aprovacao_licenca_cs', label: 'Aprov. Licença' },
    ],
    comentarios: 'comentarios_cs',
  },
  {
    titulo: 'Set Final',
    cor: 'rosa',
    datas: [
      { campo: 'solicitacao_sf', label: 'Solicitação' },
      { campo: 'recebimento_foto_sf', label: 'Receb. Foto' },
      { campo: 'recebimento_fisico_sf', label: 'Receb. Físico' },
      { campo: 'aprovacao_licenca_sf', label: 'Aprov. Licença' },
    ],
    comentarios: 'comentarios_sf',
  },
];

/**
 * Edição individual da demanda (duplo clique na lista) ou criação de um novo
 * registro (cdDemanda = 0). A etapa atual é recalculada pelo banco a cada save.
 */
export function EdicaoDemanda({
  cdDemanda,
  onFechar,
}: {
  cdDemanda: number;
  onFechar: (salvou: boolean) => void;
}) {
  const { registraLog } = useAuth();
  const { data: grupos } = useGrupos();
  const { opcoes } = useCombos();
  const { opcoesGP } = useGruposPlanejamento();
  const novo = cdDemanda === 0;
  const [form, setForm] = useState<Partial<Demanda>>({ lente_antecipada: false, status: 'ATIVO' });
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const { data: demanda, isLoading } = useQuery({
    queryKey: ['demanda', cdDemanda],
    enabled: !novo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandas')
        .select('*')
        .eq('cd_demanda', cdDemanda)
        .single();
      if (error) throw error;
      return data as Demanda;
    },
  });

  const { data: historico } = useQuery({
    queryKey: ['historico_demanda', cdDemanda],
    enabled: !novo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_transacoes')
        .select('*, usuario:usuarios(nome)')
        .eq('cd_item_transacao', cdDemanda)
        .ilike('transacao', 'EdicaoDemanda%')
        .order('dt_transacao', { ascending: false })
        .limit(500);
      if (error) return [];
      return (data ?? []) as (LogTransacao & { usuario: { nome: string } | null })[];
    },
  });

  useEffect(() => {
    if (demanda) setForm(demanda);
  }, [demanda]);

  const set = (campo: keyof Demanda, valor: unknown) => setForm((f) => ({ ...f, [campo]: valor }));

  // Cascata pelo grupo (reflexo do SysPlan): subgrupo/atributos filtram pelo
  // cd_grupo do grupo escolhido; combos gerais usam GRUPO_GERAL.
  const cdGrupo = useMemo(
    () => grupos?.find((g) => g.dc_grupo === form.grupo)?.cd_grupo ?? GRUPO_GERAL,
    [grupos, form.grupo],
  );

  // Grupo planejamento cascateado por grupo/subgrupo/sexo; com opção única,
  // preenche sozinho (mesma regra do SysPlan)
  const opcoesGrupoPlan = useMemo(
    () => opcoesGP(form.grupo, form.subgrupo, form.sexo),
    [opcoesGP, form.grupo, form.subgrupo, form.sexo],
  );
  useEffect(() => {
    if (opcoesGrupoPlan.length === 1 && form.grupo_planejamento !== opcoesGrupoPlan[0]) {
      set('grupo_planejamento', opcoesGrupoPlan[0]);
    }
  }, [opcoesGrupoPlan]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { ...form };
      delete payload.cd_demanda;
      delete payload.criado_em;
      delete payload.atualizado_em;
      delete payload.criado_por;
      delete payload.etapa_atual; // calculada pelo banco
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null;
      }
      if (novo) {
        const { data, error } = await supabase.from('demandas').insert(payload).select('cd_demanda').single();
        if (error) throw error;
        return data.cd_demanda as number;
      }
      const { error } = await supabase.from('demandas').update(payload).eq('cd_demanda', cdDemanda);
      if (error) throw error;
      return cdDemanda;
    },
    onSuccess: (cd) => {
      toast.success(novo ? `Demanda ${cd} criada.` : `Demanda ${cd} salva.`);
      onFechar(true);
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const trocarFoto = async (file: File | null) => {
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const url = await uploadFicha(file);
      set('ficha_url', url);
      registraLog('EdicaoDemanda - Upload Ficha', cdDemanda, '', url);
      toast.success('Ficha enviada — salve a demanda para gravar.');
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setEnviandoFoto(false);
    }
  };

  const Combo = ({ campo, label, tipo, grupoCombo }: { campo: keyof Demanda; label: string; tipo: string; grupoCombo?: number }) => (
    <CampoLinha label={label}>
      <Select
        className={CTRL}
        value={(form[campo] as string) ?? ''}
        onChange={(e) => set(campo, e.target.value)}
        placeholder=""
        options={opcoes(tipo, grupoCombo ?? GRUPO_GERAL)}
      />
    </CampoLinha>
  );

  const Texto = ({ campo, label }: { campo: keyof Demanda; label: string }) => (
    <CampoLinha label={label}>
      <Input className={CTRL} value={(form[campo] as string) ?? ''} onChange={(e) => set(campo, e.target.value)} />
    </CampoLinha>
  );

  const Data = ({ campo, label }: { campo: keyof Demanda; label: string }) => (
    <CampoLinha label={label}>
      <Input
        className={CTRL}
        type="date"
        value={(form[campo] as string) ?? ''}
        onChange={(e) => set(campo, e.target.value || null)}
      />
    </CampoLinha>
  );

  const etapa = (form.etapa_atual ?? 'MIX') as Etapa;

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar(false)}>
      <DialogContent className="max-w-[1100px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {novo ? 'Nova Demanda' : `Demanda ${cdDemanda}`}
            {!novo && (
              <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', ETAPA_COR[etapa])}>
                {ETAPA_LABEL[etapa]}
              </span>
            )}
            {form.status && form.status !== 'ATIVO' && <Badge variant="secondary">{form.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {!novo && isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="etapas">Etapas</TabsTrigger>
              {!novo && <TabsTrigger value="historico">Histórico</TabsTrigger>}
            </TabsList>

            <TabsContent value="dados">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Bloco titulo="Classificação" cor="ambar">
                    {Combo({ campo: 'canal', label: 'Canal', tipo: 'CANAL' })}
                    {Combo({ campo: 'griffe', label: 'Griffe', tipo: 'GRIFFE' })}
                    <CampoLinha label="Grupo">
                      <Select
                        className={CTRL}
                        value={form.grupo ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            grupo: e.target.value,
                            subgrupo: '', atributo_1: '', atributo_2: '', grupo_planejamento: '',
                          }))
                        }
                        placeholder=""
                        options={(grupos ?? []).map((g) => g.dc_grupo)}
                      />
                    </CampoLinha>
                    {Combo({ campo: 'subgrupo', label: 'Subgrupo', tipo: 'SUB GRUPO', grupoCombo: cdGrupo })}
                    {Combo({ campo: 'fornecedor', label: 'Fornecedor', tipo: 'FORNECEDOR' })}
                    <CampoLinha label="Grupo Plan.">
                      <Select
                        className={CTRL}
                        value={form.grupo_planejamento ?? ''}
                        onChange={(e) => set('grupo_planejamento', e.target.value)}
                        placeholder=""
                        options={opcoesGrupoPlan}
                      />
                    </CampoLinha>
                    {Combo({ campo: 'sexo', label: 'Sexo', tipo: 'SEXO' })}
                    <CampoLinha label="Status">
                      <Select
                        className={CTRL}
                        value={form.status ?? 'ATIVO'}
                        onChange={(e) => set('status', e.target.value)}
                        options={['ATIVO', 'ENCERRADO', 'CANCELADO']}
                      />
                    </CampoLinha>
                  </Bloco>
                </div>

                <div className="space-y-2">
                  <Bloco titulo="Atributos" cor="ciano">
                    {Combo({ campo: 'atributo_1', label: 'Atributo 1', tipo: 'ATRIBUTO 1', grupoCombo: cdGrupo })}
                    {Combo({ campo: 'atributo_2', label: 'Atributo 2', tipo: 'ATRIBUTO 2', grupoCombo: cdGrupo })}
                    <CampoLinha label="Preço Varejo">
                      <Input
                        className={CTRL}
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.preco_varejo ?? ''}
                        onChange={(e) => set('preco_varejo', e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </CampoLinha>
                    <CampoLinha label="Lente Antecipada">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={form.lente_antecipada ?? false}
                        onChange={(e) => set('lente_antecipada', e.target.checked)}
                      />
                    </CampoLinha>
                  </Bloco>
                  <Bloco titulo="Códigos" cor="verde">
                    {Texto({ campo: 'cod_1', label: '1º Código' })}
                    {Texto({ campo: 'cod_2', label: '2º Código' })}
                    {Texto({ campo: 'cod_3_licenca', label: '3º Código (Licença)' })}
                    {Texto({ campo: 'sku', label: 'SKU' })}
                    {Data({ campo: 'data_compra', label: 'Data de Compra' })}
                  </Bloco>
                </div>

                <div className="space-y-2">
                  <Bloco titulo="Ficha (foto)" cor="cinza">
                    <div className="flex flex-col items-center gap-2 p-1">
                      {form.ficha_url ? (
                        <img
                          src={otimizarUrl(form.ficha_url)}
                          alt="Ficha do produto"
                          className="max-h-44 rounded border object-contain"
                        />
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                          Sem ficha
                        </div>
                      )}
                      <input
                        ref={inputFoto}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => trocarFoto(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        loading={enviandoFoto}
                        onClick={() => inputFoto.current?.click()}
                      >
                        <Camera /> {form.ficha_url ? 'Trocar ficha' : 'Enviar ficha'}
                      </Button>
                    </div>
                  </Bloco>
                  <Bloco titulo="Licença" cor="rosa">
                    <Textarea
                      className="min-h-[80px] text-xs"
                      placeholder="Comentários de licença..."
                      value={form.comentarios_licenca ?? ''}
                      onChange={(e) => set('comentarios_licenca', e.target.value)}
                    />
                  </Bloco>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="etapas">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {BLOCOS_ETAPA.map((b) => (
                  <Bloco key={b.titulo} titulo={b.titulo} cor={b.cor}>
                    {b.datas.map((d) => Data({ campo: d.campo, label: d.label }))}
                    {b.comentarios && (
                      <Textarea
                        className="min-h-[48px] text-xs"
                        placeholder="Comentários..."
                        value={(form[b.comentarios] as string) ?? ''}
                        onChange={(e) => set(b.comentarios!, e.target.value)}
                      />
                    )}
                  </Bloco>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A etapa atual é recalculada automaticamente pelo banco a partir das datas de aprovação.
              </p>
            </TabsContent>

            {!novo && (
              <TabsContent value="historico">
                <div className="max-h-[50vh] overflow-y-auto scrollbar-thin rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary">
                      <tr className="border-b text-left">
                        <th className="px-2 py-1.5">Data/Hora</th>
                        <th className="px-2 py-1.5">Usuário</th>
                        <th className="px-2 py-1.5">Campo</th>
                        <th className="px-2 py-1.5">Anterior</th>
                        <th className="px-2 py-1.5">Atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historico ?? []).map((h) => (
                        <tr key={h.cd_transacao} className="border-b">
                          <td className="whitespace-nowrap px-2 py-1">{formatDateTime(h.dt_transacao)}</td>
                          <td className="px-2 py-1">{h.usuario?.nome ?? ''}</td>
                          <td className="px-2 py-1">{h.campo_editado || h.transacao.replace('EdicaoDemanda - ', '')}</td>
                          <td className="max-w-40 truncate px-2 py-1" title={h.info_anterior ?? ''}>{h.info_anterior}</td>
                          <td className="max-w-40 truncate px-2 py-1" title={h.info_atual ?? ''}>{h.info_atual}</td>
                        </tr>
                      ))}
                      {(historico ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="h-16 text-center text-muted-foreground">
                            Sem histórico.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button loading={salvar.isPending} onClick={() => salvar.mutate()}>
            <Save /> {novo ? 'Criar Demanda' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

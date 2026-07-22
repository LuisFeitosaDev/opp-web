import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GRUPO_GERAL, useCombos, useGrupos, useGruposPlanejamento } from '@/services/combos';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { Input, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Demanda } from '@/types';
import { Bloco, CampoLinha, CTRL } from './Bloco';

/**
 * Inclusão em massa: informe a quantidade de linhas e os valores comuns —
 * cada linha recebe um novo CD e entra na etapa MIX com status ATIVO.
 * Os combos são o reflexo do SysPlan e cascateiam pelo grupo selecionado.
 */
export function CadastroMassa({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const { registraLog } = useAuth();
  const { data: grupos } = useGrupos();
  const { opcoes } = useCombos();
  const { opcoesGP } = useGruposPlanejamento();

  const [qtdLinhas, setQtdLinhas] = useState(1);
  const [form, setForm] = useState<Partial<Demanda>>({
    lente_antecipada: false,
  });

  const cdGrupo = useMemo(
    () => grupos?.find((g) => g.dc_grupo === form.grupo)?.cd_grupo ?? GRUPO_GERAL,
    [grupos, form.grupo],
  );

  const set = (campo: keyof Demanda, valor: unknown) => setForm((f) => ({ ...f, [campo]: valor }));

  // Grupo planejamento cascateado por grupo/subgrupo/sexo (regra do SysPlan);
  // quando a combinação resolve para uma única opção, preenche sozinho.
  const opcoesGrupoPlan = useMemo(
    () => opcoesGP(form.grupo, form.subgrupo, form.sexo),
    [opcoesGP, form.grupo, form.subgrupo, form.sexo],
  );
  useEffect(() => {
    if (opcoesGrupoPlan.length === 1 && form.grupo_planejamento !== opcoesGrupoPlan[0]) {
      set('grupo_planejamento', opcoesGrupoPlan[0]);
    }
  }, [opcoesGrupoPlan]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!qtdLinhas || qtdLinhas < 1 || qtdLinhas > 500) {
        throw new Error('Informe a quantidade de linhas (1 a 500).');
      }
      const payload: Record<string, any> = {
        ...form,
        status: 'ATIVO',
        preco_varejo: form.preco_varejo || null,
      };
      delete payload.cd_demanda;
      // remove strings vazias (viram NULL no banco)
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null;
      }
      const linhas = Array.from({ length: qtdLinhas }, () => ({ ...payload }));
      const { data, error } = await supabase
        .from('demandas')
        .insert(linhas)
        .select('cd_demanda');
      if (error) throw error;
      const cds = (data ?? []).map((r: any) => r.cd_demanda).sort((a, b) => a - b);
      registraLog('EdicaoDemanda - Cadastro em Massa', 0, '', `${cds.length} linhas: CD ${cds[0]} a ${cds[cds.length - 1]}`);
      return cds;
    },
    onSuccess: (cds) => {
      toast.success(`${cds.length} demanda(s) criada(s) — CD ${cds[0]} até ${cds[cds.length - 1]}.`);
      onFechar(true);
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

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

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar(false)}>
      <DialogContent className="max-w-[900px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Inclusão de Demandas em Massa</DialogTitle>
          <DialogDescription>
            Informe a quantidade de linhas e os valores comuns — cada linha recebe um novo CD e entra
            na etapa MIX. Os campos deixados em branco podem ser preenchidos depois na edição
            individual ou em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
          <Layers className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Quantidade de linhas a criar</span>
          <Input
            className="h-8 w-24"
            type="number"
            min={1}
            max={500}
            value={qtdLinhas}
            onChange={(e) => setQtdLinhas(Number(e.target.value))}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              {Combo({ campo: 'sexo', label: 'Sexo', tipo: 'SEXO' })}
              <CampoLinha label="Grupo Plan.">
                <Select
                  className={CTRL}
                  value={form.grupo_planejamento ?? ''}
                  onChange={(e) => set('grupo_planejamento', e.target.value)}
                  placeholder=""
                  options={opcoesGrupoPlan}
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
              <CampoLinha label="Data de Compra">
                <Input
                  className={CTRL}
                  type="date"
                  value={form.data_compra ?? ''}
                  onChange={(e) => set('data_compra', e.target.value || null)}
                />
              </CampoLinha>
            </Bloco>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button
            loading={criar.isPending}
            onClick={async () => {
              if (
                await confirmar({
                  titulo: 'Inclusão em massa',
                  mensagem: `Criar ${qtdLinhas} nova(s) demanda(s)?`,
                  textoConfirmar: 'Criar',
                })
              )
                criar.mutate();
            }}
          >
            <Layers /> Criar {qtdLinhas} linha(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

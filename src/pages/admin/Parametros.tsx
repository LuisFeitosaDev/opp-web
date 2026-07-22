import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { DataTable, type Coluna } from '@/components/DataTable';
import { Label, Select } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useCombos, useGrupos, useGruposPlanejamento } from '@/services/combos';
import type { Combo, GrupoPlanejamento } from '@/types';

/**
 * Parâmetros do OPP — visualização dos PRMs espelhados do SysPlan Web.
 * Toda manutenção (incluir/alterar/excluir combos, grupos e grupo
 * planejamento) é feita EXCLUSIVAMENTE no SysPlan; o OPP apenas consome.
 * A atualização do espelho é feita com `npm run sync:prm`.
 */
export default function AdminParametros() {
  const { data: grupos } = useGrupos();
  const { data: combos, isLoading: carregandoCombos } = useCombos();
  const { data: gruposPlan, isLoading: carregandoGP } = useGruposPlanejamento();

  const [fTipo, setFTipo] = useState('');
  const [fGrupo, setFGrupo] = useState('');

  const nomeGrupo = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of grupos ?? []) m.set(g.cd_grupo, g.dc_grupo);
    return m;
  }, [grupos]);

  const tipos = useMemo(
    () => [...new Set((combos ?? []).map((c) => c.dc_tipo_combo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [combos],
  );

  const combosFiltrados = (combos ?? []).filter(
    (c) =>
      (!fTipo || c.dc_tipo_combo === fTipo) &&
      (!fGrupo || String(c.cd_grupo) === fGrupo),
  );

  const colunasCombos: Coluna<Combo>[] = [
    { key: 'cd_combo', titulo: 'CD' },
    { key: 'dc_tipo_combo', titulo: 'Tipo' },
    {
      key: 'cd_grupo',
      titulo: 'Grupo',
      render: (c) => nomeGrupo.get(c.cd_grupo) ?? c.cd_grupo,
      valor: (c) => nomeGrupo.get(c.cd_grupo) ?? String(c.cd_grupo),
    },
    { key: 'dc_combo', titulo: 'Valor', className: 'font-semibold' },
  ];

  const colunasGP: Coluna<GrupoPlanejamento>[] = [
    { key: 'dc_grupo', titulo: 'Grupo' },
    { key: 'dc_subgrupo', titulo: 'Subgrupo' },
    { key: 'dc_sexo', titulo: 'Sexo' },
    { key: 'dc_formato', titulo: 'Formato' },
    { key: 'dc_grupo_planejamento', titulo: 'Grupo Planejamento', className: 'font-semibold' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parâmetros (SysPlan)</h1>
        <p className="text-sm text-muted-foreground">Combos e grupos usados nas demandas — reflexo do SysPlan Web</p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Estes valores são um <b>espelho somente leitura</b> dos PRMs do SysPlan Web. Inclusões,
          alterações e exclusões são feitas <b>exclusivamente no SysPlan</b> (Administração →
          Parâmetros de lá); depois, atualize o espelho com <code className="rounded bg-muted px-1">npm run sync:prm</code>.
        </span>
      </div>

      <Tabs defaultValue="combos">
        <TabsList>
          <TabsTrigger value="combos">Combos ({(combos ?? []).length})</TabsTrigger>
          <TabsTrigger value="grupos">Grupos ({(grupos ?? []).length})</TabsTrigger>
          <TabsTrigger value="gp">Grupo Planejamento ({(gruposPlan ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="combos">
          <Card className="mb-3">
            <CardContent className="flex flex-wrap items-end gap-3 p-3">
              <div className="w-56">
                <Label>Tipo</Label>
                <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)} placeholder="Todos" options={tipos} />
              </div>
              <div className="w-56">
                <Label>Grupo</Label>
                <Select value={fGrupo} onChange={(e) => setFGrupo(e.target.value)} placeholder="Todos">
                  {(grupos ?? []).map((g) => (
                    <option key={g.cd_grupo} value={g.cd_grupo}>{g.dc_grupo}</option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>
          <DataTable
            colunas={colunasCombos}
            dados={combosFiltrados}
            carregando={carregandoCombos}
            rowKey={(c) => c.cd_combo}
            paginacao={100}
          />
        </TabsContent>

        <TabsContent value="grupos">
          <div className="flex flex-wrap gap-2">
            {(grupos ?? []).map((g) => (
              <Badge key={g.cd_grupo} variant="secondary" className="text-sm">
                {g.cd_grupo} · {g.dc_grupo}
              </Badge>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gp">
          <DataTable
            colunas={colunasGP}
            dados={gruposPlan ?? []}
            carregando={carregandoGP}
            rowKey={(g) => `${g.dc_grupo}|${g.dc_subgrupo}|${g.dc_sexo}|${g.dc_formato}`}
            paginacao={100}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

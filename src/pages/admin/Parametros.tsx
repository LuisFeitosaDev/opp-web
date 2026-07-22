import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DataTable, type Coluna } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { confirmar } from '@/components/ui/confirm';
import { Badge } from '@/components/ui/misc';
import { TIPOS_DOMINIO, type Dominio } from '@/types';

/**
 * Parâmetros do OPP: manutenção dos domínios (valores dos combos de
 * classificação — canal, griffe, grupo, fornecedor etc.).
 */
export default function AdminParametros() {
  const { registraLog } = useAuth();
  const qc = useQueryClient();
  const [fTipo, setFTipo] = useState('');
  const [edicao, setEdicao] = useState<Partial<Dominio> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dominios_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dominios')
        .select('*')
        .order('tipo')
        .order('ordem')
        .order('valor');
      if (error) throw error;
      return data as Dominio[];
    },
  });

  const filtrados = (data ?? []).filter((d) => !fTipo || d.tipo === fTipo);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!edicao?.tipo || !edicao.valor?.trim()) throw new Error('Informe o tipo e o valor.');
      const payload = {
        tipo: edicao.tipo,
        valor: edicao.valor.trim().toUpperCase(),
        ordem: edicao.ordem ?? 0,
        ativo: edicao.ativo ?? true,
      };
      if (edicao.cd_dominio) {
        const { error } = await supabase.from('dominios').update(payload).eq('cd_dominio', edicao.cd_dominio);
        if (error) throw error;
        registraLog('Admin - Alteracao Dominio', edicao.cd_dominio, '', `${payload.tipo}: ${payload.valor}`);
      } else {
        const { error } = await supabase.from('dominios').insert(payload);
        if (error) throw error;
        registraLog('Admin - Criacao Dominio', 0, '', `${payload.tipo}: ${payload.valor}`);
      }
    },
    onSuccess: () => {
      toast.success('Domínio salvo.');
      setEdicao(null);
      qc.invalidateQueries({ queryKey: ['dominios_admin'] });
      qc.invalidateQueries({ queryKey: ['dominios'] });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const excluir = useMutation({
    mutationFn: async (d: Dominio) => {
      // Desativa em vez de excluir: valores antigos continuam válidos nas demandas
      const { error } = await supabase.from('dominios').update({ ativo: !d.ativo }).eq('cd_dominio', d.cd_dominio);
      if (error) throw error;
      registraLog(d.ativo ? 'Admin - Desativacao Dominio' : 'Admin - Reativacao Dominio', d.cd_dominio, '', `${d.tipo}: ${d.valor}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dominios_admin'] });
      qc.invalidateQueries({ queryKey: ['dominios'] });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const colunas: Coluna<Dominio>[] = [
    { key: 'cd_dominio', titulo: 'CD' },
    { key: 'tipo', titulo: 'Tipo' },
    { key: 'valor', titulo: 'Valor', className: 'font-semibold' },
    { key: 'ordem', titulo: 'Ordem' },
    {
      key: 'ativo',
      titulo: 'Situação',
      render: (d) => (d.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>),
      valor: (d) => (d.ativo ? 'Ativo' : 'Inativo'),
    },
    {
      key: '__acoes',
      titulo: 'Ações',
      ordenavel: false,
      render: (d) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          title={d.ativo ? 'Desativar' : 'Reativar'}
          onClick={async (e) => {
            e.stopPropagation();
            if (
              await confirmar({
                titulo: d.ativo ? 'Desativar valor' : 'Reativar valor',
                mensagem: `${d.tipo}: ${d.valor}`,
                textoConfirmar: d.ativo ? 'Desativar' : 'Reativar',
                variante: d.ativo ? 'destructive' : 'default',
              })
            )
              excluir.mutate(d);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parâmetros (Domínios)</h1>
          <p className="text-sm text-muted-foreground">Valores dos combos de classificação das demandas</p>
        </div>
        <Button onClick={() => setEdicao({ tipo: fTipo || TIPOS_DOMINIO[0], ativo: true, ordem: 0 })}>
          <Plus /> Novo valor
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="w-56">
            <Label>Tipo</Label>
            <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)} placeholder="Todos" options={[...TIPOS_DOMINIO]} />
          </div>
        </CardContent>
      </Card>

      <DataTable
        colunas={colunas}
        dados={filtrados}
        carregando={isLoading}
        rowKey={(d) => d.cd_dominio}
        onRowDoubleClick={(d) => setEdicao({ ...d })}
        paginacao={50}
      />

      {edicao && (
        <Dialog open onOpenChange={(o) => !o && setEdicao(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{edicao.cd_dominio ? 'Editar valor' : 'Novo valor'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={edicao.tipo ?? ''}
                  onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value })}
                  options={[...TIPOS_DOMINIO]}
                  disabled={!!edicao.cd_dominio}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input value={edicao.valor ?? ''} onChange={(e) => setEdicao({ ...edicao, valor: e.target.value })} />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={edicao.ordem ?? 0}
                  onChange={(e) => setEdicao({ ...edicao, ordem: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdicao(null)}>Cancelar</Button>
              <Button loading={salvar.isPending} onClick={() => salvar.mutate()}><Save /> Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

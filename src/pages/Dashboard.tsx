import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, ListChecks } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { ETAPAS, ETAPA_COR, ETAPA_LABEL, type Etapa } from '@/types';

interface Resumo {
  total: number;
  ativas: number;
  encerradas: number;
  canceladas: number;
  porEtapa: Record<string, number>;
}

export default function Dashboard() {
  const { usuario, podeVer } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_demandas'],
    enabled: podeVer('lista_demandas'),
    queryFn: async (): Promise<Resumo> => {
      const { data, error } = await supabase
        .from('demandas')
        .select('status, etapa_atual')
        .neq('status', 'EXCLUIDO');
      if (error) throw error;
      const linhas = data ?? [];
      const porEtapa: Record<string, number> = {};
      for (const l of linhas) {
        if (l.status === 'ATIVO') porEtapa[l.etapa_atual] = (porEtapa[l.etapa_atual] ?? 0) + 1;
      }
      return {
        total: linhas.length,
        ativas: linhas.filter((l) => l.status === 'ATIVO').length,
        encerradas: linhas.filter((l) => l.status === 'ENCERRADO').length,
        canceladas: linhas.filter((l) => l.status === 'CANCELADO').length,
        porEtapa,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {usuario?.nome?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral do desenvolvimento de produto</p>
      </div>

      {!podeVer('lista_demandas') ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem acesso às demandas — peça a liberação a um administrador.
        </p>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { titulo: 'Total de demandas', valor: data?.total ?? 0 },
              { titulo: 'Ativas', valor: data?.ativas ?? 0 },
              { titulo: 'Encerradas', valor: data?.encerradas ?? 0 },
              { titulo: 'Canceladas', valor: data?.canceladas ?? 0 },
            ].map((kpi) => (
              <Card key={kpi.titulo}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{kpi.titulo}</p>
                  <p className="mt-1 text-3xl font-bold">{kpi.valor.toLocaleString('pt-BR')}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Demandas ativas por etapa
              </p>
              <div className="flex flex-wrap gap-3">
                {ETAPAS.filter((e) => e !== 'ENCERRADA').map((etapa: Etapa) => (
                  <div key={etapa} className="flex min-w-36 flex-1 flex-col items-center rounded-md border p-3">
                    <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', ETAPA_COR[etapa])}>
                      {ETAPA_LABEL[etapa]}
                    </span>
                    <span className="mt-2 text-2xl font-bold">{data?.porEtapa[etapa] ?? 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Link
            to="/demandas"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ListChecks className="h-4 w-4" /> Ir para a Lista de Demandas <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}

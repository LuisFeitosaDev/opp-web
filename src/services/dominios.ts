import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Dominio } from '@/types';

/**
 * Combos do OPP: todos os valores de domínio ativos, carregados uma vez.
 * `opcoes(tipo)` devolve a lista de valores de um tipo (ex.: 'GRIFFE').
 */
export function useDominios() {
  const query = useQuery({
    queryKey: ['dominios'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dominios')
        .select('*')
        .eq('ativo', true)
        .order('tipo')
        .order('ordem')
        .order('valor');
      if (error) throw error;
      return data as Dominio[];
    },
  });

  const opcoes = (tipo: string): string[] => [
    ...new Set((query.data ?? []).filter((d) => d.tipo === tipo).map((d) => d.valor)),
  ];

  return { ...query, opcoes };
}

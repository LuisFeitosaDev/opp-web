import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Combo, GrupoPlanejamento, GrupoProduto } from '@/types';

/**
 * Combos do OPP — reflexo 1:1 dos PRMs do SysPlan Web (prm_grupo,
 * prm_combos, prm_grupo_planejamento). Toda manutenção é feita no SysPlan;
 * aqui apenas consumimos (tabelas somente leitura, atualizadas pelo
 * `npm run sync:prm`).
 */

/** Combos gerais usam CD_Grupo=2 (mesma regra herdada do Access/SysPlan) */
export const GRUPO_GERAL = 2;

export function useGrupos() {
  return useQuery({
    queryKey: ['prm_grupo'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('prm_grupo').select('*').order('dc_grupo');
      if (error) throw error;
      return data as GrupoProduto[];
    },
  });
}

export function useCombos() {
  const query = useQuery({
    queryKey: ['prm_combos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const combos: Combo[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('prm_combos')
          .select('*')
          .order('dc_combo', { ascending: true })
          .order('cd_combo', { ascending: true })
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        combos.push(...data);
        offset += data.length;
      }
      return combos;
    },
  });

  /** Opções de um tipo de combo para um grupo (cd_grupo=2 => combos gerais), sem duplicados */
  const opcoes = (tipo: string, cdGrupo: number = GRUPO_GERAL): string[] => [
    ...new Set(
      (query.data ?? [])
        .filter((c) => c.dc_tipo_combo === tipo && c.cd_grupo === cdGrupo)
        .map((c) => c.dc_combo),
    ),
  ];

  /** Opções de um tipo em TODOS os grupos (para filtros da lista), sem duplicados */
  const opcoesTodas = (tipo: string): string[] =>
    [...new Set((query.data ?? []).filter((c) => c.dc_tipo_combo === tipo).map((c) => c.dc_combo))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );

  return { ...query, opcoes, opcoesTodas };
}

export function useGruposPlanejamento() {
  const query = useQuery({
    queryKey: ['prm_grupo_planejamento'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const linhas: GrupoPlanejamento[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('prm_grupo_planejamento')
          .select('*')
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        linhas.push(...data);
        offset += data.length;
      }
      return linhas;
    },
  });

  /**
   * Opções de grupo planejamento filtradas progressivamente por
   * grupo/subgrupo/sexo (o formato não existe no OPP — quando a combinação
   * tem mais de um formato, todas as opções aparecem).
   */
  const opcoesGP = (grupo?: string | null, subgrupo?: string | null, sexo?: string | null): string[] =>
    [
      ...new Set(
        (query.data ?? [])
          .filter(
            (g) =>
              g.dc_grupo_planejamento &&
              (!grupo || g.dc_grupo === grupo) &&
              (!subgrupo || g.dc_subgrupo === subgrupo) &&
              (!sexo || g.dc_sexo === sexo),
          )
          .map((g) => g.dc_grupo_planejamento as string),
      ),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return { ...query, opcoesGP };
}

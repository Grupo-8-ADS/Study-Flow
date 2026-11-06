/**
 * Organização do menu, igual à do site (frontend/src/components/navigation.ts):
 * 5 abas principais (Início, Agenda, Timer, Disciplinas, Progresso) e a área Conta,
 * aberta pelo avatar no topo. Agenda, Progresso e Conta têm abas internas.
 */
export type SectionKey = 'agenda' | 'progresso' | 'conta';

export type SectionTab = {
  label: string;
  href: '/calendario' | '/atividade' | '/rotina' | '/estatisticas' | '/rewards' | '/perfil' | '/configuracoes' | '/integracoes';
};

export const SECTIONS: Record<SectionKey, { title: string; tabs: SectionTab[] }> = {
  agenda: {
    title: 'Agenda',
    tabs: [
      { label: 'Calendário', href: '/calendario' },
      { label: 'Compromissos', href: '/atividade' },
      { label: 'Rotina e cronograma', href: '/rotina' },
    ],
  },
  progresso: {
    title: 'Progresso',
    tabs: [
      { label: 'Estatísticas', href: '/estatisticas' },
      { label: 'Recompensas', href: '/rewards' },
    ],
  },
  conta: {
    title: 'Conta',
    tabs: [
      { label: 'Perfil', href: '/perfil' },
      { label: 'Preferências', href: '/configuracoes' },
      { label: 'Integrações', href: '/integracoes' },
    ],
  },
};

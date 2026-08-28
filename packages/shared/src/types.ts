export type StudyFlowSession = {
  demoMode?: boolean;
  email: string;
  nome: string;
  pendingEmailConfirmation?: boolean;
  username: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bg_color?: string;
  horas_diarias?: number;
  nivel_atual?: number;
  xp?: number;
  last_achievement?: string | null;
};

export type StudyDistribution = {
  color: string;
  hours: number;
  max: number;
  name: string;
};

export type Profile = {
  id: string;
  nome: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bg_color: string;
  recebe_notificacao_pref: boolean;
  horas_diarias: number;
  nivel_atual: number;
  xp: number;
  last_achievement?: string | null;
  created_at: string;
  updated_at: string;
};

export type Disciplina = {
  id: string;
  user_id: string;
  nome: string;
  professor?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  anotacoes?: Record<string, any> | string | null;
  created_at?: string;
  updated_at?: string;
};

export type Avaliacao = {
  id: string;
  disciplina_id: string;
  nome: string;
  tipo: 'prova' | 'trabalho' | 'outro';
  data_entrega?: string | null;
  anotacoes?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

export type ItemCronograma = {
  id: string;
  user_id: string;
  disciplina_id?: string | null;
  topico_id?: string | null;
  nome: string;
  tipo: string;
  prioridade: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  descricao?: string | null;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SessaoEstudo = {
  id: string;
  user_id: string;
  item_id?: string | null;
  disciplina_id?: string | null;
  disciplina_nome?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  duracao_efetiva_min: number;
  numero_pausas: number;
  status: 'ativa' | 'concluida' | 'cancelada' | 'pausada';
  exp: number;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Conquista = {
  id: string;
  nome: string;
  descricao?: string | null;
  criterio?: Record<string, any>;
  pontos_recompensa: number;
  icone?: string | null;
  category?: string | null;
};

export type UserConquista = {
  user_id: string;
  conquista_id: string;
  data_conquista: string;
  conquistas?: Conquista;
};

export type Notificacao = {
  id: string;
  user_id: string;
  item_id?: string | null;
  mensagem: string;
  tipo_evento?: string | null;
  read_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
};

export type TimerMode = 'foco' | 'curta' | 'longa';

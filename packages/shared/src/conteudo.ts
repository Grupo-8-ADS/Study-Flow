/**
 * Textos de ajuda exibidos no site e no app (FAQ, termos de serviço, regras de XP).
 * Ficam aqui para as duas plataformas dizerem a mesma coisa — e a mesma regra do banco.
 * @packageDocumentation
 */

import { XP_BASE_NIVEL } from './gamificacao';

export interface PerguntaFrequente {
  pergunta: string;
  resposta: string;
}

/** Limite de XP por sessão: o banco credita no máximo 240 min (trigger preparar_sessao_estudo). */
export const XP_MAXIMO_POR_SESSAO = 240;

/** Como se ganha XP e se sobe de nível (mesma regra de public.nivel_por_xp e dos triggers). */
export const REGRAS_XP: readonly string[] = [
  `Cada minuto de foco concluído no Pomodoro vale 1 XP (até ${XP_MAXIMO_POR_SESSAO} XP por sessão).`,
  'Conquistas desbloqueadas dão XP extra.',
  `Subir do nível n para o seguinte custa ${XP_BASE_NIVEL} × n XP: ${XP_BASE_NIVEL} para o nível 2, ${XP_BASE_NIVEL * 2} para o 3, e assim por diante.`,
  'Molduras e banners são liberados conforme você sobe de nível.',
];

export const FAQ: readonly PerguntaFrequente[] = [
  { pergunta: 'Como adicionar uma disciplina?', resposta: 'Em Disciplinas, use Adicionar disciplina e informe o nome, o professor, os horários de aula e as avaliações.' },
  {
    pergunta: 'Como funciona o Timer Pomodoro?',
    resposta: 'Escolha o período de foco ou pausa, selecione uma disciplina e inicie o cronômetro. As durações podem ser ajustadas nas configurações do timer.',
  },
  { pergunta: 'Como as horas estudadas são registradas?', resposta: 'Cada sessão de foco concluída entra no seu histórico e alimenta a página de Estatísticas.' },
  { pergunta: 'Como subo de nível e ganho XP?', resposta: REGRAS_XP.slice(0, 3).join(' ') },
  { pergunta: 'Como desbloquear conquistas?', resposta: 'Conclua sessões, mantenha sequências de estudo e alcance metas relacionadas às disciplinas.' },
  {
    pergunta: 'Como compartilhar meu progresso?',
    resposta: 'Em Estatísticas, use Compartilhar progresso. Nas configurações de privacidade dá para esconder as horas estudadas ou desligar o compartilhamento.',
  },
  {
    pergunta: 'Como excluir minha conta?',
    resposta: 'Em Configurações, use Excluir minha conta e confirme no aviso de segurança. A conta e todos os seus dados são apagados de forma permanente.',
  },
];

export interface SecaoTermos {
  titulo: string;
  texto: string;
}

export const TERMOS_SERVICO: { introducao: string; secoes: readonly SecaoTermos[] } = {
  introducao: 'O Study Flow é uma ferramenta desenvolvida com finalidade acadêmica e de produtividade pessoal.',
  secoes: [
    { titulo: '1. Uso individual', texto: 'Os dados e horários armazenados são de uso estritamente individual do estudante para fins de organização acadêmica.' },
    { titulo: '2. Privacidade e dados', texto: 'O aplicativo respeita sua privacidade e não compartilha dados confidenciais ou de rotina com terceiros.' },
    {
      titulo: '3. Responsabilidade',
      texto: 'O usuário é responsável pela veracidade dos dados cadastrados e conformidade de sua rotina de estudos com seus compromissos institucionais.',
    },
  ],
};

/** Conta de demonstração da apresentação: a exclusão fica bloqueada para manter os dados de exemplo. */
export function contaDemonstracao(usuario: { email?: string | null; username?: string | null } | null | undefined): boolean {
  if (!usuario) return false;
  return usuario.email?.trim().toLowerCase() === 'teste@teste.com' || usuario.username?.trim().toLowerCase() === 'teste';
}

export const TEXTO_EXCLUIR_CONTA = {
  aviso: 'Apaga seu cadastro e todos os seus dados de forma permanente. Essa ação não pode ser desfeita.',
  avisoDemonstracao: 'Esta é a conta de demonstração da apresentação. A exclusão foi bloqueada para manter os dados de exemplo disponíveis.',
  confirmacao:
    'Sua conta e todos os seus dados (disciplinas, sessões, conquistas e notificações) serão apagados de forma permanente e você precisará criar uma nova conta para voltar.',
} as const;

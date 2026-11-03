import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

/**
 * Notificações locais (RF010): fim de ciclo do Pomodoro e lembretes de prazos.
 * Tudo é tolerante a falhas: notificar nunca pode quebrar o fluxo principal.
 */

const CANAL = 'lembretes';
const TIPOS_LEMBRETE = ['prova', 'trabalho', 'entrega', 'atividade'];
const JANELA_DIAS = 14;
const HORA_LEMBRETE = 8;
const TAG_LEMBRETE = 'lembrete-prazo';

const suportado = Platform.OS !== 'web';
let configurado = false;

export interface ItemPrazo {
  id?: string;
  nome: string;
  tipo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  completed?: boolean | null;
}

async function configurar() {
  if (configurado || !suportado) return;
  configurado = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Pede permissão apenas quando necessário (primeiro uso). */
async function garantirPermissao(): Promise<boolean> {
  if (!suportado) return false;
  await configurar();
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

async function preferenciaAtiva(): Promise<boolean> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('recebe_notificacao_pref')
    .eq('id', userRes.user.id)
    .single();
  return data?.recebe_notificacao_pref !== false;
}

export async function cancelarLembretes(): Promise<void> {
  if (!suportado) return;
  try {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      agendadas
        .filter((n) => n.content.data?.tag === TAG_LEMBRETE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch (e) {
    console.warn('Falha ao cancelar lembretes:', e);
  }
}

/** Notificação imediata ao fim de um ciclo do Pomodoro. */
export async function notificarFimDoCiclo(mode: 'foco' | 'curta' | 'longa'): Promise<void> {
  try {
    if (!(await preferenciaAtiva())) return;
    if (!(await garantirPermissao())) return;
    const foco = mode === 'foco';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: foco ? 'Sessão de foco concluída!' : 'Pausa encerrada',
        body: foco ? 'Ótimo trabalho! Que tal uma pausa?' : 'Pronto para voltar ao foco?',
      },
      trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
    });
  } catch (e) {
    console.warn('Falha ao notificar fim do ciclo:', e);
  }
}

/** Data do lembrete: 08:00 local do dia anterior ao prazo. */
export function dataDoLembrete(prazo: Date): Date {
  return new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate() - 1, HORA_LEMBRETE, 0, 0, 0);
}

/** Substitui os lembretes agendados por um por item pendente dos próximos 14 dias. */
export async function agendarLembretesDePrazos(itens: ItemPrazo[]): Promise<void> {
  if (!suportado) return;
  try {
    await cancelarLembretes();
    if (!(await preferenciaAtiva())) return;

    const agora = new Date();
    const limite = new Date(agora.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000);
    const alvos: Array<{ item: ItemPrazo; quando: Date }> = [];
    for (const item of itens) {
      if (item.completed) continue;
      if (!TIPOS_LEMBRETE.includes((item.tipo ?? '').toLowerCase())) continue;
      const prazo = new Date(item.data_fim || item.data_inicio || '');
      if (Number.isNaN(prazo.getTime()) || prazo > limite) continue;
      const quando = dataDoLembrete(prazo);
      if (quando <= agora) continue;
      alvos.push({ item, quando });
    }
    if (alvos.length === 0 || !(await garantirPermissao())) return;

    for (const { item, quando } of alvos) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Prazo amanhã',
          body: `"${item.nome}" vence amanhã.`,
          data: { tag: TAG_LEMBRETE, itemId: item.id ?? null },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: quando,
          channelId: CANAL,
        },
      });
    }
  } catch (e) {
    console.warn('Falha ao agendar lembretes:', e);
  }
}

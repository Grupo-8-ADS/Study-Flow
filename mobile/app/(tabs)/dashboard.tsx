import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  CheckSquare,
  Flame,
  Play,
  Plus,
  CalendarClock,
  Activity,
  Gift,
  Settings,
  Check,
} from 'lucide-react-native';
import {
  COLORS,
  ROTULO_TIPO,
  StudyDistribution,
  dataStr,
  formatarData,
  formatarHorario,
  hojeStr,
  intervaloDe,
  type Compromisso,
  type CompromissoForm,
} from '@studyflow/shared';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { supabase } from '../../lib/supabase';
import { agendarLembretesDePrazos } from '../../lib/notifications';
import { CompromissoEditor } from '../../components/CompromissoEditor';
import { COR_TIPO, alternarConcluido, useAgenda } from '../../lib/agenda';

const DIST_COLORS = ['#29645e', '#348e83', '#e5a93b', '#f87171', '#a855f7'];

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [distribution, setDistribution] = useState<StudyDistribution[]>([]);

  const { dados: agenda, carregando: carregandoAgenda, recarregar: recarregarAgenda } = useAgenda();
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const calculateStreakFromDates = (dates: string[]) => {
    // Dias no fuso local (as sessões são gravadas como instantes reais).
    const uniqueDays = new Set(dates.filter(Boolean).map((d) => dataStr(new Date(d))));
    if (uniqueDays.size === 0) return 0;

    let count = 0;
    const cursor = new Date();

    while (true) {
      const key = dataStr(cursor);
      if (!uniqueDays.has(key)) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  };

  const loadData = useCallback(async () => {
    try {
      const { data: sessaoRes } = await supabase.auth.getSession();
      const uid = sessaoRes.session?.user?.id;
      if (!uid) {
        setDistribution([]);
        setTotalHours(0);
        setStreak(0);
        return;
      }

      // 2. Fetch study sessions for metrics and distribution
      const { data: sessionsData } = await supabase
        .from('sessoes_estudo')
        .select('duracao_efetiva_min, data_inicio, disciplina_id, disciplinas(nome)')
        .eq('user_id', uid)
        .eq('status', 'concluida');

      if (sessionsData && sessionsData.length > 0) {
        const totalMinutes = sessionsData.reduce((acc, s) => acc + (s.duracao_efetiva_min || 0), 0);
        setTotalHours(Number((totalMinutes / 60).toFixed(1)));

        const sessionDates = sessionsData.map((s) => s.data_inicio).filter(Boolean) as string[];
        setStreak(calculateStreakFromDates(sessionDates));

        // Build subject distribution
        const subjectMap = new Map<string, number>();
        sessionsData.forEach((s: any) => {
          const subName = s.disciplinas?.nome || 'Geral';
          subjectMap.set(subName, (subjectMap.get(subName) || 0) + (s.duracao_efetiva_min || 0));
        });

        const distList: StudyDistribution[] = Array.from(subjectMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, mins], idx) => {
            const hrs = Number((mins / 60).toFixed(1));
            return {
              name,
              hours: hrs,
              max: Math.max(2, Math.ceil(hrs / 2) * 2),
              color: DIST_COLORS[idx % DIST_COLORS.length],
            };
          });

        setDistribution(distList);
      } else {
        setTotalHours(0);
        setStreak(0);
        setDistribution([]);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Carga assíncrona: os setState ocorrem após o await, não em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [session, loadData]);

  // RF010: lembretes locais dos prazos pendentes (provas, trabalhos e atividades).
  useEffect(() => {
    if (!agenda) return;
    void agendarLembretesDePrazos(
      agenda.compromissos
        .filter((c) => !c.concluido && c.tipo !== 'estudo')
        .map((c) => ({ id: c.id, nome: c.titulo, tipo: c.tipo, data_fim: intervaloDe(c).fim.toISOString(), completed: c.concluido })),
    );
  }, [agenda]);

  const onRefresh = () => {
    setRefreshing(true);
    void recarregarAgenda();
    void loadData();
  };

  // Prazos: provas, trabalhos e atividades pendentes até 14 dias à frente (e os atrasados).
  const hoje = hojeStr();
  const agora = new Date();
  const limite = dataStr(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 14));
  const tasks = (agenda?.compromissos ?? []).filter((c) => c.tipo !== 'estudo' && !c.concluido && c.data <= limite);
  const nomeDisciplina = (id: string | null) => agenda?.disciplinas.find((d) => d.id === id)?.nome;

  const pendingCount = tasks.length;

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Welcome & Quick Start Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.greetingText}>
              Olá, {session?.nome || 'Estudante'}! 👋
            </Text>
            <Text style={styles.heroSubtitle}>
              Pronto para mais uma sessão de foco e produtividade?
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.pomodoroButton}
              onPress={() => router.push('/(tabs)/timer')}
            >
              <Play size={18} color={COLORS.primary} fill={COLORS.primary} />
              <Text style={styles.pomodoroButtonText}>Iniciar Pomodoro</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3 Metric Cards */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#ecfdf5' }]}>
              <Clock size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.metricValue}>{totalHours}h</Text>
            <Text style={styles.metricLabel}>Horas de Foco</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#eff6ff' }]}>
              <CheckSquare size={20} color="#2563eb" />
            </View>
            <Text style={styles.metricValue}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>Tarefas Ativas</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#fff7ed' }]}>
              <Flame size={20} color="#ea580c" />
            </View>
            <Text style={styles.metricValue}>{streak} dias</Text>
            <Text style={styles.metricLabel}>Sequência</Text>
          </Card>
        </View>

        {/* Quick Menu Shortcuts */}
        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/rotina')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: COLORS.primaryMuted }]}>
              <CalendarClock size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.shortcutLabel}>Rotina</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/atividade')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: COLORS.infoLight }]}>
              <Activity size={22} color={COLORS.info} />
            </View>
            <Text style={styles.shortcutLabel}>Compromissos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/rewards')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: COLORS.goldLight }]}>
              <Gift size={22} color={COLORS.gold} />
            </View>
            <Text style={styles.shortcutLabel}>Recompensas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/configuracoes')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: COLORS.borderStrong }]}>
              <Settings size={22} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.shortcutLabel}>Preferências</Text>
          </TouchableOpacity>
        </View>

        {/* Tasks and Deadlines Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Próximos prazos</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.addButton}
            onPress={() => setEditor({ tipo: 'prova' })}
          >
            <Plus size={16} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Nova</Text>
          </TouchableOpacity>
        </View>

        {carregandoAgenda || !agenda ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Nada para as próximas duas semanas"
            actionTitle="+ Novo prazo"
            onAction={() => setEditor({ tipo: 'prova' })}
          />
        ) : (
          tasks.map((task) => {
            const atrasado = task.data < hoje;
            const disciplina = nomeDisciplina(task.disciplinaId);
            return (
              <Card key={task.id} style={styles.taskCard}>
                <TouchableOpacity
                  accessibilityLabel={`Marcar ${task.titulo} como feito`}
                  activeOpacity={0.7}
                  style={styles.checkbox}
                  onPress={() => void alternarConcluido(task.id)}
                >
                  {task.concluido && <Check size={14} color="#ffffff" />}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} style={styles.taskInfo} onPress={() => setEditor(task)}>
                  <Text style={styles.taskTitle}>{task.titulo}</Text>
                  {disciplina ? (
                    <Text style={styles.taskDesc} numberOfLines={1}>
                      {disciplina}
                    </Text>
                  ) : null}
                  <View style={styles.taskMeta}>
                    <Badge label={ROTULO_TIPO[task.tipo]} variant={COR_TIPO[task.tipo].badge} size="sm" />
                    <Text style={[styles.taskDueDate, atrasado && { color: COLORS.danger }]}>
                      {task.data === hoje ? 'Hoje' : formatarData(task.data, true)}
                      {task.horaInicio ? ` · ${formatarHorario(task)}` : ''}
                      {atrasado ? ' · atrasado' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}

        {/* Study Distribution Section */}
        {distribution.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Tempo de Estudo por Disciplina
            </Text>
            <Card style={styles.distributionCard}>
              {distribution.map((item, idx) => (
                <View key={idx} style={styles.distributionRow}>
                  <View style={styles.distHeader}>
                    <Text style={styles.distName}>{item.name}</Text>
                    <Text style={styles.distHours}>{item.hours}h</Text>
                  </View>
                  <View style={styles.distProgressBarBg}>
                    <View
                      style={[
                        styles.distProgressBarFill,
                        {
                          backgroundColor: item.color,
                          width: `${Math.min(100, (item.hours / item.max) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      <CompromissoEditor visible={Boolean(editor)} disciplinas={agenda?.disciplinas ?? []} inicial={editor} onClose={() => setEditor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroContent: {},
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#d1fae5',
    lineHeight: 18,
    marginBottom: 16,
  },
  pomodoroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  pomodoroButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 12,
    alignItems: 'center',
  },
  metricIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  shortcutItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  shortcutIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  taskDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDueDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  deleteTaskButton: {
    padding: 6,
    marginLeft: 6,
  },
  distributionCard: {
    padding: 16,
  },
  distributionRow: {
    marginBottom: 12,
  },
  distHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  distHours: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  distProgressBarBg: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  typeOptionTextActive: {
    color: '#ffffff',
  },
});

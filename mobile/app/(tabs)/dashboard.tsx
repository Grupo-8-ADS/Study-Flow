import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  CheckSquare,
  Flame,
  Play,
  Plus,
  BookOpen,
  Activity,
  Gift,
  Settings,
  Trash2,
  Check,
} from 'lucide-react-native';
import {
  COLORS,
  ItemCronograma,
  StudyDistribution,
  isValidDateString,
  applyDateMask,
  toDatabaseDate,
  formatDisplayDate,
} from '@studyflow/shared';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { supabase } from '../../lib/supabase';

const DIST_COLORS = ['#29645e', '#348e83', '#e5a93b', '#f87171', '#a855f7'];

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [tasks, setTasks] = useState<ItemCronograma[]>([]);
  const [distribution, setDistribution] = useState<StudyDistribution[]>([]);

  // Modal new task state
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('Trabalho');
  const [taskDueDate, setTaskDueDate] = useState('');

  const calculateStreakFromDates = (dates: string[]) => {
    const uniqueDays = new Set(dates.filter(Boolean).map((d) => d.slice(0, 10)));
    if (uniqueDays.size === 0) return 0;

    let count = 0;
    const cursor = new Date();

    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!uniqueDays.has(key)) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  };

  const loadData = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setTasks([]);
        setDistribution([]);
        setTotalHours(0);
        setStreak(0);
        return;
      }

      const uid = userRes.user.id;

      // 1. Fetch deadlines/tasks
      const { data: tasksData } = await supabase
        .from('itens_cronograma')
        .select('*')
        .eq('user_id', uid)
        .neq('tipo', 'atividade')
        .order('data_fim', { ascending: true });

      setTasks(tasksData || []);

      // 2. Fetch study sessions for metrics and distribution
      const { data: sessionsData } = await supabase
        .from('sessoes_estudo')
        .select('duracao_efetiva_min, data_inicio, disciplina_id, disciplinas(nome)')
        .eq('user_id', uid);

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
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleTask = async (id: string, currentCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('itens_cronograma')
        .update({ completed: !currentCompleted })
        .eq('id', id);

      if (error) {
        Alert.alert('Erro', 'Não foi possível atualizar o status da tarefa.');
        return;
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !currentCompleted } : t))
      );
    } catch (e) {
      console.error('Error toggling task:', e);
    }
  };

  const handleDeleteTask = (id: string) => {
    Alert.alert('Excluir Tarefa', 'Deseja realmente remover esta tarefa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('itens_cronograma').delete().eq('id', id);
            if (error) {
              Alert.alert('Erro', 'Não foi possível excluir a tarefa.');
              return;
            }
            setTasks((prev) => prev.filter((t) => t.id !== id));
          } catch (e) {
            console.error('Error deleting task:', e);
          }
        },
      },
    ]);
  };

  const handleAddTask = async () => {
    if (!taskName.trim()) {
      Alert.alert('Atenção', 'Informe o título da tarefa.');
      return;
    }

    if (taskDueDate.trim() && !isValidDateString(taskDueDate.trim())) {
      Alert.alert('Data Inválida', 'Informe uma data válida no formato DD/MM/AAAA (ex: 15/09/2026).');
      return;
    }

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        Alert.alert('Sessão expirada', 'Faça login novamente.');
        return;
      }

      const dbDate = toDatabaseDate(taskDueDate.trim());

      const { data, error } = await supabase
        .from('itens_cronograma')
        .insert({
          user_id: userRes.user.id,
          nome: taskName.trim(),
          tipo: taskType,
          prioridade: taskType === 'Prova' ? 2 : taskType === 'Trabalho' ? 1 : 0,
          data_fim: dbDate ? `${dbDate}T23:59:00` : new Date().toISOString(),
          completed: false,
        })
        .select()
        .single();

      if (error || !data) {
        Alert.alert('Erro', error?.message || 'Não foi possível salvar a tarefa.');
        return;
      }

      setTasks((prev) => [data, ...prev]);
      setTaskName('');
      setTaskDueDate('');
      setModalVisible(false);
    } catch (e) {
      console.error('Error creating task:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar a tarefa.');
    }
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;

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
        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/disciplinas')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#eaf6f4' }]}>
              <BookOpen size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.shortcutLabel}>Disciplinas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/atividade')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <Activity size={22} color="#0284c7" />
            </View>
            <Text style={styles.shortcutLabel}>Atividades</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/rewards')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Gift size={22} color="#d97706" />
            </View>
            <Text style={styles.shortcutLabel}>Recompensas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.shortcutItem}
            onPress={() => router.push('/configuracoes')}
          >
            <View style={[styles.shortcutIconCircle, { backgroundColor: '#f1f5f9' }]}>
              <Settings size={22} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.shortcutLabel}>Configurações</Text>
          </TouchableOpacity>
        </View>

        {/* Tasks and Deadlines Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Próximos Prazos & Entregas</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Nova</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Nenhum prazo cadastrado"
            description="Adicione suas próximas provas e entregas para não perder as datas."
            actionTitle="+ Adicionar Tarefa"
            onAction={() => setModalVisible(true)}
          />
        ) : (
          tasks.map((task) => (
            <Card key={task.id} style={styles.taskCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.checkbox,
                  task.completed && styles.checkboxChecked,
                ]}
                onPress={() => handleToggleTask(task.id, task.completed)}
              >
                {task.completed && <Check size={14} color="#ffffff" />}
              </TouchableOpacity>

              <View style={styles.taskInfo}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.completed && styles.taskTitleCompleted,
                  ]}
                >
                  {task.nome}
                </Text>
                {Boolean(task.descricao) && (
                  <Text style={styles.taskDesc} numberOfLines={2}>
                    {task.descricao}
                  </Text>
                )}
                <View style={styles.taskMeta}>
                  <Badge
                    label={task.tipo}
                    variant={
                      task.tipo === 'Prova'
                        ? 'danger'
                        : task.tipo === 'Trabalho'
                        ? 'warning'
                        : 'primary'
                    }
                    size="sm"
                  />
                  {Boolean(task.data_fim) && (
                    <Text style={styles.taskDueDate}>
                      📅 {formatDisplayDate(task.data_fim)}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleDeleteTask(task.id)}
                style={styles.deleteTaskButton}
              >
                <Trash2 size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </Card>
          ))
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

      {/* Add Task Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Adicionar Novo Prazo"
        variant="bottom"
      >
        <Input
          label="Título da Tarefa ou Entrega"
          placeholder="ex: Prova de Estruturas de Dados"
          value={taskName}
          onChangeText={setTaskName}
        />

        <Text style={styles.modalFieldLabel}>Tipo</Text>
        <View style={styles.typeSelector}>
          {['Trabalho', 'Prova', 'Estudo'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeOption,
                taskType === type && styles.typeOptionActive,
              ]}
              onPress={() => setTaskType(type)}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  taskType === type && styles.typeOptionTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Data Prevista (DD/MM/AAAA)"
          placeholder="ex: 15/09/2026"
          value={taskDueDate}
          onChangeText={(val) => setTaskDueDate(applyDateMask(val))}
        />

        <Button
          title="Salvar Tarefa"
          onPress={handleAddTask}
          size="lg"
          style={{ marginTop: 12 }}
        />
      </Modal>
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
    fontWeight: '900',
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
    fontWeight: '800',
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
    fontWeight: '800',
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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
import { COLORS, ItemCronograma, StudyDistribution } from '@studyflow/shared';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Storage } from '../../lib/storage';

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(3);
  const [totalHours, setTotalHours] = useState(14.5);

  const defaultTasks: ItemCronograma[] = [
    {
      id: '1',
      user_id: 'user-1',
      nome: 'Trabalho de Engenharia de Software',
      tipo: 'Trabalho',
      prioridade: 1,
      data_fim: '2026-08-25',
      completed: false,
      descricao: 'Entrega da primeira versão do diagrama de casos de uso',
    },
    {
      id: '2',
      user_id: 'user-1',
      nome: 'Prova de Banco de Dados II',
      tipo: 'Prova',
      prioridade: 2,
      data_fim: '2026-08-28',
      completed: false,
      descricao: 'Conteúdo: Transações ACID e Otimização de Queries',
    },
    {
      id: '3',
      user_id: 'user-1',
      nome: 'Leitura de Artigo sobre Algoritmos',
      tipo: 'Estudo',
      prioridade: 0,
      data_fim: '2026-08-22',
      completed: true,
      descricao: 'Capítulo 4 do livro texto',
    },
  ];

  const [tasks, setTasks] = useState<ItemCronograma[]>(defaultTasks);

  const [distribution, setDistribution] = useState<StudyDistribution[]>([
    { name: 'História', hours: 5.5, max: 8, color: '#29645e' },
    { name: 'Banco de Dados', hours: 4.0, max: 8, color: '#348e83' },
    { name: 'Engenharia de Software', hours: 3.0, max: 8, color: '#e5a93b' },
    { name: 'Cálculo I', hours: 2.0, max: 8, color: '#f87171' },
  ]);

  const tasksStorageKey = `${Storage.keys.ITENS_PREFIX}${session?.email || 'default'}`;

  // Modal new task state
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('Trabalho');
  const [taskDueDate, setTaskDueDate] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    const saved = await Storage.getItem<ItemCronograma[]>(tasksStorageKey, defaultTasks);
    setTasks(saved);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const persistTasks = async (updated: ItemCronograma[]) => {
    setTasks(updated);
    await Storage.setItem(tasksStorageKey, updated);
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    persistTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    persistTasks(updated);
  };

  const handleAddTask = () => {
    if (!taskName.trim()) return;

    const newTask: ItemCronograma = {
      id: Date.now().toString(),
      user_id: session?.email || 'local',
      nome: taskName.trim(),
      tipo: taskType,
      prioridade: 1,
      data_fim: taskDueDate || new Date().toISOString().slice(0, 10),
      completed: false,
    };

    persistTasks([newTask, ...tasks]);
    setTaskName('');
    setTaskDueDate('');
    setModalVisible(false);
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
            onRefresh={loadData}
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

        {tasks.length === 0 ? (
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
                onPress={() => handleToggleTask(task.id)}
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
                {task.descricao && (
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
                  {task.data_fim && (
                    <Text style={styles.taskDueDate}>
                      📅 {task.data_fim}
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
          label="Data Prevista (AAAA-MM-DD)"
          placeholder="ex: 2026-09-10"
          value={taskDueDate}
          onChangeText={setTaskDueDate}
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
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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

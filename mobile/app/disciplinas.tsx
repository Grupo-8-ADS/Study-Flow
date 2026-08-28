import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react-native';
import { COLORS, Disciplina } from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Storage } from '../lib/storage';
import { useAuth } from '../context/AuthContext';

const DEFAULT_DISCIPLINAS: Disciplina[] = [
  {
    id: '1',
    user_id: 'user-1',
    nome: 'História Geral e do Brasil',
    professor: 'Prof. Marcos Souza',
    data_inicio: '08:00',
    data_fim: '10:00',
    anotacoes: 'Foco na leitura dos textos da aula 3 sobre República Velha.',
  },
  {
    id: '2',
    user_id: 'user-1',
    nome: 'Banco de Dados II',
    professor: 'Profª. Juliana Alves',
    data_inicio: '10:00',
    data_fim: '12:00',
    anotacoes: 'Trabalho prático de PostgreSQL com triggers e RLS.',
  },
  {
    id: '3',
    user_id: 'user-1',
    nome: 'Engenharia de Software',
    professor: 'Prof. Carlos Santos',
    data_inicio: '14:00',
    data_fim: '16:00',
    anotacoes: 'Seminário sobre Arquitetura Monorepo e React Native.',
  },
];

export default function DisciplinasScreen() {
  const { session } = useAuth();
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(DEFAULT_DISCIPLINAS);

  const storageKey = `${Storage.keys.DISCIPLINAS_PREFIX}${session?.email || 'default'}`;

  useEffect(() => {
    async function loadData() {
      const saved = await Storage.getItem<Disciplina[]>(storageKey, DEFAULT_DISCIPLINAS);
      setDisciplinas(saved);
    }
    loadData();
  }, [session]);

  const persistDisciplinas = async (updated: Disciplina[]) => {
    setDisciplinas(updated);
    await Storage.setItem(storageKey, updated);
  };

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [professor, setProfessor] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('10:00');
  const [dataProva, setDataProva] = useState('');
  const [dataTrabalho, setDataTrabalho] = useState('');
  const [anotacoes, setAnotacoes] = useState('');

  const openCreateModal = () => {
    setEditingId(null);
    setNome('');
    setProfessor('');
    setHorarioInicio('08:00');
    setHorarioFim('10:00');
    setDataProva('');
    setDataTrabalho('');
    setAnotacoes('');
    setModalVisible(true);
  };

  const openEditModal = (d: Disciplina) => {
    setEditingId(d.id);
    setNome(d.nome);
    setProfessor(d.professor || '');
    setHorarioInicio(d.data_inicio || '08:00');
    setHorarioFim(d.data_fim || '10:00');
    setDataProva('');
    setDataTrabalho('');
    setAnotacoes(typeof d.anotacoes === 'string' ? d.anotacoes : '');
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome da disciplina.');
      return;
    }

    if (editingId) {
      const updated = disciplinas.map((item) =>
        item.id === editingId
          ? {
              ...item,
              nome: nome.trim(),
              professor: professor.trim(),
              data_inicio: horarioInicio,
              data_fim: horarioFim,
              anotacoes: anotacoes.trim(),
            }
          : item
      );
      persistDisciplinas(updated);
    } else {
      const newD: Disciplina = {
        id: Date.now().toString(),
        user_id: session?.email || 'user-1',
        nome: nome.trim(),
        professor: professor.trim(),
        data_inicio: horarioInicio,
        data_fim: horarioFim,
        anotacoes: anotacoes.trim(),
      };
      persistDisciplinas([...disciplinas, newD]);
    }

    setModalVisible(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Excluir Disciplina',
      `Tem certeza que deseja remover "${name}"? Todas as anotações vinculadas serão apagadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            const updated = disciplinas.filter((d) => d.id !== id);
            persistDisciplinas(updated);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Minhas Matérias</Text>
            <Text style={styles.pageSubtitle}>
              {disciplinas.length} {disciplinas.length === 1 ? 'disciplina cadastrada' : 'disciplinas cadastradas'}
            </Text>
          </View>

          <Button
            title="+ Disciplina"
            onPress={openCreateModal}
            size="sm"
            icon={<Plus size={16} color="#ffffff" />}
          />
        </View>

        {disciplinas.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina cadastrada"
            description="Cadastre suas matérias da faculdade ou colégio para organizar seus estudos."
            icon={<BookOpen size={28} color={COLORS.primary} />}
            actionTitle="+ Cadastrar Matéria"
            onAction={openCreateModal}
          />
        ) : (
          disciplinas.map((d) => (
            <Card key={d.id} style={styles.subjectCard}>
              <View style={styles.cardTopRow}>
                <View style={styles.iconCircle}>
                  <BookOpen size={20} color={COLORS.primary} />
                </View>
                <View style={styles.titleInfo}>
                  <Text style={styles.subjectName}>{d.nome}</Text>
                  {Boolean(d.professor) && (
                    <Text style={styles.professorName}>👨‍🏫 {d.professor}</Text>
                  )}
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openEditModal(d)}
                    style={styles.actionIconBtn}
                  >
                    <Edit2 size={16} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleDelete(d.id, d.nome)}
                    style={styles.actionIconBtn}
                  >
                    <Trash2 size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {d.data_inicio} às {d.data_fim}
                  </Text>
                </View>
              </View>

              {Boolean(d.anotacoes) && (
                <View style={styles.notesContainer}>
                  <FileText size={14} color={COLORS.primaryLight} style={{ marginTop: 2 }} />
                  <Text style={styles.notesText} numberOfLines={2}>
                    {typeof d.anotacoes === 'string' ? d.anotacoes : ''}
                  </Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Subject Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Editar Disciplina' : 'Nova Disciplina'}
        variant="bottom"
      >
        <Input
          label="Nome da Disciplina *"
          placeholder="ex: Cálculo Diferencial e Integral"
          value={nome}
          onChangeText={setNome}
        />

        <Input
          label="Nome do Professor (opcional)"
          placeholder="ex: Prof. Fernando Silva"
          value={professor}
          onChangeText={setProfessor}
        />

        <View style={styles.inputsRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              label="Horário Início"
              placeholder="08:00"
              value={horarioInicio}
              onChangeText={setHorarioInicio}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Input
              label="Horário Fim"
              placeholder="10:00"
              value={horarioFim}
              onChangeText={setHorarioFim}
            />
          </View>
        </View>

        <Input
          label="Data da Prova 1 (opcional)"
          placeholder="ex: 2026-09-15"
          value={dataProva}
          onChangeText={setDataProva}
        />

        <Input
          label="Data do Trabalho 1 (opcional)"
          placeholder="ex: 2026-09-22"
          value={dataTrabalho}
          onChangeText={setDataTrabalho}
        />

        <Input
          label="Anotações Gerais"
          placeholder="Bibliografia, links, avisos..."
          value={anotacoes}
          onChangeText={setAnotacoes}
          multiline
        />

        <Button
          title={editingId ? 'Salvar Alterações' : 'Cadastrar Disciplina'}
          onPress={handleSave}
          size="lg"
          style={{ marginTop: 8 }}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pageSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subjectCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  professorName: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  inputsRow: {
    flexDirection: 'row',
  },
});

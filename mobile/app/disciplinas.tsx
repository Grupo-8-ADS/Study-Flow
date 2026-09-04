import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  Clock,
  FileText,
  Calendar,
} from 'lucide-react-native';
import {
  COLORS,
  Disciplina,
  isValidDateString,
  isValidTimeString,
  isTimeIntervalValid,
  applyDateMask,
  applyTimeMask,
  toDatabaseDate,
  formatDisplayDate,
} from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function DisciplinasScreen() {
  const { session } = useAuth();
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadDisciplinas = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setDisciplinas([]);
        return;
      }

      const { data, error } = await supabase
        .from('disciplinas')
        .select('*')
        .eq('user_id', userRes.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching disciplinas:', error);
      } else {
        setDisciplinas(data || []);
      }
    } catch (e) {
      console.error('Failed to load disciplinas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisciplinas();
  }, [session]);

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

    const notesObj = typeof d.anotacoes === 'object' && d.anotacoes !== null ? (d.anotacoes as any) : {};
    setHorarioInicio(notesObj.startTime || '08:00');
    setHorarioFim(notesObj.endTime || '10:00');
    setDataProva(formatDisplayDate(notesObj.examDate || ''));
    setDataTrabalho(formatDisplayDate(notesObj.workDate || ''));
    setAnotacoes(typeof d.anotacoes === 'string' ? d.anotacoes : notesObj.notes || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome da disciplina.');
      return;
    }

    if (horarioInicio.trim() && !isValidTimeString(horarioInicio.trim())) {
      Alert.alert('Horário Inválido', 'Informe um horário de início válido no formato HH:MM (ex: 08:00).');
      return;
    }

    if (horarioFim.trim() && !isValidTimeString(horarioFim.trim())) {
      Alert.alert('Horário Inválido', 'Informe um horário de término válido no formato HH:MM (ex: 10:00).');
      return;
    }

    if (
      horarioInicio.trim() &&
      horarioFim.trim() &&
      !isTimeIntervalValid(horarioInicio.trim(), horarioFim.trim())
    ) {
      Alert.alert('Horário Inconsistente', 'O horário de término deve ser posterior ao horário de início.');
      return;
    }

    if (dataProva.trim() && !isValidDateString(dataProva.trim())) {
      Alert.alert('Data Inválida', 'Informe uma data de prova válida no formato DD/MM/AAAA (ex: 15/09/2026).');
      return;
    }

    if (dataTrabalho.trim() && !isValidDateString(dataTrabalho.trim())) {
      Alert.alert('Data Inválida', 'Informe uma data de trabalho válida no formato DD/MM/AAAA (ex: 22/09/2026).');
      return;
    }

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        Alert.alert('Sessão expirada', 'Por favor, faça login novamente.');
        return;
      }

      const notesPayload = {
        notes: anotacoes.trim(),
        examDate: toDatabaseDate(dataProva) || null,
        workDate: toDatabaseDate(dataTrabalho) || null,
        startTime: horarioInicio.trim() || '08:00',
        endTime: horarioFim.trim() || '10:00',
      };

      if (editingId) {
        const { error } = await supabase
          .from('disciplinas')
          .update({
            nome: nome.trim(),
            professor: professor.trim() || null,
            data_inicio: null,
            data_fim: null,
            anotacoes: notesPayload,
          })
          .eq('id', editingId)
          .eq('user_id', userRes.user.id);

        if (error) {
          Alert.alert('Erro', error.message || 'Não foi possível atualizar a disciplina.');
          return;
        }

        setDisciplinas((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  nome: nome.trim(),
                  professor: professor.trim(),
                  data_inicio: null,
                  data_fim: null,
                  anotacoes: notesPayload,
                }
              : item
          )
        );
      } else {
        const { data, error } = await supabase
          .from('disciplinas')
          .insert({
            user_id: userRes.user.id,
            nome: nome.trim(),
            professor: professor.trim() || null,
            data_inicio: null,
            data_fim: null,
            anotacoes: notesPayload,
          })
          .select()
          .single();

        if (error || !data) {
          Alert.alert('Erro', error?.message || 'Não foi possível cadastrar a disciplina.');
          return;
        }

        setDisciplinas((prev) => [data, ...prev]);
      }

      setModalVisible(false);
    } catch (e: any) {
      console.error('Error saving subject:', e);
      Alert.alert('Erro', e.message || 'Ocorreu um erro ao salvar a disciplina.');
    }
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
          onPress: async () => {
            try {
              const { error } = await supabase.from('disciplinas').delete().eq('id', id);
              if (error) {
                Alert.alert('Erro', 'Não foi possível excluir a disciplina.');
                return;
              }
              setDisciplinas((prev) => prev.filter((d) => d.id !== id));
            } catch (e) {
              console.error('Error deleting subject:', e);
            }
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Carregando disciplinas...</Text>
          </View>
        ) : disciplinas.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina cadastrada"
            description="Cadastre suas matérias da faculdade ou colégio para organizar seus estudos."
            icon={<BookOpen size={28} color={COLORS.primary} />}
            actionTitle="+ Cadastrar Matéria"
            onAction={openCreateModal}
          />
        ) : (
          disciplinas.map((d) => {
            const notesObj = typeof d.anotacoes === 'object' && d.anotacoes !== null ? (d.anotacoes as any) : {};
            const displayNotes = typeof d.anotacoes === 'string' ? d.anotacoes : notesObj.notes || '';

            return (
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
                      {d.data_inicio || notesObj.startTime || '--:--'} às {d.data_fim || notesObj.endTime || '--:--'}
                    </Text>
                  </View>

                  {Boolean(notesObj.examDate) && (
                    <View style={styles.metaItem}>
                      <Calendar size={14} color={COLORS.danger} />
                      <Text style={[styles.metaText, { color: COLORS.danger }]}>
                        Prova: {formatDisplayDate(notesObj.examDate)}
                      </Text>
                    </View>
                  )}
                  {Boolean(notesObj.workDate) && (
                    <View style={styles.metaItem}>
                      <Calendar size={14} color={COLORS.primary} />
                      <Text style={[styles.metaText, { color: COLORS.primary }]}>
                        Trabalho: {formatDisplayDate(notesObj.workDate)}
                      </Text>
                    </View>
                  )}
                </View>

                {Boolean(displayNotes) && (
                  <View style={styles.notesContainer}>
                    <FileText size={14} color={COLORS.primaryLight} style={{ marginTop: 2 }} />
                    <Text style={styles.notesText} numberOfLines={2}>
                      {displayNotes}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })
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
              onChangeText={(val) => setHorarioInicio(applyTimeMask(val))}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Input
              label="Horário Fim"
              placeholder="10:00"
              value={horarioFim}
              onChangeText={(val) => setHorarioFim(applyTimeMask(val))}
            />
          </View>
        </View>

        <Input
          label="Data da Prova 1 (opcional)"
          placeholder="ex: 15/09/2026"
          value={dataProva}
          onChangeText={(val) => setDataProva(applyDateMask(val))}
        />

        <Input
          label="Data do Trabalho 1 (opcional)"
          placeholder="ex: 22/09/2026"
          value={dataTrabalho}
          onChangeText={(val) => setDataTrabalho(applyDateMask(val))}
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
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
    flexWrap: 'wrap',
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

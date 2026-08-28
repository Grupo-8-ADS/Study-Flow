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
  Activity as ActivityIcon,
  Clock,
  Calendar,
  Edit2,
  Trash2,
  FileText,
} from 'lucide-react-native';
import {
  COLORS,
  ItemCronograma,
  isValidDateString,
  isValidTimeString,
  isTimeIntervalValid,
  applyDateMask,
  applyTimeMask,
} from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AtividadeScreen() {
  const { session } = useAuth();
  const [atividades, setAtividades] = useState<ItemCronograma[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Create/Edit State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [dataAtividade, setDataAtividade] = useState(new Date().toISOString().slice(0, 10));
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFim, setHorarioFim] = useState('10:00');
  const [anotacoes, setAnotacoes] = useState('');

  // View Details Modal State
  const [selectedAtividade, setSelectedAtividade] = useState<ItemCronograma | null>(null);

  const loadAtividades = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setAtividades([]);
        return;
      }

      const { data, error } = await supabase
        .from('itens_cronograma')
        .select('*')
        .eq('user_id', userRes.user.id)
        .eq('tipo', 'atividade')
        .order('data_inicio', { ascending: true });

      if (error) {
        console.error('Error loading atividades:', error);
      } else {
        setAtividades(data || []);
      }
    } catch (e) {
      console.error('Failed to load atividades:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAtividades();
  }, [session]);

  const openCreateModal = () => {
    setEditingId(null);
    setNome('');
    setDataAtividade(new Date().toISOString().slice(0, 10));
    setHorarioInicio('09:00');
    setHorarioFim('10:00');
    setAnotacoes('');
    setModalVisible(true);
  };

  const openEditModal = (a: ItemCronograma) => {
    setEditingId(a.id);
    setNome(a.nome);
    setDataAtividade(a.data_inicio?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setHorarioInicio(a.data_inicio?.slice(11, 16) || '09:00');
    setHorarioFim(a.data_fim?.slice(11, 16) || '10:00');
    setAnotacoes(a.descricao || '');
    if (selectedAtividade) setSelectedAtividade(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome da atividade.');
      return;
    }

    if (dataAtividade.trim() && !isValidDateString(dataAtividade.trim())) {
      Alert.alert('Data Inválida', 'Informe uma data válida no formato AAAA-MM-DD (ex: 2026-08-21).');
      return;
    }

    if (horarioInicio.trim() && !isValidTimeString(horarioInicio.trim())) {
      Alert.alert('Horário Inválido', 'Informe um horário de início válido no formato HH:MM (ex: 09:00).');
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

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        Alert.alert('Sessão expirada', 'Faça login novamente.');
        return;
      }

      const cleanDate = dataAtividade.trim() || new Date().toISOString().slice(0, 10);
      const cleanStart = horarioInicio.trim() || '09:00';
      const cleanEnd = horarioFim.trim() || '10:00';

      const payload = {
        nome: nome.trim(),
        tipo: 'atividade',
        prioridade: 1,
        data_inicio: `${cleanDate}T${cleanStart}:00`,
        data_fim: `${cleanDate}T${cleanEnd}:00`,
        descricao: anotacoes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('itens_cronograma')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', userRes.user.id);

        if (error) {
          Alert.alert('Erro', 'Não foi possível atualizar a atividade.');
          return;
        }

        setAtividades((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  ...payload,
                }
              : item
          )
        );
      } else {
        const { data, error } = await supabase
          .from('itens_cronograma')
          .insert({
            user_id: userRes.user.id,
            completed: false,
            ...payload,
          })
          .select()
          .single();

        if (error || !data) {
          Alert.alert('Erro', 'Não foi possível criar a atividade.');
          return;
        }

        setAtividades((prev) => [data, ...prev]);
      }

      setModalVisible(false);
    } catch (e) {
      console.error('Error saving activity:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar a atividade.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Excluir Atividade',
      `Deseja realmente apagar a atividade "${name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('itens_cronograma').delete().eq('id', id);
              if (error) {
                Alert.alert('Erro', 'Não foi possível excluir a atividade.');
                return;
              }
              setAtividades((prev) => prev.filter((a) => a.id !== id));
              if (selectedAtividade?.id === id) {
                setSelectedAtividade(null);
              }
            } catch (e) {
              console.error('Error deleting activity:', e);
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
            <Text style={styles.pageTitle}>Atividades & Rotina</Text>
            <Text style={styles.pageSubtitle}>
              {atividades.length} {atividades.length === 1 ? 'compromisso registrado' : 'compromissos registrados'}
            </Text>
          </View>

          <Button
            title="+ Atividade"
            onPress={openCreateModal}
            size="sm"
            icon={<Plus size={16} color="#ffffff" />}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Carregando atividades...</Text>
          </View>
        ) : atividades.length === 0 ? (
          <EmptyState
            title="Nenhuma atividade registrada"
            description="Cadastre seus compromissos diários e rotinas para manter o dia organizado."
            icon={<ActivityIcon size={28} color={COLORS.primary} />}
            actionTitle="+ Nova Atividade"
            onAction={openCreateModal}
          />
        ) : (
          atividades.map((item) => (
            <Card
              key={item.id}
              style={styles.activityCard}
              onPress={() => setSelectedAtividade(item)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.iconCircle}>
                  <ActivityIcon size={18} color={COLORS.primary} />
                </View>
                <View style={styles.titleInfo}>
                  <Text style={styles.activityName}>{item.nome}</Text>
                  <Text style={styles.timeText}>
                    ⏰ {item.data_inicio?.slice(11, 16)} - {item.data_fim?.slice(11, 16)}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openEditModal(item)}
                    style={styles.actionIconBtn}
                  >
                    <Edit2 size={16} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleDelete(item.id, item.nome)}
                    style={styles.actionIconBtn}
                  >
                    <Trash2 size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              {Boolean(item.descricao) && (
                <View style={styles.notesContainer}>
                  <FileText size={13} color={COLORS.textMuted} style={{ marginTop: 2 }} />
                  <Text style={styles.notesText} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Activity Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Editar Atividade' : 'Nova Atividade'}
        variant="bottom"
      >
        <Input
          label="Nome da Atividade *"
          placeholder="ex: Academia, Médico, Aula de Inglês..."
          value={nome}
          onChangeText={setNome}
        />

        <Input
          label="Data (AAAA-MM-DD)"
          placeholder="2026-08-21"
          value={dataAtividade}
          onChangeText={(val) => setDataAtividade(applyDateMask(val))}
        />

        <View style={styles.inputsRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              label="Horário Início"
              placeholder="09:00"
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
          label="Anotações / Detalhes"
          placeholder="Local, orientações, lembretes..."
          value={anotacoes}
          onChangeText={setAnotacoes}
          multiline
        />

        <Button
          title={editingId ? 'Salvar Alterações' : 'Cadastrar Atividade'}
          onPress={handleSave}
          size="lg"
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* View Activity Details Modal */}
      <Modal
        visible={Boolean(selectedAtividade)}
        onClose={() => setSelectedAtividade(null)}
        title="Visualização da Atividade"
        variant="bottom"
      >
        {selectedAtividade && (
          <View style={{ paddingVertical: 8 }}>
            <Text style={styles.viewDetailTitle}>{selectedAtividade.nome}</Text>

            <View style={styles.viewDetailMetaRow}>
              <Clock size={16} color={COLORS.primary} />
              <Text style={styles.viewDetailMetaText}>
                {selectedAtividade.data_inicio?.slice(11, 16)} às{' '}
                {selectedAtividade.data_fim?.slice(11, 16)}
              </Text>
            </View>

            <View style={styles.viewDetailMetaRow}>
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.viewDetailMetaText}>
                Data: {selectedAtividade.data_inicio?.slice(0, 10)}
              </Text>
            </View>

            {Boolean(selectedAtividade.descricao) && (
              <View style={styles.viewDetailNotesBox}>
                <Text style={styles.viewDetailNotesLabel}>Anotações:</Text>
                <Text style={styles.viewDetailNotesText}>
                  {selectedAtividade.descricao}
                </Text>
              </View>
            )}

            <View style={styles.viewDetailActions}>
              <Button
                title="Editar"
                variant="outline"
                onPress={() => openEditModal(selectedAtividade)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Excluir"
                variant="danger"
                onPress={() => handleDelete(selectedAtividade.id, selectedAtividade.nome)}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        )}
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
  activityCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: '600',
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
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
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
  viewDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 12,
  },
  viewDetailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  viewDetailMetaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  viewDetailNotesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  viewDetailNotesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  viewDetailNotesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  viewDetailActions: {
    flexDirection: 'row',
    marginTop: 14,
  },
});

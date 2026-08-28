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
  Activity as ActivityIcon,
  Clock,
  Calendar,
  Edit2,
  Trash2,
  FileText,
  CheckCircle2,
} from 'lucide-react-native';
import { COLORS, ItemCronograma } from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Storage } from '../lib/storage';
import { useAuth } from '../context/AuthContext';

const DEFAULT_ATIVIDADES: ItemCronograma[] = [
  {
    id: '1',
    user_id: 'user-1',
    nome: 'Academia & Exercícios',
    tipo: 'atividade',
    prioridade: 1,
    data_inicio: '2026-08-21T09:00:00',
    data_fim: '2026-08-21T10:00:00',
    descricao: 'Levar garrafa de água e toalha.',
    completed: false,
  },
  {
    id: '2',
    user_id: 'user-1',
    nome: 'Consulta Médica de Rotina',
    tipo: 'atividade',
    prioridade: 2,
    data_inicio: '2026-08-21T14:00:00',
    data_fim: '2026-08-21T15:00:00',
    descricao: 'Clínica São Lucas - Rua 2, Bairro 3. Levar exames anteriores.',
    completed: false,
  },
  {
    id: '3',
    user_id: 'user-1',
    nome: 'Evento Acadêmico / Palestra',
    tipo: 'atividade',
    prioridade: 0,
    data_inicio: '2026-08-21T21:00:00',
    data_fim: '2026-08-21T23:00:00',
    descricao: 'Auditório Principal do Bloco Central.',
    completed: false,
  },
];

export default function AtividadeScreen() {
  const { session } = useAuth();
  const [atividades, setAtividades] = useState<ItemCronograma[]>(DEFAULT_ATIVIDADES);

  const storageKey = `${Storage.keys.ACTIVITY_PREFIX}${session?.email || 'default'}_itens`;

  useEffect(() => {
    async function loadData() {
      const saved = await Storage.getItem<ItemCronograma[]>(storageKey, DEFAULT_ATIVIDADES);
      setAtividades(saved);
    }
    loadData();
  }, [session]);

  const persistAtividades = async (updated: ItemCronograma[]) => {
    setAtividades(updated);
    await Storage.setItem(storageKey, updated);
  };

  // Modal Create/Edit State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [dataAtividade, setDataAtividade] = useState('2026-08-21');
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFim, setHorarioFim] = useState('10:00');
  const [anotacoes, setAnotacoes] = useState('');

  // View Details Modal State
  const [selectedAtividade, setSelectedAtividade] = useState<ItemCronograma | null>(null);

  const openCreateModal = () => {
    setEditingId(null);
    setNome('');
    setDataAtividade('2026-08-21');
    setHorarioInicio('09:00');
    setHorarioFim('10:00');
    setAnotacoes('');
    setModalVisible(true);
  };

  const openEditModal = (a: ItemCronograma) => {
    setEditingId(a.id);
    setNome(a.nome);
    setDataAtividade(a.data_inicio?.slice(0, 10) || '2026-08-21');
    setHorarioInicio(a.data_inicio?.slice(11, 16) || '09:00');
    setHorarioFim(a.data_fim?.slice(11, 16) || '10:00');
    setAnotacoes(a.descricao || '');
    if (selectedAtividade) setSelectedAtividade(null);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome da atividade.');
      return;
    }

    if (editingId) {
      const updated = atividades.map((item) =>
        item.id === editingId
          ? {
              ...item,
              nome: nome.trim(),
              data_inicio: `${dataAtividade}T${horarioInicio}:00`,
              data_fim: `${dataAtividade}T${horarioFim}:00`,
              descricao: anotacoes.trim(),
            }
          : item
      );
      persistAtividades(updated);
    } else {
      const newA: ItemCronograma = {
        id: Date.now().toString(),
        user_id: session?.email || 'user-1',
        nome: nome.trim(),
        tipo: 'atividade',
        prioridade: 1,
        data_inicio: `${dataAtividade}T${horarioInicio}:00`,
        data_fim: `${dataAtividade}T${horarioFim}:00`,
        descricao: anotacoes.trim(),
        completed: false,
      };
      persistAtividades([...atividades, newA]);
    }

    setModalVisible(false);
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
          onPress: () => {
            const updated = atividades.filter((a) => a.id !== id);
            persistAtividades(updated);
            if (selectedAtividade?.id === id) {
              setSelectedAtividade(null);
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

        {atividades.length === 0 ? (
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
          onChangeText={setDataAtividade}
        />

        <View style={styles.inputsRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              label="Horário Início"
              placeholder="09:00"
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

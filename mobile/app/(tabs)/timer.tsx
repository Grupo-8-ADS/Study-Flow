import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Play, Pause, RotateCcw, BookOpen, FileText, CheckCircle2 } from 'lucide-react-native';
import { COLORS, TimerMode, POMODORO_TIMES } from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function TimerScreen() {
  const { session, refreshProfile } = useAuth();

  const [mode, setMode] = useState<TimerMode>('foco');
  const [timeLeft, setTimeLeft] = useState<number>(POMODORO_TIMES.foco);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<{ id: string | null; nome: string }>({
    id: null,
    nome: 'Geral',
  });
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; nome: string }>>([]);
  const [notes, setNotes] = useState<string>('');
  const [subjectModalVisible, setSubjectModalVisible] = useState<boolean>(false);

  const totalDuration = POMODORO_TIMES[mode];
  const progress = (totalDuration - timeLeft) / totalDuration;

  // Load user disciplines for dropdown
  useEffect(() => {
    async function loadDisciplinas() {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        const { data } = await supabase
          .from('disciplinas')
          .select('id, nome')
          .eq('user_id', userRes.user.id)
          .order('nome', { ascending: true });

        if (data && data.length > 0) {
          setSubjectsList(data);
          if (!selectedSubject.id) {
            setSelectedSubject({ id: data[0].id, nome: data[0].nome });
          }
        } else {
          setSubjectsList([]);
        }
      } catch (e) {
        console.error('Failed to load timer disciplines:', e);
      }
    }

    loadDisciplinas();
  }, [session]);

  // Timer interval handling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval!);
            setIsActive(false);
            handleTimerCompleted();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, mode]);

  const handleTimerCompleted = async () => {
    if (mode === 'foco') {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes.user) {
          // 1. Record study session in Supabase
          await supabase.from('sessoes_estudo').insert({
            user_id: userRes.user.id,
            disciplina_id: selectedSubject.id,
            duracao_efetiva_min: 25,
            status: 'concluida',
            exp: 25,
            notas: notes.trim() || null,
          });

          // 2. Increment XP in profiles
          const currentXp = session?.xp || 0;
          const newXp = currentXp + 25;
          const newNivel = Math.floor(newXp / 100) + 1;

          await supabase
            .from('profiles')
            .update({ xp: newXp, nivel_atual: newNivel })
            .eq('id', userRes.user.id);

          await refreshProfile();
        }
      } catch (e) {
        console.error('Error saving study session:', e);
      }

      Alert.alert(
        'Sessão Concluída! 🎉',
        `Parabéns! Você completou 25 minutos de foco em ${selectedSubject.nome} e ganhou +25 XP! Que tal uma pausa curta de 5 minutos?`,
        [
          { text: 'Pausa Curta', onPress: () => changeMode('curta') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert('Pausa Encerrada! ⏰', 'Pronto para voltar ao foco?', [
        { text: 'Iniciar Foco', onPress: () => changeMode('foco') },
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const changeMode = (newMode: TimerMode) => {
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(POMODORO_TIMES[newMode]);
  };

  const toggleTimer = () => {
    setIsActive((prev) => !prev);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(POMODORO_TIMES[mode]);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Pomodoro & Foco" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector Tabs */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'foco' && styles.modeTabActive]}
            onPress={() => changeMode('foco')}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'foco' && styles.modeTabTextActive,
              ]}
            >
              Foco (25m)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'curta' && styles.modeTabActive]}
            onPress={() => changeMode('curta')}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'curta' && styles.modeTabTextActive,
              ]}
            >
              Pausa curta (5m)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'longa' && styles.modeTabActive]}
            onPress={() => changeMode('longa')}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'longa' && styles.modeTabTextActive,
              ]}
            >
              Pausa longa (15m)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Big Progress Ring Card */}
        <Card style={styles.timerCard}>
          <ProgressRing
            size={220}
            strokeWidth={14}
            progress={progress}
            color={mode === 'foco' ? COLORS.primary : COLORS.warning}
            trackColor="#f1f5f9"
          >
            <View style={styles.timerInner}>
              <Text style={styles.timerModeLabel}>
                {mode === 'foco' ? 'Foco Total' : mode === 'curta' ? 'Pausa Curta' : 'Pausa Longa'}
              </Text>
              <Text style={styles.timerDigits}>{formatTime(timeLeft)}</Text>
              <Text style={styles.timerSubjectLabel}>
                {selectedSubject.nome}
              </Text>
            </View>
          </ProgressRing>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleTimer}
              style={[
                styles.mainPlayButton,
                isActive && styles.pauseButton,
              ]}
            >
              {isActive ? (
                <Pause size={28} color="#ffffff" fill="#ffffff" />
              ) : (
                <Play size={28} color="#ffffff" fill="#ffffff" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={resetTimer}
              style={styles.resetButton}
            >
              <RotateCcw size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Subject Selection Card */}
        <Card style={styles.subjectCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconTitleRow}>
              <BookOpen size={18} color={COLORS.primary} />
              <Text style={styles.cardSectionTitle}>Disciplina Ativa</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSubjectModalVisible(true)}
            >
              <Text style={styles.changeSubjectText}>Trocar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.subjectSelectorBox}
            onPress={() => setSubjectModalVisible(true)}
          >
            <Text style={styles.selectedSubjectName}>{selectedSubject.nome}</Text>
            <Text style={styles.subjectHint}>Toque para alterar a matéria</Text>
          </TouchableOpacity>
        </Card>

        {/* Dynamic Notes Section */}
        <Card style={styles.notesCard}>
          <View style={styles.iconTitleRow}>
            <FileText size={18} color={COLORS.primary} />
            <Text style={styles.cardSectionTitle}>
              Anotações de Estudo — {selectedSubject.nome}
            </Text>
          </View>

          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={5}
            placeholder="Anote dúvidas, fórmulas, tópicos importantes ou insights desta sessão..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />

          <View style={styles.notesFooter}>
            <CheckCircle2 size={14} color={COLORS.success} />
            <Text style={styles.notesSavedText}>
              Anotações salvas ao concluir a sessão de foco
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Select Subject Modal */}
      <Modal
        visible={subjectModalVisible}
        onClose={() => setSubjectModalVisible(false)}
        title="Selecionar Disciplina"
        variant="bottom"
      >
        <View style={{ paddingVertical: 6 }}>
          <TouchableOpacity
            style={[
              styles.subjectModalItem,
              !selectedSubject.id && styles.subjectModalItemActive,
            ]}
            onPress={() => {
              setSelectedSubject({ id: null, nome: 'Geral' });
              setSubjectModalVisible(false);
            }}
          >
            <Text
              style={[
                styles.subjectModalText,
                !selectedSubject.id && styles.subjectModalTextActive,
              ]}
            >
              Geral (Sem disciplina)
            </Text>
            {!selectedSubject.id && (
              <CheckCircle2 size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          {subjectsList.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={[
                styles.subjectModalItem,
                selectedSubject.id === sub.id && styles.subjectModalItemActive,
              ]}
              onPress={() => {
                setSelectedSubject({ id: sub.id, nome: sub.nome });
                setSubjectModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.subjectModalText,
                  selectedSubject.id === sub.id && styles.subjectModalTextActive,
                ]}
              >
                {sub.nome}
              </Text>
              {selectedSubject.id === sub.id && (
                <CheckCircle2 size={18} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 16,
  },
  timerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerModeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timerDigits: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  timerSubjectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 16,
  },
  mainPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: COLORS.warning,
  },
  resetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectCard: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  changeSubjectText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  subjectSelectorBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedSubjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  subjectHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  notesCard: {
    padding: 16,
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 110,
  },
  notesFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  notesSavedText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  subjectModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  subjectModalItemActive: {
    backgroundColor: COLORS.primaryMuted,
  },
  subjectModalText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  subjectModalTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

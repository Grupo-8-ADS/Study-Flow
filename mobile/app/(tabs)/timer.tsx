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
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { Storage } from '../../lib/storage';

export default function TimerScreen() {
  const { session } = useAuth();

  const [mode, setMode] = useState<TimerMode>('foco');
  const [timeLeft, setTimeLeft] = useState<number>(POMODORO_TIMES.foco);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('História');
  const [notes, setNotes] = useState<string>('');
  const [subjectModalVisible, setSubjectModalVisible] = useState<boolean>(false);
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(3);

  const subjects = ['História', 'Matemática', 'Banco de Dados', 'Engenharia de Software', 'Geral'];

  const totalDuration = POMODORO_TIMES[mode];
  const progress = (totalDuration - timeLeft) / totalDuration;

  // Load notes for selected subject
  useEffect(() => {
    async function loadNotes() {
      if (!session) return;
      const key = `${Storage.keys.NOTES_PREFIX}${session.email}_${selectedSubject}`;
      const saved = await Storage.getItem<string>(key, '');
      setNotes(saved);
    }
    loadNotes();
  }, [selectedSubject, session]);

  // Save notes with debounce
  const handleNotesChange = async (text: string) => {
    setNotes(text);
    if (!session) return;
    const key = `${Storage.keys.NOTES_PREFIX}${session.email}_${selectedSubject}`;
    await Storage.setItem(key, text);
  };

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

  const handleTimerCompleted = () => {
    if (mode === 'foco') {
      setCompletedSessionsCount((c) => c + 1);
      Alert.alert(
        'Sessão Concluída! 🎉',
        `Parabéns! Você completou 25 minutos de foco em ${selectedSubject}. Que tal uma pausa curta de 5 minutos?`,
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
                {selectedSubject || 'Geral'}
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
            <Text style={styles.selectedSubjectName}>{selectedSubject}</Text>
            <Text style={styles.subjectHint}>Toque para alterar a matéria</Text>
          </TouchableOpacity>
        </Card>

        {/* Dynamic Notes Section */}
        <Card style={styles.notesCard}>
          <View style={styles.iconTitleRow}>
            <FileText size={18} color={COLORS.primary} />
            <Text style={styles.cardSectionTitle}>
              Anotações de Estudo — {selectedSubject}
            </Text>
          </View>

          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={5}
            placeholder="Anote dúvidas, fórmulas, tópicos importantes ou insights desta sessão..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={handleNotesChange}
            textAlignVertical="top"
          />

          <View style={styles.notesFooter}>
            <CheckCircle2 size={14} color={COLORS.success} />
            <Text style={styles.notesSavedText}>
              Salvo automaticamente para esta disciplina
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
          {subjects.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={[
                styles.subjectModalItem,
                selectedSubject === sub && styles.subjectModalItemActive,
              ]}
              onPress={() => {
                setSelectedSubject(sub);
                setSubjectModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.subjectModalText,
                  selectedSubject === sub && styles.subjectModalTextActive,
                ]}
              >
                {sub}
              </Text>
              {selectedSubject === sub && (
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pauseButton: {
    backgroundColor: COLORS.warning,
    shadowColor: COLORS.warning,
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

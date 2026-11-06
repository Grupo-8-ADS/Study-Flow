import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Play, Pause, RotateCcw, BookOpen, FileText, CheckCircle2, Settings2, SkipForward } from 'lucide-react-native';
import {
  COLORS,
  LIMITES_POMODORO,
  POMODORO_PADRAO,
  PRESETS_POMODORO,
  ROTULO_MODO,
  duracaoModo,
  normalizarPomodoro,
  proximoModo,
  segundosRestantes,
  type ConfigPomodoro,
  type ModoPomodoro,
} from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/CompromissoEditor';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAgenda } from '../../lib/agenda';
import { notificarFimDoCiclo } from '../../lib/notifications';

const MODO_NOTIFICACAO = { foco: 'foco', pausa_curta: 'curta', pausa_longa: 'longa' } as const;
const chaveConfig = (email: string) => `studyflow_pomodoro_${email}`;

export default function TimerScreen() {
  const { session, refreshProfile } = useAuth();
  const { dados: agenda } = useAgenda();
  const subjectsList = (agenda?.disciplinas ?? []).map((d) => ({ id: d.id, nome: d.nome }));

  const [config, setConfig] = useState<ConfigPomodoro>(POMODORO_PADRAO);
  const [configVisivel, setConfigVisivel] = useState(false);
  const [mode, setMode] = useState<ModoPomodoro>('foco');
  const [totalDuration, setTotalDuration] = useState(duracaoModo('foco', POMODORO_PADRAO));
  const [timeLeft, setTimeLeft] = useState<number>(totalDuration);
  // O tempo restante vem do relógio: com o app em segundo plano o intervalo para,
  // e ao voltar o timer corrige na hora (antes ele "congelava").
  const [fimEm, setFimEm] = useState<number | null>(null);
  const isActive = fimEm !== null;
  const [focosConcluidos, setFocosConcluidos] = useState(0);
  const [aviso, setAviso] = useState('');
  // null = ainda não escolheu: usa a primeira disciplina.
  const [escolha, setEscolha] = useState<{ id: string | null; nome: string } | null>(null);
  const selectedSubject = escolha ?? (subjectsList[0] ? { id: subjectsList[0].id, nome: subjectsList[0].nome } : { id: null, nome: 'Geral' });
  const setSelectedSubject = setEscolha;
  const [notes, setNotes] = useState<string>('');
  const [subjectModalVisible, setSubjectModalVisible] = useState<boolean>(false);
  const finishCycleRef = useRef<() => void>(() => {});

  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;

  useEffect(() => {
    if (!session?.email) return;
    void AsyncStorage.getItem(chaveConfig(session.email)).then((salvo) => {
      const cfg = normalizarPomodoro(salvo);
      setConfig(cfg);
      setTotalDuration(duracaoModo('foco', cfg));
      setTimeLeft(duracaoModo('foco', cfg));
    });
  }, [session?.email]);

  const irParaModo = useCallback(
    (novo: ModoPomodoro, iniciar: boolean, cfg: ConfigPomodoro = config) => {
      const dur = duracaoModo(novo, cfg);
      setMode(novo);
      setTotalDuration(dur);
      setTimeLeft(dur);
      setFimEm(iniciar ? Date.now() + dur * 1000 : null);
    },
    [config],
  );

  // Tique pelo relógio; também recalcula ao voltar do segundo plano.
  useEffect(() => {
    if (fimEm === null) return;
    let encerrado = false;
    const tique = () => {
      if (encerrado) return;
      const restante = segundosRestantes(fimEm, Date.now());
      setTimeLeft(restante);
      if (restante === 0) {
        encerrado = true;
        finishCycleRef.current();
      }
    };
    const id = setInterval(tique, 500);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') tique();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [fimEm]);

  const changeMode = (novo: ModoPomodoro) => {
    setAviso('');
    irParaModo(novo, false);
  };

  const handleTimerCompleted = async () => {
    void notificarFimDoCiclo(MODO_NOTIFICACAO[mode]);
    const focos = mode === 'foco' ? focosConcluidos + 1 : focosConcluidos;
    const proximo = proximoModo(mode, focos, config);
    if (mode === 'foco') {
      setFocosConcluidos(focos);
      const minutos = Math.round(totalDuration / 60);
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (uid) {
          const fim = new Date();
          // XP, nível e conquistas são calculados pelo trigger on_sessao_concluida no banco.
          await supabase.from('sessoes_estudo').insert({
            user_id: uid,
            disciplina_id: selectedSubject.id,
            data_inicio: new Date(fim.getTime() - totalDuration * 1000).toISOString(),
            data_fim: fim.toISOString(),
            duracao_efetiva_min: minutos,
            status: 'concluida',
            exp: minutos,
            notas: notes.trim() || null,
          });
          await refreshProfile();
        }
      } catch (e) {
        console.error('Error saving study session:', e);
      }
      setAviso(`${minutos} min de foco em ${selectedSubject.nome} registrados (+${Math.min(minutos, 240)} XP). Hora da ${ROTULO_MODO[proximo].toLowerCase()}.`);
    } else {
      setAviso('A pausa acabou. Pronto para voltar ao foco?');
    }
    irParaModo(proximo, config.autoIniciar);
  };

  useEffect(() => {
    finishCycleRef.current = () => {
      void handleTimerCompleted();
    };
  });

  const toggleTimer = () => {
    setAviso('');
    if (fimEm !== null) {
      setTimeLeft(segundosRestantes(fimEm, Date.now()));
      setFimEm(null);
      return;
    }
    const restante = timeLeft > 0 ? timeLeft : totalDuration;
    setTimeLeft(restante);
    setFimEm(Date.now() + restante * 1000);
  };

  const resetTimer = () => {
    setAviso('');
    irParaModo(mode, false);
  };

  const pular = () => {
    setAviso('');
    irParaModo(proximoModo(mode, mode === 'foco' ? focosConcluidos + 1 : focosConcluidos, config), false);
  };

  const salvarConfig = (cfg: ConfigPomodoro) => {
    const limpa = normalizarPomodoro(cfg);
    setConfig(limpa);
    if (session?.email) void AsyncStorage.setItem(chaveConfig(session.email), JSON.stringify(limpa));
    if (!isActive) irParaModo(mode, false, limpa);
    setConfigVisivel(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const minutosDe = (m: ModoPomodoro) => (m === 'foco' ? config.foco : m === 'pausa_curta' ? config.pausaCurta : config.pausaLonga);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Timer" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeTabs}>
          {(['foco', 'pausa_curta', 'pausa_longa'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
              onPress={() => changeMode(m)}
            >
              <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                {ROTULO_MODO[m]} ({minutosDe(m)}m)
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.timerCard}>
          <ProgressRing
            size={220}
            strokeWidth={14}
            progress={progress}
            color={mode === 'foco' ? COLORS.primary : COLORS.warning}
            trackColor="#f1f5f9"
          >
            <View style={styles.timerInner}>
              <Text style={styles.timerModeLabel}>{ROTULO_MODO[mode]}</Text>
              <Text style={styles.timerDigits}>{formatTime(timeLeft)}</Text>
              <Text style={styles.timerSubjectLabel}>{selectedSubject.nome}</Text>
              <View style={styles.ciclos}>
                {Array.from({ length: config.ciclosAteLonga }, (_, i) => (
                  <View key={i} style={[styles.cicloPonto, i < focosConcluidos % config.ciclosAteLonga && styles.cicloPontoFeito]} />
                ))}
              </View>
            </View>
          </ProgressRing>

          <View style={styles.controlsRow}>
            <TouchableOpacity accessibilityLabel="Reiniciar" activeOpacity={0.7} onPress={resetTimer} style={styles.resetButton}>
              <RotateCcw size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={isActive ? 'Pausar' : 'Começar'}
              activeOpacity={0.8}
              onPress={toggleTimer}
              style={[styles.mainPlayButton, isActive && styles.pauseButton]}
            >
              {isActive ? (
                <Pause size={28} color="#ffffff" fill="#ffffff" />
              ) : (
                <Play size={28} color="#ffffff" fill="#ffffff" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Pular para o próximo modo" activeOpacity={0.7} onPress={pular} style={styles.resetButton}>
              <SkipForward size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => setConfigVisivel(true)} style={styles.ajustar}>
            <Settings2 size={16} color={COLORS.primary} />
            <Text style={styles.ajustarTexto}>Ajustar tempos</Text>
          </TouchableOpacity>
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
      {configVisivel ? <ConfigPomodoroModal inicial={config} onClose={() => setConfigVisivel(false)} onSalvar={salvarConfig} /> : null}
    </KeyboardAvoidingView>
  );
}

function ConfigPomodoroModal({
  inicial,
  onClose,
  onSalvar,
}: {
  inicial: ConfigPomodoro;
  onClose: () => void;
  onSalvar: (c: ConfigPomodoro) => void;
}) {
  const [cfg, setCfg] = useState(inicial);
  const [textos, setTextos] = useState(() => ({
    foco: String(inicial.foco),
    pausaCurta: String(inicial.pausaCurta),
    pausaLonga: String(inicial.pausaLonga),
    ciclosAteLonga: String(inicial.ciclosAteLonga),
  }));
  const aplicar = (parcial: Partial<ConfigPomodoro>) => {
    setCfg((c) => ({ ...c, ...parcial }));
    setTextos((t) => {
      const novo = { ...t };
      (['foco', 'pausaCurta', 'pausaLonga', 'ciclosAteLonga'] as const).forEach((k) => {
        if (parcial[k] !== undefined) novo[k] = String(parcial[k]);
      });
      return novo;
    });
  };
  const campo = (k: keyof typeof LIMITES_POMODORO, rotulo: string) => (
    <Input
      containerStyle={{ flex: 1 }}
      keyboardType="number-pad"
      label={`${rotulo} (${LIMITES_POMODORO[k][0]}–${LIMITES_POMODORO[k][1]})`}
      maxLength={3}
      value={textos[k]}
      onChangeText={(t) => {
        const limpo = t.replace(/\D/g, '');
        setTextos((x) => ({ ...x, [k]: limpo }));
        setCfg((c) => ({ ...c, [k]: Number(limpo) }));
      }}
    />
  );

  return (
    <Modal visible onClose={onClose} title="Ajustar tempos" variant="bottom">
      <View style={styles.presets}>
        {PRESETS_POMODORO.map((p) => (
          <Chip
            ativo={p.config.foco === cfg.foco && p.config.pausaCurta === cfg.pausaCurta && p.config.pausaLonga === cfg.pausaLonga}
            key={p.nome}
            label={p.nome}
            onPress={() => aplicar(p.config)}
          />
        ))}
      </View>
      <View style={styles.camposLinha}>
        {campo('foco', 'Foco (min)')}
        {campo('pausaCurta', 'Pausa curta')}
      </View>
      <View style={styles.camposLinha}>
        {campo('pausaLonga', 'Pausa longa')}
        {campo('ciclosAteLonga', 'Longa a cada')}
      </View>
      <View style={styles.switchLinha}>
        <Text style={styles.switchTexto}>Começar o próximo modo sozinho</Text>
        <Switch
          value={cfg.autoIniciar}
          onValueChange={(v) => aplicar({ autoIniciar: v })}
          trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
          thumbColor={cfg.autoIniciar ? COLORS.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.configAcoes}>
        <Button title="Padrão" variant="ghost" onPress={() => aplicar(POMODORO_PADRAO)} />
        <Button title="Cancelar" variant="outline" onPress={onClose} />
        <Button title="Salvar" onPress={() => onSalvar(cfg)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ciclos: { flexDirection: 'row', gap: 6, marginTop: 10 },
  cicloPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' },
  cicloPontoFeito: { backgroundColor: COLORS.primary },
  aviso: { marginTop: 16, textAlign: 'center', fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  ajustar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, padding: 6 },
  ajustarTexto: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  camposLinha: { flexDirection: 'row', gap: 12 },
  switchLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchTexto: { fontSize: 14, color: COLORS.text, flex: 1 },
  configAcoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
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
    fontWeight: '700',
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

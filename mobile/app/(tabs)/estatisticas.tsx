import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Share2, Zap } from 'lucide-react-native';
import { ConquistaIcone } from '../../components/ConquistaIcone';
import {
  COLORS,
  Conquista,
  progressoNivel,
  progressoConquista,
  diasSeguidos,
  nomeConquista,
  dataStr,
  textoCompartilhamento,
  intervaloDoPeriodo,
  gerarRelatorioPeriodo,
} from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const DIST_COLORS = ['#29645e', '#348e83', '#e5a93b', '#f87171', '#705c9d'];

export default function EstatisticasScreen() {
  const { session } = useAuth();

  const [period] = useState<'semana' | 'mes' | 'acumulado'>('semana');
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const [weekHours, setWeekHours] = useState(0);
  const [monthHours, setMonthHours] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  const [topSubject, setTopSubject] = useState<string | null>(null);
  const [subjectStats, setSubjectStats] = useState<Array<{ name: string; hours: number; percent: number; color: string }>>([]);
  const [conquistas, setConquistas] = useState<Array<Conquista & { unlocked: boolean; progress?: number; ordem?: number }>>([]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const uid = userRes.user.id;

      // 1. Fetch study sessions
      const { data: sessions } = await supabase
        .from('sessoes_estudo')
        .select('duracao_efetiva_min, data_inicio, status, disciplina_id, disciplinas(nome)')
        .eq('user_id', uid)
        .eq('status', 'concluida');

      const concluidas = (sessions || []).map((s: any) => ({
        data_inicio: s.data_inicio as string,
        duracao_efetiva_min: s.duracao_efetiva_min as number | null,
        disciplina_nome: (s.disciplinas?.nome as string | undefined) || null,
        status: 'concluida',
      }));

      const agora = new Date();
      const semana = gerarRelatorioPeriodo(concluidas, intervaloDoPeriodo('semana', agora));
      const mes = gerarRelatorioPeriodo(concluidas, intervaloDoPeriodo('mes', agora));
      const horas = (min: number) => Number((min / 60).toFixed(1));

      let totalMins = 0;
      const subMap = new Map<string, number>();
      const sessoesPorDisciplina: Record<string, number> = {};
      concluidas.forEach((s) => {
        const dur = s.duracao_efetiva_min || 0;
        totalMins += dur;
        const subName = s.disciplina_nome || 'Geral';
        subMap.set(subName, (subMap.get(subName) || 0) + dur);
        // Sessões sem disciplina não contam para conquistas por disciplina.
        if (s.disciplina_nome) sessoesPorDisciplina[s.disciplina_nome] = (sessoesPorDisciplina[s.disciplina_nome] || 0) + 1;
      });

      setWeekHours(horas(semana.totalMinutos));
      setMonthHours(horas(mes.totalMinutos));
      setTotalHours(horas(totalMins));

      const maxSubMins = Math.max(...Array.from(subMap.values()), 1);
      setSubjectStats(
        Array.from(subMap.entries())
          .sort((x, y) => y[1] - x[1])
          .map(([name, mins], idx) => ({
            name,
            hours: horas(mins),
            percent: Math.min(100, Math.round((mins / maxSubMins) * 100)),
            color: DIST_COLORS[idx % DIST_COLORS.length],
          })),
      );
      setTopSubject(
        Array.from(subMap.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
      );

      const stats = {
        sessoesConcluidas: concluidas.length,
        minutosEstudados: totalMins,
        sessoesPorDisciplina,
        diasSeguidos: diasSeguidos(concluidas.filter((s) => s.data_inicio).map((s) => dataStr(new Date(s.data_inicio)))),
      };

      // 2. Fetch conquistas and user_conquistas
      const { data: allConq } = await supabase.from('conquistas').select('*').order('tier').order('created_at');
      const { data: userConq } = await supabase
        .from('user_conquistas')
        .select('conquista_id, detalhe, data_conquista')
        .eq('user_id', uid)
        .order('data_conquista', { ascending: false });

      const desbloqueadas = new Map((userConq || []).map((u, i) => [u.conquista_id as string, { detalhe: u.detalhe as string | null, ordem: i }]));

      if (allConq && allConq.length > 0) {
        setConquistas(
          allConq
            .map((c) => {
              const ganha = desbloqueadas.get(c.id);
              return {
                ...c,
                nome: nomeConquista(c.nome, ganha?.detalhe, stats),
                unlocked: Boolean(ganha),
                ordem: ganha?.ordem ?? Number.MAX_SAFE_INTEGER,
                progress: ganha ? 100 : progressoConquista(c.criterio, stats).percentual,
              };
            })
            // Mais recentes primeiro; depois as bloqueadas, as mais perto de concluir antes.
            .sort((a, b) => a.ordem - b.ordem || (b.progress ?? 0) - (a.progress ?? 0)),
        );
      }
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carga assíncrona: os setState ocorrem após o await, não em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
  }, [session]);

  const handleShareProgress = async () => {
    try {
      const periodoAtual = period === 'semana' ? weekHours : period === 'mes' ? monthHours : totalHours;
      const rotulo = period === 'semana' ? 'Semana' : period === 'mes' ? 'Mês' : 'Acumulado';
      await Share.share({
        message: textoCompartilhamento({
          nivel: progressoNivel(session?.xp || 0).nivel,
          periodo: rotulo,
          horas: periodoAtual,
          topico: topSubject,
        }),
      });
    } catch (error: any) {
      Alert.alert('Compartilhamento', 'Não foi possível compartilhar o resumo.');
    }
  };

  const { nivel: currentLevel, faltam, progresso } = progressoNivel(session?.xp || 0);
  const currentXp = session?.xp || 0;
  const levelProgress = Math.min(1, Math.max(0.05, progresso));

  return (
    <View style={styles.container}>
      <Header title="Progresso" section="progresso" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Hours Progress Rings */}
        <Text style={styles.sectionTitle}>Total de Horas Estudadas</Text>
        <View style={styles.summaryRingsRow}>
          <Card style={styles.ringCard}>
            <ProgressRing
              size={90}
              strokeWidth={8}
              progress={Math.min(1, Math.max(0.1, weekHours / 20))}
              color={COLORS.primary}
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{weekHours}H</Text>
                <Text style={styles.ringSub}>Semana</Text>
              </View>
            </ProgressRing>
          </Card>

          <Card style={styles.ringCard}>
            <ProgressRing
              size={90}
              strokeWidth={8}
              progress={Math.min(1, Math.max(0.1, monthHours / 80))}
              color="#348e83"
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{monthHours}H</Text>
                <Text style={styles.ringSub}>Mensal</Text>
              </View>
            </ProgressRing>
          </Card>

          <Card style={styles.ringCard}>
            <ProgressRing
              size={90}
              strokeWidth={8}
              progress={Math.min(1, Math.max(0.1, totalHours / 150))}
              color={COLORS.gold}
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>{totalHours}H</Text>
                <Text style={styles.ringSub}>Total</Text>
              </View>
            </ProgressRing>
          </Card>
        </View>

        {/* Gamification Level & XP Card */}
        <Card style={styles.levelCard}>
          <View style={styles.levelRow}>
            <ProgressRing
              size={84}
              strokeWidth={8}
              progress={levelProgress}
              color={COLORS.gold}
              trackColor="#fef3c7"
            >
              <View style={styles.levelCircleInner}>
                <Text style={styles.levelNumber}>Lv. {currentLevel}</Text>
                <Text style={styles.levelXpText}>{currentXp} XP</Text>
              </View>
            </ProgressRing>

            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Estudante Nível {currentLevel}</Text>
              <Text style={styles.levelSubtitle}>
                {faltam} XP para o Nível {currentLevel + 1}
              </Text>
              <View style={styles.levelBarBg}>
                <View style={[styles.levelBarFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleShareProgress}
                style={styles.shareButton}
              >
                <Share2 size={14} color="#ffffff" />
                <Text style={styles.shareButtonText}>Compartilhar Progresso</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Study Distribution */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Distribuição por Matéria</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : subjectStats.length === 0 ? (
          <Card style={styles.emptyDistCard}>
            <Text style={styles.emptyDistText}>
              Inicie uma sessão no Pomodoro para gerar dados de estudo por disciplina.
            </Text>
          </Card>
        ) : (
          <Card style={styles.barsCard}>
            {subjectStats.map((item, idx) => (
              <View key={idx} style={styles.barItemRow}>
                <View style={styles.barLabelsRow}>
                  <Text style={styles.barName}>{item.name}</Text>
                  <Text style={styles.barHours}>{item.hours}h</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barProgress,
                      { width: `${item.percent}%`, backgroundColor: item.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Conquistas Card */}
        {conquistas.some((c) => c.unlocked) && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Conquistas Recentes</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setAchievementsModalVisible(true)}
              >
                <Text style={styles.viewAllText}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.achievementsCard}>
              {conquistas.filter((c) => c.unlocked).slice(0, 3).map((item) => (
                <View key={item.id} style={styles.achievementRow}>
                  <ConquistaIcone icone={item.icone} tier={item.tier} />
                  <View style={styles.achievementInfo}>
                    <Text style={styles.achievementName}>{item.nome}</Text>
                    <Text style={styles.achievementDesc}>{item.descricao}</Text>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Zap size={12} color={COLORS.gold} />
                    <Text style={styles.pointsText}>+{item.pontos_recompensa}</Text>
                  </View>
                </View>
              ))}

              <Button
                title="Explorar Todas as Conquistas"
                variant="outline"
                size="sm"
                onPress={() => setAchievementsModalVisible(true)}
                style={{ marginTop: 8 }}
              />
            </Card>
          </>
        )}
      </ScrollView>

      {/* All Achievements Modal */}
      <Modal
        visible={achievementsModalVisible}
        onClose={() => setAchievementsModalVisible(false)}
        title="Galeria de Conquistas"
        variant="bottom"
      >
        <View style={{ paddingVertical: 8 }}>
          <Text style={styles.modalCategoryTitle}>🏆 Conquistadas</Text>
          {conquistas
            .filter((a) => a.unlocked)
            .map((a) => (
              <View key={a.id} style={styles.modalAchieveItem}>
                <ConquistaIcone icone={a.icone} tier={a.tier} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalAchieveName}>{a.nome}</Text>
                  <Text style={styles.modalAchieveDesc}>{a.descricao}</Text>
                </View>
                <Text style={styles.unlockedTag}>Concluída</Text>
              </View>
            ))}

          <Text style={[styles.modalCategoryTitle, { marginTop: 18 }]}>
            ⏳ Em Andamento
          </Text>
          {conquistas
            .filter((a) => !a.unlocked)
            .map((a) => (
              <View key={a.id} style={styles.modalAchieveItem}>
                <ConquistaIcone bloqueada icone={a.icone} tier={a.tier} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalAchieveName}>{a.nome}</Text>
                  <Text style={styles.modalAchieveDesc}>{a.descricao}</Text>
                  <View style={styles.achieveProgressBar}>
                    <View
                      style={[
                        styles.achieveProgressFill,
                        { width: `${a.progress ?? 0}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.progressPercent}>{a.progress ?? 0}%</Text>
              </View>
            ))}
        </View>
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
  emptyDistCard: {
    padding: 18,
    marginBottom: 20,
  },
  emptyDistText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  summaryRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ringCard: {
    flex: 1,
    marginHorizontal: 3,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  ringSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  levelCard: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gold,
  },
  levelXpText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  levelInfo: {
    flex: 1,
    marginLeft: 16,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  levelSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  levelBarBg: {
    height: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  barsCard: {
    padding: 16,
    marginBottom: 20,
  },
  barItemRow: {
    marginBottom: 14,
  },
  barLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  barHours: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  barTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barProgress: {
    height: '100%',
    borderRadius: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  achievementsCard: {
    padding: 16,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  trophyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  achievementDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    marginLeft: 2,
  },
  modalCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  modalAchieveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  trophyCircleUnlocked: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyCircleLocked: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAchieveName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalAchieveDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  unlockedTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  achieveProgressBar: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  achieveProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
});

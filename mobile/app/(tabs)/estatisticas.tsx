import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { Trophy, Share2, Award, Zap } from 'lucide-react-native';
import { COLORS, Conquista } from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';

export default function EstatisticasScreen() {
  const { session } = useAuth();

  const [period, setPeriod] = useState<'semana' | 'mes' | 'acumulado'>('semana');
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);

  const subjectStats = [
    { name: 'História', hours: 6.5, percent: 90, color: COLORS.primary },
    { name: 'Banco de Dados', hours: 4.2, percent: 65, color: '#348e83' },
    { name: 'Engenharia de Software', hours: 3.0, percent: 45, color: '#e5a93b' },
    { name: 'Cálculo I', hours: 2.5, percent: 35, color: '#f87171' },
    { name: 'Algoritmos', hours: 1.8, percent: 25, color: '#705c9d' },
  ];

  const allAchievements: Array<Conquista & { unlocked: boolean; progress?: number }> = [
    {
      id: '1',
      nome: 'Foco inicial',
      descricao: 'Conclua sua primeira sessão de estudo com o Pomodoro.',
      pontos_recompensa: 50,
      unlocked: true,
    },
    {
      id: '2',
      nome: 'Estudante dedicado',
      descricao: 'Conclua 5 sessões de foco na mesma semana.',
      pontos_recompensa: 120,
      unlocked: true,
    },
    {
      id: '3',
      nome: 'Especialista em História I',
      descricao: 'Acumule 10 horas de estudo na disciplina de História.',
      pontos_recompensa: 100,
      unlocked: true,
    },
    {
      id: '4',
      nome: 'Mestre do Tempo',
      descricao: 'Acumule dez horas de foco total.',
      pontos_recompensa: 250,
      unlocked: false,
      progress: 75,
    },
    {
      id: '5',
      nome: 'Consistência de Ferro',
      descricao: 'Mantenha uma sequência de 7 dias consecutivos de estudo.',
      pontos_recompensa: 300,
      unlocked: false,
      progress: 42,
    },
    {
      id: '6',
      nome: 'Explorador da Grade',
      descricao: 'Cadastre 5 disciplinas completas no aplicativo.',
      pontos_recompensa: 150,
      unlocked: false,
      progress: 60,
    },
  ];

  const handleShareProgress = async () => {
    try {
      await Share.share({
        message: `🔥 Meu progresso no Study Flow:\n⏱️ Total de foco: 15 horas\n🏆 Nível: ${session?.nivel_atual || 12}\n⭐ Tópico mais estudado: História (110H)\n\nVenha focar comigo no Study Flow! 🚀`,
      });
    } catch (error: any) {
      Alert.alert('Compartilhamento', 'Não foi possível compartilhar o resumo.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Estatísticas & Métricas" />

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
              progress={0.75}
              color={COLORS.primary}
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>15H</Text>
                <Text style={styles.ringSub}>Semana</Text>
              </View>
            </ProgressRing>
          </Card>

          <Card style={styles.ringCard}>
            <ProgressRing
              size={90}
              strokeWidth={8}
              progress={0.65}
              color="#348e83"
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>65H</Text>
                <Text style={styles.ringSub}>Mensal</Text>
              </View>
            </ProgressRing>
          </Card>

          <Card style={styles.ringCard}>
            <ProgressRing
              size={90}
              strokeWidth={8}
              progress={0.88}
              color={COLORS.gold}
            >
              <View style={styles.ringInner}>
                <Text style={styles.ringValue}>265H</Text>
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
              progress={0.7}
              color={COLORS.gold}
              trackColor="#fef3c7"
            >
              <View style={styles.levelCircleInner}>
                <Text style={styles.levelNumber}>Lv. {session?.nivel_atual || 12}</Text>
                <Text style={styles.levelXpText}>{session?.xp || 2840} XP</Text>
              </View>
            </ProgressRing>

            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Estudante Avançado</Text>
              <Text style={styles.levelSubtitle}>
                Mais 160 XP para o Nível {(session?.nivel_atual || 12) + 1}
              </Text>
              <View style={styles.levelBarBg}>
                <View style={[styles.levelBarFill, { width: '70%' }]} />
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

        {/* Study Distribution & Period Selector */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Distribuição por Matéria</Text>

          <View style={styles.periodPills}>
            {(['semana', 'mes', 'acumulado'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodPill,
                  period === p && styles.periodPillActive,
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    period === p && styles.periodPillTextActive,
                  ]}
                >
                  {p === 'semana' ? 'Sem' : p === 'mes' ? 'Mês' : 'Total'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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

        {/* Recent Achievements Card */}
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
          {allAchievements.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.achievementRow}>
              <View style={styles.trophyCircle}>
                <Trophy size={20} color={COLORS.gold} />
              </View>
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
          {allAchievements
            .filter((a) => a.unlocked)
            .map((a) => (
              <View key={a.id} style={styles.modalAchieveItem}>
                <View style={styles.trophyCircleUnlocked}>
                  <Trophy size={20} color={COLORS.gold} />
                </View>
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
          {allAchievements
            .filter((a) => !a.unlocked)
            .map((a) => (
              <View key={a.id} style={styles.modalAchieveItem}>
                <View style={styles.trophyCircleLocked}>
                  <Award size={20} color={COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalAchieveName}>{a.nome}</Text>
                  <Text style={styles.modalAchieveDesc}>{a.descricao}</Text>
                  <View style={styles.achieveProgressBar}>
                    <View
                      style={[
                        styles.achieveProgressFill,
                        { width: `${a.progress || 0}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.progressPercent}>{a.progress}%</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '900',
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
    fontWeight: '800',
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
  periodPills: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 2,
  },
  periodPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodPillActive: {
    backgroundColor: COLORS.primary,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
    fontWeight: '800',
    color: COLORS.gold,
    marginLeft: 2,
  },
  modalCategoryTitle: {
    fontSize: 14,
    fontWeight: '800',
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

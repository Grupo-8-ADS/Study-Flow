import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Gift,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

export default function RewardsScreen() {
  const { session } = useAuth();
  const [activeCategory, setActiveCategory] = useState<'icones' | 'bordas' | 'banners'>('icones');

  const currentLevel = session?.nivel_atual || 1;
  const currentXp = session?.xp || 0;

  const rewardItems = {
    icones: [
      { id: '1', title: 'Raposa Acadêmica', desc: 'Avatar padrão de formatura', unlocked: true },
      { id: '2', title: 'Coruja Sábia', desc: 'Desbloqueado ao atingir Nível 3', unlocked: currentLevel >= 3 },
      { id: '3', title: 'Gato Focado', desc: 'Desbloqueado com 100 XP de foco', unlocked: currentXp >= 100 },
      { id: '4', title: 'Lobo Solitário', desc: 'Alcance 500 XP de foco total', unlocked: currentXp >= 500 },
      { id: '5', title: 'Dragão Místico', desc: 'Alcance o Nível 10', unlocked: currentLevel >= 10 },
      { id: '6', title: 'Fênix Renascida', desc: 'Alcance o Nível 25', unlocked: currentLevel >= 25 },
    ],
    bordas: [
      { id: '1', title: 'Borda Esmeralda', desc: 'Borda padrão Study Flow', unlocked: true },
      { id: '2', title: 'Borda Dourada Estelar', desc: 'Desbloqueada com 250 XP', unlocked: currentXp >= 250 },
      { id: '3', title: 'Borda Diamante Neon', desc: 'Alcance o Nível 5', unlocked: currentLevel >= 5 },
      { id: '4', title: 'Borda Campeão Semestral', desc: 'Alcance o Nível 15', unlocked: currentLevel >= 15 },
    ],
    banners: [
      { id: '1', title: 'Fórmulas Matemáticas', desc: 'Banner escuro com fórmulas', unlocked: true },
      { id: '2', title: 'Biblioteca Noturna', desc: 'Acumule 150 XP de estudo', unlocked: currentXp >= 150 },
      { id: '3', title: 'Galáxia do Foco', desc: 'Alcance o Nível 8', unlocked: currentLevel >= 8 },
      { id: '4', title: 'Montanhas do Saber', desc: 'Alcance o Nível 12', unlocked: currentLevel >= 12 },
      { id: '5', title: 'Aurora Boreal', desc: 'Alcance o Nível 20', unlocked: currentLevel >= 20 },
    ],
  };

  const currentItems = rewardItems[activeCategory];
  const allList = [...rewardItems.icones, ...rewardItems.bordas, ...rewardItems.banners];
  const totalUnlocked = allList.filter((i) => i.unlocked).length;
  const totalItems = allList.length;
  const progressPercent = Math.round((totalUnlocked / totalItems) * 100);

  const categories = [
    {
      id: 'icones',
      label: 'Ícones',
      color: COLORS.primary,
      unlocked: rewardItems.icones.filter((i) => i.unlocked).length,
      total: rewardItems.icones.length,
    },
    {
      id: 'bordas',
      label: 'Bordas',
      color: COLORS.purple,
      unlocked: rewardItems.bordas.filter((i) => i.unlocked).length,
      total: rewardItems.bordas.length,
    },
    {
      id: 'banners',
      label: 'Banners',
      color: COLORS.gold,
      unlocked: rewardItems.banners.filter((i) => i.unlocked).length,
      total: rewardItems.banners.length,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Collection Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Gift size={28} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>Sua dedicação vira coleção! ✨</Text>
          <Text style={styles.heroSubtitle}>
            Estude no Pomodoro, acumule XP e suba de nível para desbloquear cosméticos exclusivos para o seu perfil.
          </Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progresso da Coleção</Text>
              <Text style={styles.progressPercent}>{progressPercent}% ({totalUnlocked}/{totalItems})</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Collection Selector Tabs */}
        <View style={styles.categoryTabs}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryTab,
                activeCategory === cat.id && styles.categoryTabActive,
              ]}
              onPress={() => setActiveCategory(cat.id as any)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === cat.id && styles.categoryTabTextActive,
                ]}
              >
                {cat.label} ({cat.unlocked}/{cat.total})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rewards List */}
        <Text style={styles.sectionTitle}>
          Itens de {activeCategory === 'icones' ? 'Ícones' : activeCategory === 'bordas' ? 'Bordas' : 'Banners'}
        </Text>

        <View style={styles.gridContainer}>
          {currentItems.map((item) => (
            <Card
              key={item.id}
              style={[
                styles.itemCard,
                !item.unlocked && styles.itemCardLocked,
              ]}
            >
              <View style={styles.itemHeader}>
                <View
                  style={[
                    styles.itemIconCircle,
                    item.unlocked ? styles.itemIconUnlocked : styles.itemIconLocked,
                  ]}
                >
                  {item.unlocked ? (
                    <Sparkles size={20} color={COLORS.primary} />
                  ) : (
                    <Lock size={18} color={COLORS.textMuted} />
                  )}
                </View>

                <Badge
                  label={item.unlocked ? 'Desbloqueado' : 'Bloqueado'}
                  variant={item.unlocked ? 'success' : 'gray'}
                  size="sm"
                />
              </View>

              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDesc}>{item.desc}</Text>
            </Card>
          ))}
        </View>

        {/* How to Unlock Guide Card */}
        <Card style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <HelpCircle size={18} color={COLORS.primary} />
            <Text style={styles.guideTitle}>Como Desbloquear Mais Recompensas?</Text>
          </View>
          <Text style={styles.guideTip}>
            • <Text style={{ fontWeight: '700' }}>Pomodoro diário:</Text> Cada sessão de foco concluída concede +25 XP.
          </Text>
          <Text style={styles.guideTip}>
            • <Text style={{ fontWeight: '700' }}>Suba de nível:</Text> A cada 100 XP você avança de nível e desbloqueia novos avatares e bordas.
          </Text>
          <Text style={styles.guideTip}>
            • <Text style={{ fontWeight: '700' }}>Organize sua rotina:</Text> Cadastrar matérias e cumprir prazos acelera seu progresso acadêmico.
          </Text>
        </Card>
      </ScrollView>
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
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#d1fae5',
    lineHeight: 18,
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    padding: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 3,
  },
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  categoryTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 12,
  },
  gridContainer: {
    marginBottom: 12,
  },
  itemCard: {
    padding: 16,
    marginBottom: 10,
  },
  itemCardLocked: {
    backgroundColor: '#f8fafc',
    opacity: 0.85,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconUnlocked: {
    backgroundColor: COLORS.primaryMuted,
  },
  itemIconLocked: {
    backgroundColor: '#e2e8f0',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  guideCard: {
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  guideTip: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
    marginBottom: 6,
  },
});

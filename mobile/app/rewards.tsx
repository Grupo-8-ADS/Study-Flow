import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Gift,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function RewardsScreen() {
  const [activeCategory, setActiveCategory] = useState<'icones' | 'bordas' | 'banners'>('icones');

  const categories = [
    { id: 'icones', label: 'Ícones', color: COLORS.primary, unlocked: 3, total: 6 },
    { id: 'bordas', label: 'Bordas', color: COLORS.purple, unlocked: 2, total: 4 },
    { id: 'banners', label: 'Banners', color: COLORS.gold, unlocked: 1, total: 5 },
  ];

  const rewardItems = {
    icones: [
      { id: '1', title: 'Raposa Acadêmica', desc: 'Avatar padrão de formatura', unlocked: true },
      { id: '2', title: 'Coruja Sábia', desc: 'Desbloqueado ao atingir Nível 5', unlocked: true },
      { id: '3', title: 'Gato Focado', desc: 'Desbloqueado com 10h de foco', unlocked: true },
      { id: '4', title: 'Lobo Solitário', desc: 'Alcance 50 horas de foco', unlocked: false },
      { id: '5', title: 'Dragão Místico', desc: 'Alcance o Nível 25', unlocked: false },
      { id: '6', title: 'Fênix Renascida', desc: 'Sequência de 30 dias de foco', unlocked: false },
    ],
    bordas: [
      { id: '1', title: 'Borda Esmeralda', desc: 'Borda padrão Study Flow', unlocked: true },
      { id: '2', title: 'Borda Dourada Estelar', desc: 'Conclua 20 sessões de foco', unlocked: true },
      { id: '3', title: 'Borda Diamante Neon', desc: 'Alcance 100 horas de foco', unlocked: false },
      { id: '4', title: 'Borda Campeão Semestral', desc: 'Complete todas as matérias', unlocked: false },
    ],
    banners: [
      { id: '1', title: 'Fórmulas Matemáticas', desc: 'Banner escuro com fórmulas', unlocked: true },
      { id: '2', title: 'Biblioteca Noturna', desc: 'Acumule 30 horas de estudo', unlocked: false },
      { id: '3', title: 'Galáxia do Foco', desc: 'Alcance o Nível 20', unlocked: false },
      { id: '4', title: 'Montanhas do Saber', desc: 'Sequência de 14 dias', unlocked: false },
      { id: '5', title: 'Aurora Boreal', desc: 'Desbloqueio especial de fim de ano', unlocked: false },
    ],
  };

  const currentItems = rewardItems[activeCategory];
  const totalUnlocked = 6;
  const totalItems = 15;
  const progressPercent = Math.round((totalUnlocked / totalItems) * 100);

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
            Estude, acumule horas e suba de nível para desbloquear cosméticos exclusivos para o seu perfil.
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
            • <Text style={{ fontWeight: '700' }}>Pomodoro diário:</Text> Cada sessão concluída rende XP e avança metas de tempo.
          </Text>
          <Text style={styles.guideTip}>
            • <Text style={{ fontWeight: '700' }}>Mantenha a constância:</Text> Sequências consecutivas de estudo desbloqueiam bordas raras.
          </Text>
          <Text style={styles.guideTip}>
            • <Text style={{ fontWeight: '700' }}>Cadastre suas matérias:</Text> Organizar disciplinas e avaliações concede conquistas especiais.
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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

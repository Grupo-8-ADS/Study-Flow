import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { usePathname } from 'expo-router';
import { useIrPara } from '../../lib/navigation';
import { COLORS } from '@studyflow/shared';
import { SECTIONS, type SectionKey } from '../../constants/navigation';

/** Abas internas de uma seção (Agenda, Progresso ou Conta), como no site. */
export const SectionTabs: React.FC<{ section: SectionKey }> = ({ section }) => {
  const irPara = useIrPara();
  const pathname = usePathname();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {SECTIONS[section].tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <TouchableOpacity
            key={tab.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            activeOpacity={0.8}
            onPress={() => {
              if (!active) irPara(tab.href);
            }}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

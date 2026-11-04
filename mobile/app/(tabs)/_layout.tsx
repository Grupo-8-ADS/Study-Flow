import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BarChart3, BookOpen, CalendarDays, House, Timer as TimerIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@studyflow/shared';

/**
 * Barra de abas principal: os mesmos 5 itens do menu do site.
 * Conta (Perfil, Preferências, Integrações) abre pelo avatar no topo.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 58 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Início', tabBarIcon: ({ color }) => <House size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="calendario"
        options={{ title: 'Agenda', tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="timer"
        options={{ title: 'Timer', tabBarIcon: ({ color }) => <TimerIcon size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="disciplinas"
        options={{ title: 'Disciplinas', tabBarIcon: ({ color }) => <BookOpen size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="estatisticas"
        options={{ title: 'Progresso', tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }}
      />
    </Tabs>
  );
}

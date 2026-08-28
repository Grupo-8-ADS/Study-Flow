import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '@studyflow/shared';

function RootNavigation() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="disciplinas"
        options={{
          headerShown: true,
          title: 'Disciplinas',
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: '#ffffff' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="atividade"
        options={{
          headerShown: true,
          title: 'Atividades & Tarefas',
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: '#ffffff' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="rewards"
        options={{
          headerShown: true,
          title: 'Recompensas',
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: '#ffffff' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="configuracoes"
        options={{
          headerShown: true,
          title: 'Configurações',
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: '#ffffff' },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

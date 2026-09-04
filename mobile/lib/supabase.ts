import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fsevgdeegpaxdhcwkkcz.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXZnZGVlZ3BheGRoY3dra2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mjg2MDYsImV4cCI6MjA5OTIwNDYwNn0.J8rWkpAeueZ2-ji4gG4-IFlrq1Z4Na0K73muaySkf-4';

// SSR-Safe Storage Adapter for Expo Web + React Native
const isServer = typeof window === 'undefined' && Platform.OS === 'web';

const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isServer) return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isServer) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Error writing to storage:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (isServer) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Error removing from storage:', e);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StudyFlowSession } from '@studyflow/shared';
import { Platform } from 'react-native';

const isServer = typeof window === 'undefined' && Platform.OS === 'web';

const STORAGE_KEYS = {
  SESSION: 'studyflow_session',
  USERS: 'studyflow_users',
  ACTIVITY_PREFIX: 'studyflow_activity_',
  NOTES_PREFIX: 'studyflow_notes_',
  PRIVACY_PREFIX: 'studyflow_privacy_',
  DISCIPLINAS_PREFIX: 'studyflow_disciplinas_',
  ITENS_PREFIX: 'studyflow_itens_',
};

export const Storage = {
  async getSession(): Promise<StudyFlowSession | null> {
    if (isServer) return null;
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setSession(session: StudyFlowSession | null): Promise<void> {
    if (isServer) return;
    try {
      if (!session) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  },

  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    if (isServer) return defaultValue;
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    if (isServer) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isServer) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing ${key}:`, e);
    }
  },

  keys: STORAGE_KEYS,
};

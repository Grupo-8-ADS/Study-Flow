import React, { createContext, useContext, useEffect, useState } from 'react';
import { StudyFlowSession, DEMO_USER } from '@studyflow/shared';
import { supabase } from '../lib/supabase';
import { Storage } from '../lib/storage';

interface AuthContextType {
  session: StudyFlowSession | null;
  isLoading: boolean;
  signIn: (identifier: string, pass: string) => Promise<{ error?: string }>;
  signUp: (nome: string, username: string, email: string, pass: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateSession: (partial: Partial<StudyFlowSession>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  updateSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StudyFlowSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStored() {
      try {
        const stored = await Storage.getSession();
        if (stored) {
          setSession(stored);
        }
      } catch (err) {
        console.error('Failed to load session', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStored();
  }, []);

  const signIn = async (identifier: string, pass: string): Promise<{ error?: string }> => {
    const cleanId = identifier.trim();
    const isEmail = cleanId.includes('@');

    // Demo admin check for rapid presentation/testing
    if (
      (cleanId.toLowerCase() === 'admin@studyflow.com' || cleanId.toLowerCase() === 'admin' || cleanId.toLowerCase() === 'carlosedu') &&
      pass === '123456'
    ) {
      const demoSession: StudyFlowSession = {
        email: DEMO_USER.email,
        nome: DEMO_USER.nome,
        username: DEMO_USER.username,
        demoMode: true,
        bg_color: DEMO_USER.bg_color,
        horas_diarias: DEMO_USER.horas_diarias,
        nivel_atual: DEMO_USER.nivel_atual,
        xp: DEMO_USER.xp,
        last_achievement: DEMO_USER.last_achievement,
      };
      await Storage.setSession(demoSession);
      setSession(demoSession);
      return {};
    }

    try {
      let email = cleanId;
      if (!isEmail) {
        // Resolve username to email via Supabase RPC
        const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
          p_username: cleanId,
        });
        if (rpcError || !rpcEmail) {
          return { error: 'Email e/ou senha informados são inválidos' };
        }
        email = rpcEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        // Check local demo users fallback
        const localUsers = await Storage.getItem<any[]>(Storage.keys.USERS, []);
        const found = localUsers.find(
          (u) =>
            (u.email?.toLowerCase() === cleanId.toLowerCase() || u.username?.toLowerCase() === cleanId.toLowerCase()) &&
            u.password === pass
        );

        if (found) {
          const s: StudyFlowSession = {
            email: found.email,
            nome: found.nome,
            username: found.username,
            demoMode: true,
            bg_color: '#29645e',
            horas_diarias: 2,
            nivel_atual: 1,
            xp: 100,
          };
          await Storage.setSession(s);
          setSession(s);
          return {};
        }

        return { error: 'Email e/ou senha informados são inválidos' };
      }

      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const userSession: StudyFlowSession = {
          email: data.user.email || email,
          nome: prof?.nome || data.user.user_metadata?.nome || data.user.user_metadata?.full_name || email.split('@')[0],
          username: prof?.username || data.user.user_metadata?.username || email.split('@')[0],
          demoMode: false,
          avatar_url: prof?.avatar_url,
          banner_url: prof?.banner_url,
          bg_color: prof?.bg_color || '#29645e',
          horas_diarias: prof?.horas_diarias || 0,
          nivel_atual: prof?.nivel_atual || 1,
          xp: prof?.xp || 0,
          last_achievement: prof?.last_achievement,
        };

        await Storage.setSession(userSession);
        setSession(userSession);
        return {};
      }
    } catch (err: any) {
      return { error: err.message || 'Erro ao efetuar login' };
    }

    return { error: 'Email e/ou senha informados são inválidos' };
  };

  const signUp = async (nome: string, username: string, email: string, pass: string): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            nome: nome.trim(),
            full_name: nome.trim(),
            username: username.trim(),
          },
        },
      });

      if (error) {
        // Fallback demo storage
        const localUsers = await Storage.getItem<any[]>(Storage.keys.USERS, []);
        if (localUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          return { error: 'Este e-mail já está cadastrado.' };
        }
        const newUser = {
          nome: nome.trim(),
          username: username.trim(),
          email: email.trim(),
          password: pass,
        };
        localUsers.push(newUser);
        await Storage.setItem(Storage.keys.USERS, localUsers);

        const newSession: StudyFlowSession = {
          email: newUser.email,
          nome: newUser.nome,
          username: newUser.username,
          demoMode: true,
          bg_color: '#29645e',
          nivel_atual: 1,
          xp: 0,
          horas_diarias: 0,
        };
        await Storage.setSession(newSession);
        setSession(newSession);
        return {};
      }

      const newSession: StudyFlowSession = {
        email: email.trim(),
        nome: nome.trim(),
        username: username.trim(),
        demoMode: false,
        pendingEmailConfirmation: !data.session,
        bg_color: '#29645e',
        nivel_atual: 1,
        xp: 0,
        horas_diarias: 0,
      };

      await Storage.setSession(newSession);
      setSession(newSession);
      return {};
    } catch (err: any) {
      return { error: err.message || 'Erro ao realizar cadastro.' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    await Storage.setSession(null);
    setSession(null);
  };

  const updateSession = async (partial: Partial<StudyFlowSession>) => {
    if (!session) return;
    const updated = { ...session, ...partial };
    await Storage.setSession(updated);
    setSession(updated);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut, updateSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import React, { createContext, useContext, useEffect, useState } from 'react';
import { entrar, MENSAGENS_LOGIN, StudyFlowSession } from '@studyflow/shared';
import { supabase } from '../lib/supabase';
import { entrarPorUsuario } from '../lib/api';
import { Storage } from '../lib/storage';
import { limparAgenda } from '../lib/agenda';

interface AuthContextType {
  session: StudyFlowSession | null;
  isLoading: boolean;
  signIn: (identifier: string, pass: string) => Promise<{ error?: string }>;
  /** `confirmarEmail`: a conta foi criada mas só vale depois do link enviado por e-mail. */
  signUp: (nome: string, username: string, email: string, pass: string) => Promise<{ error?: string; confirmarEmail?: boolean }>;
  signOut: () => Promise<void>;
  updateSession: (partial: Partial<StudyFlowSession>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  updateSession: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StudyFlowSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileForUser = async (userId: string, email: string): Promise<StudyFlowSession> => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return {
      email,
      nome: prof?.nome || email.split('@')[0],
      username: prof?.username || email.split('@')[0],
      avatar_url: prof?.avatar_url,
      banner_url: prof?.banner_url,
      moldura: prof?.moldura ?? null,
      bg_color: prof?.bg_color || '#29645e',
      horas_diarias: prof?.horas_diarias || 0,
      nivel_atual: prof?.nivel_atual || 1,
      xp: prof?.xp || 0,
      last_achievement: prof?.last_achievement,
    };
  };

  useEffect(() => {
    async function loadUserSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const userSession = await fetchProfileForUser(
            data.session.user.id,
            data.session.user.email || ''
          );
          setSession(userSession);
          await Storage.setSession(userSession);
        } else {
          // Check storage cache
          const stored = await Storage.getSession();
          if (stored) {
            setSession(stored);
          }
        }
      } catch (err) {
        console.error('Failed to load Supabase session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession?.user) {
        const userSession = await fetchProfileForUser(
          currentSession.user.id,
          currentSession.user.email || ''
        );
        setSession(userSession);
        await Storage.setSession(userSession);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        await Storage.setSession(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const updated = await fetchProfileForUser(data.user.id, data.user.email || '');
      setSession(updated);
      await Storage.setSession(updated);
    }
  };

  /** Login por e-mail ou nome de usuário (mesma regra da web: ver entrar em @studyflow/shared). */
  const signIn = async (identifier: string, pass: string): Promise<{ error?: string }> => {
    const resultado = await entrar(supabase.auth, entrarPorUsuario, identifier, pass);
    if (!resultado.ok) return { error: resultado.mensagem };

    try {
      const userSession = await fetchProfileForUser(resultado.user.id, resultado.user.email || identifier.trim());
      setSession(userSession);
      await Storage.setSession(userSession);
      return {};
    } catch {
      return { error: MENSAGENS_LOGIN.indisponivel };
    }
  };

  const signUp = async (nome: string, username: string, email: string, pass: string): Promise<{ error?: string; confirmarEmail?: boolean }> => {
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
        return { error: error.message || 'Erro ao realizar cadastro.' };
      }

      // Com a confirmação de e-mail ligada no Supabase, e-mail já cadastrado volta sem identidades.
      if (data.user && data.user.identities?.length === 0) {
        return { error: 'Este e-mail já está cadastrado.' };
      }

      // Confirmação de e-mail ligada: sem sessão até o usuário abrir o link do e-mail.
      if (data.user && !data.session) {
        return { confirmarEmail: true };
      }

      if (data.user) {
        const userSession: StudyFlowSession = {
          email: email.trim(),
          nome: nome.trim(),
          username: username.trim(),
          bg_color: '#29645e',
          nivel_atual: 1,
          xp: 0,
          horas_diarias: 0,
        };

        setSession(userSession);
        await Storage.setSession(userSession);
        return {};
      }
    } catch (err: any) {
      return { error: err.message || 'Erro ao realizar cadastro.' };
    }

    return { error: 'Erro ao realizar cadastro.' };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    await Storage.setSession(null);
    limparAgenda();
    setSession(null);
  };

  const updateSession = async (partial: Partial<StudyFlowSession>) => {
    if (!session) return;
    const updated = { ...session, ...partial };
    await Storage.setSession(updated);
    setSession(updated);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut, updateSession, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

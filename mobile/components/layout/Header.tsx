import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@studyflow/shared';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { NotificationModal, NotificationItem } from './NotificationModal';
import { SectionTabs } from './SectionTabs';
import type { SectionKey } from '../../constants/navigation';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  /** Mostra as abas internas da seção (Agenda, Progresso ou Conta) abaixo do topo. */
  section?: SectionKey;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  showBack = false,
  rightAction,
  section,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showBrand = showLogo && !title;
  const { session } = useAuth();
  const [notificationVisible, setNotificationVisible] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const loadNotifications = useCallback(async (gerar: boolean) => {
    try {
      if (gerar) await supabase.rpc('gerar_notificacoes_prazos');
      const { data } = await supabase
        .from('notificacoes')
        .select('id, mensagem, tipo_evento, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications((data as NotificationItem[]) || []);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  }, []);

  const userEmail = session?.email;
  useEffect(() => {
    if (!userEmail) return;
    // Carga assíncrona: o setState ocorre após o await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications(false);
  }, [userEmail, loadNotifications]);

  const handleOpen = () => {
    setNotificationVisible(true);
    void loadNotifications(true);
  };

  const handleRead = async (id: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)));
    await supabase.from('notificacoes').update({ read_at: now }).eq('id', id).is('read_at', null);
  };

  const handleClearAll = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from('notificacoes').update({ read_at: now }).is('read_at', null);
  };

  return (
    <>
      <View style={[styles.wrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.left}>
            {showBack ? (
              <TouchableOpacity
                accessibilityLabel="Voltar"
                accessibilityRole="button"
                activeOpacity={0.7}
                hitSlop={8}
                onPress={() => (router.canGoBack() ? router.back() : router.navigate('/dashboard'))}
                style={styles.backButton}
              >
                <ChevronLeft size={24} color={COLORS.text} />
              </TouchableOpacity>
            ) : null}
            {showBrand ? (
              <View style={styles.logoRow}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.logoText}>Study Flow</Text>
              </View>
            ) : (
              <Text accessibilityRole="header" numberOfLines={1} style={styles.titleText}>
                {title}
              </Text>
            )}
          </View>

          <View style={styles.right}>
            {rightAction}

            <TouchableOpacity
              accessibilityLabel={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={styles.iconButton}
              onPress={handleOpen}
            >
              <Bell size={21} color={COLORS.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Abrir conta e perfil"
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => router.navigate('/perfil')}
              style={styles.avatarButton}
            >
              <Avatar
                name={session?.nome || 'Usuário'}
                size={34}
                uri={session?.avatar_url}
              />
            </TouchableOpacity>
          </View>
        </View>
        {section ? <SectionTabs section={section} /> : null}
      </View>

      <NotificationModal
        visible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
        notifications={notifications}
        onClearAll={handleClearAll}
        onRead={handleRead}
      />
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 4,
    marginLeft: -6,
    padding: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  logoText: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  titleText: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 3,
    backgroundColor: COLORS.danger,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  avatarButton: {
    padding: 2,
  },
});

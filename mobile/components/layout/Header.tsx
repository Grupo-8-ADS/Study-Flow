import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@studyflow/shared';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { NotificationModal, NotificationItem } from './NotificationModal';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  rightAction,
}) => {
  const router = useRouter();
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
      <View style={[styles.header, { backgroundColor: session?.bg_color || COLORS.primary }]}>
        <View style={styles.left}>
          {showLogo ? (
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Study Flow</Text>
            </View>
          ) : (
            <Text style={styles.titleText}>{title}</Text>
          )}
        </View>

        <View style={styles.right}>
          {rightAction}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconButton}
            onPress={handleOpen}
          >
            <Bell size={22} color="#ffffff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/perfil')}
            style={styles.avatarButton}
          >
            <Avatar
              name={session?.nome || 'Carlos'}
              size={36}
              level={session?.nivel_atual || 1}
              showLevel
              uri={session?.avatar_url}
            />
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  left: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginRight: 10,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarButton: {
    padding: 2,
  },
});

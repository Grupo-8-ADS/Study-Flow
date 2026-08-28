import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@studyflow/shared';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
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

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Sessão de foco concluída! 🎉',
      message: 'Você completou 25 minutos de estudo em História.',
      time: 'Há 15 min',
      type: 'focus',
      read: false,
    },
    {
      id: '2',
      title: 'Prova chegando!',
      message: 'Prova de Cálculo I marcada para daqui a 3 dias.',
      time: 'Hoje, 08:30',
      type: 'exam',
      read: false,
    },
    {
      id: '3',
      title: 'Nova conquista desbloqueada! 🏆',
      message: 'Parabéns! Você alcançou "Foco Inicial".',
      time: 'Ontem',
      type: 'achievement',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <>
      <View style={styles.header}>
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
            onPress={() => setNotificationVisible(true)}
          >
            <Bell size={22} color={COLORS.primary} />
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
            />
          </TouchableOpacity>
        </View>
      </View>

      <NotificationModal
        visible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
        notifications={notifications}
        onClearAll={handleClearAll}
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
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

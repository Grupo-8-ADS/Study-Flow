import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, CheckCircle2, Clock, Trophy, AlertTriangle } from 'lucide-react-native';
import { Modal } from '../ui/Modal';
import { COLORS } from '@studyflow/shared';

export interface NotificationItem {
  id: string;
  mensagem: string;
  tipo_evento: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClearAll?: () => void;
  onRead?: (id: string) => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const getTitle = (tipo: string | null) => {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('prova') || t.includes('prazo') || t.includes('entrega') || t.includes('trabalho')) return 'Prazo próximo';
  if (t.includes('conquista')) return 'Nova conquista';
  if (t.includes('foco') || t.includes('sessao')) return 'Sessão de foco';
  return 'Notificação';
};

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  notifications,
  onClearAll,
  onRead,
}) => {
  const getIcon = (tipo: string | null) => {
    const t = (tipo ?? '').toLowerCase();
    const type = t.includes('conquista') ? 'achievement' : t.includes('foco') || t.includes('sessao') ? 'focus' : t ? 'exam' : 'general';
    switch (type) {
      case 'focus':
        return <Clock size={18} color={COLORS.primary} />;
      case 'achievement':
        return <Trophy size={18} color={COLORS.gold} />;
      case 'exam':
        return <AlertTriangle size={18} color={COLORS.danger} />;
      default:
        return <Bell size={18} color={COLORS.primary} />;
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Notificações" variant="bottom">
      <View style={styles.container}>
        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <CheckCircle2 size={36} color={COLORS.success} />
            <Text style={styles.emptyText}>Você está em dia! Nenhuma notificação por aqui.</Text>
          </View>
        ) : (
          <>
            {notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => onRead?.(item.id)}
                style={[styles.itemCard, !item.read_at && styles.itemUnread]}
              >
                <View style={styles.iconCircle}>{getIcon(item.tipo_evento)}</View>
                <View style={styles.textContainer}>
                  <Text style={styles.itemTitle}>{getTitle(item.tipo_evento)}</Text>
                  <Text style={styles.itemMessage}>{item.mensagem}</Text>
                  <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {onClearAll && notifications.some((n) => !n.read_at) && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClearAll}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>Limpar tudo</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemUnread: {
    backgroundColor: '#ffffff',
    borderColor: COLORS.primaryMuted,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.danger,
  },
});

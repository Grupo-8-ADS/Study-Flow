import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, StyleProp } from 'react-native';
import { COLORS } from '@studyflow/shared';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  level?: number;
  showLevel?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = 'User',
  size = 44,
  level,
  showLevel = false,
  style,
}) => {
  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: COLORS.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              { fontSize: Math.max(12, Math.floor(size * 0.38)) },
            ]}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}

      {showLevel && level !== undefined && (
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  levelText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});

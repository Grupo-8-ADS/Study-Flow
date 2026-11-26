import React, { useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Shuffle } from 'lucide-react-native';
import { COLORS, ESTILOS_AVATAR, novasSementes, urlAvatar, type EstiloAvatar } from '@studyflow/shared';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface GaleriaAvataresProps {
  visible: boolean;
  onClose: () => void;
  onEscolher: (url: string) => void;
}

/** Galeria de avatares gerados (a mesma do site): escolha o estilo e toque no avatar. */
export function GaleriaAvatares({ visible, onClose, onEscolher }: GaleriaAvataresProps) {
  const [estilo, setEstilo] = useState<EstiloAvatar>(ESTILOS_AVATAR[0].id);
  const [sementes, setSementes] = useState(() => novasSementes());

  return (
    <Modal visible={visible} onClose={onClose} title="Escolher um avatar" variant="bottom">
      <View style={styles.estilos} accessibilityRole="radiogroup" accessibilityLabel="Estilo">
        {ESTILOS_AVATAR.map((e) => {
          const ativo = estilo === e.id;
          return (
            <TouchableOpacity
              key={e.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              activeOpacity={0.8}
              onPress={() => setEstilo(e.id)}
              style={[styles.estilo, ativo && styles.estiloAtivo]}
            >
              <Text style={[styles.estiloTexto, ativo && styles.estiloTextoAtivo]}>{e.nome}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.grade}>
        {sementes.map((semente) => (
          <TouchableOpacity
            key={semente}
            accessibilityLabel="Usar este avatar"
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={() => onEscolher(urlAvatar(estilo, semente))}
            style={styles.celula}
          >
            <Image source={{ uri: urlAvatar(estilo, semente) }} style={styles.avatar} />
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Outros"
        variant="outline"
        icon={<Shuffle size={16} color={COLORS.primary} />}
        onPress={() => setSementes(novasSementes())}
      />
      <Text style={styles.credito}>
        Avatares gerados pelo{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL('https://www.dicebear.com')}>
          DiceBear
        </Text>{' '}
        (estilos com licença CC0).
      </Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  estilos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  estilo: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  estiloAtivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  estiloTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  estiloTextoAtivo: {
    color: '#ffffff',
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 16,
  },
  celula: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: COLORS.primaryMuted,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  credito: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  link: {
    textDecorationLine: 'underline',
    color: COLORS.primary,
  },
});

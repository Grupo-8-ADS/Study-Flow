import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BookOpen,
  Clock,
  Compass,
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  Lock,
  Mountain,
  Target,
  Timer,
  Trophy,
  User,
} from 'lucide-react-native';

/** Ícone por chave gravada em conquistas.icone (mesmo mapa do site). */
const ICONES = {
  book: BookOpen,
  clock: Clock,
  compass: Compass,
  crown: Crown,
  flame: Flame,
  footprints: Footprints,
  graduation: GraduationCap,
  mountain: Mountain,
  target: Target,
  timer: Timer,
  trophy: Trophy,
  user: User,
} as const;

/** Bronze, prata e ouro. */
const TIER = {
  1: { fundo: '#e7b98e', aro: '#c98a55', cor: '#6b3d16' },
  2: { fundo: '#dfe5ea', aro: '#aeb9c2', cor: '#3c4a55' },
  3: { fundo: '#f6d873', aro: '#e0a92e', cor: '#6b4a00' },
} as const;

export function ConquistaIcone({
  icone,
  tier = 1,
  bloqueada = false,
  tamanho = 42,
}: {
  icone?: string | null;
  tier?: number | null;
  bloqueada?: boolean;
  tamanho?: number;
}) {
  const Icone = ICONES[(icone ?? '') as keyof typeof ICONES] ?? Trophy;
  const t = TIER[(tier ?? 1) as 1 | 2 | 3] ?? TIER[1];
  const cores = bloqueada ? { fundo: '#eef1f0', aro: '#d5dbd9', cor: '#94a3a0' } : t;
  return (
    <View
      style={[
        styles.medalha,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.fundo, borderColor: cores.aro },
      ]}
    >
      <Icone size={Math.round(tamanho * 0.46)} color={cores.cor} strokeWidth={2.2} />
      {bloqueada ? (
        <View style={styles.cadeado}>
          <Lock size={9} color="#64748b" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  medalha: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  cadeado: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Recompensas cosméticas no app: moldura em volta do avatar e fundo do banner do perfil.
 * Equivalente de frontend/src/components/moldura-avatar.tsx, com o mesmo catálogo e a
 * mesma geometria (`ArteMoldura`) de `@studyflow/shared`.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { bannerPreset, molduraPorId, type BannerPreset } from '@studyflow/shared';

/**
 * Artes empacotadas no app (versão de frontend/public/recompensas). O Metro só empacota
 * `require` estático, por isso o mapa pelo nome do arquivo do catálogo.
 */
const ARTES: Record<string, ImageSourcePropType> = {
  'moldura-formatura.png': require('../assets/images/recompensas/moldura-formatura.png'),
  // No app a ilustração vai em JPEG (o site usa WebP com miniatura).
  'banner-raposa-outono.webp': require('../assets/images/recompensas/banner-raposa-outono.jpg'),
};

export const arteRecompensa = (arquivo: string | undefined): ImageSourcePropType | null => (arquivo ? ARTES[arquivo] ?? null : null);

/**
 * Moldura em volta do avatar de diâmetro `tamanho`: aro em gradiente ou, nas molduras
 * desenhadas, a arte por cima do avatar (com os enfeites, como o capelo, saindo para fora).
 * Sem moldura, devolve o avatar como está.
 */
export function MolduraAvatar({
  moldura,
  tamanho,
  espessura = 3,
  children,
}: {
  moldura?: string | null;
  tamanho: number;
  espessura?: number;
  children: React.ReactNode;
}) {
  const m = molduraPorId(moldura);
  if (!m) return <>{children}</>;

  const arte = m.arte ? arteRecompensa(m.arte.arquivo) : null;
  if (m.arte && arte) {
    const { escala, x, y } = m.arte;
    return (
      <View style={{ width: tamanho, height: tamanho }}>
        {children}
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no"
          source={arte}
          style={{ position: 'absolute', left: x * tamanho, top: y * tamanho, width: escala * tamanho, height: escala * tamanho }}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={m.cores}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: espessura, borderRadius: (tamanho + espessura * 2) / 2 }}
    >
      {children}
    </LinearGradient>
  );
}

/** Prévia de um banner pronto (ilustração ou gradiente), ocupando o pai inteiro. */
export function PreviaBanner({ banner }: { banner: BannerPreset }) {
  const imagem = arteRecompensa(banner.imagem);
  return (
    <>
      <LinearGradient colors={banner.cores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {imagem ? (
        <Image
          accessibilityLabel={`Banner ${banner.nome}`}
          source={imagem}
          // A ilustração tem o personagem à direita: mantém ele visível em telas estreitas.
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          resizeMode="cover"
        />
      ) : null}
    </>
  );
}

/** Fundo do banner: imagem enviada, banner pronto ("preset:<id>") ou a cor do perfil. */
export function FundoBanner({ valor, corPadrao, style }: { valor?: string | null; corPadrao: string; style?: StyleProp<ViewStyle> }) {
  const preset = bannerPreset(valor);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: corPadrao }, style]}>
      {preset ? <PreviaBanner banner={preset} /> : valor ? <Image source={{ uri: valor }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
    </View>
  );
}

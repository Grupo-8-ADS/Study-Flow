import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Check, Gift, HelpCircle, Image as ImageIcon, Lock, Palette, Trophy } from 'lucide-react-native';
import {
  BANNERS,
  COLORS,
  MOLDURAS,
  RADII,
  REGRAS_XP,
  desbloqueado,
  equiparRecompensa,
  nomeConquista,
  resumoColecao,
  textoProximaRecompensa,
  valorBanner,
  type CampoRecompensa,
} from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ConquistaIcone } from '../components/ConquistaIcone';
import { PreviaBanner } from '../components/MolduraAvatar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Aba = 'conquistas' | 'molduras' | 'banners';

type ConquistaLinha = { id: string; nome: string; descricao: string | null; icone: string | null; tier: number | null };

const ABAS: { id: Aba; titulo: string; Icone: typeof Trophy }[] = [
  { id: 'conquistas', titulo: 'Conquistas', Icone: Trophy },
  { id: 'molduras', titulo: 'Molduras', Icone: Palette },
  { id: 'banners', titulo: 'Banners', Icone: ImageIcon },
];

/** Recompensas (mesmo catálogo e regras do site): conquistas, molduras do avatar e banners do perfil. */
export default function RewardsScreen() {
  const { session, updateSession, refreshProfile } = useAuth();
  const [aba, setAba] = useState<Aba>('conquistas');
  const [conquistas, setConquistas] = useState<ConquistaLinha[]>([]);
  const [ganhas, setGanhas] = useState<Map<string, string | null>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const nivel = session?.nivel_atual || 1;
  const xp = session?.xp || 0;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const [{ data: desbloqueadas }, { data: todas }] = await Promise.all([
        supabase.from('user_conquistas').select('conquista_id,detalhe').eq('user_id', userRes.user.id),
        supabase.from('conquistas').select('id,nome,descricao,icone,tier').order('tier', { ascending: true }),
        refreshProfile(),
      ]);
      setConquistas((todas ?? []) as ConquistaLinha[]);
      setGanhas(new Map((desbloqueadas ?? []).map((u) => [u.conquista_id as string, (u.detalhe as string | null) ?? null])));
    } catch (e) {
      console.error('Error loading rewards:', e);
    } finally {
      setCarregando(false);
    }
    // refreshProfile muda a cada render do contexto; recarregar só ao focar a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const resumo = resumoColecao(nivel, { feitos: conquistas.filter((c) => ganhas.has(c.id)).length, total: conquistas.length });

  const equipar = async (campo: CampoRecompensa, valor: string | null) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return;
    setErro(null);
    setSalvando(`${campo}:${valor}`);
    const falha = await equiparRecompensa(supabase, userRes.user.id, campo, valor);
    setSalvando(null);
    if (falha) {
      setErro(falha);
      return;
    }
    await updateSession({ [campo]: valor });
  };

  const ocupado = salvando !== null;

  return (
    <View style={styles.container}>
      <Header title="Progresso" section="progresso" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={carregando && conquistas.length > 0} onRefresh={() => void carregar()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopo}>
            <View style={styles.heroIcone}>
              <Gift size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.heroTitulo}>
                Nível {nivel}
              </Text>
              <Text style={styles.heroTexto}>{textoProximaRecompensa(nivel, xp)}</Text>
            </View>
          </View>
          <View style={styles.progressoCaixa}>
            <View style={styles.progressoLinha}>
              <Text style={styles.progressoRotulo}>Progresso geral</Text>
              <Text style={styles.progressoValor}>
                {resumo.feitos} de {resumo.total} · {resumo.percentual}%
              </Text>
            </View>
            <View
              accessibilityLabel="Progresso geral da coleção"
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: resumo.percentual }}
              style={styles.barra}
            >
              <View style={[styles.barraCheia, { width: `${resumo.percentual}%` }]} />
            </View>
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.abas}>
          {ABAS.map(({ id, titulo, Icone }) => {
            const ativo = aba === id;
            const { feitos, total } = resumo[id];
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                key={id}
                onPress={() => setAba(id)}
                style={[styles.aba, ativo && styles.abaAtiva]}
              >
                <Icone size={15} color={ativo ? '#ffffff' : COLORS.textSecondary} />
                <Text style={[styles.abaTexto, ativo && styles.abaTextoAtivo]}>
                  {titulo} {feitos}/{total}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {erro ? (
          <View accessibilityLiveRegion="polite" style={styles.erro}>
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        ) : null}

        {aba === 'conquistas' ? (
          carregando && conquistas.length === 0 ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
          ) : conquistas.length === 0 ? (
            <EmptyState title="Nenhuma conquista ainda" description="Continue estudando para desbloquear as primeiras medalhas." />
          ) : (
            conquistas.map((c) => {
              const ganha = ganhas.has(c.id);
              return (
                <Card key={c.id} style={[styles.item, !ganha && styles.itemBloqueado]}>
                  <ConquistaIcone bloqueada={!ganha} icone={c.icone} tamanho={40} tier={c.tier} />
                  <View style={styles.itemTexto}>
                    <Text numberOfLines={1} style={styles.itemNome}>
                      {nomeConquista(c.nome, ganhas.get(c.id) ?? null)}
                    </Text>
                    <Text numberOfLines={2} style={[styles.itemMeta, ganha && { color: COLORS.success }]}>
                      {ganha ? 'Desbloqueada' : (c.descricao ?? 'Continue estudando')}
                    </Text>
                  </View>
                </Card>
              );
            })
          )
        ) : null}

        {aba === 'molduras' ? (
          <>
            {session?.moldura ? (
              <Button disabled={ocupado} onPress={() => void equipar('moldura', null)} size="sm" style={styles.tirar} title="Tirar moldura" variant="ghost" />
            ) : null}
            {MOLDURAS.map((m) => {
              const livre = desbloqueado(m, nivel);
              const equipada = session?.moldura === m.id;
              return (
                <Card key={m.id} style={[styles.item, equipada && styles.itemEquipado]}>
                  <View style={[styles.previaMoldura, !livre && styles.apagado]}>
                    <Avatar moldura={m.id} name={session?.nome || 'Você'} size={52} uri={session?.avatar_url} />
                  </View>
                  <View style={styles.itemTexto}>
                    <Text style={styles.itemNome}>{m.nome}</Text>
                    <Text style={styles.itemMeta}>Nível {m.nivel}</Text>
                  </View>
                  <AcaoItem
                    equipado={equipada}
                    livre={livre}
                    nome={`moldura ${m.nome}`}
                    ocupado={ocupado}
                    onEquipar={() => void equipar('moldura', m.id)}
                    rotuloEquipado="Equipada"
                  />
                </Card>
              );
            })}
          </>
        ) : null}

        {aba === 'banners' ? (
          <>
            <Text style={styles.dica}>Equipar um banner pronto substitui a imagem enviada no perfil. Você pode enviar outra imagem quando quiser.</Text>
            {BANNERS.map((b) => {
              const livre = desbloqueado(b, nivel);
              const valor = valorBanner(b);
              const equipado = session?.banner_url === valor;
              return (
                <Card key={b.id} style={[styles.banner, equipado && styles.itemEquipado]}>
                  <View style={[styles.bannerPrevia, !livre && styles.apagado]}>
                    <PreviaBanner banner={b} />
                    {livre ? null : (
                      <View style={styles.bannerCadeado}>
                        <Lock size={18} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.bannerRodape}>
                    <View style={styles.itemTexto}>
                      <Text style={styles.itemNome}>{b.nome}</Text>
                      <Text style={styles.itemMeta}>Nível {b.nivel}</Text>
                    </View>
                    <AcaoItem
                      equipado={equipado}
                      livre={livre}
                      nome={`banner ${b.nome}`}
                      ocupado={ocupado}
                      onEquipar={() => void equipar('banner_url', valor)}
                      rotuloEquipado="Equipado"
                    />
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        <Card style={styles.guia}>
          <View style={styles.guiaTopo}>
            <HelpCircle size={18} color={COLORS.primary} />
            <Text style={styles.guiaTitulo}>Como ganhar XP e subir de nível</Text>
          </View>
          {REGRAS_XP.map((regra) => (
            <Text key={regra} style={styles.guiaItem}>
              • {regra}
            </Text>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function AcaoItem({
  equipado,
  livre,
  nome,
  ocupado,
  onEquipar,
  rotuloEquipado,
}: {
  equipado: boolean;
  livre: boolean;
  nome: string;
  ocupado: boolean;
  onEquipar: () => void;
  rotuloEquipado: string;
}) {
  if (equipado) {
    return (
      <View style={styles.estado}>
        <Check size={14} color={COLORS.primary} />
        <Text style={styles.estadoEquipado}>{rotuloEquipado}</Text>
      </View>
    );
  }
  if (livre) {
    return <Button accessibilityLabel={`Equipar ${nome}`} disabled={ocupado} onPress={onEquipar} size="sm" title="Equipar" variant="outline" />;
  }
  return (
    <View style={styles.estado}>
      <Lock size={13} color={COLORS.textMuted} />
      <Badge label="Bloqueado" size="sm" variant="gray" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  hero: { backgroundColor: COLORS.primaryDark, borderRadius: 20, padding: 18, marginBottom: 16, gap: 14 },
  heroTopo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroIcone: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroTitulo: { fontSize: 19, fontWeight: '700', color: '#ffffff' },
  heroTexto: { fontSize: 13, lineHeight: 18, color: COLORS.primaryMuted, marginTop: 4 },
  progressoCaixa: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12 },
  progressoLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressoRotulo: { fontSize: 12, fontWeight: '600', color: COLORS.primaryMuted },
  progressoValor: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  barra: { height: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' },
  barraCheia: { height: '100%', backgroundColor: '#8fd3c4', borderRadius: 3 },
  abas: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginBottom: 14, gap: 4 },
  aba: { flex: 1, flexDirection: 'row', gap: 5, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  abaAtiva: { backgroundColor: COLORS.primary },
  abaTexto: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  abaTextoAtivo: { color: '#ffffff', fontWeight: '700' },
  erro: { backgroundColor: COLORS.dangerLight, borderRadius: RADII.control, padding: 12, marginBottom: 12 },
  erroTexto: { color: COLORS.danger, fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
  itemBloqueado: { backgroundColor: '#f8fafa' },
  itemEquipado: { borderWidth: 2, borderColor: COLORS.primaryLight },
  itemTexto: { flex: 1, minWidth: 0 },
  itemNome: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  previaMoldura: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  apagado: { opacity: 0.4 },
  tirar: { alignSelf: 'flex-end', marginBottom: 8 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  estadoEquipado: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dica: { fontSize: 13, lineHeight: 18, color: COLORS.textMuted, marginBottom: 10 },
  banner: { padding: 0, marginBottom: 10, overflow: 'hidden' },
  bannerPrevia: { height: 80, position: 'relative' },
  bannerCadeado: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  bannerRodape: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  guia: { padding: 16, marginTop: 6, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryMuted },
  guiaTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  guiaTitulo: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  guiaItem: { fontSize: 12, lineHeight: 18, color: COLORS.text, marginBottom: 4 },
});

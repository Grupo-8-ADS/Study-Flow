import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useIrPara } from '../lib/navigation';
import { Clock, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import {
  COLORS,
  COMO_O_CRONOGRAMA_E_MONTADO,
  DURACAO_BLOCO_MIN,
  NOMES_DIAS_SEMANA,
  RADII,
  applyTimeMask,
  horaStr,
  intervaloDe,
  limiteDiarioInicial,
  planejarCronograma,
  resumoCronograma,
  rotuloResumoCronograma,
  textoDescartados,
  adicionarHorarioLivre,
  carregarHorariosLivres,
  removerHorarioLivre,
  type BlocoEstudo,
  type HorarioLivre,
} from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { RotinaFixaCard } from '../components/RotinaFixaCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { salvarBlocosCronograma, useAgenda } from '../lib/agenda';

const dois = (n: number) => String(n).padStart(2, '0');
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Rotina semanal e geração de cronograma (mesmas regras do site, via @studyflow/shared). */
export default function RotinaScreen() {
  const irPara = useIrPara();
  const { session } = useAuth();
  const { dados: agenda } = useAgenda();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [slots, setSlots] = useState<HorarioLivre[]>([]);

  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [errosRotina, setErrosRotina] = useState<string[]>([]);
  const [salvandoSlot, setSalvandoSlot] = useState(false);

  const [semanas, setSemanas] = useState(2);
  const [duracao, setDuracao] = useState(String(DURACAO_BLOCO_MIN.padrao));
  /** Máximo de horas de estudo por dia ("" = sem limite). Começa pela meta diária do perfil. */
  const [limiteHoras, setLimiteHoras] = useState(() => String(limiteDiarioInicial(session?.horas_diarias)));
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [semDisciplinas, setSemDisciplinas] = useState(false);
  const [previa, setPrevia] = useState<{ blocos: BlocoEstudo[]; duracaoMin: number; descartados: number } | null>(null);
  const [substituir, setSubstituir] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const r = await carregarHorariosLivres(supabase, id);
      if (r.ok) setSlots(r.horarios);
      setErroCarga(r.ok ? null : r.erros[0]);
    } catch {
      setErroCarga('Não foi possível carregar sua rotina. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const adicionar = async () => {
    setSucesso(null);
    setPrevia(null);
    if (!userId) return;
    setSalvandoSlot(true);
    const r = await adicionarHorarioLivre(supabase, userId, slots, { dia_semana: dia, hora_inicio: inicio, hora_fim: fim });
    setSalvandoSlot(false);
    if (!r.ok) {
      setErrosRotina(r.erros);
      return;
    }
    setSlots(r.horarios);
    setErrosRotina([]);
    setInicio('');
    setFim('');
  };

  const remover = async (slot: HorarioLivre) => {
    if (!userId) return;
    setSucesso(null);
    setPrevia(null);
    const r = await removerHorarioLivre(supabase, userId, slots, slot.id);
    if (r.ok) setSlots(r.horarios);
    setErrosRotina(r.ok ? [] : r.erros);
  };

  const gerar = () => {
    setSucesso(null);
    setPrevia(null);
    setErroGeracao(null);
    setSemDisciplinas(false);
    if (!agenda) return;
    const resultado = planejarCronograma({ agenda, rotina: slots, semanas, duracaoBloco: duracao, limiteHoras, substituir });
    if (resultado.ok) {
      setPrevia(resultado);
    } else {
      setErroGeracao(resultado.mensagem);
      setSemDisciplinas(Boolean(resultado.semDisciplinas));
    }
  };

  const confirmar = async () => {
    if (!previa) return;
    setSalvando(true);
    setErroGeracao(null);
    const msg = await salvarBlocosCronograma(previa.blocos, substituir);
    setSalvando(false);
    if (msg) {
      setErroGeracao(msg);
      return;
    }
    setSucesso(`Cronograma salvo! ${previa.blocos.length} blocos de estudo adicionados.`);
    setPrevia(null);
  };

  const resumo = previa ? resumoCronograma(previa.blocos) : [];
  const agoraRender = new Date();
  const blocosFuturos = (agenda?.compromissos ?? []).filter(
    (c) => c.origem === 'cronograma' && !c.concluido && intervaloDe(c).inicio >= agoraRender,
  ).length;

  return (
    <View style={styles.container}>
      <Header title="Agenda" section="agenda" showBack />
      {loading && slots.length === 0 && !agenda ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {erroCarga ? (
            <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertDanger]}>
              <Text style={styles.alertDangerText}>{erroCarga}</Text>
            </View>
          ) : null}

          {agenda ? <RotinaFixaCard dados={agenda} titulo="1. Sua rotina fixa" /> : null}

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>2. Horários livres para estudar</Text>

            <Text style={styles.label}>Dia da semana</Text>
            <View style={styles.chips}>
              {DIAS_CURTOS.map((nome, i) => (
                <TouchableOpacity
                  key={nome}
                  accessibilityLabel={NOMES_DIAS_SEMANA[i]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: dia === i }}
                  onPress={() => setDia(i)}
                  style={[styles.chip, dia === i && styles.chipActive]}
                >
                  <Text style={[styles.chipText, dia === i && styles.chipTextActive]}>{nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <Input
                containerStyle={styles.half}
                keyboardType="number-pad"
                label="Início"
                maxLength={5}
                onChangeText={(t) => setInicio(applyTimeMask(t))}
                placeholder="19:00"
                value={inicio}
              />
              <Input
                containerStyle={styles.half}
                keyboardType="number-pad"
                label="Fim"
                maxLength={5}
                onChangeText={(t) => setFim(applyTimeMask(t))}
                placeholder="21:00"
                value={fim}
              />
            </View>
            <Button
              disabled={salvandoSlot}
              icon={<Plus size={18} color={COLORS.primary} />}
              loading={salvandoSlot}
              onPress={() => void adicionar()}
              title="Adicionar horário"
              variant="outline"
            />

            {errosRotina.length > 0 ? (
              <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertDanger]}>
                {errosRotina.map((erro) => (
                  <Text key={erro} style={styles.alertDangerText}>
                    {erro}
                  </Text>
                ))}
              </View>
            ) : null}

            {slots.length === 0 ? (
              <EmptyState description="Adicione pelo menos um horário para gerar o cronograma." title="Nenhum horário cadastrado" />
            ) : (
              <View style={styles.list}>
                {slots.map((slot, index) => (
                  <View key={slot.id} style={[styles.listItem, index > 0 && styles.listItemBorder]}>
                    <Clock size={16} color={COLORS.primary} />
                    <Text style={styles.listText}>
                      {NOMES_DIAS_SEMANA[slot.dia_semana]} · {slot.hora_inicio} – {slot.hora_fim}
                    </Text>
                    <TouchableOpacity
                      accessibilityLabel={`Remover horário ${NOMES_DIAS_SEMANA[slot.dia_semana]} ${slot.hora_inicio}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => void remover(slot)}
                    >
                      <Trash2 size={17} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>3. Gerar cronograma</Text>

            <Text style={styles.label}>Semanas</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  accessibilityLabel={`${n} ${n === 1 ? 'semana' : 'semanas'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: semanas === n }}
                  onPress={() => setSemanas(n)}
                  style={[styles.chip, styles.chipWide, semanas === n && styles.chipActive]}
                >
                  <Text style={[styles.chipText, semanas === n && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <Input
                containerStyle={styles.half}
                keyboardType="number-pad"
                label="Duração do bloco (min)"
                maxLength={3}
                onChangeText={setDuracao}
                value={duracao}
              />
              <Input
                containerStyle={styles.half}
                keyboardType="decimal-pad"
                label="Máximo por dia (h)"
                maxLength={4}
                onChangeText={(t) => {
                  setLimiteHoras(t);
                  setPrevia(null);
                }}
                placeholder="Sem limite"
                value={limiteHoras}
              />
            </View>

            {blocosFuturos > 0 ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Substituir os {blocosFuturos} blocos de estudo já agendados</Text>
                <Switch
                  value={substituir}
                  onValueChange={(v) => {
                    setSubstituir(v);
                    setPrevia(null);
                  }}
                  trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
                  thumbColor={substituir ? COLORS.primary : '#f4f3f4'}
                />
              </View>
            ) : null}

            <Button icon={<Sparkles size={18} color="#ffffff" />} onPress={gerar} title="Gerar cronograma" />
            <View style={styles.regras}>
              <Text style={styles.regrasTitulo}>Como o cronograma é montado</Text>
              {COMO_O_CRONOGRAMA_E_MONTADO.map((regra) => (
                <Text key={regra} style={styles.hint}>
                  • {regra}
                </Text>
              ))}
            </View>

            {erroGeracao ? (
              <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertDanger]}>
                <Text style={styles.alertDangerText}>{erroGeracao}</Text>
                {semDisciplinas ? (
                  <Text accessibilityRole="link" onPress={() => irPara('/disciplinas')} style={styles.alertLink}>
                    Ir para Disciplinas
                  </Text>
                ) : null}
              </View>
            ) : null}

            {sucesso ? (
              <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertSuccess]}>
                <Text style={styles.alertSuccessText}>{sucesso}</Text>
                <Text accessibilityRole="link" onPress={() => irPara('/calendario')} style={styles.alertLink}>
                  Ver no calendário
                </Text>
              </View>
            ) : null}

            {previa ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Prévia do cronograma</Text>
                {previa.descartados > 0 ? (
                  <Text style={styles.hint}>{textoDescartados(previa.descartados)}</Text>
                ) : null}
                <View style={styles.chips}>
                  {resumo.map(([nome, qtd]) => (
                    <View key={nome} style={styles.summaryPill}>
                      <Text style={styles.summaryText}>{rotuloResumoCronograma(nome, qtd, previa.duracaoMin)}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.list}>
                  {previa.blocos.map((b, index) => {
                    const ini = new Date(b.data_inicio);
                    return (
                      <View key={`${b.data_inicio}-${b.disciplina_id}`} style={[styles.previewRow, index > 0 && styles.listItemBorder]}>
                        <Text style={styles.previewDate}>
                          {DIAS_CURTOS[ini.getDay()]} {dois(ini.getDate())}/{dois(ini.getMonth() + 1)} · {horaStr(ini)} – {horaStr(new Date(b.data_fim))}
                        </Text>
                        <Text style={styles.previewSubject}>{b.disciplina_nome}</Text>
                      </View>
                    );
                  })}
                </View>
                <Button
                  disabled={salvando}
                  loading={salvando}
                  onPress={() => void confirmar()}
                  title={substituir && blocosFuturos > 0 ? 'Substituir e salvar' : 'Confirmar e salvar no cronograma'}
                />
                <Button onPress={() => setPrevia(null)} style={{ marginTop: 8 }} title="Descartar" variant="ghost" />
              </View>
            ) : null}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  hint: { fontSize: 13, lineHeight: 18, color: COLORS.textMuted },
  regras: { backgroundColor: COLORS.primarySoft, borderRadius: RADII.control, padding: 12, gap: 4 },
  regrasTitulo: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  chipWide: { minWidth: 56 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchText: { flex: 1, fontSize: 14, color: COLORS.text },
  alert: { borderRadius: RADII.control, padding: 12, gap: 4 },
  alertDanger: { backgroundColor: COLORS.dangerLight },
  alertDangerText: { color: COLORS.danger, fontSize: 14 },
  alertSuccess: { backgroundColor: COLORS.successLight },
  alertSuccessText: { color: COLORS.success, fontSize: 14, fontWeight: '500' },
  alertLink: { color: COLORS.primary, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  list: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.control },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  listItemBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  listText: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  preview: { marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  summaryPill: { backgroundColor: COLORS.primaryMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  summaryText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '600' },
  previewRow: { paddingHorizontal: 12, paddingVertical: 10 },
  previewDate: { fontSize: 13, color: COLORS.textMuted },
  previewSubject: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 2 },
});

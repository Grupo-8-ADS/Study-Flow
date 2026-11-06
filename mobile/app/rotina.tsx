import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useIrPara } from '../lib/navigation';
import { Clock, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import {
  COLORS,
  CronogramaError,
  NOMES_DIAS_SEMANA,
  RADII,
  aulasNoPeriodo,
  dataStr,
  gerarCronograma,
  hojeStr,
  horaStr,
  intervaloDe,
  proximasProvas,
  validarRotina,
  type BlocoEstudo,
  type RotinaSlot,
} from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';
import { salvarBlocosCronograma, useAgenda } from '../lib/agenda';

type Slot = RotinaSlot & { id: string };

const dois = (n: number) => String(n).padStart(2, '0');
const hhmm = (valor: string) => String(valor).slice(0, 5);
const ordenar = (lista: Slot[]) =>
  [...lista].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Normaliza "1900" ou "19:00" para "19:00"; devolve null se não for um horário válido. */
function normalizarHora(valor: string): string | null {
  const limpo = valor.trim().replace(/[^0-9:]/g, '');
  const m = limpo.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${dois(h)}:${dois(min)}`;
}

/** Rotina semanal e geração de cronograma (mesmas regras do site, via @studyflow/shared). */
export default function RotinaScreen() {
  const irPara = useIrPara();
  const { dados: agenda } = useAgenda();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [errosRotina, setErrosRotina] = useState<string[]>([]);
  const [salvandoSlot, setSalvandoSlot] = useState(false);

  const [semanas, setSemanas] = useState(2);
  const [duracao, setDuracao] = useState('50');
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
      const rotinaRes = await supabase.from('rotinas_semanais').select('id,dia_semana,hora_inicio,hora_fim').eq('user_id', id);
      setSlots(
        ordenar(
          (rotinaRes.data ?? []).map((r) => ({
            id: r.id,
            dia_semana: r.dia_semana,
            hora_inicio: hhmm(r.hora_inicio),
            hora_fim: hhmm(r.hora_fim),
          })),
        ),
      );
      setErroCarga(rotinaRes.error ? 'Não foi possível carregar sua rotina. Verifique a conexão e tente novamente.' : null);
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
    const ini = normalizarHora(inicio);
    const fi = normalizarHora(fim);
    if (!ini || !fi) {
      setErrosRotina(['Informe o horário de início e o de fim no formato HH:MM.']);
      return;
    }
    const novo: RotinaSlot = { dia_semana: dia, hora_inicio: ini, hora_fim: fi };
    const erros = validarRotina([...slots, novo]);
    if (erros.length > 0) {
      setErrosRotina(erros);
      return;
    }
    if (!userId) return;
    setErrosRotina([]);
    setSalvandoSlot(true);
    const { data, error } = await supabase
      .from('rotinas_semanais')
      .insert({ user_id: userId, ...novo })
      .select('id')
      .single();
    setSalvandoSlot(false);
    if (error || !data) {
      setErrosRotina(['Não foi possível salvar o horário. Tente novamente.']);
      return;
    }
    setSlots((atual) => ordenar([...atual, { ...novo, id: data.id }]));
    setInicio('');
    setFim('');
  };

  const remover = async (slot: Slot) => {
    if (!userId) return;
    setSucesso(null);
    setPrevia(null);
    const { error } = await supabase.from('rotinas_semanais').delete().eq('id', slot.id).eq('user_id', userId);
    if (error) {
      setErrosRotina(['Não foi possível remover o horário. Tente novamente.']);
      return;
    }
    setSlots((atual) => atual.filter((s) => s.id !== slot.id));
    setErrosRotina([]);
  };

  const gerar = () => {
    setSucesso(null);
    setPrevia(null);
    setErroGeracao(null);
    setSemDisciplinas(false);
    if (!agenda) return;
    if (agenda.disciplinas.length === 0) {
      setErroGeracao('Cadastre ao menos uma disciplina antes de gerar o cronograma.');
      setSemDisciplinas(true);
      return;
    }
    if (slots.length === 0) {
      setErroGeracao('Cadastre sua rotina semanal antes de gerar o cronograma.');
      return;
    }
    const duracaoMin = Number(duracao);
    if (!Number.isInteger(duracaoMin) || duracaoMin < 10 || duracaoMin > 240) {
      setErroGeracao('Informe uma duração de bloco entre 10 e 240 minutos.');
      return;
    }

    const agora = new Date();
    const hoje = hojeStr();
    const fimPeriodo = dataStr(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + semanas * 7 - 1));
    const provas = proximasProvas(agenda.compromissos);
    // O que já ocupa o tempo: aulas, compromissos com horário e (se não for substituir) blocos já salvos.
    const ocupados = [
      ...aulasNoPeriodo(agenda.disciplinas, hoje, fimPeriodo),
      ...agenda.compromissos.filter(
        (c) => c.horaInicio && !c.concluido && c.data >= hoje && c.data <= fimPeriodo && !(substituir && c.origem === 'cronograma'),
      ),
    ].map((c) => {
      const { inicio: ini, fim: f } = intervaloDe(c);
      // Compromisso só com horário de início ocupa 1 h.
      return { inicio: ini, fim: f > ini ? f : new Date(ini.getTime() + 60 * 60 * 1000) };
    });

    try {
      const params = {
        disciplinas: agenda.disciplinas.map((d) => ({ id: d.id, nome: d.nome, peso: d.prioridade, proximaProva: provas.get(d.id) ?? null })),
        rotina: slots,
        dataInicio: agora,
        semanas,
        duracaoBlocoMin: duracaoMin,
      };
      const todos = (() => {
        try {
          return gerarCronograma(params).length;
        } catch {
          return 0;
        }
      })();
      const blocos = gerarCronograma({ ...params, ocupados, naoAntesDe: agora });
      setPrevia({ blocos, duracaoMin, descartados: Math.max(0, todos - blocos.length) });
    } catch (e) {
      setErroGeracao(e instanceof CronogramaError ? e.message : 'Não foi possível gerar o cronograma.');
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

  const resumo = previa
    ? Array.from(previa.blocos.reduce((mapa, b) => mapa.set(b.disciplina_nome, (mapa.get(b.disciplina_nome) ?? 0) + 1), new Map<string, number>()))
    : [];
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

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>1. Horários livres para estudar</Text>

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
                keyboardType="numbers-and-punctuation"
                label="Início"
                maxLength={5}
                onChangeText={setInicio}
                placeholder="19:00"
                value={inicio}
              />
              <Input
                containerStyle={styles.half}
                keyboardType="numbers-and-punctuation"
                label="Fim"
                maxLength={5}
                onChangeText={setFim}
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
            <Text style={styles.cardTitle}>2. Gerar cronograma</Text>

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
            <Input keyboardType="number-pad" label="Duração do bloco (min)" maxLength={3} onChangeText={setDuracao} value={duracao} />

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
            <Text style={styles.hint}>
              Os blocos entram nos seus horários livres, pulando aulas, compromissos com horário e o que já passou. As disciplinas se revezam
              conforme a prioridade, e quem tem prova no período ganha peso dobrado até a prova.
            </Text>

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
                  <Text style={styles.hint}>
                    {previa.descartados} {previa.descartados === 1 ? 'horário foi pulado' : 'horários foram pulados'} por já ter passado ou bater com
                    outro compromisso.
                  </Text>
                ) : null}
                <View style={styles.chips}>
                  {resumo.map(([nome, qtd]) => (
                    <View key={nome} style={styles.summaryPill}>
                      <Text style={styles.summaryText}>
                        {nome}: {qtd} {qtd === 1 ? 'bloco' : 'blocos'} ·{' '}
                        {((qtd * previa.duracaoMin) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                      </Text>
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

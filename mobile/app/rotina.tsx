import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import {
  COLORS,
  CronogramaError,
  NOMES_DIAS_SEMANA,
  RADII,
  gerarCronograma,
  validarRotina,
  type BlocoEstudo,
  type DisciplinaPlanejamento,
  type RotinaSlot,
} from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';

type Slot = RotinaSlot & { id: string };

const dois = (n: number) => String(n).padStart(2, '0');
const dataLocal = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const horaLocal = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
/** Mesmo formato "sem fuso" que o site usa ao gravar itens_cronograma. */
const timestampLocal = (d: Date) => `${dataLocal(d)}T${horaLocal(d)}:00`;
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

/** Data da próxima prova (hoje ou futura) a partir das anotações da disciplina. */
function proximaProvaDe(anotacoes: unknown): string | null {
  const notas = (typeof anotacoes === 'object' && anotacoes !== null ? anotacoes : {}) as Record<string, unknown>;
  const datas: string[] = [];
  if (Array.isArray(notas.provas)) {
    notas.provas.forEach((p) => {
      const data = (p as { data?: string } | null)?.data;
      if (data) datas.push(String(data).slice(0, 10));
    });
  } else if (typeof notas.examDate === 'string' && notas.examDate) {
    datas.push(notas.examDate.slice(0, 10));
  }
  const hoje = dataLocal(new Date());
  return datas.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= hoje).sort()[0] ?? null;
}

/** Rotina semanal e geração de cronograma (mesmas regras do site, via @studyflow/shared). */
export default function RotinaScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaPlanejamento[]>([]);

  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [errosRotina, setErrosRotina] = useState<string[]>([]);
  const [salvandoSlot, setSalvandoSlot] = useState(false);

  const [semanas, setSemanas] = useState(1);
  const [duracao, setDuracao] = useState('50');
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [semDisciplinas, setSemDisciplinas] = useState(false);
  const [previa, setPrevia] = useState<{ blocos: BlocoEstudo[]; duracaoMin: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const [rotinaRes, disciplinasRes] = await Promise.all([
        supabase.from('rotinas_semanais').select('id,dia_semana,hora_inicio,hora_fim').eq('user_id', id),
        supabase.from('disciplinas').select('id,nome,anotacoes').eq('user_id', id).order('created_at', { ascending: false }),
      ]);
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
      setDisciplinas((disciplinasRes.data ?? []).map((d) => ({ id: d.id, nome: d.nome, proximaProva: proximaProvaDe(d.anotacoes) })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga assíncrona: o setState ocorre após o await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

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
    if (disciplinas.length === 0) {
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
    try {
      const blocos = gerarCronograma({ disciplinas, rotina: slots, dataInicio: new Date(), semanas, duracaoBlocoMin: duracaoMin });
      setPrevia({ blocos, duracaoMin });
    } catch (e) {
      setErroGeracao(e instanceof CronogramaError ? e.message : 'Não foi possível gerar o cronograma.');
    }
  };

  const confirmar = async () => {
    if (!previa || !userId) return;
    setSalvando(true);
    setErroGeracao(null);
    try {
      const linhas = previa.blocos.map((b) => ({
        nome: `Estudo: ${b.disciplina_nome}`,
        tipo: 'estudo',
        disciplina_id: b.disciplina_id,
        data_inicio: timestampLocal(new Date(b.data_inicio)),
        data_fim: timestampLocal(new Date(b.data_fim)),
        user_id: userId,
      }));
      const { error } = await supabase.from('itens_cronograma').insert(linhas);
      if (error) {
        setErroGeracao('Não foi possível salvar o cronograma. Tente novamente.');
        return;
      }
      setSucesso(`Cronograma salvo! ${previa.blocos.length} blocos de estudo adicionados.`);
      setPrevia(null);
    } finally {
      setSalvando(false);
    }
  };

  const resumo = useMemo(
    () =>
      previa
        ? Array.from(
            previa.blocos.reduce((mapa, b) => mapa.set(b.disciplina_nome, (mapa.get(b.disciplina_nome) ?? 0) + 1), new Map<string, number>()),
          )
        : [],
    [previa],
  );

  return (
    <View style={styles.container}>
      <Header title="Agenda" section="agenda" showBack />
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Diga quando você pode estudar na semana e o Study Flow distribui blocos de estudo entre as suas disciplinas.
          </Text>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>1. Minha rotina semanal</Text>
            <Text style={styles.cardDescription}>Horários livres para estudar, por dia da semana.</Text>

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
            <Text style={styles.cardDescription}>Escolha o período e o tamanho de cada bloco. Você revisa a prévia antes de salvar.</Text>

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
            <Button icon={<Sparkles size={18} color="#ffffff" />} onPress={gerar} title="Gerar cronograma" />

            {erroGeracao ? (
              <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertDanger]}>
                <Text style={styles.alertDangerText}>{erroGeracao}</Text>
                {semDisciplinas ? (
                  <Text accessibilityRole="link" onPress={() => router.navigate('/disciplinas')} style={styles.alertLink}>
                    Ir para Disciplinas
                  </Text>
                ) : null}
              </View>
            ) : null}

            {sucesso ? (
              <View accessibilityLiveRegion="polite" style={[styles.alert, styles.alertSuccess]}>
                <Text style={styles.alertSuccessText}>{sucesso}</Text>
                <Text accessibilityRole="link" onPress={() => router.navigate('/calendario')} style={styles.alertLink}>
                  Ver no calendário
                </Text>
              </View>
            ) : null}

            {previa ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Prévia do cronograma</Text>
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
                          {DIAS_CURTOS[ini.getDay()]} {dois(ini.getDate())}/{dois(ini.getMonth() + 1)} · {horaLocal(ini)} – {horaLocal(new Date(b.data_fim))}
                        </Text>
                        <Text style={styles.previewSubject}>{b.disciplina_nome}</Text>
                      </View>
                    );
                  })}
                </View>
                <Button disabled={salvando} loading={salvando} onPress={() => void confirmar()} title="Confirmar e salvar no cronograma" />
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
  intro: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  card: { gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardDescription: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginTop: -6 },
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

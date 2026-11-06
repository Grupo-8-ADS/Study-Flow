import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Circle } from 'lucide-react-native';
import {
  COLORS,
  ROTULO_TIPO,
  aulasNoPeriodo,
  dataLocal,
  dataStr,
  formatarHorario,
  hojeStr,
  ordenarCompromissos,
  type Compromisso,
  type CompromissoForm,
} from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CompromissoEditor } from '../../components/CompromissoEditor';
import { COR_TIPO, alternarConcluido, useAgenda } from '../../lib/agenda';
import { useIrPara } from '../../lib/navigation';

type Evento = Compromisso & { aula?: true };

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const corDe = (e: Evento) => COR_TIPO[e.aula ? 'aula' : e.tipo];

export default function CalendarioScreen() {
  const { dados, carregando, atualizando, recarregar } = useAgenda();
  const irPara = useIrPara();
  const [selecionada, setSelecionada] = useState(hojeStr());
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const ano = mes.getFullYear();
  const m = mes.getMonth();
  const primeiro = dataStr(new Date(ano, m, 1));
  const ultimo = dataStr(new Date(ano, m + 1, 0));

  const porDia = new Map<string, Evento[]>();
  if (dados) {
    const eventos: Evento[] = [
      ...dados.compromissos.filter((c) => c.data >= primeiro && c.data <= ultimo),
      ...aulasNoPeriodo(dados.disciplinas, primeiro, ultimo),
    ];
    ordenarCompromissos(eventos).forEach((e) => porDia.set(e.data, [...(porDia.get(e.data) ?? []), e as Evento]));
  }

  const offset = (new Date(ano, m, 1).getDay() + 6) % 7;
  const total = new Date(ano, m + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const hoje = hojeStr();
  const doDia = porDia.get(selecionada) ?? [];
  const sel = dataLocal(selecionada);
  const nomeDisciplina = (id: string | null) => dados?.disciplinas.find((d) => d.id === id)?.nome;

  return (
    <View style={styles.container}>
      <Header title="Agenda" section="agenda" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando && Boolean(dados)} onRefresh={() => void recarregar()} />}
      >
        <Card style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity accessibilityLabel="Mês anterior" onPress={() => setMes(new Date(ano, m - 1, 1))} style={styles.monthArrow}>
              <ChevronLeft size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const d = new Date();
                setMes(new Date(d.getFullYear(), d.getMonth(), 1));
                setSelecionada(hoje);
              }}
            >
              <Text style={styles.monthTitle}>
                {MESES[m]} {ano}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Próximo mês" onPress={() => setMes(new Date(ano, m + 1, 1))} style={styles.monthArrow}>
              <ChevronRight size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdaysRow}>
            {DIAS.map((d) => (
              <Text key={d} style={styles.weekdayLabel}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {celulas.map((dia, idx) => {
              if (dia === null) return <View key={`v-${idx}`} style={styles.dayCellEmpty} />;
              const data = dataStr(new Date(ano, m, dia));
              const eventos = porDia.get(data) ?? [];
              const isSel = data === selecionada;
              return (
                <TouchableOpacity
                  key={data}
                  activeOpacity={0.7}
                  style={[styles.dayCell, isSel && styles.dayCellSelected]}
                  onPress={() => setSelecionada(data)}
                  onLongPress={() => setEditor({ data })}
                >
                  <Text style={[styles.dayText, data === hoje && styles.dayToday, isSel && styles.dayTextSelected]}>{dia}</Text>
                  {eventos.length > 0 ? (
                    <View style={styles.dotsRow}>
                      {eventos.slice(0, 3).map((e) => (
                        <View key={e.id} style={[styles.eventDot, { backgroundColor: isSel ? '#fff' : corDe(e).cor }]} />
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <View style={styles.agendaHeaderRow}>
          <View>
            <Text style={styles.agendaDateTitle}>
              {sel.getDate()} de {MESES[sel.getMonth()]}
            </Text>
            <Text style={styles.agendaSubtitle}>
              {doDia.length === 0 ? 'Nada marcado' : `${doDia.length} ${doDia.length === 1 ? 'item' : 'itens'}`}
            </Text>
          </View>
          <Button title="+ Compromisso" size="sm" onPress={() => setEditor({ data: selecionada })} />
        </View>

        {carregando || !dados ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : doDia.length === 0 ? (
          <EmptyState title="Dia livre" icon={<CalendarIcon size={26} color={COLORS.primary} />} />
        ) : (
          doDia.map((e) => (
            <Card key={e.id} style={styles.eventCard}>
              <View style={[styles.eventLeftBar, { backgroundColor: corDe(e).cor }]} />
              {e.aula ? null : (
                <TouchableOpacity
                  accessibilityLabel={e.concluido ? `Marcar ${e.titulo} como pendente` : `Marcar ${e.titulo} como feito`}
                  onPress={() => void alternarConcluido(e.id)}
                  style={styles.check}
                >
                  {e.concluido ? <CheckCircle2 size={22} color={COLORS.success} /> : <Circle size={22} color={COLORS.placeholder} />}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.eventContent}
                onPress={() => (e.aula ? irPara('/disciplinas') : setEditor(e))}
              >
                <Text style={[styles.eventTitle, e.concluido && styles.riscado]}>{e.titulo}</Text>
                <Text style={styles.eventTimeText}>{formatarHorario(e)}</Text>
                <View style={styles.badges}>
                  <Badge label={e.aula ? 'Aula' : ROTULO_TIPO[e.tipo]} variant={corDe(e).badge} size="sm" />
                  {!e.aula && nomeDisciplina(e.disciplinaId) ? <Badge label={nomeDisciplina(e.disciplinaId)!} variant="gray" size="sm" /> : null}
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      <CompromissoEditor visible={Boolean(editor)} disciplinas={dados?.disciplinas ?? []} inicial={editor} onClose={() => setEditor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  loadingBox: { paddingVertical: 20, alignItems: 'center' },
  calendarCard: { padding: 16, marginBottom: 20 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { padding: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  monthTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  weekdaysRow: { flexDirection: 'row', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  weekdayLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginVertical: 2 },
  dayCellEmpty: { width: '14.28%', height: 44 },
  dayCellSelected: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  dayToday: { color: COLORS.primary, textDecorationLine: 'underline' },
  dayTextSelected: { color: '#ffffff', fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  eventDot: { width: 5, height: 5, borderRadius: 3 },
  agendaHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  agendaDateTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  agendaSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 12, marginBottom: 10, overflow: 'hidden' },
  eventLeftBar: { width: 4, position: 'absolute', left: 0, top: 0, bottom: 0 },
  check: { padding: 4, marginRight: 4 },
  eventContent: { flex: 1, paddingLeft: 6 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  riscado: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  eventTimeText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
});

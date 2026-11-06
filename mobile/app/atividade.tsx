import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react-native';
import {
  COLORS,
  ROTULO_TIPO,
  formatarData,
  formatarHorario,
  hojeStr,
  type Compromisso,
  type CompromissoForm,
  type TipoCompromisso,
} from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Chip, CompromissoEditor } from '../components/CompromissoEditor';
import { COR_TIPO, alternarConcluido, useAgenda } from '../lib/agenda';

type Visao = 'proximos' | 'atrasados' | 'concluidos' | 'todos';
const VISOES: Array<[Visao, string]> = [
  ['proximos', 'Próximos'],
  ['atrasados', 'Atrasados'],
  ['concluidos', 'Concluídos'],
  ['todos', 'Todos'],
];
const TIPOS: TipoCompromisso[] = ['prova', 'trabalho', 'atividade', 'estudo'];

/** Lista de compromissos (mesmos dados e formulário do calendário). */
export default function CompromissosScreen() {
  const { dados, carregando, atualizando, recarregar } = useAgenda();
  const [visao, setVisao] = useState<Visao>('proximos');
  const [tipos, setTipos] = useState<Set<TipoCompromisso>>(() => new Set<TipoCompromisso>(['prova', 'trabalho', 'atividade']));
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const hoje = hojeStr();
  const lista = (dados?.compromissos ?? []).filter((c) => {
    if (!tipos.has(c.tipo)) return false;
    if (visao === 'proximos') return !c.concluido && c.data >= hoje;
    if (visao === 'atrasados') return !c.concluido && c.data < hoje;
    if (visao === 'concluidos') return c.concluido;
    return true;
  });
  if (visao === 'atrasados' || visao === 'concluidos') lista.reverse();
  const grupos = new Map<string, Compromisso[]>();
  lista.forEach((c) => grupos.set(c.data, [...(grupos.get(c.data) ?? []), c]));

  const nomeDisciplina = (id: string | null) => dados?.disciplinas.find((d) => d.id === id)?.nome;
  const alternarTipo = (t: TipoCompromisso) =>
    setTipos((atual) => {
      const novo = new Set(atual);
      if (novo.has(t)) novo.delete(t);
      else novo.add(t);
      return novo.size === 0 ? atual : novo;
    });

  return (
    <View style={styles.container}>
      <Header title="Agenda" section="agenda" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={atualizando && Boolean(dados)} onRefresh={() => void recarregar()} />}
      >
        <View style={styles.topo}>
          <Text style={styles.titulo}>Compromissos</Text>
          <Button title="+ Novo" size="sm" onPress={() => setEditor({})} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
          {VISOES.map(([v, rotulo]) => (
            <Chip ativo={visao === v} key={v} label={rotulo} onPress={() => setVisao(v)} />
          ))}
        </ScrollView>
        <View style={styles.filtrosTipo}>
          {TIPOS.map((t) => (
            <TouchableOpacity key={t} onPress={() => alternarTipo(t)} style={[styles.tipo, !tipos.has(t) && styles.tipoOff]}>
              <View style={[styles.ponto, { backgroundColor: tipos.has(t) ? COR_TIPO[t].cor : COLORS.border }]} />
              <Text style={[styles.tipoTexto, !tipos.has(t) && { color: COLORS.placeholder }]}>{ROTULO_TIPO[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {carregando || !dados ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : grupos.size === 0 ? (
          <EmptyState
            title={visao === 'atrasados' ? 'Nada atrasado' : visao === 'concluidos' ? 'Nada concluído ainda' : 'Nenhum compromisso'}
            icon={<ListChecks size={26} color={COLORS.primary} />}
          />
        ) : (
          Array.from(grupos.entries()).map(([data, itens]) => (
            <View key={data} style={styles.grupo}>
              <Text style={[styles.grupoTitulo, data < hoje && visao !== 'concluidos' && { color: COLORS.danger }]}>
                {data === hoje ? 'Hoje' : formatarData(data, true)}
              </Text>
              <Card style={styles.card}>
                {itens.map((c, i) => (
                  <View key={c.id} style={[styles.linha, i > 0 && styles.linhaBorda]}>
                    <TouchableOpacity onPress={() => void alternarConcluido(c.id)} style={styles.check}>
                      {c.concluido ? <CheckCircle2 size={22} color={COLORS.success} /> : <Circle size={22} color={COLORS.placeholder} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.info} onPress={() => setEditor(c)}>
                      <Text style={[styles.nome, c.concluido && styles.riscado]} numberOfLines={1}>
                        {c.titulo}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {formatarHorario(c)}
                        {nomeDisciplina(c.disciplinaId) ? ` · ${nomeDisciplina(c.disciplinaId)}` : ''}
                      </Text>
                    </TouchableOpacity>
                    <Badge label={ROTULO_TIPO[c.tipo]} variant={COR_TIPO[c.tipo].badge} size="sm" />
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
      <CompromissoEditor visible={Boolean(editor)} disciplinas={dados?.disciplinas ?? []} inicial={editor} onClose={() => setEditor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 18, paddingBottom: 40 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titulo: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  filtros: { gap: 8, paddingBottom: 10 },
  filtrosTipo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: '#fff',
  },
  tipoOff: { backgroundColor: 'transparent', borderColor: COLORS.border },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  tipoTexto: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  grupo: { marginBottom: 16 },
  grupoTitulo: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  card: { padding: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 6 },
  linhaBorda: { borderTopWidth: 1, borderTopColor: COLORS.border },
  check: { padding: 2 },
  info: { flex: 1 },
  nome: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  riscado: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});

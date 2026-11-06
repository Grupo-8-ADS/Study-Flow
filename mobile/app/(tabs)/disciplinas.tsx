import React, { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookOpen, Clock, Edit2, Plus, Trash2 } from 'lucide-react-native';
import {
  COLORS,
  NOMES_DIAS_SEMANA,
  ROTULO_TIPO,
  applyTimeMask,
  formatarData,
  hojeStr,
  type Aula,
  type Compromisso,
  type CompromissoForm,
  type DisciplinaAgenda,
  type DisciplinaForm,
} from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Chip, CompromissoEditor } from '../../components/CompromissoEditor';
import { COR_TIPO, excluirDisciplina, salvarDisciplina, useAgenda } from '../../lib/agenda';

const vazia: DisciplinaForm = { nome: '', professor: '', prioridade: 2, aulas: [], notas: '' };
const PRIORIDADES: Array<[1 | 2 | 3, string]> = [
  [1, 'Baixa'],
  [2, 'Média'],
  [3, 'Alta'],
];
const diaCurto = (d: number) => NOMES_DIAS_SEMANA[d].slice(0, 3);

function resumoAulas(aulas: Aula[]) {
  if (aulas.length === 0) return 'Sem horário de aula';
  return [...aulas]
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio))
    .map((a) => `${diaCurto(a.dia_semana)} ${a.inicio}–${a.fim}`)
    .join(' · ');
}

export default function DisciplinasScreen() {
  const { dados, carregando, atualizando, recarregar } = useAgenda();
  const [editando, setEditando] = useState<{ id?: string; form: DisciplinaForm } | null>(null);
  const [vendo, setVendo] = useState<string | null>(null);
  const [compromisso, setCompromisso] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const hoje = hojeStr();
  const avaliacoesDe = (id: string) =>
    (dados?.compromissos ?? []).filter((c) => c.disciplinaId === id && (c.tipo === 'prova' || c.tipo === 'trabalho'));
  const vista = vendo ? dados?.disciplinas.find((d) => d.id === vendo) ?? null : null;

  const confirmarExclusao = (d: DisciplinaAgenda) =>
    Alert.alert('Excluir disciplina', `Excluir “${d.nome}”? Provas e blocos de estudo ligados a ela continuam na agenda, sem disciplina.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await excluirDisciplina(d.id);
          setVendo(null);
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <Header title="Disciplinas" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={atualizando && Boolean(dados)} onRefresh={() => void recarregar()} />}
      >
        <View style={styles.topo}>
          <Text style={styles.titulo}>Disciplinas</Text>
          <Button title="+ Adicionar" size="sm" onPress={() => setEditando({ form: vazia })} />
        </View>

        {carregando || !dados ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : dados.disciplinas.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina adicionada"
            description="Com as disciplinas e seus horários de aula, o cronograma encaixa os estudos nos seus horários livres."
            icon={<BookOpen size={26} color={COLORS.primary} />}
            actionTitle="Cadastrar primeira disciplina"
            onAction={() => setEditando({ form: vazia })}
          />
        ) : (
          dados.disciplinas.map((d) => {
            const proxima = avaliacoesDe(d.id).find((c) => c.data >= hoje && !c.concluido);
            return (
              <Card key={d.id} style={styles.card}>
                <View style={styles.cardTopo}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setVendo(d.id)}>
                    <Text style={styles.nome}>{d.nome}</Text>
                    {d.professor ? <Text style={styles.meta}>Prof. {d.professor}</Text> : null}
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Editar ${d.nome}`} onPress={() => setEditando({ id: d.id, form: { ...d } })} style={styles.icone}>
                    <Edit2 size={17} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Excluir ${d.nome}`} onPress={() => confirmarExclusao(d)} style={styles.icone}>
                    <Trash2 size={17} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.aulas}>
                  <Clock size={14} color={COLORS.placeholder} />
                  <Text style={styles.meta}>{resumoAulas(d.aulas)}</Text>
                </View>
                <View style={styles.badges}>
                  <Badge
                    label={`Prioridade ${PRIORIDADES.find(([p]) => p === d.prioridade)?.[1].toLowerCase()}`}
                    variant={d.prioridade === 3 ? 'danger' : d.prioridade === 1 ? 'gray' : 'primary'}
                    size="sm"
                  />
                  {proxima ? (
                    <Badge label={`${ROTULO_TIPO[proxima.tipo]} ${formatarData(proxima.data).slice(0, 5)}`} variant={COR_TIPO[proxima.tipo].badge} size="sm" />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {editando ? <DisciplinaEditor inicial={editando} onClose={() => setEditando(null)} /> : null}

      <Modal visible={Boolean(vista) && !compromisso} onClose={() => setVendo(null)} title={vista?.nome} variant="bottom">
        {vista ? (
          <>
            {vista.professor ? <Text style={styles.meta}>Prof. {vista.professor}</Text> : null}
            <Text style={styles.secao}>Aulas</Text>
            <Text style={styles.meta}>{resumoAulas(vista.aulas)}</Text>
            <View style={styles.secaoTopo}>
              <Text style={styles.secao}>Provas e trabalhos</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title="+ Prova" size="sm" variant="outline" onPress={() => setCompromisso({ tipo: 'prova', disciplinaId: vista.id })} />
                <Button title="+ Trabalho" size="sm" variant="outline" onPress={() => setCompromisso({ tipo: 'trabalho', disciplinaId: vista.id })} />
              </View>
            </View>
            {avaliacoesDe(vista.id).length === 0 ? (
              <Text style={styles.meta}>Nenhuma prova ou trabalho marcado.</Text>
            ) : (
              avaliacoesDe(vista.id).map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setCompromisso(c)} style={styles.avaliacao}>
                  <View style={[styles.ponto, { backgroundColor: COR_TIPO[c.tipo].cor }]} />
                  <Text style={[styles.avaliacaoNome, c.concluido && styles.riscado]} numberOfLines={1}>
                    {c.titulo}
                  </Text>
                  <Text style={[styles.meta, c.data < hoje && !c.concluido && { color: COLORS.danger }]}>{formatarData(c.data)}</Text>
                </TouchableOpacity>
              ))
            )}
            {vista.notas ? (
              <>
                <Text style={styles.secao}>Anotações</Text>
                <Text style={styles.meta}>{vista.notas}</Text>
              </>
            ) : null}
          </>
        ) : null}
      </Modal>

      <CompromissoEditor visible={Boolean(compromisso)} disciplinas={dados?.disciplinas ?? []} inicial={compromisso} onClose={() => setCompromisso(null)} />
    </View>
  );
}

function DisciplinaEditor({ inicial, onClose }: { inicial: { id?: string; form: DisciplinaForm }; onClose: () => void }) {
  const [form, setForm] = useState<DisciplinaForm>(() => ({ ...inicial.form, aulas: inicial.form.aulas.map((a) => ({ ...a })) }));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (parcial: Partial<DisciplinaForm>) => {
    setErro('');
    setForm((f) => ({ ...f, ...parcial }));
  };
  const mudarAula = (i: number, parcial: Partial<Aula>) => mudar({ aulas: form.aulas.map((a, j) => (j === i ? { ...a, ...parcial } : a)) });

  const salvar = async () => {
    if (form.aulas.some((a) => !/^\d{2}:\d{2}$/.test(a.inicio) || !/^\d{2}:\d{2}$/.test(a.fim))) {
      setErro('Preencha início e fim de cada aula no formato HH:MM.');
      return;
    }
    setSalvando(true);
    const msg = await salvarDisciplina(form, inicial.id);
    setSalvando(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <Modal visible onClose={onClose} title={inicial.id ? 'Editar disciplina' : 'Nova disciplina'} variant="bottom">
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      <Input label="Nome" placeholder="Ex.: Cálculo I" value={form.nome} onChangeText={(t) => mudar({ nome: t })} />
      <Input label="Professor (opcional)" value={form.professor} onChangeText={(t) => mudar({ professor: t })} />

      <Text style={styles.label}>Prioridade no cronograma</Text>
      <View style={styles.chips}>
        {PRIORIDADES.map(([p, rotulo]) => (
          <Chip ativo={form.prioridade === p} key={p} label={rotulo} onPress={() => mudar({ prioridade: p })} />
        ))}
      </View>

      <View style={styles.secaoTopo}>
        <Text style={styles.label}>Horários de aula</Text>
        <Button title="+ Aula" size="sm" variant="outline" onPress={() => mudar({ aulas: [...form.aulas, { dia_semana: 1, inicio: '19:00', fim: '20:40' }] })} />
      </View>
      {form.aulas.length === 0 ? <Text style={styles.dica}>As aulas aparecem toda semana no calendário e o cronograma não marca estudo por cima delas.</Text> : null}
      {form.aulas.map((a, i) => (
        <View key={i} style={styles.aulaEditor}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {NOMES_DIAS_SEMANA.map((nome, d) => (
              <Chip ativo={a.dia_semana === d} key={nome} label={nome.slice(0, 3)} onPress={() => mudarAula(i, { dia_semana: d })} />
            ))}
          </ScrollView>
          <View style={styles.horarios}>
            <Input containerStyle={{ flex: 1 }} label="Início" keyboardType="number-pad" maxLength={5} value={a.inicio} onChangeText={(t) => mudarAula(i, { inicio: applyTimeMask(t) })} />
            <Input containerStyle={{ flex: 1 }} label="Fim" keyboardType="number-pad" maxLength={5} value={a.fim} onChangeText={(t) => mudarAula(i, { fim: applyTimeMask(t) })} />
            <TouchableOpacity accessibilityLabel={`Remover aula ${i + 1}`} onPress={() => mudar({ aulas: form.aulas.filter((_, j) => j !== i) })} style={styles.remover}>
              <Trash2 size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Input label="Anotações" multiline value={form.notas} onChangeText={(t) => mudar({ notas: t })} style={{ minHeight: 70, textAlignVertical: 'top' }} />

      <View style={styles.acoes}>
        <Button title="Cancelar" variant="outline" onPress={onClose} />
        <Button title="Salvar" onPress={() => void salvar()} loading={salvando} icon={<Plus size={16} color="#fff" />} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 18, paddingBottom: 40 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titulo: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  card: { padding: 14, marginBottom: 10 },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  nome: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  icone: { padding: 6 },
  aulas: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  secao: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 4 },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  avaliacao: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avaliacaoNome: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  riscado: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  erro: { backgroundColor: COLORS.dangerLight, color: COLORS.danger, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dica: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  aulaEditor: { backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  horarios: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  remover: { padding: 10, marginBottom: 16 },
  acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});

/**
 * Atividades fixas da rotina (trabalho, academia, curso...): cadastro igual ao das
 * disciplinas, com horários semanais e aviso de conflito com aulas e outras atividades.
 * Equivalente de frontend/src/components/rotina-fixa.tsx.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock, Edit2, Repeat, Trash2 } from 'lucide-react-native';
import {
  COLORS,
  conflitosAoSalvar,
  itensComHorarios,
  resumoHorarios,
  type AgendaDados,
  type ItemComHorarios,
  type RotinaFixa,
  type RotinaFixaForm,
} from '@studyflow/shared';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { EmptyState } from './ui/EmptyState';
import { HorariosSemanaisEditor, confirmarConflitos } from './HorariosSemanais';
import { excluirRotina, salvarRotina } from '../lib/agenda';

const NOVO_HORARIO = { dia_semana: 1, inicio: '08:00', fim: '12:00' };
const vazia: RotinaFixaForm = { nome: '', horarios: [{ ...NOVO_HORARIO }], notas: '' };

/** Cartão com a lista de atividades fixas e os modais de criar, editar e excluir. */
export function RotinaFixaCard({ dados, titulo }: { dados: AgendaDados; titulo: string }) {
  const [editando, setEditando] = useState<{ id?: string; form: RotinaFixaForm } | null>(null);

  const confirmarExclusao = (r: RotinaFixa) =>
    Alert.alert('Excluir atividade', `Excluir “${r.nome}”? Ela sai do calendário e o horário volta a ficar livre para o cronograma.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (!(await excluirRotina(r.id))) Alert.alert('Excluir atividade', 'Não foi possível excluir. Tente novamente.');
        },
      },
    ]);

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <View style={styles.tituloLinha}>
          <Repeat size={18} color={COLORS.primary} />
          <Text accessibilityRole="header" style={styles.titulo}>
            {titulo}
          </Text>
        </View>
        <Button title="+ Atividade" size="sm" variant="outline" onPress={() => setEditando({ form: vazia })} />
      </View>
      <Text style={styles.descricao}>Trabalho, academia, curso... Aparecem no calendário toda semana e o cronograma não marca estudo nesses horários.</Text>

      {dados.rotinas.length === 0 ? (
        <EmptyState title="Nenhuma atividade fixa" description="Cadastre os compromissos que se repetem toda semana." />
      ) : (
        dados.rotinas.map((r) => (
          <View key={r.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.nome}>
                {r.nome}
              </Text>
              <View style={styles.horarios}>
                <Clock size={14} color={COLORS.placeholder} />
                <Text style={styles.meta}>{resumoHorarios(r.horarios)}</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityLabel={`Editar ${r.nome}`}
              accessibilityRole="button"
              onPress={() => setEditando({ id: r.id, form: { nome: r.nome, horarios: r.horarios, notas: r.notas } })}
              style={styles.icone}
            >
              <Edit2 size={17} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel={`Excluir ${r.nome}`} accessibilityRole="button" onPress={() => confirmarExclusao(r)} style={styles.icone}>
              <Trash2 size={17} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {editando ? <RotinaFixaEditor inicial={editando} onClose={() => setEditando(null)} outros={itensComHorarios(dados)} /> : null}
    </Card>
  );
}

function RotinaFixaEditor({ inicial, onClose, outros }: { inicial: { id?: string; form: RotinaFixaForm }; onClose: () => void; outros: ItemComHorarios[] }) {
  const [form, setForm] = useState<RotinaFixaForm>(() => ({ ...inicial.form, horarios: inicial.form.horarios.map((h) => ({ ...h })) }));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (parcial: Partial<RotinaFixaForm>) => {
    setErro('');
    setForm((f) => ({ ...f, ...parcial }));
  };

  const salvar = async () => {
    const conflitos = conflitosAoSalvar({ id: inicial.id, nome: form.nome, tipo: 'rotina', horarios: form.horarios }, outros);
    if (conflitos.length > 0 && !(await confirmarConflitos(conflitos))) return;
    setSalvando(true);
    const msg = await salvarRotina(form, inicial.id);
    setSalvando(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <Modal visible onClose={onClose} title={inicial.id ? 'Editar atividade' : 'Nova atividade da rotina'} variant="bottom">
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={styles.erro}>
          {erro}
        </Text>
      ) : null}
      <Input label="Nome da atividade" placeholder="Ex.: Trabalho, Academia, Inglês" value={form.nome} onChangeText={(t) => mudar({ nome: t })} />
      <HorariosSemanaisEditor
        horarios={form.horarios}
        novo={NOVO_HORARIO}
        onChange={(horarios) => mudar({ horarios })}
        rotulo="horário"
        titulo="Dias e horários"
        vazio="Adicione pelo menos um horário."
      />
      <Input
        label="Anotações (opcional)"
        multiline
        placeholder="Local, observações..."
        value={form.notas}
        onChangeText={(t) => mudar({ notas: t })}
        style={{ minHeight: 60, textAlignVertical: 'top' }}
      />
      <View style={styles.acoes}>
        <Button title="Cancelar" variant="outline" onPress={onClose} />
        <Button title="Salvar" onPress={() => void salvar()} loading={salvando} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  titulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  descricao: { fontSize: 13, lineHeight: 18, color: COLORS.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  nome: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  horarios: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  icone: { padding: 6 },
  erro: { backgroundColor: COLORS.dangerLight, color: COLORS.danger, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 },
  acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});

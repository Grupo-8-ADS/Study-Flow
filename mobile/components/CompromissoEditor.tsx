import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  TIPOS_COMPROMISSO,
  applyDateMask,
  applyTimeMask,
  compromissoVazio,
  formatDisplayDate,
  toDatabaseDate,
  type Compromisso,
  type CompromissoForm,
  type DisciplinaAgenda,
} from '@studyflow/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { excluirCompromisso, salvarCompromisso } from '../lib/agenda';

type Props = {
  visible: boolean;
  disciplinas: DisciplinaAgenda[];
  /** Compromisso existente (edição) ou valores iniciais de um novo. */
  inicial?: Compromisso | Partial<CompromissoForm> | null;
  onClose: () => void;
};

/** Formulário único de compromisso (prova, trabalho, atividade ou estudo), igual ao do site. */
export function CompromissoEditor({ visible, disciplinas, inicial, onClose }: Props) {
  if (!visible) return null;
  return <Conteudo disciplinas={disciplinas} inicial={inicial} onClose={onClose} />;
}

function Conteudo({ disciplinas, inicial, onClose }: Omit<Props, 'visible'>) {
  const existente = inicial && 'id' in inicial && inicial.id ? (inicial as Compromisso) : null;
  const base = { ...compromissoVazio(), ...(inicial ?? {}) };
  const [form, setForm] = useState<CompromissoForm>(base);
  const [dataTexto, setDataTexto] = useState(formatDisplayDate(base.data));
  const [comHorario, setComHorario] = useState(Boolean(base.horaInicio));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (parcial: Partial<CompromissoForm>) => {
    setErro('');
    setForm((f) => ({ ...f, ...parcial }));
  };

  const salvar = async () => {
    const data = toDatabaseDate(dataTexto);
    if (!data) {
      setErro('Informe a data no formato DD/MM/AAAA.');
      return;
    }
    if (comHorario && !/^\d{2}:\d{2}$/.test(form.horaInicio)) {
      setErro('Informe o horário de início (HH:MM) ou desligue “Definir horário”.');
      return;
    }
    const final = { ...form, data, ...(comHorario ? {} : { horaInicio: '', horaFim: '' }) };
    setSalvando(true);
    const msg = await salvarCompromisso(final, existente?.id);
    setSalvando(false);
    if (msg) setErro(msg);
    else onClose();
  };

  const excluir = () => {
    if (!existente) return;
    Alert.alert('Excluir compromisso', `Excluir “${existente.titulo}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const ok = await excluirCompromisso(existente.id);
          if (ok) onClose();
          else setErro('Não foi possível excluir. Tente novamente.');
        },
      },
    ]);
  };

  return (
    <Modal visible onClose={onClose} title={existente ? 'Editar compromisso' : 'Novo compromisso'} variant="bottom">
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <Input label="Nome" placeholder="Ex.: P1 de Cálculo" value={form.titulo} onChangeText={(t) => mudar({ titulo: t })} />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chips}>
        {TIPOS_COMPROMISSO.map((t) => (
          <Chip ativo={form.tipo === t.value} key={t.value} label={t.label} onPress={() => mudar({ tipo: t.value })} />
        ))}
      </View>

      <Input
        label="Data"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        value={dataTexto}
        onChangeText={(t) => {
          setErro('');
          setDataTexto(applyDateMask(t));
        }}
      />

      <Text style={styles.label}>Disciplina</Text>
      <View style={styles.chips}>
        <Chip ativo={!form.disciplinaId} label="Nenhuma" onPress={() => mudar({ disciplinaId: null })} />
        {disciplinas.map((d) => (
          <Chip ativo={form.disciplinaId === d.id} key={d.id} label={d.nome} onPress={() => mudar({ disciplinaId: d.id })} />
        ))}
      </View>

      <View style={styles.linhaSwitch}>
        <Text style={styles.textoSwitch}>Definir horário</Text>
        <Switch
          value={comHorario}
          onValueChange={(v) => {
            setErro('');
            setComHorario(v);
          }}
          trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
          thumbColor={comHorario ? COLORS.primary : '#f4f3f4'}
        />
      </View>
      {comHorario ? (
        <View style={styles.horarios}>
          <Input
            containerStyle={styles.meia}
            label="Início"
            placeholder="HH:MM"
            keyboardType="number-pad"
            maxLength={5}
            value={form.horaInicio}
            onChangeText={(t) => mudar({ horaInicio: applyTimeMask(t) })}
          />
          <Input
            containerStyle={styles.meia}
            label="Término (opcional)"
            placeholder="HH:MM"
            keyboardType="number-pad"
            maxLength={5}
            value={form.horaFim}
            onChangeText={(t) => mudar({ horaFim: applyTimeMask(t) })}
          />
        </View>
      ) : (
        <Text style={styles.dica}>Sem horário, vale para o dia inteiro.</Text>
      )}

      <Input label="Anotações" multiline value={form.notas} onChangeText={(t) => mudar({ notas: t })} style={styles.notas} />

      <View style={styles.acoes}>
        {existente ? <Button title="Excluir" variant="ghost" onPress={excluir} style={styles.acao} textStyle={{ color: COLORS.danger }} /> : null}
        <Button title="Cancelar" variant="outline" onPress={onClose} style={styles.acao} />
        <Button title="Salvar" onPress={() => void salvar()} loading={salvando} style={styles.acao} />
      </View>
    </Modal>
  );
}

export function Chip({ ativo, label, onPress }: { ativo: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.chip, ativo && styles.chipAtivo]}
    >
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  erro: { backgroundColor: COLORS.dangerLight, color: COLORS.danger, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  chipAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextoAtivo: { color: '#fff' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  textoSwitch: { fontSize: 14, color: COLORS.text },
  horarios: { flexDirection: 'row', gap: 12 },
  meia: { flex: 1 },
  dica: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16 },
  notas: { minHeight: 70, textAlignVertical: 'top' },
  acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  acao: { minWidth: 90 },
});

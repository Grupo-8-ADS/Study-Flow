/**
 * Peças de formulário para horários que se repetem toda semana (aulas das disciplinas e
 * atividades fixas da rotina) e o aviso de conflito antes de salvar. Equivalente de
 * frontend/src/components/horarios-semanais.tsx; regras e textos vêm de `@studyflow/shared`.
 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import {
  AVISO_CONFLITO,
  COLORS,
  NOMES_DIAS_SEMANA,
  applyTimeMask,
  descreverConflito,
  type ConflitoHorario,
  type HorarioSemanal,
} from '@studyflow/shared';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Chip } from './CompromissoEditor';

/** Lista editável de horários semanais (dia, início e fim). */
export function HorariosSemanaisEditor({
  titulo,
  rotulo,
  horarios,
  onChange,
  novo,
  vazio,
  feminino = false,
}: {
  titulo: string;
  /** Nome de um item ("aula", "horário"), usado no botão e nos rótulos acessíveis. */
  rotulo: string;
  horarios: HorarioSemanal[];
  onChange: (horarios: HorarioSemanal[]) => void;
  /** Horário sugerido ao adicionar. */
  novo: HorarioSemanal;
  vazio: string;
  /** O rótulo é feminino ("aula"): os rótulos acessíveis usam "da" em vez de "do". */
  feminino?: boolean;
}) {
  const de = feminino ? 'da' : 'do';
  const mudar = (i: number, parcial: Partial<HorarioSemanal>) => onChange(horarios.map((h, j) => (j === i ? { ...h, ...parcial } : h)));

  return (
    <View>
      <View style={styles.topo}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Button title={`+ ${rotulo[0].toUpperCase()}${rotulo.slice(1)}`} size="sm" variant="outline" onPress={() => onChange([...horarios, { ...novo }])} />
      </View>
      {horarios.length === 0 ? <Text style={styles.vazio}>{vazio}</Text> : null}
      {horarios.map((h, i) => (
        <View key={i} style={styles.linha}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {NOMES_DIAS_SEMANA.map((nome, d) => (
              <Chip ativo={h.dia_semana === d} key={nome} label={nome.slice(0, 3)} onPress={() => mudar(i, { dia_semana: d })} />
            ))}
          </ScrollView>
          <View style={styles.horas}>
            <Input
              accessibilityLabel={`Início ${de} ${rotulo} ${i + 1}`}
              containerStyle={{ flex: 1 }}
              keyboardType="number-pad"
              label="Início"
              maxLength={5}
              onChangeText={(t) => mudar(i, { inicio: applyTimeMask(t) })}
              placeholder="08:00"
              value={h.inicio}
            />
            <Input
              accessibilityLabel={`Fim ${de} ${rotulo} ${i + 1}`}
              containerStyle={{ flex: 1 }}
              keyboardType="number-pad"
              label="Fim"
              maxLength={5}
              onChangeText={(t) => mudar(i, { fim: applyTimeMask(t) })}
              placeholder="12:00"
              value={h.fim}
            />
            <TouchableOpacity
              accessibilityLabel={`Remover ${rotulo} ${i + 1}`}
              accessibilityRole="button"
              onPress={() => onChange(horarios.filter((_, j) => j !== i))}
              style={styles.remover}
            >
              <Trash2 size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Aviso de conflito de horário: "Voltar e ajustar" resolve false; "Salvar mesmo assim", true
 * (ex.: aula quinzenal, ou uma atividade que o usuário vai fazer em semanas alternadas).
 */
export function confirmarConflitos(conflitos: ConflitoHorario[]): Promise<boolean> {
  const lista = conflitos.map((c) => `• ${descreverConflito(c)}`).join('\n');
  return new Promise((resolve) => {
    Alert.alert(
      AVISO_CONFLITO.titulo,
      `${AVISO_CONFLITO.introducao(conflitos.length)}\n\n${lista}\n\n${AVISO_CONFLITO.explicacao}`,
      [
        { text: AVISO_CONFLITO.ajustar, style: 'cancel', onPress: () => resolve(false) },
        { text: AVISO_CONFLITO.salvarMesmoAssim, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

const styles = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  titulo: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  vazio: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  linha: { backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  horas: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  remover: { padding: 10, marginBottom: 16 },
});

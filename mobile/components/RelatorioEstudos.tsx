/**
 * Relatório de estudos (RF011) no app: semana, mês ou período personalizado, com os
 * mesmos números do site (`montarRelatorio`) e exportação em .csv pelo menu de
 * compartilhamento do aparelho.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, FileText } from 'lucide-react-native';
import {
  BOM_UTF8,
  COLORS,
  RADII,
  applyDateMask,
  dataStr,
  hojeStr,
  formatDisplayDate,
  formatarDataISO,
  formatarMinutos,
  montarRelatorio,
  nomeArquivoRelatorio,
  relatorioParaCSV,
  resumoRelatorio,
  toDatabaseDate,
  type ModoRelatorio,
  type RelatorioPeriodo,
  type SessaoRelatorio,
} from '@studyflow/shared';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Chip } from './CompromissoEditor';

const MODOS: [ModoRelatorio, string][] = [
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['personalizado', 'Personalizado'],
];

const inicioDoMesISO = () => dataStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

/** Grava o CSV no cache do app e abre o menu de compartilhamento (salvar, e-mail, Drive...). */
async function exportarCsv(relatorio: RelatorioPeriodo) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Exportar CSV', 'O compartilhamento de arquivos não está disponível neste aparelho.');
    return;
  }
  const arquivo = new File(Paths.cache, nomeArquivoRelatorio(relatorio));
  arquivo.create({ overwrite: true });
  arquivo.write(BOM_UTF8 + relatorioParaCSV(relatorio));
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'text/csv', dialogTitle: 'Relatório de estudos', UTI: 'public.comma-separated-values-text' });
}

export function RelatorioEstudos({ sessoes }: { sessoes: SessaoRelatorio[] }) {
  const [modo, setModo] = useState<ModoRelatorio>('semana');
  // Campos em DD/MM/AAAA (como os outros formulários do app); o relatório usa AAAA-MM-DD.
  const [inicio, setInicio] = useState(() => formatDisplayDate(inicioDoMesISO()));
  const [fim, setFim] = useState(() => formatDisplayDate(hojeStr()));
  const [exportando, setExportando] = useState(false);

  const [inicioISO, fimISO] = [toDatabaseDate(inicio), toDatabaseDate(fim)];
  const { relatorio, erro } =
    modo === 'personalizado' && (!inicioISO || !fimISO)
      ? { relatorio: null, erro: 'Informe as duas datas no formato DD/MM/AAAA.' }
      : montarRelatorio(sessoes, modo, { inicio: inicioISO ?? '', fim: fimISO ?? '' });

  const exportar = async () => {
    if (!relatorio) return;
    setExportando(true);
    try {
      await exportarCsv(relatorio);
    } catch (e) {
      console.error('Error exporting report:', e);
      Alert.alert('Exportar CSV', 'Não foi possível gerar o arquivo. Tente de novo.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <FileText size={18} color={COLORS.primary} />
        <Text accessibilityRole="header" style={styles.titulo}>
          Relatório de estudos
        </Text>
      </View>
      <Text style={styles.descricao}>{relatorio ? `De ${formatarDataISO(relatorio.inicio)} a ${formatarDataISO(relatorio.fim)}` : 'Escolha o período.'}</Text>

      <View style={styles.chips}>
        {MODOS.map(([valor, rotulo]) => (
          <Chip ativo={modo === valor} key={valor} label={rotulo} onPress={() => setModo(valor)} />
        ))}
      </View>

      {modo === 'personalizado' ? (
        <View style={styles.datas}>
          <Input containerStyle={{ flex: 1 }} keyboardType="number-pad" label="Data inicial" maxLength={10} onChangeText={(t) => setInicio(applyDateMask(t))} placeholder="DD/MM/AAAA" value={inicio} />
          <Input containerStyle={{ flex: 1 }} keyboardType="number-pad" label="Data final" maxLength={10} onChangeText={(t) => setFim(applyDateMask(t))} placeholder="DD/MM/AAAA" value={fim} />
        </View>
      ) : null}

      {erro ? (
        <Text accessibilityLiveRegion="polite" style={styles.erro}>
          {erro}
        </Text>
      ) : null}

      {relatorio ? (
        <>
          <View style={styles.resumo}>
            {resumoRelatorio(relatorio).map(([rotulo, valor]) => (
              <View key={rotulo} style={styles.resumoItem}>
                <Text style={styles.resumoRotulo}>{rotulo}</Text>
                <Text style={styles.resumoValor}>{valor}</Text>
              </View>
            ))}
          </View>

          {relatorio.porDisciplina.length === 0 ? (
            <Text style={styles.vazio}>Nenhuma sessão concluída neste período.</Text>
          ) : (
            relatorio.porDisciplina.map((linha) => (
              <View key={linha.disciplina} style={styles.linha}>
                <Text numberOfLines={1} style={styles.linhaNome}>
                  {linha.disciplina}
                </Text>
                <Text style={styles.linhaMeta}>
                  {formatarMinutos(linha.minutos)} · {linha.sessoes} {linha.sessoes === 1 ? 'sessão' : 'sessões'} · {linha.percentual}%
                </Text>
              </View>
            ))
          )}

          <Button
            icon={<Download size={16} color={COLORS.primary} />}
            loading={exportando}
            onPress={() => void exportar()}
            title="Exportar CSV"
            variant="outline"
          />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 16, gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  descricao: { fontSize: 13, color: COLORS.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  datas: { flexDirection: 'row', gap: 10 },
  erro: { backgroundColor: COLORS.dangerLight, color: COLORS.danger, padding: 10, borderRadius: RADII.control, fontSize: 13 },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resumoItem: { flexGrow: 1, flexBasis: '45%', backgroundColor: COLORS.primarySoft, borderRadius: RADII.control, padding: 12 },
  resumoRotulo: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  resumoValor: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  vazio: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },
  linha: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  linhaNome: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  linhaMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});

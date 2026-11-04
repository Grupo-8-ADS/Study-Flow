import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExternalLink, Mail, Tags } from 'lucide-react-native';
import { COLORS, RADII } from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';

/** Endereço do site, onde a conexão com o Gmail (OAuth) é feita. */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://study-flow-ten-olive.vercel.app';

const ROTULO_LOCAL: Record<string, string> = {
  assunto: 'Assunto',
  corpo: 'Corpo do e-mail',
  remetente: 'Remetente',
  destinatario: 'Destinatário',
};

type StatusGmail = { email_sinc: string | null; data_ultima_sinc: string | null } | null;
type Palavra = { id: string; palavra: string; localizacao: string };

/**
 * Integrações no app: mostra o status do Gmail e as palavras-chave.
 * Conectar, sincronizar e editar palavras-chave ficam no site (o OAuth do Google roda lá).
 */
export default function IntegracoesScreen() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusGmail>(null);
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [erroCarga, setErroCarga] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      const [sinc, lista] = await Promise.all([
        supabase.from('sinc_gmail').select('email_sinc, data_ultima_sinc').eq('user_id', id).maybeSingle(),
        supabase.from('palavras_chave').select('id, palavra, localizacao').eq('user_id', id).order('created_at'),
      ]);
      setStatus((sinc.data as StatusGmail) ?? null);
      setPalavras((lista.data ?? []) as Palavra[]);
      setErroCarga(Boolean(sinc.error || lista.error));
    } catch {
      setErroCarga(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga assíncrona: o setState ocorre após o await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  return (
    <View style={styles.container}>
      <Header title="Conta" section="conta" showBack />
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {erroCarga ? (
            <View accessibilityLiveRegion="polite" style={styles.error}>
              <Text style={styles.errorText}>Não foi possível carregar o status. Verifique a conexão e tente novamente.</Text>
            </View>
          ) : null}
          <Text style={styles.intro}>
            Conecte seu Gmail e o Study Flow transforma e-mails sobre provas, trabalhos e entregas em itens do seu cronograma.
          </Text>

          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <View style={styles.iconBox}>
                <Mail size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Gmail</Text>
              <Badge label={status ? 'Conectado' : 'Desconectado'} variant={status ? 'success' : 'gray'} />
            </View>
            <Text style={styles.body}>
              {status
                ? `Conectado${status.email_sinc ? ` como ${status.email_sinc}` : ''}. ${
                    status.data_ultima_sinc
                      ? `Última sincronização: ${new Date(status.data_ultima_sinc).toLocaleString('pt-BR')}.`
                      : 'Ainda não sincronizado.'
                  }`
                : 'Não conectado. O Study Flow pede só permissão de leitura.'}
            </Text>
            <View style={styles.note}>
              <Text style={styles.noteText}>Para conectar, sincronizar ou desconectar, use a página Integrações no site.</Text>
            </View>
            <Button
              icon={<ExternalLink size={17} color={COLORS.primary} />}
              onPress={() => void Linking.openURL(`${SITE_URL}/integracoes`)}
              title="Abrir no site"
              variant="outline"
            />
          </Card>

          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <View style={styles.iconBox}>
                <Tags size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Palavras-chave</Text>
            </View>
            <Text style={styles.body}>O Study Flow procura estas palavras nos seus e-mails para identificar provas e entregas.</Text>
            {palavras.length === 0 ? (
              <Text style={styles.empty}>Nenhuma palavra-chave cadastrada ainda.</Text>
            ) : (
              <View accessibilityLabel="Palavras-chave cadastradas" style={styles.pills}>
                {palavras.map((p) => (
                  <View key={p.id} style={styles.pill}>
                    <Text style={styles.pillText}>
                      <Text style={{ fontWeight: '700' }}>{p.palavra}</Text> · {ROTULO_LOCAL[p.localizacao] ?? p.localizacao}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADII.control,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, flex: 1 },
  body: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  note: { backgroundColor: COLORS.primarySoft, borderRadius: RADII.control, padding: 12 },
  noteText: { fontSize: 13, lineHeight: 19, color: COLORS.primaryDark },
  error: { backgroundColor: COLORS.dangerLight, borderRadius: RADII.control, padding: 12 },
  errorText: { color: COLORS.danger, fontSize: 14 },
  empty: { fontSize: 14, color: COLORS.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, color: COLORS.primaryDark },
});

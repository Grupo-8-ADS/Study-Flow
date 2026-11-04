import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react-native';
import { APP_RETORNO_GMAIL, COLORS, RADII, type LocalizacaoPalavra } from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { supabase } from '../lib/supabase';

/** Site do Study Flow: as rotas /api/gmail/* (OAuth e sincronização) rodam lá. */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://study-flow-ten-olive.vercel.app';

const LOCALIZACOES: { valor: LocalizacaoPalavra; rotulo: string }[] = [
  { valor: 'assunto', rotulo: 'Assunto' },
  { valor: 'corpo', rotulo: 'Corpo do e-mail' },
  { valor: 'remetente', rotulo: 'Remetente' },
  { valor: 'destinatario', rotulo: 'Destinatário' },
];

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null;

/** Mesmas mensagens do site para o retorno do consentimento do Google. */
const RETORNO_OAUTH: Record<string, Aviso> = {
  conectado: { tipo: 'sucesso', texto: 'Gmail conectado! Agora é só sincronizar.' },
  cancelado: { tipo: 'erro', texto: 'A conexão com o Gmail foi cancelada.' },
  erro: { tipo: 'erro', texto: 'Não foi possível conectar o Gmail. Tente novamente.' },
  'nao-configurado': { tipo: 'erro', texto: 'A integração com o Gmail ainda não foi configurada no servidor.' },
};

type StatusGmail = { email_sinc: string | null; data_ultima_sinc: string | null } | null;
type Palavra = { id: string; palavra: string; localizacao: LocalizacaoPalavra };

/** Chama as rotas do site com o token da sessão do Supabase (as rotas aceitam Bearer). */
async function chamarApi(caminho: string, metodo: 'POST' | 'DELETE') {
  const { data } = await supabase.auth.getSession();
  const resposta = await fetch(`${SITE_URL}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  const corpo = resposta.status === 204 ? {} : await resposta.json().catch(() => ({}));
  return { ok: resposta.ok, corpo: corpo as Record<string, unknown> };
}

/** Integração com o Gmail (RF012) no app: conectar, sincronizar, desconectar e palavras-chave. */
export default function IntegracoesScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusGmail>(null);
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [novaPalavra, setNovaPalavra] = useState('');
  const [localizacao, setLocalizacao] = useState<LocalizacaoPalavra>('assunto');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const [sinc, lista] = await Promise.all([
        supabase.from('sinc_gmail').select('email_sinc, data_ultima_sinc').eq('user_id', id).maybeSingle(),
        supabase.from('palavras_chave').select('id, palavra, localizacao').eq('user_id', id).order('created_at'),
      ]);
      setStatus((sinc.data as StatusGmail) ?? null);
      setPalavras((lista.data ?? []) as Palavra[]);
      if (sinc.error || lista.error) {
        setAviso({ tipo: 'erro', texto: 'Não foi possível carregar o status. Verifique a conexão e tente novamente.' });
      }
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível carregar o status. Verifique a conexão e tente novamente.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga assíncrona: o setState ocorre após o await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const conectar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const { ok, corpo } = await chamarApi('/api/gmail/conectar?origem=app', 'POST');
      if (!ok || typeof corpo.url !== 'string') {
        setAviso({ tipo: 'erro', texto: String(corpo.message ?? 'Não foi possível iniciar a conexão com o Gmail.') });
        return;
      }
      // Abre o consentimento no navegador do sistema (o Google bloqueia login em WebView).
      // O callback do site redireciona para studyflow://integracoes?gmail=..., que fecha a sessão.
      const resultado = await WebBrowser.openAuthSessionAsync(corpo.url, APP_RETORNO_GMAIL);
      if (resultado.type === 'success') {
        const valor = Linking.parse(resultado.url).queryParams?.gmail;
        const retorno = typeof valor === 'string' ? valor : 'erro';
        setAviso(RETORNO_OAUTH[retorno] ?? RETORNO_OAUTH.erro);
        await carregar();
      } else {
        setAviso(RETORNO_OAUTH.cancelado);
      }
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível iniciar a conexão com o Gmail.' });
    } finally {
      setOcupado(false);
    }
  };

  const sincronizar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const { ok, corpo } = await chamarApi('/api/gmail/sincronizar', 'POST');
      if (!ok) {
        setAviso({ tipo: 'erro', texto: String(corpo.message ?? 'Não foi possível sincronizar.') });
        return;
      }
      const criados = Number(corpo.criados ?? 0);
      setAviso({
        tipo: 'sucesso',
        texto:
          criados > 0
            ? `Sincronizado! ${criados} ${criados === 1 ? 'item adicionado' : 'itens adicionados'} ao cronograma.`
            : `Sincronizado! Nenhum item novo (${Number(corpo.encontrados ?? 0)} e-mails analisados).`,
      });
      await carregar();
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível sincronizar.' });
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = () => {
    Alert.alert('Desconectar o Gmail?', 'O Study Flow deixa de ler seus e-mails. Os itens já importados continuam no cronograma.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          setOcupado(true);
          try {
            const { ok } = await chamarApi('/api/gmail/conexao', 'DELETE');
            setAviso(ok ? { tipo: 'sucesso', texto: 'Gmail desconectado.' } : { tipo: 'erro', texto: 'Não foi possível desconectar.' });
            await carregar();
          } catch {
            setAviso({ tipo: 'erro', texto: 'Não foi possível desconectar.' });
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  const adicionarPalavra = async () => {
    const palavra = novaPalavra.trim();
    if (!userId || !palavra) return;
    if (palavras.some((p) => p.palavra.toLowerCase() === palavra.toLowerCase() && p.localizacao === localizacao)) {
      const rotulo = LOCALIZACOES.find((l) => l.valor === localizacao)?.rotulo.toLowerCase();
      setAviso({ tipo: 'erro', texto: `"${palavra}" já está cadastrada para ${rotulo}.` });
      return;
    }
    const { error } = await supabase.from('palavras_chave').insert({ user_id: userId, palavra, localizacao });
    if (error) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível salvar a palavra-chave.' });
      return;
    }
    setNovaPalavra('');
    setAviso(null);
    await carregar();
  };

  const removerPalavra = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from('palavras_chave').delete().eq('id', id);
    if (error) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível remover a palavra-chave.' });
      return;
    }
    await carregar();
  };

  return (
    <View style={styles.container}>
      <Header title="Conta" section="conta" showBack />
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Conecte seu Gmail e o Study Flow transforma e-mails sobre provas, trabalhos e entregas em itens do seu cronograma.
          </Text>

          {aviso ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.alert, aviso.tipo === 'sucesso' ? styles.alertSuccess : styles.alertDanger]}
            >
              <Text style={aviso.tipo === 'sucesso' ? styles.alertSuccessText : styles.alertDangerText}>{aviso.texto}</Text>
            </View>
          ) : null}

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

            {status ? (
              <>
                <Button
                  disabled={ocupado || palavras.length === 0}
                  icon={<RefreshCw size={17} color="#ffffff" />}
                  loading={ocupado}
                  onPress={() => void sincronizar()}
                  title="Sincronizar agora"
                />
                {palavras.length === 0 ? (
                  <Text style={styles.hint}>Cadastre ao menos uma palavra-chave abaixo para sincronizar.</Text>
                ) : null}
                <Button disabled={ocupado} onPress={desconectar} title="Desconectar" variant="ghost" />
              </>
            ) : (
              <Button
                disabled={!userId || ocupado}
                icon={<Mail size={17} color="#ffffff" />}
                loading={ocupado}
                onPress={() => void conectar()}
                title="Conectar Gmail"
              />
            )}
          </Card>

          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <View style={styles.iconBox}>
                <Tags size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Palavras-chave</Text>
            </View>
            <Text style={styles.body}>O Study Flow procura estas palavras nos seus e-mails para identificar provas e entregas.</Text>

            <Input
              autoCapitalize="none"
              editable={Boolean(userId)}
              label="Palavra-chave"
              maxLength={60}
              onChangeText={setNovaPalavra}
              onSubmitEditing={() => void adicionarPalavra()}
              placeholder="Ex.: prova, entrega, P1"
              returnKeyType="done"
              value={novaPalavra}
            />
            <Text style={styles.label}>Onde procurar</Text>
            <View style={styles.chips}>
              {LOCALIZACOES.map((l) => (
                <TouchableOpacity
                  key={l.valor}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: localizacao === l.valor }}
                  onPress={() => setLocalizacao(l.valor)}
                  style={[styles.chip, localizacao === l.valor && styles.chipActive]}
                >
                  <Text style={[styles.chipText, localizacao === l.valor && styles.chipTextActive]}>{l.rotulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              disabled={!userId || !novaPalavra.trim()}
              icon={<Plus size={17} color={COLORS.primary} />}
              onPress={() => void adicionarPalavra()}
              title="Adicionar palavra-chave"
              variant="outline"
            />

            {palavras.length === 0 ? (
              <Text style={styles.empty}>Nenhuma palavra-chave cadastrada ainda.</Text>
            ) : (
              <View accessibilityLabel="Palavras-chave cadastradas" style={styles.pills}>
                {palavras.map((p) => (
                  <View key={p.id} style={styles.pill}>
                    <Text style={styles.pillText}>
                      <Text style={{ fontWeight: '700' }}>{p.palavra}</Text> ·{' '}
                      {LOCALIZACOES.find((l) => l.valor === p.localizacao)?.rotulo ?? p.localizacao}
                    </Text>
                    <TouchableOpacity
                      accessibilityLabel={`Remover ${p.palavra}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => void removerPalavra(p.id)}
                      style={styles.pillRemove}
                    >
                      <Trash2 size={14} color={COLORS.primaryDark} />
                    </TouchableOpacity>
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
  hint: { fontSize: 13, color: COLORS.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  alert: { borderRadius: RADII.control, padding: 12 },
  alertDanger: { backgroundColor: COLORS.dangerLight },
  alertDangerText: { color: COLORS.danger, fontSize: 14 },
  alertSuccess: { backgroundColor: COLORS.successLight },
  alertSuccessText: { color: COLORS.success, fontSize: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  empty: { fontSize: 14, color: COLORS.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
  },
  pillText: { fontSize: 13, color: COLORS.primaryDark },
  pillRemove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Shield,
  Bell,
  HelpCircle,
  FileText,
  LogOut,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, FAQ, OPCOES_PRIVACIDADE, TERMOS_SERVICO, TEXTO_EXCLUIR_CONTA, contaDemonstracao } from '@studyflow/shared';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cancelarLembretes } from '../lib/notifications';
import { usePrivacidade } from '../lib/privacidade';

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  // Toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('recebe_notificacao_pref')
        .eq('id', userRes.user.id)
        .single();
      if (ativo && data) setNotificationsEnabled(data.recebe_notificacao_pref !== false);
    })().catch((e) => console.error('Error loading preference:', e));
    return () => {
      ativo = false;
    };
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { error } = await supabase
        .from('profiles')
        .update({ recebe_notificacao_pref: value })
        .eq('id', userRes.user.id);
      if (error) throw error;
      if (!value) await cancelarLembretes();
    } catch (e: any) {
      setNotificationsEnabled(!value);
      Alert.alert('Erro', 'Não foi possível salvar a preferência: ' + (e?.message ?? e));
    }
  };

  const { privacidade, alternar: alternarPrivacidade, erro: erroPrivacidade } = usePrivacidade();
  const demonstracao = contaDemonstracao(session);

  // Modals
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar a sessão no aplicativo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    setDeleteModalVisible(false);
    if (demonstracao) return;
    Alert.alert(
      'Excluir conta',
      TEXTO_EXCLUIR_CONTA.confirmacao,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_own_account');
            if (error) {
              Alert.alert('Erro', 'Não foi possível excluir a conta: ' + error.message);
              return;
            }
            await cancelarLembretes();
            await signOut();
            try {
              await AsyncStorage.clear();
            } catch (e) {
              console.error('Error clearing storage:', e);
            }
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Conta" section="conta" showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <Card style={styles.accountCard}>
          <Avatar
            name={session?.nome || 'Usuário'}
            size={56}
            level={session?.nivel_atual || 1}
            moldura={session?.moldura}
            showLevel
            uri={session?.avatar_url}
          />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{session?.nome}</Text>
            <Text style={styles.accountUsername}>@{session?.username}</Text>
            <Text style={styles.accountEmail}>{session?.email}</Text>
          </View>
        </Card>

        {/* General Settings Section */}
        <Text style={styles.sectionTitle}>Geral & Preferências</Text>

        <Card style={styles.settingsListCard}>
          {/* Notifications Toggle */}
          <View style={styles.settingItemRow}>
            <View style={styles.settingIconTitle}>
              <View style={[styles.iconCircle, { backgroundColor: '#eaf6f4' }]}>
                <Bell size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Notificações e Lembretes</Text>
                <Text style={styles.settingItemSubtitle}>Avisos de sessões e provas</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
              thumbColor={notificationsEnabled ? COLORS.primary : '#f4f3f4'}
            />
          </View>

          {/* Privacy Modal Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.settingItemRow}
            onPress={() => setPrivacyModalVisible(true)}
          >
            <View style={styles.settingIconTitle}>
              <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                <Shield size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Privacidade & Compartilhamento</Text>
                <Text style={styles.settingItemSubtitle}>Visibilidade de perfil e dados</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* FAQ Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.settingItemRow}
            onPress={() => setFaqModalVisible(true)}
          >
            <View style={styles.settingIconTitle}>
              <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                <HelpCircle size={18} color="#d97706" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Ajuda & FAQ</Text>
                <Text style={styles.settingItemSubtitle}>Dúvidas frequentes do app</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Terms Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
            onPress={() => setTermsModalVisible(true)}
          >
            <View style={styles.settingIconTitle}>
              <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
                <FileText size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Termos de Serviço</Text>
                <Text style={styles.settingItemSubtitle}>Políticas e licença de uso</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Danger Zone Section */}
        <Text style={[styles.sectionTitle, { color: COLORS.danger, marginTop: 12 }]}>
          Zona de Risco
        </Text>

        <Card style={styles.dangerCard}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.dangerRow}
            onPress={handleLogout}
          >
            <LogOut size={18} color={COLORS.textSecondary} />
            <Text style={styles.dangerOptionText}>Sair da Conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.dangerRow, { borderTopWidth: 1, borderTopColor: '#fee2e2', marginTop: 10, paddingTop: 10 }]}
            disabled={demonstracao}
            onPress={() => setDeleteModalVisible(true)}
          >
            <AlertTriangle size={18} color={demonstracao ? COLORS.textMuted : COLORS.danger} />
            <Text style={[styles.dangerOptionText, { color: demonstracao ? COLORS.textMuted : COLORS.danger, fontWeight: '700' }]}>
              {demonstracao ? 'Conta demo protegida' : 'Excluir Minha Conta'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.dangerHint}>{demonstracao ? TEXTO_EXCLUIR_CONTA.avisoDemonstracao : TEXTO_EXCLUIR_CONTA.aviso}</Text>
        </Card>
      </ScrollView>

      {/* Privacy Settings Modal */}
      <Modal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        title="Privacidade do Perfil"
        variant="bottom"
      >
        <View style={{ paddingVertical: 6 }}>
          <Text style={styles.modalToggleDesc}>As preferências são salvas na sua conta e valem no site e no app.</Text>
          {erroPrivacidade ? <Text style={styles.privacyError}>{erroPrivacidade}</Text> : null}
          {OPCOES_PRIVACIDADE.map((opcao) => (
            <View key={opcao.chave} style={styles.modalToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalToggleTitle}>{opcao.titulo}</Text>
                <Text style={styles.modalToggleDesc}>{opcao.descricao}</Text>
              </View>
              <Switch
                accessibilityLabel={opcao.titulo}
                value={privacidade[opcao.chave]}
                onValueChange={() => void alternarPrivacidade(opcao.chave)}
                trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
                thumbColor={privacidade[opcao.chave] ? COLORS.primary : '#f4f3f4'}
              />
            </View>
          ))}

          <Button
            title="Concluir"
            onPress={() => setPrivacyModalVisible(false)}
            style={{ marginTop: 16 }}
          />
        </View>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={faqModalVisible}
        onClose={() => setFaqModalVisible(false)}
        title="Perguntas Frequentes"
        variant="bottom"
      >
        <View style={{ paddingVertical: 6 }}>
          {FAQ.map((faq, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              style={styles.faqItem}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <Text style={styles.faqQuestion}>{faq.pergunta}</Text>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{faq.resposta}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Terms Modal */}
      <Modal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
        title="Termos de Serviço"
        variant="bottom"
      >
        <ScrollView style={{ maxHeight: 300, paddingVertical: 8 }}>
          <Text style={styles.termsText}>{TERMOS_SERVICO.introducao}</Text>
          {TERMOS_SERVICO.secoes.map((secao) => (
            <View key={secao.titulo} style={{ marginTop: 12 }}>
              <Text style={[styles.termsText, { fontWeight: '700' }]}>{secao.titulo}</Text>
              <Text style={styles.termsText}>{secao.texto}</Text>
            </View>
          ))}
        </ScrollView>
        <Button
          title="Entendido"
          onPress={() => setTermsModalVisible(false)}
          style={{ marginTop: 12 }}
        />
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        title="Confirme sua Escolha"
        variant="center"
      >
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <AlertTriangle size={44} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.deleteModalTitle}>
            Tem certeza que deseja excluir a sua conta?
          </Text>
          <Text style={styles.deleteModalSubtitle}>{TEXTO_EXCLUIR_CONTA.aviso}</Text>

          <View style={styles.deleteModalButtons}>
            <Button
              title="Excluir Conta Definitivamente"
              variant="danger"
              onPress={handleDeleteAccount}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setDeleteModalVisible(false)}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
  },
  accountInfo: {
    marginLeft: 14,
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  accountUsername: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
  },
  settingsListCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  settingItemSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  dangerCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
    padding: 14,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dangerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  privacyError: {
    backgroundColor: COLORS.dangerLight,
    color: COLORS.danger,
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
    fontSize: 13,
  },
  dangerHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  modalToggleDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  faqItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  faqAnswer: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  termsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  deleteModalButtons: {
    width: '100%',
  },
});

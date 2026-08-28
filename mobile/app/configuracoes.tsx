import React, { useState } from 'react';
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
  User,
} from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export default function ConfiguracoesScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  // Toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showHours, setShowHours] = useState(true);
  const [showAchievements, setShowAchievements] = useState(true);

  // Modals
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Como funciona o temporizador Pomodoro?',
      a: 'O método Pomodoro divide o estudo em blocos de foco de 25 minutos com pausas curtas de 5 minutos. Após 4 ciclos, recomenda-se uma pausa longa de 15 minutos.',
    },
    {
      q: 'Minhas anotações são salvas por matéria?',
      a: 'Sim! Toda vez que você altera a disciplina ativa no timer e digita notas, o texto é vinculado exclusivamente àquela matéria e ao seu usuário.',
    },
    {
      q: 'Como subo de nível e ganho XP?',
      a: 'Você ganha XP a cada sessão de foco concluída, tarefas entregues no prazo e mantendo sua sequência diária ativa.',
    },
  ];

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
    Alert.alert(
      'Conta Excluída',
      'Sua conta e dados foram removidos com sucesso.',
      [
        {
          text: 'OK',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <Card style={styles.accountCard}>
          <Avatar
            name={session?.nome || 'Carlos'}
            size={56}
            level={session?.nivel_atual || 12}
            showLevel
          />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{session?.nome || 'Carlos Eduardo'}</Text>
            <Text style={styles.accountUsername}>@{session?.username || 'carlosedu'}</Text>
            <Text style={styles.accountEmail}>{session?.email || 'admin@studyflow.com'}</Text>
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
              onValueChange={setNotificationsEnabled}
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
            onPress={() => setDeleteModalVisible(true)}
          >
            <AlertTriangle size={18} color={COLORS.danger} />
            <Text style={[styles.dangerOptionText, { color: COLORS.danger, fontWeight: '700' }]}>
              Excluir Minha Conta
            </Text>
          </TouchableOpacity>
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
          <View style={styles.modalToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalToggleTitle}>Perfil Público</Text>
              <Text style={styles.modalToggleDesc}>Permitir que outros alunos vejam seu nível</Text>
            </View>
            <Switch
              value={publicProfile}
              onValueChange={setPublicProfile}
              trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
              thumbColor={publicProfile ? COLORS.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.modalToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalToggleTitle}>Exibir Horas de Foco</Text>
              <Text style={styles.modalToggleDesc}>Mostrar resumo de horas no seu perfil</Text>
            </View>
            <Switch
              value={showHours}
              onValueChange={setShowHours}
              trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
              thumbColor={showHours ? COLORS.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.modalToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalToggleTitle}>Exibir Conquistas</Text>
              <Text style={styles.modalToggleDesc}>Compartilhar troféus desbloqueados</Text>
            </View>
            <Switch
              value={showAchievements}
              onValueChange={setShowAchievements}
              trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
              thumbColor={showAchievements ? COLORS.primary : '#f4f3f4'}
            />
          </View>

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
          {faqs.map((faq, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              style={styles.faqItem}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{faq.a}</Text>
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
          <Text style={styles.termsText}>
            O Study Flow é uma ferramenta desenvolvida com finalidade acadêmica e de produtividade pessoal.
            {'\n\n'}
            1. Os dados armazenados são de uso individual do estudante.
            {'\n\n'}
            2. O aplicativo não compartilha dados confidenciais com terceiros.
            {'\n\n'}
            3. O usuário é responsável pela veracidade dos dados cadastrados e conformidade de sua rotina de estudos.
          </Text>
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
          <Text style={styles.deleteModalSubtitle}>
            Esta ação é definitiva. Todo o seu histórico de foco, disciplinas cadastradas e conquistas serão apagados permanentemente.
          </Text>

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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
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

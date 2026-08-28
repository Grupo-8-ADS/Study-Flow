import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  Lock,
  LogOut,
  Palette,
} from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function PerfilScreen() {
  const router = useRouter();
  const { session, updateSession, signOut, refreshProfile } = useAuth();

  const [nome, setNome] = useState(session?.nome || '');
  const [username, setUsername] = useState(session?.username || '');
  const [email, setEmail] = useState(session?.email || '');
  const [bgColor, setBgColor] = useState(session?.bg_color || COLORS.primary);
  const [saving, setSaving] = useState(false);

  // Password Modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (session) {
      setNome(session.nome || '');
      setUsername(session.username || '');
      setEmail(session.email || '');
      setBgColor(session.bg_color || COLORS.primary);
    }
  }, [session]);

  const colorPalette = [
    '#29645e', // Verde Study Flow
    '#1e293b', // Slate Dark
    '#0f766e', // Teal
    '#1e3a8a', // Blue
    '#581c87', // Purple
    '#7c2d12', // Warm Amber/Brown
  ];

  const handleSaveProfile = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        Alert.alert('Sessão expirada', 'Faça login novamente.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          username: username.trim(),
          bg_color: bgColor,
        })
        .eq('id', userRes.user.id);

      if (error) {
        Alert.alert('Erro', 'Não foi possível atualizar o perfil: ' + error.message);
        return;
      }

      await updateSession({
        nome: nome.trim(),
        username: username.trim(),
        bg_color: bgColor,
      });

      await refreshProfile();
      Alert.alert('Perfil Atualizado! 🎉', 'Suas alterações foram salvas com sucesso no banco de dados.');
    } catch (e) {
      console.error('Error updating profile:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert('Erro', 'Não foi possível alterar a senha: ' + error.message);
        return;
      }

      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Senha Alterada! 🔐', 'Sua senha foi redefinida com sucesso.');
    } catch (e) {
      console.error('Error changing password:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao alterar a senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sair da Conta', 'Deseja realmente encerrar sua sessão?', [
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

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Banner & Header Card */}
        <View style={styles.bannerContainer}>
          <View style={[styles.bannerBg, { backgroundColor: bgColor }]} />

          <View style={styles.avatarWrapper}>
            <Avatar
              name={nome}
              size={84}
              level={session?.nivel_atual || 1}
              showLevel
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cameraBadge}
              onPress={() =>
                Alert.alert(
                  'Foto de Perfil',
                  'Selecione uma foto da sua galeria ou câmera.'
                )
              }
            >
              <Camera size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileHeaderInfo}>
            <Text style={styles.profileName}>{nome || 'Estudante'}</Text>
            <Text style={styles.profileUsername}>@{username || 'usuario'}</Text>

            <View style={styles.statsPillRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillLabel}>Nível</Text>
                <Text style={styles.statPillValue}>
                  {session?.nivel_atual || 1}
                </Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillLabel}>XP Total</Text>
                <Text style={styles.statPillValue}>
                  {session?.xp || 0}
                </Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillLabel}>Meta Horas</Text>
                <Text style={styles.statPillValue}>
                  {session?.horas_diarias || 2}h
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Edit Profile Fields Card */}
        <Card style={styles.fieldsCard}>
          <Text style={styles.cardSectionTitle}>Informações Pessoais</Text>

          <Input
            label="Nome Completo"
            value={nome}
            onChangeText={setNome}
          />

          <Input
            label="Nome de Usuário"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Input
            label="Email Cadastrado"
            value={email}
            editable={false}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* Color Theme Selector */}
          <Text style={styles.colorLabel}>
            <Palette size={14} color={COLORS.primary} /> Cor de Fundo do Banner
          </Text>
          <View style={styles.colorPaletteRow}>
            {colorPalette.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorCircle,
                  { backgroundColor: c },
                  bgColor === c && styles.colorCircleSelected,
                ]}
                onPress={() => setBgColor(c)}
              />
            ))}
          </View>

          {/* Change Password Link Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.changePasswordButton}
            onPress={() => setPasswordModalVisible(true)}
          >
            <Lock size={16} color={COLORS.primary} />
            <Text style={styles.changePasswordText}>Alterar Senha de Acesso</Text>
          </TouchableOpacity>

          <Button
            title="Salvar Alterações"
            onPress={handleSaveProfile}
            loading={saving}
            size="lg"
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* Logout Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.logoutButton}
          onPress={handleSignOut}
        >
          <LogOut size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        title="Alterar Senha"
        variant="bottom"
      >
        <Input
          label="Nova Senha"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChangeText={setNewPassword}
          isPassword
        />

        <Input
          label="Confirmar Nova Senha"
          placeholder="Repita a nova senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
        />

        <Button
          title="Confirmar e Salvar Nova Senha"
          onPress={handleChangePassword}
          loading={passwordLoading}
          size="lg"
          style={{ marginTop: 10 }}
        />
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
  bannerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  bannerBg: {
    height: 100,
    width: '100%',
  },
  avatarWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: -42,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileHeaderInfo: {
    alignItems: 'center',
    padding: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  statsPillRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statPill: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statPillLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statPillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 1,
  },
  fieldsCard: {
    padding: 18,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 16,
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 4,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
  },
  changePasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});

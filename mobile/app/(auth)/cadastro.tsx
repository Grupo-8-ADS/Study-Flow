import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2, User, Mail, Lock } from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function CadastroScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!nome.trim() || !username.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    const result = await signUp(nome, username, email, password);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSuccessMessage('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => {
        router.replace('/(tabs)/dashboard');
      }, 1200);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Study Flow</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.badgeHeader}>
            <Text style={styles.badgeHeaderText}>Criar Cadastro</Text>
          </View>

          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={COLORS.danger} style={styles.feedbackIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {Boolean(successMessage) && (
            <View style={styles.successBox}>
              <CheckCircle2 size={18} color={COLORS.success} style={styles.feedbackIcon} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          <Input
            label="Nome Completo"
            placeholder="Seu nome"
            value={nome}
            onChangeText={(text) => {
              setNome(text);
              if (errorMessage) setErrorMessage('');
            }}
            leftIcon={<User size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Nome de Usuário"
            placeholder="ex: carlosedu"
            value={username}
            onChangeText={(text) => {
              setUsername(text.toLowerCase().replace(/\s/g, ''));
              if (errorMessage) setErrorMessage('');
            }}
            autoCapitalize="none"
            leftIcon={<User size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Email"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Senha"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            isPassword
            leftIcon={<Lock size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Confirmar Senha"
            placeholder="Repita sua senha"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            isPassword
            leftIcon={<Lock size={18} color={COLORS.textSecondary} />}
          />

          <Button
            title="Cadastrar"
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={styles.submitButton}
          />

          <Button
            title="Já tenho uma conta (Fazer Login)"
            variant="ghost"
            onPress={() => router.back()}
            style={styles.backButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 20,
    alignItems: 'center',
  },
  mascotImage: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeHeader: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeHeaderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  feedbackIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 10,
  },
  backButton: {
    marginBottom: 8,
  },
});

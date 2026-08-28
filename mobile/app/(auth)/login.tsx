import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, User, Lock } from 'lucide-react-native';
import { COLORS } from '@studyflow/shared';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const { session, signIn } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/dashboard');
    }
  }, [session]);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    const result = await signIn(identifier, password);
    setLoading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  const handleFillDemo = () => {
    setIdentifier('admin@studyflow.com');
    setPassword('123456');
    setErrorMessage('');
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
        {/* Hero Section with Brand Background */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Study Flow</Text>
          <Text style={styles.brandSubtitle}>
            Seu assistente de produtividade e foco acadêmico
          </Text>
        </View>

        {/* Card Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acesse sua conta</Text>

          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={COLORS.danger} style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Input
            label="Email ou Nome de Usuário"
            placeholder="ex: seu.email@exemplo.com"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (errorMessage) setErrorMessage('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<User size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Senha"
            placeholder="Sua senha de acesso"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            isPassword
            leftIcon={<Lock size={18} color={COLORS.textSecondary} />}
          />

          <View style={styles.optionsRow}>
            <View style={styles.rememberRow}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: '#e2e8f0', true: COLORS.primaryLight }}
                thumbColor={rememberMe ? COLORS.primary : '#f4f3f4'}
              />
              <Text style={styles.rememberText}>Me manter conectado</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  'Recuperação de Senha',
                  'Para recuperar sua senha, entre em contato com o suporte ou utilize o email cadastrado.'
                )
              }
            >
              <Text style={styles.forgotText}>Problemas para logar?</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginButton}
          />

          <Button
            title="Criar cadastro"
            variant="outline"
            size="lg"
            onPress={() => router.push('/(auth)/cadastro')}
            style={styles.signupButton}
          />

          {/* Quick Demo Fill Helper */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleFillDemo}
            style={styles.demoHelper}
          >
            <Text style={styles.demoHelperText}>
              ⚡ Preencher com usuário demo de teste
            </Text>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
  },
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 28,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  mascotImage: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#d1fae5',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: 12,
  },
  signupButton: {
    marginBottom: 16,
  },
  demoHelper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  demoHelperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});

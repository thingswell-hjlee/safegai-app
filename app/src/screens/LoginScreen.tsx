/**
 * M1 로그인 화면 — spec-app-ux.md §6.1 시퀀스
 *
 * 이메일+비밀번호 → Amplify Auth → 성공 시 홈 직행
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';

const LAST_EMAIL_KEY = 'last_login_email';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  // 마지막 로그인 이메일 자동 채움 (매번 입력하는 부담 제거)
  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY).then((v) => { if (v) setEmail(v); });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim());
    await login(email.trim(), password);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SafeGAI</Text>
        <Text style={styles.subtitle}>스마트 안전 관리 시스템</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.fieldLabel}>이메일 주소</Text>
        <TextInput
          style={styles.input}
          placeholder="예: hong@thingswell.co.kr"
          placeholderTextColor="#9AA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          accessibilityLabel="이메일 주소 입력"
        />
        <Text style={styles.fieldLabel}>비밀번호</Text>
        <TextInput
          style={styles.input}
          placeholder="비밀번호를 입력하세요"
          placeholderTextColor="#9AA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          accessibilityLabel="비밀번호 입력"
        />

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>로그인</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.app,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    color: colors.brand.navy,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.text.sub,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: colors.text.main,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.button,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.main,
    minHeight: touchTarget.min,
  },
  error: {
    fontSize: typography.caption.fontSize,
    color: colors.severity.danger,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.brand.navy,
    borderRadius: radius.button,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.text.inverse,
  },
});

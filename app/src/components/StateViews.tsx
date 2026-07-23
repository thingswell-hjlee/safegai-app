/**
 * EmptyState / ErrorState — 아이콘+한 문장+재시도 (§3, §5, §6.4)
 * 전 데이터 화면에 4상태(로딩/빈/에러/데이터) 구현용.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';

// ─── LoadingState ─────────────────────────────────────────────────────────
export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand.navy} />
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────
interface EmptyProps {
  message?: string;
}

export function EmptyState({ message = '표시할 내용이 없습니다' }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.icon}>📋</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────
interface ErrorProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: 200,
  },
  icon: { fontSize: 40, marginBottom: spacing.md },
  message: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.text.sub,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.severity.danger,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.base,
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    minHeight: touchTarget.min,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    color: colors.text.inverse,
  },
});

/**
 * StatusBanner — 홈 최상단 (§3)
 * 정상 = 초록 '현장 정상 운영 중'
 * 미처리 N건 = 빨강 'N건 확인 필요' (탭→목록)
 * 현장 지연 = gw online:false → 회색 '현장 연결 지연'
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';

interface Props {
  openCount: number;
  gwOffline: boolean;
  onPress?: () => void;
}

export function StatusBanner({ openCount, gwOffline, onPress }: Props) {
  let bgColor: string;
  let message: string;
  let icon: string;

  let hint: string;
  if (gwOffline) {
    bgColor = colors.severity.fault;
    icon = '⊘';
    message = '현장과 연결이 안 됩니다';
    hint = '잠시 후에도 계속되면 유지보수 담당자에게 연락하세요';
  } else if (openCount > 0) {
    bgColor = colors.severity.danger;
    icon = '⚠️';
    message = `확인할 알림이 ${openCount}건 있습니다`;
    hint = '여기를 눌러 확인하세요';
  } else {
    bgColor = colors.state.ok;
    icon = '✅';
    message = '지금 현장은 안전합니다';
    hint = '';
  }

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`${message}. ${hint}`}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{icon} {message}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.title.fontSize,
    fontWeight: '800',
    color: colors.text.inverse,
    textAlign: 'center',
  },
  hint: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.text.inverse,
    opacity: 0.9,
    marginTop: spacing.xs,
  },
});

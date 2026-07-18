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

  if (gwOffline) {
    bgColor = colors.severity.fault;
    icon = '⊘';
    message = '현장 연결 지연';
  } else if (openCount > 0) {
    bgColor = colors.severity.danger;
    icon = '⚠';
    message = `${openCount}건 확인 필요`;
  } else {
    bgColor = colors.state.ok;
    icon = '✓';
    message = '현장 정상 운영 중';
  }

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`${icon} ${message}`}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{icon} {message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  text: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});

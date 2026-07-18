/**
 * SeverityBadge — 심각도4 + 상태3 캡슐 (§3)
 * 색+아이콘문자+문구 3중 표기 (색만으로 구분 금지)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

type Severity = 'DANGER' | 'WARNING' | 'FAULT' | 'INFO';
type Status = 'OPEN' | 'ACKED' | 'IN_PROGRESS' | 'RESOLVED';

const SEVERITY_CONFIG: Record<Severity, { color: string; icon: string; label: string }> = {
  DANGER: { color: colors.severity.danger, icon: '⚠', label: '위험' },
  WARNING: { color: colors.severity.warning, icon: '⚡', label: '주의' },
  FAULT: { color: colors.severity.fault, icon: '⊘', label: '장애' },
  INFO: { color: colors.severity.info, icon: 'ⓘ', label: '정보' },
};

const STATUS_CONFIG: Record<Status, { label: string }> = {
  OPEN: { label: '미처리' },
  ACKED: { label: '확인됨' },
  IN_PROGRESS: { label: '조치 중' },
  RESOLVED: { label: '완료' },
};

interface Props {
  severity: Severity;
  status?: Status;
}

export function SeverityBadge({ severity, status }: Props) {
  const sev = SEVERITY_CONFIG[severity];
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: sev.color }]}>
        <Text style={styles.badgeText}>{sev.icon} {sev.label}</Text>
      </View>
      {status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{STATUS_CONFIG[status].label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: typography.badge.fontSize,
    fontWeight: typography.badge.fontWeight,
    color: colors.text.inverse,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.bg.app,
  },
  statusText: {
    fontSize: typography.badge.fontSize,
    fontWeight: typography.badge.fontWeight,
    color: colors.text.sub,
  },
});

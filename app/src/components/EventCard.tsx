/**
 * EventCard — 좌측 심각도 색바(4dp) + 제목·위치·시각·현재값 + 상태배지 (§3)
 * 미처리 DANGER는 연빨강 배경.
 * 접근성 contentDescription: "위험, 오븐 전면 접근 감지, 14시 3분, 미처리"
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafegaiEvent } from '../stores/eventStore';
import { SeverityBadge } from './SeverityBadge';
import { colors, typography, spacing, radius } from '../theme/tokens';

const SEVERITY_COLORS: Record<string, string> = {
  DANGER: colors.severity.danger,
  WARNING: colors.severity.warning,
  INFO: colors.severity.info,
  FAULT: colors.severity.fault,
};

const SEVERITY_LABEL: Record<string, string> = {
  DANGER: '위험',
  WARNING: '주의',
  FAULT: '장애',
  INFO: '정보',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: '미처리',
  ACKED: '확인됨',
  IN_PROGRESS: '조치 중',
  RESOLVED: '완료',
};

interface Props {
  event: SafegaiEvent;
  onPress?: () => void;
}

export function EventCard({ event, onPress }: Props) {
  const isDangerOpen = event.severity === 'DANGER' && event.status === 'OPEN';
  const time = new Date(event.occurredAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const accessLabel = `${SEVERITY_LABEL[event.severity]}, ${event.title}, ${time}, ${STATUS_LABEL[event.status]}`;

  return (
    <TouchableOpacity
      style={[styles.card, isDangerOpen && styles.dangerBg]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessLabel}
      accessibilityRole="button"
    >
      <View style={[styles.sevBar, { backgroundColor: SEVERITY_COLORS[event.severity] }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.meta}>
          {event.location ? `${event.location} · ` : ''}{time}
          {event.currentValue != null ? ` · ${event.currentValue}${event.unit}` : ''}
        </Text>
        <SeverityBadge severity={event.severity} status={event.status} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  dangerBg: {
    backgroundColor: '#FEF2F2', // 연빨강 (danger 10% opacity 상당)
  },
  sevBar: { width: 4 },
  content: { flex: 1, padding: spacing.md, gap: spacing.xs },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.main,
  },
  meta: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    color: colors.text.sub,
  },
});

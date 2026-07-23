/**
 * M4 알림 상세 — GET /events/{id} (푸시 딥링크 착지 대비)
 * 주 버튼 '조치 시작' 1개 → M5로 이동.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useEventDetailQuery } from '../api/queries';
import { useAuthStore } from '../stores/authStore';
import { SeverityBadge } from '../components/SeverityBadge';
import { LoadingState, ErrorState } from '../components/StateViews';
import { getErrorMessage } from '../api/client';
import { colors, typography, spacing, radius, touchTarget } from '../theme/tokens';

interface Props {
  route: any;
  navigation: any;
}

export function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { role } = useAuthStore();
  const { data: event, isLoading, isError, error, refetch } = useEventDetailQuery(eventId);

  if (isLoading) return <LoadingState />;
  if (isError || !event) return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />;

  const roleLevel = { admin: 4, teacher: 3, operator: 2, maintainer: 1 }[role ?? 'maintainer'] ?? 0;
  const canAct = event.status !== 'RESOLVED' && roleLevel >= 3;

  const time = new Date(event.occurredAt).toLocaleString('ko-KR');

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림 상세</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <SeverityBadge severity={event.severity} status={event.status} />

        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.message}>{event.message}</Text>

        <View style={styles.infoGrid}>
          <InfoRow label="발생 시각" value={time} />
          <InfoRow label="위치" value={event.location || '-'} />
          <InfoRow label="기기" value={DEVICE_KO[event.deviceId] || event.deviceId} />
          {event.currentValue != null && (
            <InfoRow label="측정값" value={`${event.currentValue}${event.unit}`} />
          )}
          <InfoRow label="종류" value={TYPE_KO[event.eventType] || event.eventType} />
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      {canAct && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('ActionProcess', { eventId: event.eventId })}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>조치 시작</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// 영문 코드 → 쉬운 한글 (비전문가 배려)
const TYPE_KO: Record<string, string> = {
  TEMP: '온도', HUMIDITY: '습도', PM25: '미세먼지(PM2.5)', PM10: '미세먼지(PM10)',
  CO2: '이산화탄소', TVOC: '공기질(TVOC)', OVEN_TEMP: '오븐 온도',
  GATEWAY_OFFLINE: '현장 연결 끊김', DEVICE_FAULT: '장비 이상', DEVICE_RECOVER: '장비 복구',
  AI_INTRUSION: '위험구역 접근', AI_OCCUPANCY: '인원 감지', DIAG: '점검',
};
const DEVICE_KO: Record<string, string> = {
  'FG-01': '환경센서', 'SG-01': '경보장치', 'FID-01': 'AI 카메라',
  GW: '게이트웨이', 'gw-01': '게이트웨이',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.app },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl * 2,
  },
  backBtn: { padding: spacing.xs },
  backText: { fontSize: typography.body.fontSize, color: colors.text.inverse },
  headerTitle: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.inverse },
  body: { flex: 1 },
  bodyContent: { padding: spacing.base, gap: spacing.base },
  title: { fontSize: typography.display.fontSize, fontWeight: typography.display.fontWeight, color: colors.text.main },
  message: { fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight, color: colors.text.sub },
  infoGrid: { gap: spacing.sm, marginTop: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  infoLabel: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.sub },
  infoValue: { fontSize: typography.body.fontSize, fontWeight: '500', color: colors.text.main },
  footer: { backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.base, paddingBottom: spacing.xl },
  actionBtn: { backgroundColor: colors.brand.navy, borderRadius: radius.button, paddingVertical: spacing.md, alignItems: 'center', minHeight: touchTarget.min },
  actionBtnText: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.inverse },
});

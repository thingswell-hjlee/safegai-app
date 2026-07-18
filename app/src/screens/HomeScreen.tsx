/**
 * 임시 홈 화면 — 로그인 성공 후 GET /events 리스트 표시
 * EventCard 컴포넌트는 다음 모듈에서 구현 (여기선 기본 View)
 */
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useEventsQuery } from '../api/queries';
import { getErrorMessage } from '../api/client';
import { SafegaiEvent } from '../stores/eventStore';
import { colors, typography, spacing, radius } from '../theme/tokens';

const SEVERITY_COLORS: Record<string, string> = {
  DANGER: colors.severity.danger,
  WARNING: colors.severity.warning,
  INFO: colors.severity.info,
  FAULT: colors.severity.fault,
};

export function HomeScreen() {
  const { email, role, logout } = useAuthStore();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useEventsQuery({ siteId: 'MAPO-01' });

  const renderItem = ({ item }: { item: SafegaiEvent }) => (
    <View style={styles.card}>
      <View style={[styles.sevBar, { backgroundColor: SEVERITY_COLORS[item.severity] }]} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.location} · {new Date(item.occurredAt).toLocaleTimeString('ko-KR')}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.badge, { backgroundColor: SEVERITY_COLORS[item.severity] }]}>
            {item.severity}
          </Text>
          <Text style={styles.statusBadge}>{item.status}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SafeGAI</Text>
          <Text style={styles.headerSub}>{email} ({role})</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefetching && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.navy} />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{getErrorMessage(error)}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {data && (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.eventId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>오늘 발생한 이벤트가 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.app },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl * 2,
  },
  headerTitle: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.inverse },
  headerSub: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.inverse, opacity: 0.8 },
  logoutBtn: { padding: spacing.sm },
  logoutText: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.inverse },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  list: { padding: spacing.base },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  sevBar: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md },
  cardTitle: { fontSize: typography.body.fontSize, fontWeight: '600', color: colors.text.main },
  cardMeta: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.sub, marginTop: spacing.xs },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  badge: {
    fontSize: typography.badge.fontSize,
    fontWeight: typography.badge.fontWeight,
    color: colors.text.inverse,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBadge: {
    fontSize: typography.badge.fontSize,
    fontWeight: typography.badge.fontWeight,
    color: colors.text.sub,
    backgroundColor: colors.bg.app,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  errorText: { fontSize: typography.body.fontSize, color: colors.severity.danger, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.base,
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
  },
  retryText: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.inverse },
  emptyText: { fontSize: typography.body.fontSize, color: colors.text.sub },
});

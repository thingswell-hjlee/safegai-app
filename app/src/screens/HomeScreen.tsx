/**
 * M1 홈 — StatusBanner + GET /events?limit=5 + GET /site/state (30초 자동갱신, 포그라운드만)
 * '현장 지연' = site/state의 gw online:false.
 */
import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useEventsQuery, useSiteStateQuery } from '../api/queries';
import { SafegaiEvent } from '../stores/eventStore';
import { StatusBanner } from '../components/StatusBanner';
import { EventCard } from '../components/EventCard';
import { FreshnessLabel } from '../components/FreshnessLabel';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { getErrorMessage } from '../api/client';
import { colors, typography, spacing } from '../theme/tokens';

interface Props {
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const { email, role, logout } = useAuthStore();

  const eventsQ = useEventsQuery({ limit: 5, siteId: 'MAPO-01' });
  const siteQ = useSiteStateQuery();

  // dataUpdatedAt(마지막 성공 fetch ms)으로 FreshnessLabel 계산
  const lastUpdated = useMemo(() => {
    const timestamps = [eventsQ.dataUpdatedAt, siteQ.dataUpdatedAt].filter((t) => t > 0);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [eventsQ.dataUpdatedAt, siteQ.dataUpdatedAt]);

  const openCount = siteQ.data?.openCount ?? 0;
  const gwOffline = (() => {
    const devices = siteQ.data?.devices ?? [];
    const gateways = devices.filter((d) => d.deviceId.startsWith('gw'));
    if (gateways.length === 0) return true; // 하트비트 미수신 → 연결 지연 간주
    return gateways.some((d) => !d.online);
  })();

  const navigateToList = () => navigation.navigate('EventList');
  const navigateToDetail = (eventId: string) =>
    navigation.navigate('EventDetail', { eventId });

  // 4상태
  if (eventsQ.isLoading && !eventsQ.data) return <LoadingState />;
  if (eventsQ.isError) return <ErrorState message={getErrorMessage(eventsQ.error)} onRetry={() => eventsQ.refetch()} />;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SafeGAI</Text>
          <Text style={styles.headerSub}>{email} ({role})</Text>
        </View>
        <View style={styles.headerRight}>
          <FreshnessLabel lastUpdatedAt={lastUpdated} />
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>설정</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* StatusBanner */}
      <StatusBanner openCount={openCount} gwOffline={gwOffline} onPress={navigateToList} />

      {/* 최근 이벤트 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 알림</Text>
          <TouchableOpacity onPress={navigateToList}>
            <Text style={styles.moreText}>전체보기</Text>
          </TouchableOpacity>
        </View>

        {eventsQ.data?.items.length === 0 ? (
          <EmptyState message="최근 발생한 이벤트가 없습니다" />
        ) : (
          <FlatList
            data={eventsQ.data?.items ?? []}
            keyExtractor={(item) => item.eventId}
            renderItem={({ item }) => (
              <EventCard event={item} onPress={() => navigateToDetail(item.eventId)} />
            )}
            scrollEnabled={false}
          />
        )}
      </View>
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
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
  logoutBtn: { padding: spacing.xs },
  logoutText: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.inverse },
  section: { padding: spacing.base, flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.main },
  moreText: { fontSize: typography.caption.fontSize, color: colors.brand.navy },
});

/**
 * M3 알림 목록 — GET /events (status/severity 필터, cursor 페이지네이션 20건)
 * 당겨서 새로고침. EventCard 리스트.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient, ApiResponse } from '../api/client';
import { SafegaiEvent } from '../stores/eventStore';
import { EventCard } from '../components/EventCard';
import { FreshnessLabel } from '../components/FreshnessLabel';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { getErrorMessage } from '../api/client';
import { colors, typography, spacing, touchTarget } from '../theme/tokens';

type FilterStatus = '' | 'OPEN' | 'ACKED' | 'IN_PROGRESS' | 'RESOLVED';
type FilterSeverity = '' | 'DANGER' | 'WARNING' | 'FAULT' | 'INFO';

interface Props {
  navigation: any;
}

export function EventListScreen({ navigation }: Props) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('');
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('');
  const [lastUpdated] = useState(new Date());

  const query = useInfiniteQuery({
    queryKey: ['events', 'list', statusFilter, severityFilter],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params: Record<string, string | number> = { siteId: 'MAPO-01', limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      if (pageParam) params.cursor = pageParam;
      const res = await apiClient.get<ApiResponse<{ items: SafegaiEvent[]; cursor: string | null }>>(
        '/events', { params },
      );
      return res.data.data!;
    },
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30000,
  });

  const allItems = query.data?.pages.flatMap((p) => p.items) ?? [];

  const handleRefresh = useCallback(() => { query.refetch(); }, [query]);

  // 4상태
  if (query.isLoading && !query.data) return <LoadingState />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} onRetry={handleRefresh} />;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 홈</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림 목록</Text>
        <FreshnessLabel lastUpdatedAt={lastUpdated} />
      </View>

      {/* 필터 */}
      <View style={styles.filters}>
        <FilterChip label="전체" active={!statusFilter} onPress={() => setStatusFilter('')} />
        <FilterChip label="미처리" active={statusFilter === 'OPEN'} onPress={() => setStatusFilter('OPEN')} />
        <FilterChip label="조치중" active={statusFilter === 'IN_PROGRESS'} onPress={() => setStatusFilter('IN_PROGRESS')} />
        <FilterChip label="완료" active={statusFilter === 'RESOLVED'} onPress={() => setStatusFilter('RESOLVED')} />
      </View>

      {/* 리스트 */}
      {allItems.length === 0 ? (
        <EmptyState message="조건에 맞는 알림이 없습니다" />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.eventId}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => navigation.navigate('EventDetail', { eventId: item.eventId })} />
          )}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={handleRefresh} />}
          onEndReached={() => query.hasNextPage && query.fetchNextPage()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brand.navy,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl * 2,
  },
  backBtn: { padding: spacing.xs },
  backText: { fontSize: typography.body.fontSize, color: colors.text.inverse },
  headerTitle: { fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight, color: colors.text.inverse },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: touchTarget.min * 0.7,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.brand.navy, borderColor: colors.brand.navy },
  chipText: { fontSize: typography.caption.fontSize, fontWeight: typography.caption.fontWeight, color: colors.text.sub },
  chipTextActive: { color: colors.text.inverse },
  list: { padding: spacing.base },
});

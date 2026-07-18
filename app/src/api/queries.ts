/**
 * react-query 훅 — staleTime 홈·환경 30s (§6.3)
 *
 * 엔드포인트는 spec-b.md §4 그대로 (재정의 금지).
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiResponse } from './client';
import { SafegaiEvent } from '../stores/eventStore';
import { SiteState } from '../stores/envStore';

const STALE_TIME_DEFAULT = 30 * 1000; // 30초

/**
 * GET /events — 이벤트 목록 (GSI1 최신순)
 */
export function useEventsQuery(params?: {
  siteId?: string;
  status?: string;
  severity?: string;
  limit?: number;
  cursor?: string;
}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ items: SafegaiEvent[]; cursor: string | null }>>(
        '/events',
        { params: { siteId: 'MAPO-01', limit: 20, ...params } },
      );
      return res.data.data!;
    },
    staleTime: STALE_TIME_DEFAULT,
  });
}

/**
 * GET /events/{id} — 단건 상세
 */
export function useEventDetailQuery(eventId: string | null) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SafegaiEvent>>(`/events/${eventId}`);
      return res.data.data!;
    },
    enabled: !!eventId,
    staleTime: STALE_TIME_DEFAULT,
  });
}

/**
 * GET /site/state — 현장 상태 요약
 */
export function useSiteStateQuery() {
  return useQuery({
    queryKey: ['siteState'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SiteState>>('/site/state');
      return res.data.data!;
    },
    staleTime: STALE_TIME_DEFAULT,
  });
}

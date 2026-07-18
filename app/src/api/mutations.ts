/**
 * API mutations — ack, assign, resolve (§6.3, spec-b.md §4)
 * useMutation + invalidate + 409 처리. POST 재시도 금지(§6.2).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from './client';
import { Alert } from 'react-native';

interface AckResult { eventId: string; status: string }
interface AssignResult { eventId: string; status: string; assignee: string }
interface ResolveResult { eventId: string; status: string }

/**
 * POST /events/{id}/ack — 확인 (teacher↑)
 */
export function useAckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.post<ApiResponse<AckResult>>(`/events/${eventId}/ack`);
      return res.data.data!;
    },
    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
    },
    onError: (error: any) => {
      handle409(error);
    },
  });
}

/**
 * POST /events/{id}/assign — 담당 지정 (admin, 본인지정 teacher↑)
 */
export function useAssignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const res = await apiClient.post<ApiResponse<AssignResult>>(`/events/${eventId}/assign`, { userId });
      return res.data.data!;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
    },
    onError: (error: any) => {
      handle409(error);
    },
  });
}

/**
 * POST /events/{id}/resolve — 완료 (assignee·admin)
 */
export function useResolveMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, note }: { eventId: string; note?: string }) => {
      const res = await apiClient.post<ApiResponse<ResolveResult>>(`/events/${eventId}/resolve`, { note });
      return res.data.data!;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
    },
    onError: (error: any) => {
      handle409(error);
    },
  });
}

/**
 * 409 STATE_CONFLICT → '다른 관리자가 먼저 처리했습니다' 안내 + 최신 재조회
 */
function handle409(error: any) {
  if (error?.response?.status === 409) {
    Alert.alert('알림', '다른 관리자가 먼저 처리했습니다. 최신 상태를 확인합니다.');
  }
}

/**
 * API mutations — ack, assign, resolve (§6.3, spec-b.md §4)
 *
 * 낙관적 갱신(optimistic update)을 react-query 방식으로 구현:
 * - onMutate: cancelQueries → getQueryData(prev) → setQueryData(목표상태) → return {prev}
 * - onError: setQueryData(prev)로 즉시 롤백 + 409 Alert
 * - onSettled: ['event',id] + ['events'] + ['siteState'] invalidate
 *
 * POST 재시도 금지(§6.2). 엔드포인트는 spec-b.md §4 그대로.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiResponse } from './client';
import { SafegaiEvent } from '../stores/eventStore';
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
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: ['event', eventId] });
      const prev = qc.getQueryData<SafegaiEvent>(['event', eventId]);
      qc.setQueryData<SafegaiEvent | undefined>(['event', eventId], (old) =>
        old ? { ...old, status: 'ACKED' } : old,
      );
      return { prev };
    },
    onError: (error: any, eventId, context) => {
      if (context?.prev) {
        qc.setQueryData(['event', eventId], context.prev);
      }
      handle409(error);
    },
    onSettled: (_data, _error, eventId) => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
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
    onMutate: async ({ eventId }) => {
      await qc.cancelQueries({ queryKey: ['event', eventId] });
      const prev = qc.getQueryData<SafegaiEvent>(['event', eventId]);
      qc.setQueryData<SafegaiEvent | undefined>(['event', eventId], (old) =>
        old ? { ...old, status: 'IN_PROGRESS' } : old,
      );
      return { prev };
    },
    onError: (error: any, vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['event', vars.eventId], context.prev);
      }
      handle409(error);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: ['event', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
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
    onMutate: async ({ eventId }) => {
      await qc.cancelQueries({ queryKey: ['event', eventId] });
      const prev = qc.getQueryData<SafegaiEvent>(['event', eventId]);
      qc.setQueryData<SafegaiEvent | undefined>(['event', eventId], (old) =>
        old ? { ...old, status: 'RESOLVED' } : old,
      );
      return { prev };
    },
    onError: (error: any, vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['event', vars.eventId], context.prev);
      }
      handle409(error);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: ['event', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['siteState'] });
    },
  });
}

/**
 * 409 STATE_CONFLICT → '다른 관리자가 먼저 처리했습니다' 안내
 */
function handle409(error: any) {
  if (error?.response?.status === 409) {
    Alert.alert('알림', '다른 관리자가 먼저 처리했습니다. 최신 상태를 확인합니다.');
  }
}

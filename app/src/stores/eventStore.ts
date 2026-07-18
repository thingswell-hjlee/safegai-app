/**
 * eventStore — Zustand (§6.3)
 *
 * 이벤트 타입 정의만 제공. 낙관적 갱신은 react-query onMutate/onError로 처리.
 */
import { create } from 'zustand';

export interface SafegaiEvent {
  eventId: string;
  siteId: string;
  deviceId: string;
  eventType: string;
  severity: 'DANGER' | 'WARNING' | 'INFO' | 'FAULT';
  title: string;
  message: string;
  location: string;
  occurredAt: string;
  currentValue: number | null;
  unit: string;
  status: 'OPEN' | 'ACKED' | 'IN_PROGRESS' | 'RESOLVED';
  assignee?: { userId: string | null; at: string | null };
}

/**
 * 앱 전역에서 공유할 최소 상태만 유지.
 * 목록/상세 데이터는 react-query 캐시가 SSOT(Single Source of Truth).
 */
export interface EventState {
  lastActionEventId: string | null;
  setLastActionEventId: (id: string | null) => void;
}

export const useEventStore = create<EventState>((set) => ({
  lastActionEventId: null,
  setLastActionEventId: (id) => set({ lastActionEventId: id }),
}));

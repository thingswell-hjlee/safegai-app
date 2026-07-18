/**
 * eventStore — Zustand (§6.3)
 *
 * 이벤트 목록/상세 상태 관리 뼈대.
 * 낙관적 갱신·실패 롤백은 다음 모듈(M5 ActionStepper)에서 구현.
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
}

export interface EventState {
  events: SafegaiEvent[];
  selectedEvent: SafegaiEvent | null;
  setEvents: (events: SafegaiEvent[]) => void;
  setSelectedEvent: (event: SafegaiEvent | null) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  selectedEvent: null,
  setEvents: (events) => set({ events }),
  setSelectedEvent: (event) => set({ selectedEvent: event }),
}));

/**
 * eventStore — Zustand (§6.3)
 *
 * 이벤트 목록/상세 상태 관리.
 * 낙관적 갱신 + 실패 롤백.
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

export interface EventState {
  events: SafegaiEvent[];
  selectedEvent: SafegaiEvent | null;
  setEvents: (events: SafegaiEvent[]) => void;
  setSelectedEvent: (event: SafegaiEvent | null) => void;
  /** 낙관적 갱신: 이벤트 상태를 즉시 변경 (UI 반응성) */
  optimisticUpdateStatus: (eventId: string, newStatus: SafegaiEvent['status']) => SafegaiEvent | null;
  /** 실패 롤백: 이전 이벤트 상태로 복원 */
  rollbackEvent: (event: SafegaiEvent) => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedEvent: null,
  setEvents: (events) => set({ events }),
  setSelectedEvent: (event) => set({ selectedEvent: event }),

  optimisticUpdateStatus: (eventId, newStatus) => {
    const { events, selectedEvent } = get();
    const prev = events.find((e) => e.eventId === eventId) || selectedEvent;
    if (!prev) return null;

    // 목록 갱신
    set({
      events: events.map((e) =>
        e.eventId === eventId ? { ...e, status: newStatus } : e,
      ),
      selectedEvent:
        selectedEvent?.eventId === eventId
          ? { ...selectedEvent, status: newStatus }
          : selectedEvent,
    });

    return prev; // 롤백용 원본 반환
  },

  rollbackEvent: (event) => {
    const { events, selectedEvent } = get();
    set({
      events: events.map((e) => (e.eventId === event.eventId ? event : e)),
      selectedEvent:
        selectedEvent?.eventId === event.eventId ? event : selectedEvent,
    });
  },
}));

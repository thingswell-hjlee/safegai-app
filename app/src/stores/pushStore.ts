/**
 * pushStore — 인앱 배너 상태 + 딥링크 pending 관리
 */
import { create } from 'zustand';

export interface BannerMessage {
  title: string;
  body: string;
  eventId: string | null;
  severity: string;
}

export interface PushState {
  // 인앱 배너
  banner: BannerMessage | null;
  showBanner: (msg: BannerMessage) => void;
  hideBanner: () => void;

  // 딥링크 pending (미로그인 상태로 딥링크 진입 시)
  pendingDeepLink: string | null;
  setPendingDeepLink: (eventId: string | null) => void;
  consumePendingDeepLink: () => string | null;

  // 마지막 수신 시각
  lastPushAt: string | null;
  setLastPushAt: (ts: string) => void;
}

export const pushStore = create<PushState>((set, get) => ({
  banner: null,
  showBanner: (msg) => {
    set({ banner: msg, lastPushAt: new Date().toISOString() });
    // 3초 후 자동 숨김
    setTimeout(() => {
      set((state) => (state.banner === msg ? { banner: null } : {}));
    }, 3000);
  },
  hideBanner: () => set({ banner: null }),

  pendingDeepLink: null,
  setPendingDeepLink: (eventId) => set({ pendingDeepLink: eventId }),
  consumePendingDeepLink: () => {
    const link = get().pendingDeepLink;
    set({ pendingDeepLink: null });
    return link;
  },

  lastPushAt: null,
  setLastPushAt: (ts) => set({ lastPushAt: ts }),
}));

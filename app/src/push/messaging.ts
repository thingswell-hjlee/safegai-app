/**
 * FCM 메시지 처리 — spec-app-ux §7
 *
 * - 포그라운드(onMessage): 인앱 배너 3초 + react-query invalidate
 * - 백그라운드/종료(setBackgroundMessageHandler): 시스템 알림 표시 (서버 notification+data)
 * - 알림 탭 → 딥링크: data.eventId → M4 상세 이동 후 재조회
 */
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { QueryClient } from '@tanstack/react-query';
import { pushStore } from '../stores/pushStore';

/**
 * 포그라운드 메시지 리스너 등록
 * 인앱 배너 3초 표시 + ['events'], ['siteState'] invalidate.
 */
export function subscribeForegroundMessages(queryClient: QueryClient): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    // react-query invalidate
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['siteState'] });

    // 인앱 배너 3초 표시 (pushStore에 메시지 저장)
    const data = remoteMessage.data ?? {};
    const notification = remoteMessage.notification;

    pushStore.getState().showBanner({
      title: notification?.title ?? (data.title as string) ?? '',
      body: notification?.body ?? (data.body as string) ?? '',
      eventId: (data.eventId as string) ?? null,
      severity: (data.severity as string) ?? 'INFO',
    });
  });
}

/**
 * 백그라운드 메시지 핸들러 등록 (앱 엔트리에서 호출)
 * 서버가 notification+data 병행 발송하므로 시스템 알림은 자동 표시됨.
 * 이 핸들러는 추가 로직(로컬 상태 갱신 등)을 위한 것.
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // 백그라운드: 시스템 알림은 서버 payload로 자동 표시.
    // 추가 처리 필요 시 여기에 구현.
  });
}

/**
 * 딥링크 처리: 알림 탭 → eventId 추출
 */
export function extractEventIdFromMessage(
  message: FirebaseMessagingTypes.RemoteMessage | null,
): string | null {
  if (!message?.data?.eventId) return null;
  return message.data.eventId as string;
}

/**
 * 종료 상태에서 알림 탭으로 앱 열림 — 초기 알림 확인
 */
export async function getInitialDeepLink(): Promise<string | null> {
  const message = await messaging().getInitialNotification();
  return extractEventIdFromMessage(message);
}

/**
 * 백그라운드 상태에서 알림 탭 리스너
 */
export function subscribeNotificationOpened(
  onNavigate: (eventId: string) => void,
): () => void {
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    const eventId = extractEventIdFromMessage(remoteMessage);
    if (eventId) {
      onNavigate(eventId);
    }
  });
}

/**
 * Android 알림 채널 설정 — push-policy §4
 *
 * @notifee/react-native로 실제 채널 생성:
 * - danger_channel: importance MAX (무음 불가, 강한 소리)
 * - warning_channel: importance DEFAULT
 * - fault_channel: importance DEFAULT
 * - info_channel: importance LOW
 *
 * 서버 payload의 android.notification.channelId와 매칭.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

/**
 * Android 알림 채널 4개 생성 (앱 시작 시 호출)
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: 'danger_channel',
    name: '위험 알림',
    description: '즉각 대응이 필요한 위험 이벤트',
    importance: AndroidImportance.HIGH, // MAX에 해당 (notifee에서 HIGH가 최대)
    sound: 'default',
    vibration: true,
    bypassDnd: true, // 무음 모드에서도 알림
  });

  await notifee.createChannel({
    id: 'warning_channel',
    name: '주의 알림',
    description: '주의가 필요한 이벤트',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });

  await notifee.createChannel({
    id: 'fault_channel',
    name: '장애 알림',
    description: '시스템 장애 알림',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });

  await notifee.createChannel({
    id: 'info_channel',
    name: '정보 알림',
    description: '일반 정보 알림',
    importance: AndroidImportance.LOW,
  });
}

/**
 * Android 13+ POST_NOTIFICATIONS 권한 요청
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return granted;
}

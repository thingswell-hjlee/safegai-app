/**
 * Android 알림 채널 설정 — push-policy §4
 *
 * 등급별 채널 4개:
 * - danger_channel: importance MAX (무음 불가, 강한 소리)
 * - warning_channel: importance DEFAULT
 * - fault_channel: importance DEFAULT
 * - info_channel: importance LOW
 *
 * 서버 payload의 android.notification.channelId와 매칭.
 */
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

/**
 * Android 알림 채널 생성 (API 26+)
 * React Native Firebase는 Android에서 자동으로 채널을 관리하지만,
 * 사전 정의가 필요한 경우 native 코드나 notifee를 사용.
 * 여기서는 firebase messaging의 채널 설정을 문서화하고,
 * Android native 단에서 채널을 생성하도록 안내한다.
 *
 * 실제 채널 생성은 Android MainApplication에서 수행.
 * 이 함수는 앱 초기화 시 호출하여 iOS 관련 설정을 처리한다.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'ios') {
    // iOS: 알림 표시를 위한 포그라운드 설정
    await messaging().setAutoInitEnabled(true);
  }
  // Android 채널은 native 코드에서 생성 (아래 ANDROID_SETUP.md 참조)
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

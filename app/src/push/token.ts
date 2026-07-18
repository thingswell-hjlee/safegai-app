/**
 * FCM 토큰 수명주기 — push-policy §5
 *
 * - 로그인 성공 시: FCM 토큰 획득 → POST /push/token (멱등).
 *   마지막 등록 7일 경과 시 재등록.
 * - onTokenRefresh → 재등록.
 * - 로그아웃 시: DELETE /push/token 후 로컬 토큰 정리.
 */
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { Platform } from 'react-native';

const TOKEN_REGISTERED_AT_KEY = 'fcm_token_registered_at';
const TOKEN_VALUE_KEY = 'fcm_token_value';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * FCM 토큰 획득 및 서버 등록 (로그인 후 호출)
 */
export async function registerPushToken(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (!token) return;

    // 7일 이내 등록 이력이 있고 같은 토큰이면 스킵
    const lastRegistered = await AsyncStorage.getItem(TOKEN_REGISTERED_AT_KEY);
    const lastToken = await AsyncStorage.getItem(TOKEN_VALUE_KEY);
    if (
      lastRegistered &&
      lastToken === token &&
      Date.now() - parseInt(lastRegistered, 10) < SEVEN_DAYS_MS
    ) {
      return; // 7일 미경과 + 동일 토큰 → 재등록 불필요
    }

    // POST /push/token (멱등)
    await apiClient.post('/push/token', {
      token,
      device: Platform.OS,
    });

    // 등록 시각·토큰 로컬 기록 (표시데이터만 AsyncStorage 허용)
    await AsyncStorage.setItem(TOKEN_REGISTERED_AT_KEY, Date.now().toString());
    await AsyncStorage.setItem(TOKEN_VALUE_KEY, token);
  } catch (err) {
    console.warn('[push/token] registerPushToken failed:', err);
  }
}

/**
 * onTokenRefresh 리스너 등록
 */
export function subscribeTokenRefresh(): () => void {
  return messaging().onTokenRefresh(async (newToken) => {
    try {
      await apiClient.post('/push/token', {
        token: newToken,
        device: Platform.OS,
      });
      await AsyncStorage.setItem(TOKEN_REGISTERED_AT_KEY, Date.now().toString());
      await AsyncStorage.setItem(TOKEN_VALUE_KEY, newToken);
    } catch (err) {
      console.warn('[push/token] onTokenRefresh registration failed:', err);
    }
  });
}

/**
 * 로그아웃 시 토큰 해제
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_VALUE_KEY);
    if (token) {
      await apiClient.delete('/push/token', { data: { token } });
    }
  } catch (err) {
    console.warn('[push/token] unregisterPushToken failed:', err);
  }
  await AsyncStorage.removeItem(TOKEN_REGISTERED_AT_KEY);
  await AsyncStorage.removeItem(TOKEN_VALUE_KEY);
}

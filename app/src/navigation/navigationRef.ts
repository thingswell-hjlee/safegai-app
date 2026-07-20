/**
 * 전역 NavigationContainer ref — 딥링크·인앱배너에서 화면 이동용
 * (App.tsx의 NavigationContainer에 연결됨)
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** 네비게이션 준비됐을 때만 이동 (준비 전 호출은 무시) */
export function navigateTo(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-ignore — 화면 이름은 RootNavigator 정의 기준
    navigationRef.navigate(name, params);
  }
}
